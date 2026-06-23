import bcrypt

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.supabase_client import supabase

router = APIRouter()


class PlatformLoginRequest(BaseModel):
    email: str
    password: str


@router.post('/admin/login')
def platform_login(req: PlatformLoginRequest):
    email = req.email.strip().lower()
    rows = (
        supabase.table('platform_admins')
        .select('*')
        .eq('email', email)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(status_code=401, detail='Invalid email or password')
    admin = rows[0]
    if admin.get('role') != 'super_admin':
        raise HTTPException(status_code=403, detail='Platform admin access required.')
    if not bcrypt.checkpw(
        req.password.encode('utf-8'),
        admin['password_hash'].encode('utf-8'),
    ):
        raise HTTPException(status_code=401, detail='Invalid email or password')

    return {
        'admin_id': admin['id'],
        'first_name': admin.get('first_name') or 'Admin',
        'role': admin['role'],
    }


@router.get('/admin/overview')
def platform_overview(admin_id: str):
    _verify_platform_admin(admin_id)
    orgs = supabase.table('organizations').select('id', count='exact').execute()
    candidates = supabase.table('candidates').select('id', count='exact').execute()
    sessions = supabase.table('coaching_sessions').select('id', count='exact').execute()
    invites = (
        supabase.table('org_invites')
        .select('id', count='exact')
        .eq('status', 'pending')
        .execute()
    )
    return {
        'organizationCount': orgs.count or 0,
        'candidateCount': candidates.count or 0,
        'sessionCount': sessions.count or 0,
        'pendingInvites': invites.count or 0,
    }


def _verify_platform_admin(admin_id: str) -> dict:
    rows = (
        supabase.table('platform_admins')
        .select('id, role, email')
        .eq('id', admin_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows or rows[0].get('role') != 'super_admin':
        raise HTTPException(status_code=403, detail='Platform admin access required.')
    return rows[0]
