from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional
from services.supabase_client import supabase
from services.ai_engine import get_coach_response, score_response
from services.transcript_analysis import analyze_transcript
from services.cdl_engine import run_cdl_update
from services.memory_agent import (load_session_context, store_turn,
                                   update_candidate_cdl)
 
router = APIRouter()
 
class VapiPayload(BaseModel):
    type:       Optional[str] = None
    transcript: Optional[str] = None
    call:       Optional[dict] = {}
 
 
@router.post('/inbound')
async def voice_inbound(payload: VapiPayload):
    # Step 1: Skip non-transcript events
    if payload.type != 'transcript' or not payload.transcript:
        return {'status': 'ok'}
 
    # Step 2: Extract session metadata
    meta         = (payload.call or {}).get('metadata', {})
    candidate_id = meta.get('candidate_id')
    session_id   = meta.get('session_id')
    turn_number  = int(meta.get('turn_number', 2))
    if not candidate_id or not session_id:
        return {'status': 'missing metadata'}
 
    # Step 3: Load context
    ctx       = load_session_context(session_id)
    session   = ctx['session']
    recent    = ctx['recent_turns']
    candidate = (
        supabase.table('candidates')
        .select('*').eq('id', candidate_id).single().execute().data
    )
    cdl = candidate['current_cdl']
    fw  = session['framework_used']
 
    # Step 4: Transcript Analysis Skill
    analytics = analyze_transcript(payload.transcript)
 
    # Step 5: Scoring Agent
    scores   = score_response(payload.transcript, fw, cdl, analytics)
    cdl_data = run_cdl_update(
        cdl,
        scores.get('human_score', 70),
        scores.get('agent_score', 70),
        analytics.get('too_short', False)
    )
    new_cdl   = cdl_data['cdl_new']
    composite = cdl_data['composite_score']
 
    # Step 6: Store candidate turn
    store_turn(
        session_id, candidate_id, turn_number, 'candidate',
        payload.transcript,
        cdl_at_turn=cdl,
        human_score=scores.get('human_score'),
        agent_score=scores.get('agent_score'),
        composite_score=composite,
        word_count=analytics.get('word_count'),
        nudge=scores.get('nudge'),
        clifton_strength=scores.get('clifton_strength')
    )
 
    # Step 7: Update CDL if changed
    if new_cdl != cdl:
        update_candidate_cdl(candidate_id, new_cdl)
 
    # Step 8: Coaching Agent — generate next question
    msgs = [
        {'role': 'user' if t['role'] == 'candidate' else 'assistant',
         'content': t['content']}
        for t in (recent or [])
    ]
    reply = get_coach_response(
        msgs, candidate, fw,
        candidate.get('coach_name', 'Alex'),
        nudge=scores.get('nudge'),
        cdl=new_cdl
    )
 
    # Step 9: Store coach turn
    store_turn(session_id, candidate_id, turn_number + 1, 'coach', reply,
               cdl_at_turn=new_cdl)
 
    # Step 10: Return result
    return {
        'assistant_said':  reply,
        'human_score':     scores.get('human_score'),
        'agent_score':     scores.get('agent_score'),
        'composite_score': composite,
        'cdl_new':         new_cdl,
        'cdl_movement':    cdl_data['cdl_movement'],
    }
