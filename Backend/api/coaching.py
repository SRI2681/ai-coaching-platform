from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.supabase_client import supabase
from services.ai_engine import (get_coach_response, generate_session_summary,
                                 create_avatar_session, select_framework)
from services.memory_agent import (load_candidate_context, store_turn,
                                   store_session_summary)
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

@router.post('/register')
async def register_candidate(req: RegisterRequest):
    existing = supabase.table('candidates').select('id').eq('email', req.email).execute().data
    if existing:
        raise HTTPException(status_code=400, detail='Email already registered')
    hashed = bcrypt.hashpw(req.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    candidate = supabase.table('candidates').insert({
        'id':           str(uuid.uuid4()),
        'email':        req.email,
        'password_hash': hashed,
        'first_name':   req.first_name,
        'last_name':    req.last_name,
        'role_title':   req.role_title,
        'role_level':   req.role_level,
        'coach_name':   req.coach_name,
        'primary_goal': req.primary_goal,
        'current_cdl':  1.0,
    }).execute().data[0]
    return {'candidate_id': candidate['id'], 'message': 'Registration successful'}

# ── Login ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post('/login')
async def login_candidate(req: LoginRequest):
    result = supabase.table('candidates').select('*').eq('email', req.email).execute().data
    if not result:
        raise HTTPException(status_code=401, detail='Invalid email or password')
    candidate = result[0]
    if not bcrypt.checkpw(req.password.encode('utf-8'), candidate['password_hash'].encode('utf-8')):
        raise HTTPException(status_code=401, detail='Invalid email or password')
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

    framework = select_framework(
        candidate.get('role_level', 'manager'),
        candidate.get('primary_goal', ''),
        candidate.get('current_cdl', 1.0)
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
        cdl=candidate['current_cdl']
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
 
    framework = select_framework(
        candidate.get('role_level', 'manager'),
        candidate.get('primary_goal', ''),
        candidate.get('current_cdl', 1.0)
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
    if not avatar['fallback_mode']:
        supabase.table('coaching_sessions').update({
            'tavus_conversation_id': avatar['conversation_id']
        }).eq('id', session_id).execute()
 
    response = {
        'session_id':       session_id,
        'framework':        framework,
        'current_cdl':      candidate['current_cdl'],
        'conversation_url': avatar.get('conversation_url'),
        'fallback_mode':    avatar['fallback_mode']
    }
    if 'fallback_reason' in avatar:
        response['fallback_reason'] = avatar['fallback_reason']
    return response


class EndRequest(BaseModel):
    candidate_id: str

@router.post('/end/{session_id}')
async def end_session(session_id: str, req: EndRequest):
    session = (
        supabase.table('coaching_sessions')
        .select('role,content').eq('session_id', session_id)
        .order('turn_number').execute().data
    )
    candidate = (
        supabase.table('candidates')
        .select('current_cdl').eq('id', req.candidate_id).single().execute().data
    )
    cdl_start    = session.get('cdl_at_start', 1.0)
    cdl_end      = candidate.get('current_cdl', cdl_start)
    movement     = get_cdl_movement(cdl_start, cdl_end)
    framework    = session.get('framework_used', 'GROW')
    summary_data = generate_session_summary(turns, framework, cdl_start, cdl_end)
    store_session_summary(
        session_id, req.candidate_id,
        cdl_start, cdl_end, movement, framework, summary_data
    )
    return {
        'debrief': {
            **summary_data,
            'cdl_start': cdl_start,
            'cdl_end':   cdl_end,
            'cdl_movement': movement
        }
    }
class RegisterRequest(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    role_title: str = 'Leader'
    role_level: str = 'manager'
    coach_name: str = 'Alex'
    primary_goal: str = 'Develop leadership skills'
 
@router.post('/register')
async def register_candidate(req: RegisterRequest):
    from passlib.context import CryptContext
    pwd_ctx = CryptContext(schemes=['bcrypt'], deprecated='auto')
    hashed  = pwd_ctx.hash(req.password)
    try:
        result = supabase.table('candidates').insert({
            'email': req.email, 'password_hash': hashed,
            'first_name': req.first_name, 'last_name': req.last_name,
            'role_title': req.role_title, 'role_level': req.role_level,
            'coach_name': req.coach_name, 'primary_goal': req.primary_goal
        }).execute()
        return {'candidate_id': result.data[0]['id'], 'message': 'Account created'}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
 
 
class LoginRequest(BaseModel):
    email: str
    password: str
 
@router.post('/login')
async def login_candidate(req: LoginRequest):
    from passlib.context import CryptContext
    pwd_ctx = CryptContext(schemes=['bcrypt'], deprecated='auto')
    result  = (
        supabase.table('candidates')
        .select('*').eq('email', req.email).single().execute()
    )
    if not result.data or not pwd_ctx.verify(req.password, result.data['password_hash']):
        raise HTTPException(status_code=401, detail='Invalid credentials')
    c = result.data
    return {
        'candidate_id': c['id'],
        'first_name':   c['first_name'],
        'current_cdl':  c['current_cdl'],
        'coach_name':   c['coach_name']
    }
