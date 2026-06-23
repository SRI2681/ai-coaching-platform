"""Candidate profile — scores and progress only (no transcript text)."""

from typing import Any

from api.progress import compute_progress_metrics
from services.candidate_data import (
    baseline_is_complete,
    format_baseline_result,
    get_active_goal,
    get_completed_baseline,
)
from services.supabase_client import supabase


def build_candidate_profile(candidate_id: str) -> dict[str, Any]:
    candidate = (
        supabase.table('candidates')
        .select(
            'id, first_name, last_name, email, role_title, role_level, '
            'coach_name, current_cdl, baseline_completed_at, org_id, created_at'
        )
        .eq('id', candidate_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not candidate:
        return {}
    c = candidate[0]

    baseline_row = get_completed_baseline(candidate_id)
    baseline = format_baseline_result(baseline_row) if baseline_row else None
    metrics = compute_progress_metrics(candidate_id)
    goal = get_active_goal(candidate_id)

    assessments = (
        supabase.table('assessments')
        .select('type, score, level, completed_at, goal_progress_pct')
        .eq('candidate_id', candidate_id)
        .eq('status', 'completed')
        .order('completed_at')
        .execute()
        .data
        or []
    )

    sessions = (
        supabase.table('coaching_sessions')
        .select('id, framework_used, completed_at, status, recording_url')
        .eq('candidate_id', candidate_id)
        .eq('status', 'completed')
        .order('completed_at', desc=True)
        .limit(10)
        .execute()
        .data
        or []
    )

    org_name = None
    if c.get('org_id'):
        org = (
            supabase.table('organizations')
            .select('name')
            .eq('id', c['org_id'])
            .limit(1)
            .execute()
            .data
            or []
        )
        org_name = org[0]['name'] if org else None

    plan = (
        supabase.table('action_plans')
        .select('focus_areas, status, created_at')
        .eq('candidate_id', candidate_id)
        .eq('status', 'active')
        .order('created_at', desc=True)
        .limit(1)
        .execute()
        .data
        or []
    )

    return {
        'candidateId': candidate_id,
        'firstName': c.get('first_name'),
        'lastName': c.get('last_name'),
        'email': c.get('email'),
        'roleTitle': c.get('role_title'),
        'roleLevel': c.get('role_level'),
        'coachName': c.get('coach_name'),
        'cdl': c.get('current_cdl'),
        'orgId': c.get('org_id'),
        'orgName': org_name,
        'baselineCompleted': baseline_is_complete(candidate_id),
        'baseline': baseline,
        'activeGoal': {
            'title': (goal.get('title') or goal.get('goal_text')) if goal else None,
            'theme': goal.get('theme') if goal else None,
            'isOrgAssigned': bool(goal.get('is_org_assigned')) if goal else False,
        },
        'progress': metrics,
        'assessments': [
            {
                'type': a.get('type'),
                'score': a.get('score'),
                'level': a.get('level'),
                'date': a.get('completed_at'),
                'goalProgressPct': a.get('goal_progress_pct'),
            }
            for a in assessments
        ],
        'sessions': [
            {
                'id': s['id'],
                'framework': s.get('framework_used'),
                'completedAt': s.get('completed_at'),
                'hasRecording': bool(s.get('recording_url')),
            }
            for s in sessions
        ],
        'actionPlan': {
            'focusAreas': plan[0].get('focus_areas') if plan else [],
            'completionPercent': metrics.get('actionPlanCompletionPercent', 0),
        },
    }
