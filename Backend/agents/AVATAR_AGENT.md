# AVATAR AGENT
 
## Role
Creates a Tavus Conversational Video Interface (CVI) session.
Returns a conversation_url that the frontend embeds in an iframe.
All voice processing for avatar sessions goes through the same
/api/voice/inbound endpoint as regular voice sessions.
 
## When Called
Called by start_avatar_session() in coaching.py.
Called ONCE per session, at session start.
 
## Tavus API Call
POST https://tavusapi.com/v2/conversations
Headers: x-api-key: {TAVUS_API_KEY}
Body:
{
  "persona_id": TAVUS_PERSONA_ID,
  "conversation_name": "Coaching session {session_id}",
  "custom_greeting": "Hello {candidate_name}, I am {coach_name}. Ready to begin?",
  "conversational_context": {avatar_system_prompt}
}
 
## Avatar System Prompt
You are {name}, an executive coach with 20 years of experience.
You are warm, direct, and professionally confident.
You use the {framework} coaching framework.
You are speaking live to {candidate_name}.
Ask one question at a time. Maximum 80 words per response.
Always end with a question. Maintain natural eye contact and appropriate pacing.
 
## Fallback Rule
If the Tavus API call fails for any reason (timeout, wrong API key, access issue):
Return {fallback_mode: True, conversation_url: None}
The frontend automatically switches to voice-only mode.
The session continues normally. No error is shown to the candidate.
