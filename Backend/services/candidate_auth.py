"""Candidate authentication helpers."""

from typing import Any, Optional

import bcrypt

from services.supabase_client import supabase


def normalize_email(email: str) -> str:
    return email.strip().lower()


def find_candidate_by_email(email: str) -> Optional[dict[str, Any]]:
    normalized = normalize_email(email)
    rows = (
        supabase.table('candidates')
        .select('*')
        .eq('email', normalized)
        .limit(1)
        .execute()
        .data
        or []
    )
    if rows:
        return rows[0]

    # Legacy rows may have mixed-case emails from manual setup.
    rows = (
        supabase.table('candidates')
        .select('*')
        .ilike('email', normalized)
        .limit(1)
        .execute()
        .data
        or []
    )
    if rows:
        candidate = rows[0]
        if candidate.get('email') != normalized:
            supabase.table('candidates').update({'email': normalized}).eq('id', candidate['id']).execute()
            candidate['email'] = normalized
        return candidate
    return None


def verify_password(password: str, password_hash: Optional[str]) -> bool:
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
    except (ValueError, TypeError):
        return False


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
