import os
from dotenv import load_dotenv
import httpx

load_dotenv()
api_key = os.getenv('TAVUS_API_KEY')
headers = {'x-api-key': api_key, 'Content-Type': 'application/json'}

for url in ['https://tavusapi.com/v2/personas', 'https://tavusapi.com/v2/personas?limit=10']:
    print('URL', url)
    try:
        r = httpx.get(url, headers=headers, timeout=20.0)
        print('status', r.status_code)
        print(r.text)
    except Exception as e:
        print('ERROR', repr(e))
