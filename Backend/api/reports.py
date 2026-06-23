import json
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from api.progress import compute_progress_metrics
from services.ai_engine import client
from services.supabase_client import supabase

router = APIRouter()

MODEL = 'claude-haiku-4-5-20251001'

REPORT_PROMPT = (
    'You are an executive coach. Write a concise final coaching report. '
    'Goal: {goal}. Baseline score: {baseline}. Final score: {final}. '
    'Per-competency: {competencies}. Sessions completed: {sessions}. '
    'Return ONLY valid JSON, no code fences: '
    '{{"summary":"3-4 sentences","strengths":["..."],'
    '"development_areas":["..."],"final_readiness_level":"..."}}'
)


class GenerateReportRequest(BaseModel):
    candidate_id: str
    org_id: Optional[str] = None


def _format_competencies(competencies: dict[str, Any]) -> str:
    parts = []
    for key, label in (
        ('strategic', 'Strategic Thinking'),
        ('operational', 'Operational Accountability'),
        ('influence', 'Influence & Communication'),
    ):
        value = competencies.get(key)
        if value is not None:
            parts.append(f'{label}: {value}')
    return ', '.join(parts) if parts else 'Not available'


def _synthesize_report(metrics: dict[str, Any]) -> dict[str, Any]:
    try:
        resp = client.messages.create(
            model=MODEL,
            max_tokens=500,
            system=REPORT_PROMPT.format(
                goal=metrics.get('goalTitle') or 'Executive leadership development',
                baseline=metrics.get('baselineScore', 0),
                final=metrics.get('currentScore', 0),
                competencies=_format_competencies(metrics.get('competencies') or {}),
                sessions=metrics.get('sessionCount', 0),
            ),
            messages=[{'role': 'user', 'content': 'Write the final report.'}],
        )
        ai = json.loads(resp.content[0].text)
    except Exception:
        ai = {
            'summary': (
                f"Over the coaching journey, the leader progressed from a baseline of "
                f"{metrics.get('baselineScore', 0)} to a current score of "
                f"{metrics.get('currentScore', 0)} across {metrics.get('sessionCount', 0)} sessions."
            ),
            'strengths': ['Consistent engagement with coaching'],
            'development_areas': ['Continue building executive presence'],
            'final_readiness_level': 'Developing',
        }

    assessment_results = [
        {'type': t.get('type'), 'score': t.get('score')}
        for t in metrics.get('assessmentTrends', [])
    ]

    return {
        'goalTitle': metrics.get('goalTitle') or '',
        'baselineScore': metrics.get('baselineScore', 0),
        'finalScore': metrics.get('currentScore', 0),
        'assessmentResults': assessment_results,
        'progressChart': metrics.get('progressChart', []),
        'strengths': ai.get('strengths', []),
        'developmentAreas': ai.get('development_areas', []),
        'finalReadinessLevel': ai.get('final_readiness_level', ''),
        'summary': ai.get('summary', ''),
        'sessionCount': metrics.get('sessionCount', 0),
        'actionPlanCompletionPercent': metrics.get('actionPlanCompletionPercent', 0),
        'progressPercent': metrics.get('progressPercent', 0),
        'scoreDelta': metrics.get('scoreDelta', 0),
    }


def _latest_report(candidate_id: str) -> Optional[dict]:
    rows = (
        supabase.table('reports')
        .select('*')
        .eq('candidate_id', candidate_id)
        .eq('type', 'candidate')
        .order('created_at', desc=True)
        .limit(1)
        .execute()
        .data
        or []
    )
    return rows[0] if rows else None


@router.post('/reports/generate')
def generate_report(req: GenerateReportRequest):
    metrics = compute_progress_metrics(req.candidate_id)
    if not metrics.get('assessmentTrends'):
        raise HTTPException(
            status_code=400,
            detail='Complete at least a baseline assessment before generating a report.',
        )

    payload = _synthesize_report(metrics)
    row = (
        supabase.table('reports')
        .insert({
            'candidate_id': req.candidate_id,
            'org_id': req.org_id,
            'type': 'candidate',
            'payload': payload,
        })
        .execute()
        .data[0]
    )
    return {
        'report_id': row['id'],
        'payload': payload,
        'created_at': row.get('created_at'),
    }


@router.get('/reports/{candidate_id}')
def get_report(candidate_id: str):
    report = _latest_report(candidate_id)
    if not report:
        raise HTTPException(status_code=404, detail='No saved report found')
    return {
        'report_id': report['id'],
        'payload': report.get('payload') or {},
        'created_at': report.get('created_at'),
    }
