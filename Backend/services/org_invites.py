"""Invite-based linking of candidates to organizations."""

import secrets
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import HTTPException

from services.supabase_client import supabase


def _token() -> str:
    return secrets.token_urlsafe(24)


def create_invites(
    org_id: str,
    emails: list[str],
    invited_by: str,
) -> list[dict[str, Any]]:
    created = []
    for raw in emails:
        email = raw.strip().lower()
        if not email or '@' not in email:
            continue

        existing = (
            supabase.table('org_invites')
            .select('id, invite_token, status')
            .eq('org_id', org_id)
            .eq('email', email)
            .limit(1)
            .execute()
            .data
            or []
        )
        if existing and existing[0].get('status') == 'accepted':
            continue

        token = existing[0]['invite_token'] if existing else _token()
        if existing:
            row = existing[0]
        else:
            row = (
                supabase.table('org_invites')
                .insert({
                    'org_id': org_id,
                    'email': email,
                    'invite_token': token,
                    'invited_by': invited_by,
                    'status': 'pending',
                })
                .execute()
                .data[0]
            )

        created.append({
            'email': email,
            'invite_token': token,
            'status': row.get('status', 'pending'),
        })
    return created


def lookup_invite(token: str) -> dict[str, Any]:
    rows = (
        supabase.table('org_invites')
        .select('id, org_id, email, status, invite_token')
        .eq('invite_token', token)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(status_code=404, detail='Invite not found or expired.')
    invite = rows[0]
    org = (
        supabase.table('organizations')
        .select('id, name')
        .eq('id', invite['org_id'])
        .limit(1)
        .execute()
        .data
        or []
    )
    return {
        'invite_token': invite['invite_token'],
        'email': invite['email'],
        'status': invite['status'],
        'org_id': invite['org_id'],
        'org_name': org[0]['name'] if org else 'Organization',
    }


def accept_invite(token: str, candidate_id: str, candidate_email: str) -> dict[str, Any]:
    invite = lookup_invite(token)
    if invite['status'] == 'accepted':
        return {'org_id': invite['org_id'], 'already_linked': True}

    if candidate_email.lower() != invite['email'].lower():
        raise HTTPException(
            status_code=400,
            detail='This invite was sent to a different email address.',
        )

    org_id = invite['org_id']
    members = (
        supabase.table('org_members')
        .select('id')
        .eq('org_id', org_id)
        .eq('candidate_id', candidate_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not members:
        supabase.table('org_members').insert({
            'org_id': org_id,
            'candidate_id': candidate_id,
            'pipeline_stage': 'Emerging',
        }).execute()

    supabase.table('candidates').update({'org_id': org_id}).eq('id', candidate_id).execute()
    supabase.table('org_invites').update({
        'status': 'accepted',
        'candidate_id': candidate_id,
        'accepted_at': datetime.now(timezone.utc).isoformat(),
    }).eq('invite_token', token).execute()

    return {'org_id': org_id, 'org_name': invite['org_name'], 'linked': True}


def list_org_invites(org_id: str) -> list[dict[str, Any]]:
    return (
        supabase.table('org_invites')
        .select('email, status, invite_token, created_at, accepted_at, candidate_id')
        .eq('org_id', org_id)
        .order('created_at', desc=True)
        .execute()
        .data
        or []
    )


def try_accept_pending_invite(candidate_id: str, email: str) -> Optional[dict[str, Any]]:
    rows = (
        supabase.table('org_invites')
        .select('invite_token')
        .eq('email', email.lower())
        .eq('status', 'pending')
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        return None
    return accept_invite(rows[0]['invite_token'], candidate_id, email)
