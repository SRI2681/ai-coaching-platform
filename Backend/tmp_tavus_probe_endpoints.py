import os
import json
from dotenv import load_dotenv
import httpx

load_dotenv()
api_key = os.getenv('TAVUS_API_KEY')
persona = os.getenv('TAVUS_PERSONA_ID')
headers = {'x-api-key': api_key, 'Content-Type': 'application/json'}
base_urls = [
    'https://tavusapi.com/v2/conversations',
    'https://api.tavus.com/v2/conversations',
    'https://api.tavus.ai/v2/conversations'
]
payload = {
    'persona_id': persona,
    'custom_greeting': 'Hello Test, I am Alex. Ready to begin?',
    'conversational_context': 'You are Alex, a coach.'
}
for url in base_urls:
    print('===', url)
    try:
        resp = httpx.post(url, headers=headers, json=payload, timeout=20.0)
        print('status', resp.status_code)
        print(resp.text)
    except Exception as e:
        print('error', repr(e))
