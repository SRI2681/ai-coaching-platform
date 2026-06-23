# backend/services/assessment_engine.py
import json
import logging
import re
from typing import Any, Optional

from services.ai_engine import client

logger = logging.getLogger(__name__)

MODEL = 'claude-haiku-4-5-20251001'

BASELINE_GEN_QUESTION_PROMPT = (
    'You are a master executive assessor synthesizing THREE methodologies:\n'
    '1) CliftonStrengths — probe innate talent themes (e.g. Strategic, Achiever, '
    'Relator, Command, Analytical) and how they show up at work.\n'
    '2) DISC — probe behavioral style under pressure across Dominance, Influence, '
    'Steadiness, and Conscientiousness.\n'
    '3) ActionCOACH/FocalPoint — executive competencies: strategic thinking, '
    'operational accountability, influence & communication.\n\n'
    "Generate ONE baseline diagnostic question at tier {tier} "
    '(1=foundational self-awareness, 2=applied leadership scenarios, '
    '3=executive/ambiguous judgment) for the candidate goal: "{goal}".\n'
    'Rotate competency_lens across clifton, disc, and executive — avoid repeating '
    'the same lens twice in a row when prior context shows recent lenses used.\n'
    'The question must be answerable in 2-4 spoken sentences.\n'
    'Prior Q&A and inferred signals:\n{prior_context}\n'
    'Return ONLY valid JSON, no code fences: '
    '{{"question":"...","competency_lens":"clifton|disc|executive",'
    '"competency_focus":"strategic|operational|influence","tier":{tier}}}'
)

PROGRESS_GEN_QUESTION_PROMPT = (
    'You are administering a GMAT-style computerized adaptive test (CAT) to measure '
    'how much a leader has BUILT skills toward their coaching goal since baseline.\n\n'
    'GOAL: {goal}\n'
    'BASELINE LEVEL: {level} (score {baseline_score}/100)\n'
    'BASELINE GAPS TO CLOSE: {gaps}\n'
    'BASELINE STRENGTHS: {strengths}\n'
    'Clifton themes from baseline: {clifton_themes}\n'
    'DISC profile from baseline: {disc_profile}\n\n'
    'Tier {tier}: 1=apply baseline skills, 2=complex stakeholder scenarios, '
    '3=executive judgment under ambiguity.\n'
    'Each question must test demonstrable skill GROWTH toward the goal — not personality '
    'rediscovery. Adapt like GMAT: if prior answers show mastery, increase difficulty; '
    'if weak, probe the specific gap with a targeted scenario.\n'
    'Prior progress-test Q&A:\n{prior_context}\n'
    'Return ONLY valid JSON, no code fences: '
    '{{"question":"...","skill_target":"which gap or goal skill this tests",'
    '"competency_focus":"strategic|operational|influence","tier":{tier}}}'
)

BASELINE_SCORE_PROMPT = (
    'You are an expert assessor combining CliftonStrengths, DISC, and ActionCOACH/FocalPoint. '
    'Score the candidate answer on executive competencies (0-100 each): Strategic Thinking, '
    'Operational Accountability, Influence & Communication.\n'
    'Also infer DISC behavioral signals (0-100 each): dominance, influence, steadiness, '
    'conscientiousness, and name 1-2 Clifton-style talent themes evidenced in the answer.\n'
    'Question: {question}. Lens: {lens}.\n'
    'Return ONLY valid JSON, no code fences: '
    '{{"strategic_thinking_score":0,"operational_accountability_score":0,'
    '"influence_communication_score":0,'
    '"disc_scores":{{"dominance":0,"influence":0,"steadiness":0,"conscientiousness":0}},'
    '"clifton_themes":["..."],"note":"one sentence"}}'
)

PROGRESS_SCORE_PROMPT = (
    'You are scoring a GMAT-style progress test answer measuring skill growth toward a goal. '
    'Goal: {goal}. Skill being tested: {skill_target}. Baseline gap context: {gaps}.\n'
    'Score executive competencies (0-100 each): Strategic Thinking, Operational '
    'Accountability, Influence & Communication. Also rate goal_progress (0-100): how much '
    'this answer demonstrates building the target skill since baseline.\n'
    'Question: {question}.\n'
    'Return ONLY valid JSON, no code fences: '
    '{{"strategic_thinking_score":0,"operational_accountability_score":0,'
    '"influence_communication_score":0,"goal_progress":0,"note":"one sentence"}}'
)

BASELINE_FINALIZE_PROMPT = (
    'You are synthesizing a ONE-TIME baseline leadership profile using CliftonStrengths, '
    'DISC, and ActionCOACH/FocalPoint executive competencies.\n'
    'From the full Q&A history below, produce a robust baseline stored for all future '
    'progress measurement. Compute overall score: Strategic 40%, Operational 40%, '
    'Influence 20%. Map level: Foundation (<40), Developing (40-59), Practitioner '
    '(60-79), Advanced (80+).\n\n'
    'Q&A history:\n{history}\n\n'
    'Return ONLY valid JSON, no code fences: '
    '{{"score":0,"strategic_score":0,"operational_score":0,"influence_score":0,'
    '"level":"Foundation|Developing|Practitioner|Advanced",'
    '"strengths":["..."],'
    '"gaps":["..."],'
    '"methodology_profile":{{'
    '"clifton_themes":["top 4-6 talent themes"],'
    '"disc_profile":{{"dominance":0,"influence":0,"steadiness":0,"conscientiousness":0}},'
    '"disc_style":"e.g. Influential Driver",'
    '"executive_summary":"2 sentences tying Clifton+DISC to executive readiness"'
    '}}}}'
)

PROGRESS_FINALIZE_PROMPT = (
    'You are finalizing a GMAT-style progress test measuring skill growth toward a goal.\n'
    'Goal: {goal}. Baseline score: {baseline_score}. Baseline gaps: {gaps}.\n\n'
    'Q&A history:\n{history}\n\n'
    'Compute progress score (0-100) reflecting skill built toward the goal since baseline. '
    'Compute goal_progress_pct: estimated % of goal skill gap closed since baseline.\n'
    'Return ONLY valid JSON, no code fences: '
    '{{"score":0,"strategic_score":0,"operational_score":0,"influence_score":0,'
    '"level":"Foundation|Developing|Practitioner|Advanced",'
    '"goal_progress_pct":0,'
    '"strengths":["skills improved since baseline"],'
    '"gaps":["remaining gaps toward goal"]}}'
)


def _parse_json(text: str) -> dict:
    cleaned = text.strip()
    fence = re.search(r'```(?:json)?\s*([\s\S]*?)```', cleaned)
    if fence:
        cleaned = fence.group(1).strip()
    return json.loads(cleaned)


def _format_prior_context(prior_answers: list[dict]) -> str:
    if not prior_answers:
        return 'None yet — this is the first question.'
    lines = []
    for idx, item in enumerate(prior_answers, start=1):
        scores = item.get('scores') or {}
        composite = round(
            scores.get('strategic_thinking_score', 0) * 0.4
            + scores.get('operational_accountability_score', 0) * 0.4
            + scores.get('influence_communication_score', 0) * 0.2
        )
        lens = item.get('lens') or scores.get('competency_lens', '')
        lines.append(
            f"{idx}. Q: {item.get('q', '')}\n"
            f"   A: {item.get('answer', '')}\n"
            f"   Lens: {lens} | composite={composite}"
            f"{'; goal_progress=' + str(scores.get('goal_progress')) if scores.get('goal_progress') is not None else ''}"
        )
    return '\n'.join(lines)


def _format_baseline_for_progress(baseline_context: Optional[dict]) -> dict[str, str]:
    ctx = baseline_context or {}
    profile = ctx.get('methodology_profile') or {}
    disc = profile.get('disc_profile') or ctx.get('disc_profile') or {}
    return {
        'level': str(ctx.get('level', 'Developing')),
        'baseline_score': str(ctx.get('score', 0)),
        'gaps': str(ctx.get('gaps', [])),
        'strengths': str(ctx.get('strengths', [])),
        'clifton_themes': str(profile.get('clifton_themes') or ctx.get('clifton_themes', [])),
        'disc_profile': str(disc),
    }


def generate_question(
    goal: str,
    tier: int,
    prior_answers: Optional[list[dict]] = None,
    assessment_type: str = 'baseline',
    baseline_context: Optional[dict] = None,
) -> dict:
    prior_context = _format_prior_context(prior_answers or [])
    is_baseline = assessment_type == 'baseline'

    try:
        if is_baseline:
            system = BASELINE_GEN_QUESTION_PROMPT.format(
                tier=tier, goal=goal, prior_context=prior_context
            )
        else:
            b = _format_baseline_for_progress(baseline_context)
            system = PROGRESS_GEN_QUESTION_PROMPT.format(
                tier=tier,
                goal=goal,
                prior_context=prior_context,
                level=b['level'],
                baseline_score=b['baseline_score'],
                gaps=b['gaps'],
                strengths=b['strengths'],
                clifton_themes=b['clifton_themes'],
                disc_profile=b['disc_profile'],
            )
        resp = client.messages.create(
            model=MODEL,
            max_tokens=350,
            system=system,
            messages=[{'role': 'user', 'content': 'Generate the next adaptive question.'}],
        )
        question = _parse_json(resp.content[0].text)
        if 'competency_lens' in question:
            question['competency_focus'] = question.get('competency_focus') or question['competency_lens']
        return question
    except Exception as exc:
        logger.warning('generate_question fallback: %s', exc)
        return {
            'question': (
                'Describe a recent decision where you had to balance '
                'short-term results against long-term strategy.'
            ),
            'competency_focus': 'strategic',
            'competency_lens': 'executive',
            'tier': tier,
        }


def score_answer(
    question: str,
    answer: str,
    assessment_type: str = 'baseline',
    lens: str = 'executive',
    skill_target: str = '',
    goal: str = '',
    gaps: Optional[list] = None,
) -> dict:
    is_baseline = assessment_type == 'baseline'
    try:
        if is_baseline:
            system = BASELINE_SCORE_PROMPT.format(question=question, lens=lens)
        else:
            system = PROGRESS_SCORE_PROMPT.format(
                question=question,
                goal=goal,
                skill_target=skill_target or 'goal skill',
                gaps=str(gaps or []),
            )
        resp = client.messages.create(
            model=MODEL,
            max_tokens=300,
            system=system,
            messages=[{'role': 'user', 'content': answer}],
        )
        return _parse_json(resp.content[0].text)
    except Exception as exc:
        logger.warning('score_answer fallback: %s', exc)
        return {
            'strategic_thinking_score': 70,
            'operational_accountability_score': 70,
            'influence_communication_score': 70,
            'note': 'fallback',
        }


def next_tier(current_tier: int, last_composite: float) -> int:
    """GMAT-style CAT difficulty adjustment."""
    if last_composite >= 80:
        return min(current_tier + 1, 3)
    if last_composite < 55:
        return max(current_tier - 1, 1)
    return current_tier


def _rule_finalize(answers: list) -> dict[str, Any]:
    def avg(key: str) -> int:
        vals = [a['scores'][key] for a in answers if a.get('scores') and key in a['scores']]
        return round(sum(vals) / len(vals)) if vals else 70

    strat = avg('strategic_thinking_score')
    oper = avg('operational_accountability_score')
    infl = avg('influence_communication_score')
    overall = round(strat * 0.4 + oper * 0.4 + infl * 0.2)
    level = (
        'Foundation'
        if overall < 40
        else 'Developing'
        if overall < 60
        else 'Practitioner'
        if overall < 80
        else 'Advanced'
    )
    strengths = [
        name
        for name, v in [
            ('Strategic Thinking', strat),
            ('Operational Accountability', oper),
            ('Influence & Communication', infl),
        ]
        if v >= 75
    ]
    gaps = [
        name
        for name, v in [
            ('Strategic Thinking', strat),
            ('Operational Accountability', oper),
            ('Influence & Communication', infl),
        ]
        if v < 60
    ]
    return {
        'score': overall,
        'strategic_score': strat,
        'operational_score': oper,
        'influence_score': infl,
        'level': level,
        'strengths': strengths or ['Balanced profile'],
        'gaps': gaps or ['No critical gaps'],
        'methodology_profile': {},
    }


def finalize_assessment(
    answers: list,
    assessment_type: str = 'baseline',
    goal: str = '',
    baseline_context: Optional[dict] = None,
) -> dict[str, Any]:
    history = _format_prior_context(answers)
    is_baseline = assessment_type == 'baseline'

    try:
        if is_baseline:
            system = BASELINE_FINALIZE_PROMPT.format(history=history)
        else:
            b = _format_baseline_for_progress(baseline_context)
            system = PROGRESS_FINALIZE_PROMPT.format(
                history=history,
                goal=goal,
                baseline_score=b['baseline_score'],
                gaps=b['gaps'],
            )
        resp = client.messages.create(
            model=MODEL,
            max_tokens=600,
            system=system,
            messages=[{'role': 'user', 'content': 'Finalize the assessment.'}],
        )
        result = _parse_json(resp.content[0].text)
        payload: dict[str, Any] = {
            'score': int(result.get('score', 0)),
            'strategic_score': int(result.get('strategic_score', 0)),
            'operational_score': int(result.get('operational_score', 0)),
            'influence_score': int(result.get('influence_score', 0)),
            'level': result.get('level', 'Developing'),
            'strengths': result.get('strengths') or ['Balanced profile'],
            'gaps': result.get('gaps') or ['No critical gaps'],
        }
        if is_baseline:
            payload['methodology_profile'] = result.get('methodology_profile') or {}
        else:
            payload['goal_progress_pct'] = int(result.get('goal_progress_pct', 0))
        return payload
    except Exception as exc:
        logger.warning('finalize_assessment AI fallback: %s', exc)
        fallback = _rule_finalize(answers)
        if not is_baseline:
            fallback['goal_progress_pct'] = max(0, fallback['score'] - int(
                (baseline_context or {}).get('score', 0)
            ))
        return fallback


def starting_tier_from_cdl(current_cdl: float, assessment_type: str = 'baseline') -> int:
    if assessment_type == 'baseline':
        return 1
    return min(3, max(1, round(float(current_cdl or 1.0))))
