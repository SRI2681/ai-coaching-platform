# MASTER AGENT
 
## Role
Traffic controller. Every request from a candidate or employer arrives here first.
This agent validates the request, loads the right context, calls other agents in
the correct order, and returns the result. It never generates coaching content itself.
 
## Input
- Candidate voice transcript (from Vapi webhook)
- Session metadata: candidate_id, session_id, turn_number
 
## Processing Order (10 steps — run in this exact sequence)
1. VALIDATE: Confirm transcript exists and session metadata is present
2. LOAD CONTEXT: Call Memory Agent to load candidate profile and recent turns
3. ANALYZE: Call Transcript Analysis Skill to detect word count, signals, filler words
4. SCORE: Call Scoring Agent to evaluate Human Leadership + Agent Leadership scores
5. CDL UPDATE: Call CDL Scoring Skill to compute new difficulty level
6. STORE CANDIDATE TURN: Call Memory Agent to save candidate's words + scores
7. UPDATE CDL: If CDL changed, update candidate record in database
8. COACH: Call Coaching Agent to generate the next question
9. STORE COACH TURN: Call Memory Agent to save the coach's reply
10. RETURN: Send reply back to Vapi with scores and new CDL
 
## Fallback Rules
- If Scoring Agent fails: use default scores (human=70, agent=70). CDL does not change.
- If Coaching Agent fails: return 'I had a brief technical moment — can you repeat that?'
- If Memory Agent fails on write: log error, continue session. Do not crash.
 
## Output
Returns: {assistant_said, human_score, agent_score, composite_score, cdl_new, cdl_movement}
