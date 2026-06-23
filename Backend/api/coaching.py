from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.supabase_client import supabase
from services.ai_engine import (get_coach_response, generate_session_summary,
                                 create_avatar_session, select_framework)
from services.candidate_data import assemble_session_transcript, coaching_baseline
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
    email = req.email.strip().lower()
    existing = supabase.table('candidates').select('id').eq('email', email).execute().data
    if existing:
        raise HTTPException(status_code=400, detail='Email already registered')
    hashed = bcrypt.hashpw(req.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
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
    email = req.email.strip().lower()
    result = supabase.table('candidates').select('*').eq('email', email).execute().data
    if not result:
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
        if pending:
            raise HTTPException(
                status_code=401,
                detail='No account yet. You were invited — switch to Sign Up to create your password.',
            )
        raise HTTPException(status_code=401, detail='Invalid email or password')
    candidate = result[0]
    if not candidate.get('password_hash'):
        raise HTTPException(
            status_code=401,
            detail='Account has no password set. Use Sign Up or reset via your invite link.',
        )
    if not bcrypt.checkpw(req.password.encode('utf-8'), candidate['password_hash'].encode('utf-8')):
        raise HTTPException(status_code=401, detail='Invalid email or password')
    try_accept_pending_invite(candidate['id'], candidate['email'])
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
    store_session_summary(
        session_id, req.candidate_id,
        cdl_start, cdl_end, movement, framework, summary_data
    )

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
