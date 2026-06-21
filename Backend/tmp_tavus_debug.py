import os
import json
from dotenv import load_dotenv
import httpx

load_dotenv()
api_key = os.getenv('TAVUS_API_KEY')
persona = os.getenv('TAVUS_PERSONA_ID')
print('has_key', bool(api_key), 'has_persona', bool(persona))
headers = {'x-api-key': api_key, 'Content-Type': 'application/json'}
body = {
    'persona_id': persona,
    'custom_greeting': 'Hello Test, I am Alex. Ready to begin?',
    'conversational_context': 'You are Alex, a coach.',
    'properties': {'session_id': 'test-session'}
}
print('body', json.dumps(body, indent=2))
try:
    resp = httpx.post('https://tavusapi.com/v2/conversations', headers=headers, json=body, timeout=20.0)
    print('status', resp.status_code)
    print('headers', dict(resp.headers))
    print('text', resp.text)
    try:
        print('json', json.dumps(resp.json(), indent=2))
    except Exception as e:
        print('json parse failed', e)
except Exception as e:
    print('exception', repr(e))
