from typing import Any, Optional

from fastapi import APIRouter

from services.supabase_client import supabase

router = APIRouter()


def _completed_assessments(candidate_id: str) -> list[dict]:
    return (
        supabase.table('assessments')
        .select('*')
        .eq('candidate_id', candidate_id)
        .eq('status', 'completed')
        .order('completed_at')
        .execute()
        .data
        or []
    )


def _active_goal_title(candidate_id: str) -> str:
    rows = (
        supabase.table('goals')
        .select('title, goal_text')
        .eq('candidate_id', candidate_id)
        .eq('status', 'active')
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        return ''
    row = rows[0]
    return row.get('title') or row.get('goal_text') or ''


def _action_plan_completion(candidate_id: str) -> int:
    plans = (
        supabase.table('action_plans')
        .select('id')
        .eq('candidate_id', candidate_id)
        .eq('status', 'active')
        .order('created_at', desc=True)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not plans:
        return 0

    items = (
        supabase.table('action_items')
        .select('is_completed')
        .eq('action_plan_id', plans[0]['id'])
        .execute()
        .data
        or []
    )
    if not items:
        return 0
    done = sum(1 for i in items if i.get('is_completed'))
    return round((done / len(items)) * 100)


def _session_count(candidate_id: str) -> int:
    rows = (
        supabase.table('coaching_sessions')
        .select('id')
        .eq('candidate_id', candidate_id)
        .eq('status', 'completed')
        .execute()
        .data
        or []
    )
    return len(rows)


def _pick_baseline(assessments: list[dict]) -> Optional[dict]:
    baselines = [a for a in assessments if a.get('type') == 'baseline']
    return baselines[0] if baselines else None


def _pick_current(assessments: list[dict]) -> Optional[dict]:
    if not assessments:
        return None
    for assessment_type in ('final', 'midpoint', 'baseline'):
        matches = [a for a in assessments if a.get('type') == assessment_type]
        if matches:
            return matches[-1]
    return assessments[-1]


def compute_progress_metrics(candidate_id: str) -> dict[str, Any]:
    """Baseline vs current score delta, trends, plan completion, session count."""
    assessments = _completed_assessments(candidate_id)
    baseline_row = _pick_baseline(assessments)
    current_row = _pick_current(assessments)

    baseline_score = int(baseline_row['score']) if baseline_row and baseline_row.get('score') is not None else 0
    current_score = int(current_row['score']) if current_row and current_row.get('score') is not None else baseline_score
    score_delta = current_score - baseline_score

    if baseline_score > 0:
        progress_percent = round((score_delta / baseline_score) * 100)
    else:
        progress_percent = current_score

    assessment_trends = [
        {
            'type': a.get('type'),
            'score': a.get('score'),
            'level': a.get('level'),
            'date': a.get('completed_at') or a.get('created_at'),
        }
        for a in assessments
    ]

    progress_chart = [
        {
            'type': a.get('type'),
            'score': a.get('score') or 0,
            'date': a.get('completed_at') or a.get('created_at'),
            'goalProgressPct': a.get('goal_progress_pct'),
        }
        for a in assessments
    ]

    latest_progress = next(
        (a for a in reversed(assessments) if a.get('type') in ('midpoint', 'final')),
        None,
    )

    return {
        'baselineScore': baseline_score,
        'currentScore': current_score,
        'scoreDelta': score_delta,
        'progressPercent': progress_percent,
        'goalProgressPct': latest_progress.get('goal_progress_pct') if latest_progress else None,
        'assessmentTrends': assessment_trends,
        'progressChart': progress_chart,
        'actionPlanCompletionPercent': _action_plan_completion(candidate_id),
        'sessionCount': _session_count(candidate_id),
        'goalTitle': _active_goal_title(candidate_id),
        'competencies': _competency_snapshot(current_row or baseline_row),
    }


def _competency_snapshot(row: Optional[dict]) -> dict[str, Optional[int]]:
    if not row:
        return {
            'strategic': None,
            'operational': None,
            'influence': None,
        }
    return {
        'strategic': row.get('strategic_score'),
        'operational': row.get('operational_score'),
        'influence': row.get('influence_score'),
    }


@router.get('/progress/{candidate_id}')
def get_progress(candidate_id: str):
    return compute_progress_metrics(candidate_id)
