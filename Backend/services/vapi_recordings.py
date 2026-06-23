"""Fetch call recordings from Vapi when not provided by the client."""

import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


def fetch_vapi_recording(call_id: str) -> Optional[str]:
    api_key = os.getenv('VAPI_API_KEY') or os.getenv('VAPI_PRIVATE_KEY')
    if not api_key or not call_id:
        return None
    try:
        resp = httpx.get(
            f'https://api.vapi.ai/call/{call_id}',
            headers={'Authorization': f'Bearer {api_key}'},
            timeout=15.0,
        )
        if resp.status_code >= 400:
            logger.warning('Vapi call fetch failed: %s', resp.status_code)
            return None
        data = resp.json()
        artifact = data.get('artifact') or {}
        return (
            data.get('recordingUrl')
            or artifact.get('recordingUrl')
            or artifact.get('recording', {}).get('url')
            or data.get('recording', {}).get('url')
        )
    except Exception as exc:
        logger.warning('Vapi recording fetch error: %s', exc)
        return None
