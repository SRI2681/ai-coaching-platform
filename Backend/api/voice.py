from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional
from services.supabase_client import supabase
from services.ai_engine import get_coach_response, score_response
from services.transcript_analysis import analyze_transcript
from services.candidate_data import coaching_baseline
from services.memory_agent import (load_session_context, store_turn,
                                   update_candidate_cdl)
 
router = APIRouter()
 
class VapiPayload(BaseModel):
    type:       Optional[str] = None
    transcript: Optional[str] = None
    call:       Optional[dict] = {}
 
 
@router.post('/inbound')
async def voice_inbound(payload: VapiPayload):
    # Step 1: ignore non-speech events
    if payload.type != 'transcript' or not payload.transcript:
        return {'status': 'ok'}

    # Step 2: read who is speaking and which session
    meta         = (payload.call or {}).get('metadata', {})
    candidate_id = meta.get('candidate_id')
    session_id   = meta.get('session_id')
    turn_number  = int(meta.get('turn_number', 2))
    if not candidate_id or not session_id:
        return {'status': 'missing metadata'}

    # Step 3: load the session + leader
    ctx       = load_session_context(session_id)
    session   = ctx['session']
    recent    = ctx['recent_turns']
    candidate = (supabase.table('candidates')
                 .select('*').eq('id', candidate_id).single().execute().data)
    cdl = candidate['current_cdl']
    fw  = session['framework_used']

    # Step 4: quick text analysis
    analytics = analyze_transcript(payload.transcript)

    # Step 5: score on the 3 executive competencies
    scores = score_response(payload.transcript, fw, cdl, analytics)
    strat = scores.get('strategic_thinking_score', 70)
    oper  = scores.get('operational_accountability_score', 70)
    infl  = scores.get('influence_communication_score', 70)
    composite = round(strat * 0.4 + oper * 0.4 + infl * 0.2, 1)

    # CDL rules: 85+ advance, 60-84 hold, under 60 regress
    if composite >= 85:
        new_cdl = min(cdl + 0.5, 5.0)
    elif composite < 60:
        new_cdl = max(cdl - 0.3, 1.0)
    else:
        new_cdl = cdl
    new_cdl = round(new_cdl, 1)

    # Step 6: save the leader's turn with the new scores
    store_turn(
        session_id, candidate_id, turn_number, 'candidate',
        payload.transcript,
        cdl_at_turn=cdl,
        composite_score=composite,
        word_count=analytics.get('word_count'),
        nudge=scores.get('nudge'),
        strategic_thinking_score=strat,
        operational_accountability_score=oper,
        influence_communication_score=infl
    )

    # Step 7: update the leader's CDL if it moved
    if new_cdl != cdl:
        update_candidate_cdl(candidate_id, new_cdl)

    # Step 8: coach generates the next question
    msgs = [
        {'role': 'user' if t['role'] == 'candidate' else 'assistant',
         'content': t['content']}
        for t in (recent or [])
    ]
    reply = get_coach_response(
        msgs, candidate, fw,
        candidate.get('coach_name', 'Alex'),
        nudge=scores.get('nudge'),
        cdl=new_cdl,
        baseline=coaching_baseline(candidate_id),
    )

    # Step 9: save the coach's turn
    store_turn(session_id, candidate_id, turn_number + 1, 'coach', reply,
               cdl_at_turn=new_cdl)

    # Step 10: send the reply back
    if new_cdl > cdl:
        movement = 'up'
    elif new_cdl < cdl:
        movement = 'down'
    else:
        movement = 'hold'
    return {
        'assistant_said': reply,
        'strategic_thinking_score': strat,
        'operational_accountability_score': oper,
        'influence_communication_score': infl,
        'composite_score': composite,
        'cdl_new': new_cdl,
        'cdl_movement': movement
    }
