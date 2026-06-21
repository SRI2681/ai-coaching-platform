# PLATFORM WORKFLOW
 
## Session Start Flow
Triggered by: POST /api/coaching/start or /api/coaching/avatar-session/start
 
1. Master Agent receives start request with candidate_id
2. Memory Agent loads candidate profile + last session summary
3. Framework Selector Skill picks the coaching framework
4. Memory Agent creates session record in database
5. If last session exists: inject action item into opening message
6. Coaching Agent generates opening question (calibrated to candidate CDL)
7. Memory Agent stores opening question as Turn 1
8. Return: session_id, coach_opening, framework, current_cdl, coach_name
 
## Per-Turn Flow (every time candidate speaks)
Triggered by: POST /api/voice/inbound (from Vapi webhook)
 
1.  Master Agent receives transcript + session metadata
2.  Memory Agent loads session context + recent turns
3.  Transcript Analysis Skill analyzes the response (no API call)
4.  Scoring Agent evaluates Human Leadership + Agent Leadership scores
5.  CDL Scoring Skill computes composite score and CDL adjustment
6.  Memory Agent stores candidate turn with scores
7.  If CDL changed: update candidate record
8.  Coaching Agent generates next question at new CDL level
9.  Memory Agent stores coach turn
10. Return: assistant_said, human_score, agent_score, composite_score, cdl_new
 
Total time for steps 1-10: target under 2.5 seconds.
 
## Session End Flow
Triggered by: POST /api/coaching/end/{session_id}
 
1. Master Agent loads all turns for the session
2. Memory Agent calls OpenAI to generate session summary
3. Memory Agent stores summary in session_summaries table
4. Memory Agent marks session as 'completed' in coaching_sessions
5. Return: debrief with summary, key_win, key_gap, action_item, CDL movement
 
## Avatar Session Difference
Avatar sessions follow the same flow above, with one addition:
After step 3 in Session Start Flow, Avatar Agent creates a Tavus CVI session.
The conversation_url is returned to the frontend and embedded in an iframe.
All subsequent voice turns go through the same /api/voice/inbound endpoint.
