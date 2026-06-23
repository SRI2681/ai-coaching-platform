# backend/services/action_plan_engine.py
import json
import logging
import re
from datetime import date, timedelta
from typing import Any, Optional

from services.ai_engine import client
from services.supabase_client import supabase

logger = logging.getLogger(__name__)

MODEL = 'claude-haiku-4-5-20251001'

PLAN_PROMPT = (
    'You are an executive coach (ActionCOACH/FocalPoint). Build a personalized 30-day '
    'action plan for a leader.\n\n'
    'GOAL: {goal}\n'
    'BASELINE LEVEL: {level}\n'
    'BASELINE SCORES (0-100): Strategic {strategic}, Operational {operational}, '
    'Influence {influence} (overall {overall})\n'
    'STRENGTHS: {strengths}\n'
    'GAPS: {gaps}\n\n'
    'RECENT SESSION SUMMARIES:\n{session_summaries}\n\n'
    'COACHING TRANSCRIPT EXCERPTS:\n{transcripts}\n\n'
    'Use the goal, baseline competency profile, session themes, and transcript evidence '
    'to create specific milestones, practice exercises, and next steps — not generic advice. '
    'When transcripts show recurring themes (e.g. delegation, stakeholder conflict), '
    'address them directly in the plan.\n'
    'Return ONLY valid JSON, no code fences: '
    '{{"focus_areas":["..."],'
    '"items":[{{"kind":"milestone|exercise|next_step","title":"...",'
    '"detail":"...","days_from_now":7}}]}}'
    ' Produce 3 focus areas and 5-7 items. Keep titles under 12 words.'
)


def _parse_json(text: str) -> dict:
    cleaned = text.strip()
    fence = re.search(r'```(?:json)?\s*([\s\S]*?)```', cleaned)
    if fence:
        cleaned = fence.group(1).strip()
    return json.loads(cleaned)


def _format_baseline(baseline: dict[str, Any]) -> dict[str, Any]:
    return {
        'level': baseline.get('level', 'Developing'),
        'strategic': baseline.get('strategic_score', baseline.get('strategic', '—')),
        'operational': baseline.get('operational_score', baseline.get('operational', '—')),
        'influence': baseline.get('influence_score', baseline.get('influence', '—')),
        'overall': baseline.get('score', '—'),
        'strengths': baseline.get('strengths', []),
        'gaps': baseline.get('gaps', []),
    }


def load_baseline_from_db(candidate_id: str) -> Optional[dict[str, Any]]:
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
    if not rows:
        return None
    row = rows[0]
    return {
        'level': row.get('level'),
        'score': row.get('score'),
        'strategic_score': row.get('strategic_score'),
        'operational_score': row.get('operational_score'),
        'influence_score': row.get('influence_score'),
        'strengths': row.get('strengths') or [],
        'gaps': row.get('gaps') or [],
    }


def _load_session_summaries(candidate_id: str, limit: int = 5) -> str:
    rows = (
        supabase.table('session_summaries')
        .select(
            'summary_text, key_win, key_gap, action_item, growth_moment, created_at'
        )
        .eq('candidate_id', candidate_id)
        .order('created_at', desc=True)
        .limit(limit)
        .execute()
        .data
        or []
    )
    if not rows:
        return 'No coaching sessions completed yet.'

    blocks = []
    for idx, row in enumerate(rows, start=1):
        parts = [f'Session {idx}:']
        if row.get('summary_text'):
            parts.append(f"Summary: {row['summary_text']}")
        if row.get('key_win'):
            parts.append(f"Win: {row['key_win']}")
        if row.get('key_gap'):
            parts.append(f"Gap: {row['key_gap']}")
        if row.get('action_item'):
            parts.append(f"Action item: {row['action_item']}")
        if row.get('growth_moment'):
            parts.append(f"Growth moment: {row['growth_moment']}")
        blocks.append('\n'.join(parts))
    return '\n\n'.join(blocks)


def _load_transcript_excerpts(
    candidate_id: str,
    max_sessions: int = 3,
    max_turns_per_session: int = 12,
) -> str:
    sessions = (
        supabase.table('coaching_sessions')
        .select('id, completed_at, full_transcript, recording_url')
        .eq('candidate_id', candidate_id)
        .eq('status', 'completed')
        .order('completed_at', desc=True)
        .limit(max_sessions)
        .execute()
        .data
        or []
    )
    if not sessions:
        return 'No coaching transcripts available yet.'

    blocks = []
    for session in sessions:
        archived = (session.get('full_transcript') or '').strip()
        if archived:
            label = session.get('completed_at') or session['id'][:8]
            recording = (
                f'\n[Recording archived: {session["recording_url"]}]'
                if session.get('recording_url')
                else ''
            )
            blocks.append(
                f'--- Coaching session ({label}) ---\n{archived[:3000]}{recording}'
            )
            continue

        turns = (
            supabase.table('conversation_turns')
            .select('role, content, turn_number')
            .eq('session_id', session['id'])
            .order('turn_number')
            .limit(max_turns_per_session)
            .execute()
            .data
            or []
        )
        if not turns:
            continue
        lines = []
        for turn in turns:
            role = 'Coach' if turn.get('role') in ('coach', 'assistant') else 'Leader'
            content = (turn.get('content') or '')[:400]
            lines.append(f'{role}: {content}')
        label = session.get('completed_at') or session['id'][:8]
        blocks.append(f'--- Coaching session ({label}) ---\n' + '\n'.join(lines))

    return '\n\n'.join(blocks) if blocks else 'No coaching transcripts available yet.'


def _supersede_active_plans(candidate_id: str) -> None:
    existing = (
        supabase.table('action_plans')
        .select('id')
        .eq('candidate_id', candidate_id)
        .eq('status', 'active')
        .execute()
        .data
        or []
    )
    for plan in existing:
        supabase.table('action_plans').update({'status': 'superseded'}).eq(
            'id', plan['id']
        ).execute()


def generate_action_plan(
    candidate_id: str,
    goal: str,
    baseline: dict[str, Any],
    goal_id: Optional[str] = None,
) -> str:
    profile = _format_baseline(baseline)
    session_summaries = _load_session_summaries(candidate_id)
    transcripts = _load_transcript_excerpts(candidate_id)

    try:
        resp = client.messages.create(
            model=MODEL,
            max_tokens=900,
            system=PLAN_PROMPT.format(
                goal=goal,
                level=profile['level'],
                strategic=profile['strategic'],
                operational=profile['operational'],
                influence=profile['influence'],
                overall=profile['overall'],
                strengths=profile['strengths'],
                gaps=profile['gaps'],
                session_summaries=session_summaries,
                transcripts=transcripts,
            ),
            messages=[
                {
                    'role': 'user',
                    'content': (
                        'Generate a dynamic action plan grounded in baseline skills '
                        'and coaching session evidence.'
                    ),
                }
            ],
        )
        plan = _parse_json(resp.content[0].text)
    except Exception as exc:
        logger.warning('generate_action_plan fallback: %s', exc)
        plan = {
            'focus_areas': profile['gaps'] or ['Executive presence'],
            'items': [
                {
                    'kind': 'milestone',
                    'title': 'Run one coaching session this week',
                    'detail': 'Complete a full avatar session.',
                    'days_from_now': 7,
                }
            ],
        }

    _supersede_active_plans(candidate_id)

    ap = (
        supabase.table('action_plans')
        .insert({
            'candidate_id': candidate_id,
            'goal_id': goal_id,
            'focus_areas': plan['focus_areas'],
            'summary': goal,
        })
        .execute()
        .data[0]
    )

    for item in plan.get('items', []):
        supabase.table('action_items').insert({
            'action_plan_id': ap['id'],
            'candidate_id': candidate_id,
            'kind': item.get('kind', 'milestone'),
            'title': item['title'],
            'detail': item.get('detail'),
            'due_date': str(
                date.today() + timedelta(days=int(item.get('days_from_now', 7)))
            ),
        }).execute()

    return ap['id']
