from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.supabase_client import supabase
from services.ai_engine import (get_coach_response, generate_session_summary,
                                 create_avatar_session, select_framework)
from services.candidate_data import assemble_session_transcript, coaching_baseline
from services.candidate_auth import find_candidate_by_email, hash_password, normalize_email, verify_password
from services.org_invites import try_accept_pending_invite, accept_invite
from services.vapi_recordings import fetch_vapi_recording
from services.memory_agent import load_candidate_context, store_session_summary, store_turn
from services.cdl_engine import get_cdl_movement
import bcrypt
import uuid

router = APIRouter()

# ── Register ──────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    role_title: str
    role_level: str
    coach_name: str
    primary_goal: str
    invite_token: Optional[str] = None

@router.post('/register')
async def register_candidate(req: RegisterRequest):
    email = normalize_email(req.email)
    existing = find_candidate_by_email(email)
    hashed = hash_password(req.password)

    if existing:
        if existing.get('password_hash'):
            raise HTTPException(
                status_code=400,
                detail='Email already registered. Sign in with your password instead.',
            )
        # Complete a legacy / invite-only row that has no usable password yet.
        candidate = (
            supabase.table('candidates')
            .update({
                'email': email,
                'password_hash': hashed,
                'first_name': req.first_name,
                'last_name': req.last_name,
                'role_title': req.role_title,
                'role_level': req.role_level,
                'coach_name': req.coach_name,
                'primary_goal': req.primary_goal,
            })
            .eq('id', existing['id'])
            .execute()
            .data[0]
        )
    else:
        candidate = supabase.table('candidates').insert({
            'id':           str(uuid.uuid4()),
            'email':        email,
            'password_hash': hashed,
            'first_name':   req.first_name,
            'last_name':    req.last_name,
            'role_title':   req.role_title,
            'role_level':   req.role_level,
            'coach_name':   req.coach_name,
            'primary_goal': req.primary_goal,
            'current_cdl':  1.0,
        }).execute().data[0]
    org_link = None
    if req.invite_token:
        org_link = accept_invite(req.invite_token, candidate['id'], email)
    else:
        org_link = try_accept_pending_invite(candidate['id'], email)
    return {
        'candidate_id': candidate['id'],
        'message': 'Registration successful',
        'org_link': org_link,
    }

# ── Login ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post('/login')
async def login_candidate(req: LoginRequest):
    email = normalize_email(req.email)
    candidate = find_candidate_by_email(email)
    if not candidate:
        try:
            pending = (
                supabase.table('org_invites')
                .select('id')
                .eq('email', email)
                .eq('status', 'pending')
                .limit(1)
                .execute()
                .data
                or []
            )
        except Exception:
            pending = []
        if pending:
            raise HTTPException(
                status_code=401,
                detail='No account yet. You were invited — switch to Sign Up to create your password.',
            )
        raise HTTPException(status_code=401, detail='Invalid email or password')

    if not candidate.get('password_hash'):
        raise HTTPException(
            status_code=401,
            detail='No password set yet. Switch to Sign Up to finish creating your account.',
        )
    if not verify_password(req.password, candidate.get('password_hash')):
        raise HTTPException(status_code=401, detail='Invalid email or password')

    try:
        try_accept_pending_invite(candidate['id'], email)
    except Exception:
        pass

    return {
        'candidate_id': candidate['id'],
        'first_name':   candidate['first_name'],
        'current_cdl':  candidate['current_cdl'],
        'coach_name':   candidate['coach_name'],
    }

# ── Start Session ─────────────────────────────────────────────────────────────

class StartRequest(BaseModel):
    candidate_id: str
    session_type: str = 'voice'

@router.post('/start')
async def start_session(req: StartRequest):
    ctx       = load_candidate_context(req.candidate_id)
    candidate = ctx['candidate']
    if not candidate:
        raise HTTPException(status_code=404, detail='Candidate not found')

    baseline = coaching_baseline(req.candidate_id)
    goal_text = ctx['goals'][0] if ctx.get('goals') else candidate.get('primary_goal', '')
    framework = select_framework(
        candidate.get('role_level', 'manager'),
        goal_text,
        candidate.get('current_cdl', 1.0),
        baseline=baseline,
    )

    session = supabase.table('coaching_sessions').insert({
        'candidate_id':   req.candidate_id,
        'session_type':   req.session_type,
        'framework_used': framework,
        'cdl_at_start':   candidate['current_cdl'],
    }).execute().data[0]
    session_id = session['id']

    last = ctx.get('last_summary')
    memory_hint = ''
    if last:
        memory_hint = (
            f' In our last session, your key win was: {last["key_win"]}. '
            f'You committed to: {last["action_item"]}. '
            f'Reference this naturally in your opening.'
        )

    messages = []
    if memory_hint:
        messages = [{'role': 'system', 'content': memory_hint}]
    opening = get_coach_response(
        messages, candidate, framework,
        candidate.get('coach_name', 'Alex'),
        cdl=candidate['current_cdl'],
        baseline=baseline,
    )
    store_turn(session_id, req.candidate_id, 1, 'coach', opening,
               cdl_at_turn=candidate['current_cdl'])

    return {
        'session_id':    session_id,
        'coach_opening': opening,
        'framework':     framework,
        'current_cdl':   candidate['current_cdl'],
        'coach_name':    candidate.get('coach_name', 'Alex')
    }
@router.post('/avatar-session/start')
async def start_avatar_session(req: StartRequest):
    ctx       = load_candidate_context(req.candidate_id)
    candidate = ctx['candidate']
    if not candidate:
        raise HTTPException(status_code=404, detail='Candidate not found')
 
    baseline = coaching_baseline(req.candidate_id)
    goal_text = ctx['goals'][0] if ctx.get('goals') else candidate.get('primary_goal', '')
    framework = select_framework(
        candidate.get('role_level', 'manager'),
        goal_text,
        candidate.get('current_cdl', 1.0),
        baseline=baseline,
    )
    session = supabase.table('coaching_sessions').insert({
        'candidate_id':   req.candidate_id,
        'session_type':   'avatar',
        'framework_used': framework,
        'cdl_at_start':   candidate['current_cdl'],
    }).execute().data[0]
    session_id = session['id']
 
    avatar = create_avatar_session(
        candidate.get('first_name', 'there'),
        candidate.get('coach_name', 'Alex'),
        framework, session_id
    )

    response = {
        'session_id':    session_id,
        'framework':     framework,
        'current_cdl':   candidate['current_cdl'],
        'session_token': avatar.get('session_token'),
        'fallback_mode': avatar['fallback_mode'],
    }
    if avatar.get('persona_id'):
        response['persona_id'] = avatar['persona_id']
    if 'fallback_reason' in avatar:
        response['fallback_reason'] = avatar['fallback_reason']
    return response


class EndRequest(BaseModel):
    candidate_id: str
    recording_url: Optional[str] = None
    vapi_call_id: Optional[str] = None


class SessionCallMetaRequest(BaseModel):
    vapi_call_id: Optional[str] = None
    recording_url: Optional[str] = None


@router.patch('/session/{session_id}/call-meta')
async def update_session_call_meta(session_id: str, req: SessionCallMetaRequest):
    update: dict = {}
    if req.vapi_call_id:
        update['vapi_call_id'] = req.vapi_call_id
    if req.recording_url:
        update['recording_url'] = req.recording_url
    if not update:
        return {'updated': False}
    supabase.table('coaching_sessions').update(update).eq('id', session_id).execute()
    return {'updated': True, **update}


@router.post('/end/{session_id}')
async def end_session(session_id: str, req: EndRequest):
    session = (
        supabase.table('coaching_sessions')
        .select('*').eq('id', session_id).single().execute().data
    )
    if not session:
        raise HTTPException(status_code=404, detail='Session not found')

    turns = (
        supabase.table('conversation_turns')
        .select('role,content,turn_number')
        .eq('session_id', session_id)
        .order('turn_number').execute().data or []
    )

    candidate = (
        supabase.table('candidates')
        .select('current_cdl').eq('id', req.candidate_id).single().execute().data
    )
    if not candidate:
        raise HTTPException(status_code=404, detail='Candidate not found')

    cdl_start = session.get('cdl_at_start', 1.0)
    cdl_end = candidate.get('current_cdl', cdl_start)
    movement = get_cdl_movement(cdl_start, cdl_end)
    framework = session.get('framework_used', 'GROW')
    summary_data = generate_session_summary(turns, framework, cdl_start, cdl_end)
    try:
        store_session_summary(
            session_id, req.candidate_id,
            cdl_start, cdl_end, movement, framework, summary_data
        )
    except Exception:
        pass

    recording_url = req.recording_url
    if not recording_url:
        call_id = req.vapi_call_id or session.get('vapi_call_id')
        if call_id:
            recording_url = fetch_vapi_recording(call_id)

    session_update: dict = {
        'full_transcript': assemble_session_transcript(turns),
    }
    if recording_url:
        session_update['recording_url'] = recording_url
    if req.vapi_call_id:
        session_update['vapi_call_id'] = req.vapi_call_id
    if session_update.get('full_transcript') or recording_url or req.vapi_call_id:
        supabase.table('coaching_sessions').update(session_update).eq('id', session_id).execute()

    return {
        'debrief': {
            **summary_data,
            'cdl_start': cdl_start,
            'cdl_end': cdl_end,
            'cdl_movement': movement,
            'framework': framework,
        }
    }


@router.get('/sessions/latest-summary/{candidate_id}')
async def latest_session_summary(candidate_id: str):
    try:
        rows = (
            supabase.table('session_summaries')
            .select(
                'summary_text, key_win, key_gap, key_insight, action_item, growth_moment, '
                'cdl_at_start, cdl_at_end, cdl_movement, framework_used, created_at'
            )
            .eq('candidate_id', candidate_id)
            .order('created_at', desc=True)
            .limit(1)
            .execute()
            .data
            or []
        )
    except Exception:
        rows = (
            supabase.table('session_summaries')
            .select('*')
            .eq('candidate_id', candidate_id)
            .limit(1)
            .execute()
            .data
            or []
        )

    if not rows:
        raise HTTPException(status_code=404, detail='No session summary found yet.')
    row = rows[0]
    cdl_start = float(row.get('cdl_at_start') or 1.0)
    cdl_end = float(row.get('cdl_at_end') or cdl_start)
    movement = row.get('cdl_movement') or 'held'
    return {
        'debrief': {
            'summary_text': row.get('summary_text') or 'Session completed.',
            'key_win': row.get('key_win') or '—',
            'key_gap': row.get('key_gap') or '—',
            'key_insight': row.get('key_insight'),
            'action_item': row.get('action_item') or 'Reflect on this session before your next check-in.',
            'growth_moment': row.get('growth_moment'),
            'cdl_start': cdl_start,
            'cdl_end': cdl_end,
            'cdl_movement': movement,
        }
    }
