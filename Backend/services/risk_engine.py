"""Risk flagging for org roster (Section 6.3)."""

from datetime import datetime, timedelta, timezone

from api.progress import compute_progress_metrics
from services.supabase_client import supabase


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


def _recent_session_within_days(candidate_id: str, days: int = 14) -> bool:
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    rows = (
        supabase.table('coaching_sessions')
        .select('id, completed_at, created_at')
        .eq('candidate_id', candidate_id)
        .eq('status', 'completed')
        .execute()
        .data
        or []
    )
    for row in rows:
        ts = row.get('completed_at') or row.get('created_at')
        if ts and str(ts) >= cutoff[:10]:
            return True
    return False


def compute_risk_level(candidate_id: str) -> str:
    """
    needs_attention: no session in 14 days OR action-plan completion < 25%
    at_risk: improvement since baseline <= 0 (when baseline exists)
    else: on_track
    """
    metrics = compute_progress_metrics(candidate_id)
    baseline = metrics.get('baselineScore') or 0
    delta = metrics.get('scoreDelta', 0)
    completion = _action_plan_completion(candidate_id)
    has_recent_session = _recent_session_within_days(candidate_id)

    if baseline > 0 and delta <= 0:
        return 'at_risk'
    if not has_recent_session or completion < 25:
        return 'needs_attention'
    return 'on_track'


def refresh_member_risk(candidate_id: str, org_id: str) -> str:
    risk = compute_risk_level(candidate_id)
    supabase.table('org_members').update({'risk_level': risk}).eq(
        'org_id', org_id
    ).eq('candidate_id', candidate_id).execute()
    return risk


def derive_pipeline_stage(candidate_id: str, current_score: int, baseline_done: bool) -> str:
    if not baseline_done:
        return 'Emerging'
    if current_score >= 75:
        return 'Ready'
    if current_score >= 50:
        return 'Developing'
    return 'Emerging'
