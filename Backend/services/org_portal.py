"""Org portal data assembly — scores and risk only, never transcripts (Section 11)."""

from typing import Any

from api.progress import compute_progress_metrics
from services.candidate_data import baseline_is_complete, get_active_goal
from services.risk_engine import derive_pipeline_stage, refresh_member_risk
from services.supabase_client import supabase

PIPELINE_STAGES = ['Emerging', 'Developing', 'Ready']


def _coaching_status(candidate_id: str) -> str:
    if not baseline_is_complete(candidate_id):
        return 'baseline_pending'
    sessions = (
        supabase.table('coaching_sessions')
        .select('id')
        .eq('candidate_id', candidate_id)
        .eq('status', 'completed')
        .limit(1)
        .execute()
        .data
        or []
    )
    return 'active' if sessions else 'assessed'


def build_roster_entry(member: dict, org_id: str) -> dict[str, Any]:
    candidate_id = member['candidate_id']
    candidate = (
        supabase.table('candidates')
        .select('id, first_name, last_name, current_cdl, baseline_completed_at')
        .eq('id', candidate_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not candidate:
        return {}
    c = candidate[0]

    risk = refresh_member_risk(candidate_id, org_id)
    metrics = compute_progress_metrics(candidate_id)
    goal = get_active_goal(candidate_id)
    baseline_done = bool(c.get('baseline_completed_at')) or baseline_is_complete(candidate_id)

    stage = member.get('pipeline_stage') or derive_pipeline_stage(
        candidate_id,
        metrics.get('currentScore') or 0,
        baseline_done,
    )
    if not member.get('pipeline_stage'):
        supabase.table('org_members').update({'pipeline_stage': stage}).eq(
            'id', member['id']
        ).execute()

    return {
        'candidateId': candidate_id,
        'name': f"{c.get('first_name', '')} {c.get('last_name', '')}".strip(),
        'goal': (goal.get('title') or goal.get('goal_text')) if goal else '',
        'goalIsOrgAssigned': bool(goal.get('is_org_assigned')) if goal else False,
        'status': _coaching_status(candidate_id),
        'baselineScore': metrics.get('baselineScore', 0),
        'currentScore': metrics.get('currentScore', 0),
        'progressPercent': metrics.get('progressPercent', 0),
        'riskLevel': risk,
        'pipelineStage': stage,
        'sessionCount': metrics.get('sessionCount', 0),
        'actionPlanCompletionPercent': metrics.get('actionPlanCompletionPercent', 0),
        'cdl': c.get('current_cdl'),
    }


def get_org_roster(org_id: str) -> dict[str, Any]:
    members = (
        supabase.table('org_members')
        .select('id, candidate_id, org_id, team_name, risk_level, pipeline_stage')
        .eq('org_id', org_id)
        .execute()
        .data
        or []
    )
    candidates = [
        entry
        for m in members
        if (entry := build_roster_entry(m, org_id))
    ]
    return {'orgId': org_id, 'candidates': candidates, 'total': len(candidates)}


def get_org_pipeline(org_id: str) -> dict[str, Any]:
    roster = get_org_roster(org_id)
    items = roster['candidates']

    stages: dict[str, dict[str, Any]] = {}
    for stage_name in PIPELINE_STAGES:
        stage_candidates = [c for c in items if c.get('pipelineStage') == stage_name]
        scores = [c['currentScore'] for c in stage_candidates if c.get('currentScore')]
        stages[stage_name] = {
            'name': stage_name,
            'count': len(stage_candidates),
            'avgScore': round(sum(scores) / len(scores)) if scores else 0,
            'atRiskCount': sum(1 for c in stage_candidates if c.get('riskLevel') == 'at_risk'),
            'candidates': [
                {
                    'candidateId': c['candidateId'],
                    'name': c['name'],
                    'currentScore': c['currentScore'],
                    'riskLevel': c['riskLevel'],
                    'progressPercent': c['progressPercent'],
                }
                for c in stage_candidates
            ],
        }

    total = len(items)
    on_track = sum(1 for c in items if c.get('riskLevel') == 'on_track')
    return {
        'orgId': org_id,
        'stages': stages,
        'metrics': {
            'totalLeaders': total,
            'onTrackPercent': round((on_track / total) * 100) if total else 0,
            'readyCount': stages['Ready']['count'],
            'atRiskTotal': sum(1 for c in items if c.get('riskLevel') == 'at_risk'),
        },
    }


def get_org_progress_dashboard(org_id: str) -> dict[str, Any]:
    """Org-wide progress dashboard (Page 33) — aggregate metrics, no transcripts."""
    from services.org_invites import list_org_invites

    roster = get_org_roster(org_id)
    items = roster['candidates']
    invites = list_org_invites(org_id)

    pending_invites = sum(1 for i in invites if i.get('status') == 'pending')
    accepted_invites = sum(1 for i in invites if i.get('status') == 'accepted')

    if not items:
        return {
            'orgId': org_id,
            'overallPercent': 0,
            'completionRate': 0,
            'improvementRate': 0,
            'riskAlerts': [],
            'totals': {
                'leaders': 0,
                'pendingInvites': pending_invites,
                'acceptedInvites': accepted_invites,
            },
            'averages': {
                'baselineScore': 0,
                'currentScore': 0,
                'progressPercent': 0,
                'actionPlanCompletionPercent': 0,
            },
        }

    baselines = [c['baselineScore'] for c in items]
    currents = [c['currentScore'] for c in items]
    improvements = [c['progressPercent'] for c in items]
    plan_completion = [c['actionPlanCompletionPercent'] for c in items]
    baseline_done = sum(1 for c in items if c.get('baselineScore', 0) > 0)

    risk_alerts = [
        {
            'candidateId': c['candidateId'],
            'name': c['name'],
            'riskLevel': c['riskLevel'],
            'reason': (
                'No score improvement since baseline'
                if c['riskLevel'] == 'at_risk'
                else 'Low engagement or plan completion'
            ),
        }
        for c in items
        if c.get('riskLevel') in ('at_risk', 'needs_attention')
    ]

    return {
        'orgId': org_id,
        'overallPercent': round(sum(plan_completion) / len(plan_completion)),
        'completionRate': round((baseline_done / len(items)) * 100),
        'improvementRate': round(sum(improvements) / len(improvements)),
        'riskAlerts': risk_alerts,
        'totals': {
            'leaders': len(items),
            'pendingInvites': pending_invites,
            'acceptedInvites': accepted_invites,
            'onTrack': sum(1 for c in items if c.get('riskLevel') == 'on_track'),
            'atRisk': sum(1 for c in items if c.get('riskLevel') == 'at_risk'),
        },
        'averages': {
            'baselineScore': round(sum(baselines) / len(baselines)),
            'currentScore': round(sum(currents) / len(currents)),
            'progressPercent': round(sum(improvements) / len(improvements)),
            'actionPlanCompletionPercent': round(sum(plan_completion) / len(plan_completion)),
        },
        'leaders': [
            {
                'candidateId': c['candidateId'],
                'name': c['name'],
                'baselineScore': c['baselineScore'],
                'currentScore': c['currentScore'],
                'progressPercent': c['progressPercent'],
                'riskLevel': c['riskLevel'],
                'sessionCount': c['sessionCount'],
            }
            for c in items
        ],
    }
