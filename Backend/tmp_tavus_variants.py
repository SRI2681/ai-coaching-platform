import os
import json
from dotenv import load_dotenv
import httpx

load_dotenv()
api_key = os.getenv('TAVUS_API_KEY')
persona = os.getenv('TAVUS_PERSONA_ID')
print('api_key repr:', repr(api_key))
print('persona repr:', repr(persona))
print('has_key', bool(api_key), 'has_persona', bool(persona))
headers = {'x-api-key': api_key, 'Content-Type': 'application/json'}
variants = [
    ('persona_id', {'persona_id': persona}),
    ('persona', {'persona': persona}),
    ('personaId', {'personaId': persona}),
    ('assistant_id', {'assistant_id': persona}),
    ('assistantId', {'assistantId': persona}),
    ('persona_id_extra', {'persona_id': persona, 'metadata': {'session_id': 'test-session'}}),
]
for name, persona_field in variants:
    body = {
        **persona_field,
        'custom_greeting': 'Hello Test, I am Alex. Ready to begin?',
        'conversational_context': 'You are Alex, a coach.'
    }
    print('\n=== variant:', name, '===')
    print(json.dumps(body, indent=2))
    try:
        resp = httpx.post('https://tavusapi.com/v2/conversations', headers=headers, json=body, timeout=20.0)
        print('status', resp.status_code)
        print(resp.text)
    except Exception as e:
        print('exception', repr(e))
