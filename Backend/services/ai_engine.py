import json, logging, os, httpx
from anthropic import Anthropic
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv()
client        = Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
ANAM_API_KEY = os.getenv('ANAM_API_KEY')
ANAM_PERSONA_ID = os.getenv('ANAM_PERSONA_ID')


def create_anam_session_token(persona_id: str, system_prompt: str | None = None) -> httpx.Response:
    persona_config = {'personaId': persona_id}
    if system_prompt:
        persona_config['systemPrompt'] = system_prompt
    return httpx.post(
        'https://api.anam.ai/v1/auth/session-token',
        headers={
            'Authorization': f'Bearer {ANAM_API_KEY}',
            'Content-Type': 'application/json',
        },
        json={'personaConfig': persona_config},
        timeout=15.0,
    )

# ── COACHING AGENT ────────────────────────────────────────────────────────────

COACH_PERSONA = (
    'You are {name}, an executive coach with 20 years of experience coaching '
    '{role} leaders at enterprise organizations. '
    'You use the {framework} coaching framework. '
    'You are coaching {candidate}. '
    'Be direct, warm, and ask one powerful open question per turn. '
    'Maximum 120 words. Always end with a question. Never break character. '
    'DIFFICULTY CALIBRATION — you are at CDL {cdl}: '
    'CDL 1.0-1.9: Ask simple single-part awareness questions about goals and current situation. '
    'CDL 2.0-2.9: Ask two-part questions that connect cause and effect. '
    'CDL 3.0-3.9: Challenge assumptions. Add stakeholder complexity. Ask about system interactions. '
    'CDL 4.0-4.9: Introduce systemic friction and competing priorities across human and AI systems. '
    'CDL 5.0: Multi-stakeholder crisis scenario with no single right answer — require trade-off reasoning. '
    '{nudge_instruction}'
)

def get_coach_response(messages, candidate, framework, coach_name='Alex',
                       nudge=None, cdl=1.0):
    nudge_instruction = (
        f'NUDGE: Weave this naturally into your response without stating it directly: {nudge}'
        if nudge else ''
    )
    system = COACH_PERSONA.format(
        name=coach_name,
        framework=framework,
        candidate=candidate.get('first_name', 'there'),
        role=candidate.get('role_title', 'leader'),
        cdl=round(cdl, 1),
        nudge_instruction=nudge_instruction
    )
    if not messages:
        messages = [{'role': 'user', 'content': 'Begin the coaching session.'}]
    resp = client.messages.create(
        model='claude-haiku-4-5-20251001',
        system=system,
        messages=messages,
        max_tokens=90      # was 300 - keeps the coach to ~45 words
    )
    if not resp.content:
        return "That's an important point. Can you tell me more about what feels most urgent right now?"
    return resp.content[0].text

# ── SCORING AGENT ─────────────────────────────────────────────────────────────

SCORE_PROMPT = (
    'You are an expert executive coaching evaluator trained in the '
    'ActionCOACH and FocalPoint methodologies. Evaluate the candidate '
    'response on THREE executive competencies, each scored 0-100: '
    '1. Strategic Thinking: long-term planning, market awareness, '
    'finding leverage over daily firefighting. '
    '2. Operational Accountability: clear timelines, delegation, '
    'tracking numbers/KPIs, following through on prior promises. '
    '3. Influence & Communication: clarity, emotional intelligence, '
    'motivation, alignment with culture. '
    'Framework in use: {framework}. Candidate CDL: {cdl}. '
    'Return ONLY valid JSON, no other text, no code fences: '
    '{{"strategic_thinking_score": 0, '
    '"operational_accountability_score": 0, '
    '"influence_communication_score": 0, '
    '"critique": "2 sentences max", '
    '"nudge": "one coaching tip or null"}}'
)

def score_response(transcript, framework, cdl, analytics=None):
    prompt = SCORE_PROMPT.format(framework=framework, cdl=round(cdl, 1))
    try:
        resp = client.messages.create(
            model='claude-haiku-4-5-20251001',
            system=prompt,
            messages=[{'role': 'user', 'content': transcript}],
            max_tokens=300
        )
        return json.loads(resp.content[0].text)
    except Exception:
        return {
            'strategic_thinking_score': 70,
            'operational_accountability_score': 70,
            'influence_communication_score': 70,
            'critique': 'Score unavailable for this turn.',
            'nudge': None
        }
    
    # ── MEMORY AGENT — SESSION SUMMARY ───────────────────────────────────────────

SUMMARY_PROMPT = (
    'You are an executive coaching analyst. '
    'Read the coaching session transcript below and generate a structured debrief. '
    'Framework used: {framework}. CDL moved from {cdl_start} to {cdl_end}. '
    'Return ONLY valid JSON with no other text: '
    '{{"summary_text": "2-3 sentence overview", '
    '"key_win": "strongest leadership moment", '
    '"key_gap": "most important area to work on", '
    '"key_insight": "one insight the candidate discovered", '
    '"action_item": "one specific action before next session", '
    '"growth_moment": "a specific quote showing breakthrough thinking or null"}}'
)

def generate_session_summary(turns, framework, cdl_start, cdl_end):
    transcript_lines = []
    for t in turns:
        role_label = 'CANDIDATE' if t['role'] == 'candidate' else 'COACH'
        transcript_lines.append(f'{role_label}: {t["content"]}')
    transcript_text = '\n'.join(transcript_lines)
    prompt = SUMMARY_PROMPT.format(
        framework=framework, cdl_start=cdl_start, cdl_end=cdl_end
    )
    try:
        resp = client.messages.create(
            model='claude-haiku-4-5-20251001',
            system=prompt,
            messages=[{'role': 'user', 'content': transcript_text}],
            max_tokens=500
        )
        return json.loads(resp.content[0].text)
    except Exception:
        return {
            'summary_text': 'Session summary could not be generated.',
            'key_win': 'To be reviewed', 'key_gap': 'To be reviewed',
            'key_insight': None, 'action_item': 'Reflect on this session',
            'growth_moment': None
        }
    
    # ── AVATAR AGENT ──────────────────────────────────────────────────────────────

AVATAR_SYSTEM_PROMPT = (
    'You are {name}, an executive coach with 20 years of experience. '
    'You are warm, direct, and professionally confident. '
    'You use the {framework} coaching framework. '
    'You are speaking live to {candidate_name}. '
    'Ask one question at a time. Maximum 80 words per response. '
    'Always end with a question. Maintain natural eye contact and appropriate pacing.'
)

def create_avatar_session(candidate_name, coach_name, framework, session_id):
    persona_prompt = AVATAR_SYSTEM_PROMPT.format(
        name=coach_name,
        framework=framework,
        candidate_name=candidate_name
    )

    if not ANAM_API_KEY or not ANAM_PERSONA_ID:
        logger.error(
            'Anam configuration missing: ANAM_API_KEY=%s, ANAM_PERSONA_ID=%s',
            bool(ANAM_API_KEY), bool(ANAM_PERSONA_ID)
        )
        return {'session_token': None, 'fallback_mode': True}

    try:
        resp = create_anam_session_token(ANAM_PERSONA_ID, persona_prompt)
        data = resp.json() if resp.content else {}

        if resp.status_code >= 400:
            error_details = data.get('message') or data.get('error') or json.dumps(data)
            logger.error(
                'Anam session token creation failed: status=%s response=%s',
                resp.status_code,
                error_details,
            )
            return {
                'session_token': None,
                'fallback_mode': True,
                'fallback_reason': f'Anam error: {error_details}',
            }

        session_token = data.get('sessionToken') or data.get('session_token')
        if not session_token:
            logger.error(
                'Anam response missing sessionToken: status=%s response=%s',
                resp.status_code,
                json.dumps(data),
            )
            return {
                'session_token': None,
                'fallback_mode': True,
                'fallback_reason': 'Anam response missing sessionToken',
            }

        return {
            'session_token': session_token,
            'persona_id': ANAM_PERSONA_ID,
            'fallback_mode': False,
        }
    except Exception as exc:
        logger.exception('Failed to create Anam session for %s', session_id)
        return {
            'session_token': None,
            'fallback_mode': True,
            'fallback_reason': str(exc),
        }

# ── FRAMEWORK SELECTOR SKILL ──────────────────────────────────────────────────

def select_framework(role_level, primary_goal, current_cdl,
                     employer_override=None):
    if employer_override:
        return employer_override
    if role_level in ['c-suite', 'vp']:
        return 'Goldsmith'
    goal_lower = (primary_goal or '').lower()
    if 'revenue' in goal_lower or 'scale' in goal_lower:
        return 'ActionCOACH'
    if role_level == 'director' and 'kpi' in goal_lower:
        return 'MAP'
    return 'GROW'