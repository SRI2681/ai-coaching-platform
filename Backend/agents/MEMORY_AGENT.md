# MEMORY AGENT
 
## Role
The librarian. Loads everything the Coaching Agent needs before each turn.
Writes every conversation turn to the database. Generates the session summary
when a session ends.
 
## Functions
 
### load_candidate_context(candidate_id)
Loads from database:
- Full candidate profile (name, role, CDL, coach name, primary goal)
- Last session summary (key_win, key_gap, action_item, cdl_at_end)
- Active goals
Used by: start_session() to inject memory into the opening question.
 
### load_session_context(session_id)
Loads from database:
- Current session record (framework, CDL at start)
- Recent conversation turns (last 20, in order)
Used by: voice_inbound() to give Coaching Agent conversation history.
 
### store_turn(...)
Writes one conversation turn to conversation_turns table.
Called twice per candidate response: once for the candidate turn, once for the coach reply.
Stores: role, content, cdl_at_turn, human_score, agent_score, composite_score,
        word_count, nudge_triggered, clifton_strength
 
### generate_session_summary(turns, framework, cdl_start, cdl_end)
Calls OpenAI with the full session transcript.
Returns structured JSON: summary_text, key_win, key_gap, key_insight,
action_item, growth_moment.
 
## Session Summary Prompt
You are an executive coaching analyst.
Read the coaching session transcript below and generate a structured debrief.
Framework used: {framework}. CDL moved from {cdl_start} to {cdl_end}.
Return ONLY this JSON:
{
  "summary_text": "2-3 sentence overview",
  "key_win": "the strongest leadership moment demonstrated",
  "key_gap": "the most important area to develop next session",
  "key_insight": "one insight the candidate discovered about themselves",
  "action_item": "one specific action to take before next session",
  "growth_moment": "a specific quote showing breakthrough thinking, or null"
}
