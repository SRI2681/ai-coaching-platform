"""Central helpers for loading and persisting candidate coaching data."""

from datetime import datetime, timezone
from typing import Any, Optional

from services.supabase_client import supabase


def get_active_goal(candidate_id: str) -> Optional[dict[str, Any]]:
    rows = (
        supabase.table('goals')
        .select('id, title, goal_text, description, theme, is_org_assigned')
        .eq('candidate_id', candidate_id)
        .eq('status', 'active')
        .order('created_at', desc=True)
        .limit(1)
        .execute()
        .data
        or []
    )
    return rows[0] if rows else None


def get_active_goal_text(candidate_id: str) -> str:
    goal = get_active_goal(candidate_id)
    if not goal:
        return ''
    return goal.get('title') or goal.get('goal_text') or ''


def get_completed_baseline(candidate_id: str) -> Optional[dict[str, Any]]:
    rows = (
        supabase.table('assessments')
        .select('*')
        .eq('candidate_id', candidate_id)
        .eq('type', 'baseline')
        .eq('status', 'completed')
        .order('completed_at', desc=True)
        .limit(1)
        .execute()
        .data
        or []
    )
    return rows[0] if rows else None


def get_in_progress_baseline(candidate_id: str) -> Optional[dict[str, Any]]:
    rows = (
        supabase.table('assessments')
        .select('*')
        .eq('candidate_id', candidate_id)
        .eq('type', 'baseline')
        .eq('status', 'in_progress')
        .order('created_at', desc=True)
        .limit(1)
        .execute()
        .data
        or []
    )
    return rows[0] if rows else None


def baseline_is_complete(candidate_id: str) -> bool:
    return get_completed_baseline(candidate_id) is not None


def mark_baseline_complete(candidate_id: str) -> None:
    supabase.table('candidates').update({
        'baseline_completed_at': datetime.now(timezone.utc).isoformat(),
    }).eq('id', candidate_id).execute()


def format_baseline_result(row: dict[str, Any]) -> dict[str, Any]:
    return {
        'assessment_id': row.get('id'),
        'score': row.get('score'),
        'strategic_score': row.get('strategic_score'),
        'operational_score': row.get('operational_score'),
        'influence_score': row.get('influence_score'),
        'level': row.get('level'),
        'strengths': row.get('strengths') or [],
        'gaps': row.get('gaps') or [],
        'methodology_profile': row.get('methodology_profile') or {},
        'completed_at': row.get('completed_at'),
        'goal_id': row.get('goal_id'),
    }


def build_baseline_context(row: dict[str, Any]) -> dict[str, Any]:
    profile = row.get('methodology_profile') or {}
    return {
        'score': row.get('score'),
        'level': row.get('level'),
        'strategic_score': row.get('strategic_score'),
        'operational_score': row.get('operational_score'),
        'influence_score': row.get('influence_score'),
        'strengths': row.get('strengths') or [],
        'gaps': row.get('gaps') or [],
        'methodology_profile': profile,
        'clifton_themes': profile.get('clifton_themes', []),
        'disc_profile': profile.get('disc_profile', {}),
    }


def coaching_baseline(candidate_id: str) -> dict[str, Any]:
    row = get_completed_baseline(candidate_id)
    return format_baseline_result(row) if row else {}


def assemble_session_transcript(turns: list[dict]) -> str:
    lines = []
    for turn in turns:
        role = 'Coach' if turn.get('role') in ('coach', 'assistant') else 'Leader'
        content = (turn.get('content') or '').strip()
        if content:
            lines.append(f'{role}: {content}')
    return '\n'.join(lines)
