import json, logging, os, httpx
from anthropic import Anthropic
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv()
client        = Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
TAVUS_API_KEY = os.getenv('TAVUS_API_KEY')
TAVUS_PERSONA = os.getenv('TAVUS_PERSONA_ID') or os.getenv('TAVUS_PERSONA')


def fetch_fallback_tavus_persona():
    if not TAVUS_API_KEY:
        return None
    try:
        resp = httpx.get(
            'https://tavusapi.com/v2/personas?limit=1',
            headers={'x-api-key': TAVUS_API_KEY, 'Content-Type': 'application/json'},
            timeout=10.0
        )
        if resp.status_code != 200:
            logger.warning('Unable to fetch fallback Tavus persona list: status=%s', resp.status_code)
            return None
        data = resp.json()
        if isinstance(data, dict) and isinstance(data.get('data'), list) and data['data']:
            return data['data'][0].get('persona_id')
    except Exception:
        logger.exception('Failed to fetch fallback Tavus persona list')
    return None


def create_tavus_conversation(payload):
    return httpx.post(
        'https://tavusapi.com/v2/conversations',
        headers={
            'x-api-key': TAVUS_API_KEY,
            'Content-Type': 'application/json'
        },
        json=payload,
        timeout=10.0
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
        max_tokens=300
    )
    if not resp.content:
        return "That's an important point. Can you tell me more about what feels most urgent right now?"
    return resp.content[0].text

# ── SCORING AGENT ─────────────────────────────────────────────────────────────

SCORE_PROMPT = (
    'You are an expert executive coaching evaluator. '
    'Evaluate the candidate response on TWO vectors: '
    '1. Human Leadership Score (0-100): psychological safety, empathy, clarity, accountability. '
    '2. Agent/System Leadership Score (0-100): systemic thinking, AI governance, KPI linkage, risk awareness. '
    'Framework in use: {framework}. Candidate CDL: {cdl}. '
    'Return ONLY valid JSON with no other text: '
    '{{"human_score": 0, "agent_score": 0, '
    '"critique": "2 sentences max", "nudge": "coaching tip or null", '
    '"clifton_strength": "strength name if detectable or null"}}'
)

CLIFTON_SIGNALS = {
    'Achiever':       ['accomplish', 'done', 'complete', 'results', 'drive'],
    'Analytical':     ['data', 'evidence', 'analyse', 'pattern', 'reason'],
    'Communication':  ['story', 'explain', 'present', 'message', 'articulate'],
    'Empathy':        ['feel', 'understand', 'care', 'emotion', 'perspective'],
    'Strategic':      ['strategy', 'direction', 'vision', 'path', 'alternative'],
    'Relator':        ['relationship', 'trust', 'close', 'friend', 'personal'],
    'Futuristic':     ['future', 'possibility', 'imagine', 'could be', 'potential'],
}

def score_response(transcript, framework, cdl, analytics=None):
    prompt = SCORE_PROMPT.format(framework=framework, cdl=round(cdl, 1))
    try:
        resp = client.messages.create(
            model='claude-haiku-4-5-20251001',
            system=prompt,
            messages=[{'role': 'user', 'content': transcript}],
            max_tokens=300
        )
        result = json.loads(resp.content[0].text)
        if not result.get('clifton_strength') and transcript:
            tl = transcript.lower()
            for strength, terms in CLIFTON_SIGNALS.items():
                if any(t in tl for t in terms):
                    result['clifton_strength'] = strength
                    break
        return result
    except Exception:
        return {
            'human_score': 70, 'agent_score': 70,
            'critique': 'Score unavailable for this turn.',
            'nudge': None, 'clifton_strength': None
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

    if not TAVUS_API_KEY or not TAVUS_PERSONA:
        logger.error('Tavus configuration missing: TAVUS_API_KEY=%s, TAVUS_PERSONA=%s',
                     bool(TAVUS_API_KEY), bool(TAVUS_PERSONA))
        return {'conversation_id': None, 'conversation_url': None, 'fallback_mode': True}

    try:
        persona_id = TAVUS_PERSONA
        if not persona_id:
            persona_id = fetch_fallback_tavus_persona()
            logger.warning('Using fallback Tavus persona_id %s because env var was not set.', persona_id)

        if not persona_id:
            return {
                'conversation_id': None,
                'conversation_url': None,
                'fallback_mode': True,
                'fallback_reason': 'Tavus persona_id is not configured and no fallback persona was available.'
            }

        payload = {
            'persona_id':             persona_id,
            'conversation_name':      f'Coaching session {session_id}',
            'custom_greeting':        f'Hello {candidate_name}, I am {coach_name}. Ready to begin?',
            'conversational_context': persona_prompt
        }

        resp = create_tavus_conversation(payload)
        data = resp.json()

        if resp.status_code >= 400:
            error_details = data.get('error') or data.get('message') or json.dumps(data)
            logger.error(
                'Tavus conversation creation failed: status=%s response=%s',
                resp.status_code,
                error_details
            )
            return {
                'conversation_id': None,
                'conversation_url': None,
                'fallback_mode': True,
                'fallback_reason': f'Tavus error: {error_details}'
            }

        def extract_field(source, *keys):
            for key in keys:
                if key in source and source[key]:
                    return source[key]
            return None

        conversation_id = extract_field(data, 'conversation_id', 'conversationId', 'id')
        conversation_url = extract_field(
            data,
            'conversation_url', 'conversationUrl', 'url', 'conversation_url', 'conversationUrl'
        )

        if not conversation_id or not conversation_url:
            nested = data.get('conversation') if isinstance(data.get('conversation'), dict) else None
            if nested:
                conversation_id = conversation_id or extract_field(nested, 'conversation_id', 'conversationId', 'id')
                conversation_url = conversation_url or extract_field(
                    nested,
                    'conversation_url', 'conversationUrl', 'url'
                )

        if not conversation_id or not conversation_url:
            logger.error(
                'Tavus response missing conversation data: status=%s response=%s',
                resp.status_code,
                json.dumps(data)
            )
            return {
                'conversation_id': None,
                'conversation_url': None,
                'fallback_mode': True,
                'fallback_reason': 'Tavus response missing conversation_id or conversation_url'
            }

        return {
            'conversation_id':  conversation_id,
            'conversation_url': conversation_url,
            'persona_id':       persona_id,
            'fallback_mode':    False
        }
    except Exception as exc:
        logger.exception('Failed to create Tavus conversation for session %s', session_id)
        return {
            'conversation_id': None,
            'conversation_url': None,
            'fallback_mode': True,
            'fallback_reason': str(exc)
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