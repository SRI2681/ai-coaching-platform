import os
import json
from dotenv import load_dotenv
import httpx

load_dotenv()
api_key = os.getenv('TAVUS_API_KEY')
persona_id = os.getenv('TAVUS_PERSONA_ID')
vapi_id = os.getenv('VAPI_ASSISTANT_ID')
headers = {'x-api-key': api_key, 'Content-Type': 'application/json'}
for name, persona in [('TAVUS_PERSONA_ID', persona_id), ('VAPI_ASSISTANT_ID', vapi_id)]:
    print('---', name, persona)
    body = {
        'persona_id': persona,
        'custom_greeting': 'Hello Test, I am Alex. Ready to begin?',
        'conversational_context': 'You are Alex, a coach.'
    }
    try:
        resp = httpx.post('https://tavusapi.com/v2/conversations', headers=headers, json=body, timeout=20.0)
        print(resp.status_code)
        print(resp.text)
    except Exception as e:
        print('ERROR', repr(e))
