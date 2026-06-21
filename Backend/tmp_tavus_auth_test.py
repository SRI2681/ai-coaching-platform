import os, json
from dotenv import load_dotenv
import httpx

load_dotenv()
api_key = os.getenv('TAVUS_API_KEY')
persona = os.getenv('TAVUS_PERSONA_ID')
for auth_header in [
    {'x-api-key': api_key, 'Content-Type': 'application/json'},
    {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
]:
    print('AUTH', auth_header)
    body = {
        'persona_id': persona,
        'custom_greeting': 'Hello Test, I am Alex. Ready to begin?',
        'conversational_context': 'You are Alex, a coach.'
    }
    try:
        resp = httpx.post('https://tavusapi.com/v2/conversations', headers=auth_header, json=body, timeout=20.0)
        print(resp.status_code)
        print(resp.text)
    except Exception as e:
        print('ERROR', repr(e))
