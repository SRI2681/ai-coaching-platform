# backend/api/assessments.py
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services import assessment_engine as ae
from services.candidate_data import (
    baseline_is_complete,
    build_baseline_context,
    format_baseline_result,
    get_active_goal,
    get_completed_baseline,
    get_in_progress_baseline,
    mark_baseline_complete,
)
from services.supabase_client import supabase

router = APIRouter()

BASELINE_QUESTION_COUNT = 10
PROGRESS_QUESTION_COUNT = 8


class StartReq(BaseModel):
    candidate_id: str
    goal: str
    type: str = 'baseline'  # 'baseline' | 'midpoint' | 'final'
    goal_id: Optional[str] = None


class AnswerReq(BaseModel):
    assessment_id: str
    question: str
    answer: str
    tier: int
    skill_target: Optional[str] = None
    competency_lens: Optional[str] = None


def _extract_goal(answers: list) -> str:
    for item in answers:
        if item.get('_meta') and item.get('goal'):
            return item['goal']
    return 'Develop executive leadership'


def _scored_answers(answers: list) -> list:
    return [a for a in answers if not a.get('_meta')]


def _current_question(assessment: dict) -> dict:
    questions = assessment.get('questions') or []
    return questions[-1] if questions else {}


def _resume_response(assessment: dict) -> dict:
    question = _current_question(assessment)
    scored = _scored_answers(assessment.get('answers') or [])
    return {
        'assessment_id': assessment['id'],
        'question': question,
        'tier': assessment.get('difficulty_tier', question.get('tier', 1)),
        'resumed': True,
        'questions_answered': len(scored),
        'already_completed': False,
    }


def _starting_tier(candidate_id: str, assessment_type: str) -> int:
    if assessment_type == 'baseline':
        return 1
    row = (
        supabase.table('candidates')
        .select('current_cdl')
        .eq('id', candidate_id)
        .single()
        .execute()
        .data
    )
    cdl = row.get('current_cdl', 1.0) if row else 1.0
    return ae.starting_tier_from_cdl(cdl, assessment_type)


def _load_baseline_context(candidate_id: str) -> Optional[dict[str, Any]]:
    row = get_completed_baseline(candidate_id)
    return build_baseline_context(row) if row else None


def _question_limit(assessment_type: str) -> int:
    return BASELINE_QUESTION_COUNT if assessment_type == 'baseline' else PROGRESS_QUESTION_COUNT


@router.get('/assessments/baseline/{candidate_id}')
def get_baseline(candidate_id: str):
    row = get_completed_baseline(candidate_id)
    if not row:
        raise HTTPException(status_code=404, detail='Baseline assessment not completed yet.')
    return format_baseline_result(row)


@router.get('/assessments/status/{candidate_id}')
def assessment_status(candidate_id: str):
    completed = get_completed_baseline(candidate_id)
    in_progress = get_in_progress_baseline(candidate_id)
    return {
        'baselineCompleted': completed is not None,
        'baseline': format_baseline_result(completed) if completed else None,
        'baselineInProgress': bool(in_progress),
        'inProgressAssessmentId': in_progress['id'] if in_progress else None,
        'canTakeProgressTest': completed is not None,
    }


@router.post('/assessments/start')
def start(req: StartReq):
    goal_row = get_active_goal(req.candidate_id)
    goal_id = req.goal_id or (goal_row['id'] if goal_row else None)
    goal_text = req.goal or (
        (goal_row.get('title') or goal_row.get('goal_text')) if goal_row else ''
    ) or 'Develop executive leadership'

    if req.type == 'baseline':
        completed = get_completed_baseline(req.candidate_id)
        if completed:
            return {
                'already_completed': True,
                'assessment_id': completed['id'],
                'result': format_baseline_result(completed),
            }

        in_progress = get_in_progress_baseline(req.candidate_id)
        if in_progress:
            return _resume_response(in_progress)
    else:
        if not baseline_is_complete(req.candidate_id):
            raise HTTPException(
                status_code=400,
                detail='Complete your one-time baseline assessment before taking a progress test.',
            )

    tier = _starting_tier(req.candidate_id, req.type)
    baseline_context = _load_baseline_context(req.candidate_id) if req.type != 'baseline' else None

    first_q = ae.generate_question(
        goal_text,
        tier=tier,
        prior_answers=[],
        assessment_type=req.type,
        baseline_context=baseline_context,
    )

    row = (
        supabase.table('assessments')
        .insert({
            'candidate_id': req.candidate_id,
            'goal_id': goal_id,
            'type': req.type,
            'difficulty_tier': tier,
            'questions': [first_q],
            'answers': [{'_meta': True, 'goal': goal_text, 'goal_id': goal_id}],
        })
        .execute()
        .data[0]
    )
    return {
        'assessment_id': row['id'],
        'question': first_q,
        'tier': tier,
        'already_completed': False,
        'resumed': False,
    }


@router.post('/assessments/answer')
def answer(req: AnswerReq):
    assessment = (
        supabase.table('assessments')
        .select('*')
        .eq('id', req.assessment_id)
        .single()
        .execute()
        .data
    )
    if not assessment:
        raise HTTPException(status_code=404, detail='Assessment not found')

    if assessment.get('type') == 'baseline' and assessment.get('status') == 'completed':
        raise HTTPException(status_code=409, detail='Baseline is locked after completion.')

    assessment_type = assessment.get('type', 'baseline')
    answers = assessment.get('answers') or []
    goal = _extract_goal(answers)
    baseline_context = _load_baseline_context(assessment['candidate_id'])

    current_q = _current_question(assessment)
    lens = req.competency_lens or current_q.get('competency_lens', 'executive')
    skill_target = req.skill_target or current_q.get('skill_target', '')

    scores = ae.score_answer(
        req.question,
        req.answer,
        assessment_type=assessment_type,
        lens=lens,
        skill_target=skill_target,
        goal=goal,
        gaps=(baseline_context or {}).get('gaps'),
    )

    composite = round(
        scores['strategic_thinking_score'] * 0.4
        + scores['operational_accountability_score'] * 0.4
        + scores['influence_communication_score'] * 0.2
    )
    tier = ae.next_tier(req.tier, composite)

    scored = _scored_answers(answers)
    scored.append({
        'q': req.question,
        'answer': req.answer,
        'scores': scores,
        'lens': lens,
        'skill_target': skill_target,
    })

    meta = [a for a in answers if a.get('_meta')]
    answers = meta + scored
    limit = _question_limit(assessment_type)

    if len(scored) >= limit:
        result = ae.finalize_assessment(
            scored,
            assessment_type=assessment_type,
            goal=goal,
            baseline_context=baseline_context,
        )
        update_payload: dict[str, Any] = {
            'status': 'completed',
            'answers': answers,
            'completed_at': datetime.now(timezone.utc).isoformat(),
            **{k: v for k, v in result.items() if k != 'methodology_profile' and k != 'goal_progress_pct'},
        }
        if result.get('methodology_profile'):
            update_payload['methodology_profile'] = result['methodology_profile']
        if result.get('goal_progress_pct') is not None:
            update_payload['goal_progress_pct'] = result['goal_progress_pct']

        supabase.table('assessments').update(update_payload).eq(
            'id', req.assessment_id
        ).execute()

        if assessment_type == 'baseline':
            mark_baseline_complete(assessment['candidate_id'])

        return {'done': True, 'result': result}

    next_q = ae.generate_question(
        goal,
        tier,
        prior_answers=scored,
        assessment_type=assessment_type,
        baseline_context=baseline_context,
    )
    supabase.table('assessments').update({
        'answers': answers,
        'difficulty_tier': tier,
        'questions': (assessment.get('questions') or []) + [next_q],
    }).eq('id', req.assessment_id).execute()
    return {'done': False, 'question': next_q, 'tier': tier}
