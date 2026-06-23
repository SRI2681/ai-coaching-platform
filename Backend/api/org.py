import bcrypt
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.org_auth import log_org_audit, verify_candidate_in_org, verify_org_admin
from services.org_invites import (
    accept_invite,
    create_invites,
    list_org_invites,
    lookup_invite,
)
from services.org_portal import get_org_pipeline, get_org_progress_dashboard, get_org_roster
from services.supabase_client import supabase

router = APIRouter()


class OrgLoginRequest(BaseModel):
    email: str
    password: str
    organization_id: str


class OrgAdminContext(BaseModel):
    admin_id: str


class AssignGoalRequest(BaseModel):
    admin_id: str
    candidate_id: str
    title: str
    description: Optional[str] = None
    theme: Optional[str] = None


class OrgRegisterRequest(BaseModel):
    org_name: str
    contact_email: str
    plan: str = 'team'
    admin_first_name: str
    admin_last_name: str
    admin_email: str
    admin_password: str
    invite_emails: list[str] = []


class InviteAcceptRequest(BaseModel):
    invite_token: str
    candidate_id: str


class AddInvitesRequest(BaseModel):
    admin_id: str
    emails: list[str]


@router.post('/org/register')
def org_register(req: OrgRegisterRequest):
    org_rows = (
        supabase.table('organizations')
        .insert({
            'name': req.org_name,
            'contact_email': req.contact_email,
            'plan': req.plan,
        })
        .execute()
        .data
    )
    org = org_rows[0]
    org_id = org['id']

    hashed = bcrypt.hashpw(req.admin_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    admin_rows = (
        supabase.table('org_admins')
        .insert({
            'id': str(uuid.uuid4()),
            'org_id': org_id,
            'email': req.admin_email.lower(),
            'password_hash': hashed,
            'role': 'org_admin',
            'first_name': req.admin_first_name,
            'last_name': req.admin_last_name,
        })
        .execute()
        .data
    )
    admin = admin_rows[0]
    invites = create_invites(org_id, req.invite_emails, admin['id'])

    log_org_audit(admin['id'], 'org_register', org_id, org_id, {'invite_count': len(invites)})

    return {
        'org_id': org_id,
        'org_name': req.org_name,
        'admin_id': admin['id'],
        'invites': invites,
    }


@router.get('/org/invites/lookup')
def invite_lookup(token: str):
    return lookup_invite(token)


@router.post('/org/invites/accept')
def invite_accept(req: InviteAcceptRequest):
    cand = (
        supabase.table('candidates')
        .select('email')
        .eq('id', req.candidate_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not cand:
        raise HTTPException(status_code=404, detail='Candidate not found')
    return accept_invite(req.invite_token, req.candidate_id, cand[0]['email'])


@router.get('/org/{org_id}/invites')
def org_invites(org_id: str, admin_id: str):
    verify_org_admin(admin_id, org_id)
    return {'invites': list_org_invites(org_id)}


@router.post('/org/{org_id}/invites')
def add_org_invites(org_id: str, req: AddInvitesRequest):
    admin = verify_org_admin(req.admin_id, org_id)
    invites = create_invites(org_id, req.emails, admin['id'])
    log_org_audit(req.admin_id, 'send_invites', org_id, org_id, {'count': len(invites)})
    return {'invites': invites}


@router.get('/org/{org_id}/progress-dashboard')
def org_progress_dashboard(org_id: str, admin_id: str):
    verify_org_admin(admin_id, org_id)
    return get_org_progress_dashboard(org_id)


@router.post('/org/login')
def org_login(req: OrgLoginRequest):
    rows = (
        supabase.table('org_admins')
        .select('*')
        .eq('email', req.email)
        .eq('org_id', req.organization_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(status_code=401, detail='Invalid credentials or organization.')
    admin = rows[0]
    if admin.get('role') != 'org_admin':
        raise HTTPException(status_code=403, detail='Org admin access required.')
    if not bcrypt.checkpw(
        req.password.encode('utf-8'),
        admin['password_hash'].encode('utf-8'),
    ):
        raise HTTPException(status_code=401, detail='Invalid credentials or organization.')

    org = (
        supabase.table('organizations')
        .select('id, name, plan')
        .eq('id', req.organization_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    org_name = org[0]['name'] if org else 'Organization'

    return {
        'admin_id': admin['id'],
        'org_id': admin['org_id'],
        'org_name': org_name,
        'first_name': admin.get('first_name', ''),
        'role': admin['role'],
    }


@router.get('/org/{org_id}/roster')
def org_roster(org_id: str, admin_id: str):
    verify_org_admin(admin_id, org_id)
    return get_org_roster(org_id)


@router.get('/org/{org_id}/pipeline')
def org_pipeline(org_id: str, admin_id: str):
    verify_org_admin(admin_id, org_id)
    return get_org_pipeline(org_id)


@router.get('/org/{org_id}/analytics')
def org_analytics(org_id: str, admin_id: str):
    """Aggregate-only analytics — no per-person coaching content."""
    verify_org_admin(admin_id, org_id)
    roster = get_org_roster(org_id)
    items = roster['candidates']
    if not items:
        return {
            'total_leaders': 0,
            'average_baseline': 0,
            'average_current': 0,
            'average_improvement_pct': 0,
            'risk_distribution': {'on_track': 0, 'needs_attention': 0, 'at_risk': 0},
        }

    baselines = [c['baselineScore'] for c in items]
    currents = [c['currentScore'] for c in items]
    improvements = [c['progressPercent'] for c in items]
    risk_dist = {'on_track': 0, 'needs_attention': 0, 'at_risk': 0}
    for c in items:
        level = c.get('riskLevel', 'on_track')
        if level in risk_dist:
            risk_dist[level] += 1

    return {
        'total_leaders': len(items),
        'average_baseline': round(sum(baselines) / len(baselines)),
        'average_current': round(sum(currents) / len(currents)),
        'average_improvement_pct': round(sum(improvements) / len(improvements)),
        'risk_distribution': risk_dist,
    }


@router.post('/org/{org_id}/assign-goal')
def assign_goal(org_id: str, req: AssignGoalRequest):
    admin = verify_org_admin(req.admin_id, org_id)
    verify_candidate_in_org(req.candidate_id, org_id)

    existing_active = (
        supabase.table('goals')
        .select('id')
        .eq('candidate_id', req.candidate_id)
        .eq('status', 'active')
        .execute()
        .data
        or []
    )
    for goal in existing_active:
        supabase.table('goals').update({'status': 'superseded'}).eq('id', goal['id']).execute()

    row = (
        supabase.table('goals')
        .insert({
            'candidate_id': req.candidate_id,
            'goal_text': req.title,
            'title': req.title,
            'description': req.description,
            'theme': req.theme,
            'status': 'active',
            'is_org_assigned': True,
            'assigned_by': admin['id'],
            'org_id': org_id,
        })
        .execute()
        .data[0]
    )

    log_org_audit(
        req.admin_id,
        'assign_goal',
        req.candidate_id,
        org_id,
        {'goal_id': row['id'], 'title': req.title},
    )

    return {
        'goal_id': row['id'],
        'candidate_id': req.candidate_id,
        'title': req.title,
        'is_org_assigned': True,
    }
