from services.supabase_client import supabase
 
 
def load_candidate_context(candidate_id: str) -> dict:
    candidate = (
        supabase.table('candidates')
        .select('*').eq('id', candidate_id).single().execute().data
    )
    last_summary = (
        supabase.table('session_summaries')
        .select('key_win,key_gap,action_item,cdl_at_end,framework_used')
        .eq('candidate_id', candidate_id)
        .order('created_at', desc=True).limit(1).execute().data
    )
    active_goals = (
        supabase.table('goals')
        .select('goal_text').eq('candidate_id', candidate_id)
        .eq('status', 'active').execute().data
    )
    return {
        'candidate':    candidate,
        'last_summary': last_summary[0] if last_summary else None,
        'goals':        [g['goal_text'] for g in (active_goals or [])]
    }
 
 
def load_session_context(session_id: str, limit=20) -> dict:
    session = (
        supabase.table('coaching_sessions')
        .select('*').eq('id', session_id).single().execute().data
    )
    turns = (
        supabase.table('conversation_turns')
        .select('role,content,cdl_at_turn')
        .eq('session_id', session_id)
        .order('turn_number').limit(limit).execute().data
    )
    return {'session': session, 'recent_turns': turns or []}
 
 
def store_turn(session_id, candidate_id, turn_number, role, content,
               cdl_at_turn=None, human_score=None, agent_score=None,
               composite_score=None, word_count=None, nudge=None,
               clifton_strength=None):
    supabase.table('conversation_turns').insert({
        'session_id':       session_id,
        'candidate_id':     candidate_id,
        'turn_number':      turn_number,
        'role':             role,
        'content':          content,
        'cdl_at_turn':      cdl_at_turn,
        'human_score':      human_score,
        'agent_score':      agent_score,
        'composite_score':  composite_score,
        'word_count':       word_count,
        'nudge_triggered':  nudge,
        'clifton_strength': clifton_strength,
    }).execute()
 
 
def update_candidate_cdl(candidate_id: str, new_cdl: float):
    supabase.table('candidates').update(
        {'current_cdl': new_cdl}
    ).eq('id', candidate_id).execute()
 
 
def store_session_summary(session_id, candidate_id, cdl_start, cdl_end,
                          movement, framework, summary_data):
    supabase.table('session_summaries').insert({
        'session_id':    session_id,
        'candidate_id':  candidate_id,
        'cdl_at_start':  cdl_start,
        'cdl_at_end':    cdl_end,
        'cdl_movement':  movement,
        'framework_used': framework,
        **summary_data
    }).execute()
    supabase.table('coaching_sessions').update({
        'status':        'completed',
        'cdl_at_end':    cdl_end,
        'completed_at':  'now()'
    }).eq('id', session_id).execute()
