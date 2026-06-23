"""Org admin authentication and tenant isolation (Section 11)."""

from fastapi import HTTPException

from services.supabase_client import supabase

ORG_ADMIN_ROLE = 'org_admin'

# Fields that must NEVER be returned to org admins (privacy wall).
BLOCKED_ORG_FIELDS = frozenset({
    'password_hash',
    'full_transcript',
    'recording_url',
    'transcript',
    'summary_text',
    'key_win',
    'key_gap',
    'key_insight',
    'action_item',
    'growth_moment',
    'answers',
    'questions',
    'content',
})


def verify_org_admin(admin_id: str, org_id: str) -> dict:
    """Ensure caller is org_admin and belongs to the requested org."""
    row = (
        supabase.table('org_admins')
        .select('id, org_id, email, role, first_name, last_name')
        .eq('id', admin_id)
        .limit(1)
        .execute()
        .data
    )
    if not row:
        raise HTTPException(status_code=403, detail='Invalid org admin credentials.')
    admin = row[0]
    if admin.get('role') != ORG_ADMIN_ROLE:
        raise HTTPException(status_code=403, detail='Org admin role required.')
    if str(admin.get('org_id')) != str(org_id):
        raise HTTPException(status_code=403, detail='Access denied for this organization.')
    return admin


def verify_candidate_in_org(candidate_id: str, org_id: str) -> dict:
    """Tenant isolation: candidate must be a member of this org."""
    rows = (
        supabase.table('org_members')
        .select('id, candidate_id, org_id, team_name, risk_level, pipeline_stage')
        .eq('org_id', org_id)
        .eq('candidate_id', candidate_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(
            status_code=403,
            detail='Candidate is not a member of this organization.',
        )
    return rows[0]


def log_org_audit(
    admin_id: str,
    action: str,
    target: str,
    org_id: str,
    metadata: dict | None = None,
) -> None:
    payload = {'org_id': org_id, **(metadata or {})}
    supabase.table('audit_events').insert({
        'actor_id': admin_id,
        'actor_role': ORG_ADMIN_ROLE,
        'action': action,
        'target': target,
        'metadata': payload,
    }).execute()
