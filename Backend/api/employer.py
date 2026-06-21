from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.supabase_client import supabase
 
router = APIRouter()
 
@router.get('/team-analytics')
async def get_team_analytics(company_id: str):
    candidates = (
        supabase.table('candidates')
        .select('id, current_cdl, role_level, role_title')
        .eq('company_id', company_id).execute().data
    )
    if not candidates:
        return {'team_size': 0, 'avg_cdl': 0, 'cdl_distribution': {}}
 
    cdls    = [c['current_cdl'] for c in candidates]
    avg_cdl = round(sum(cdls) / len(cdls), 2)
 
    distribution = {'1': 0, '2': 0, '3': 0, '4': 0, '5': 0}
    for cdl in cdls:
        band = str(min(5, max(1, int(cdl))))
        distribution[band] += 1
 
    candidate_ids = [c['id'] for c in candidates]
    sessions = (
        supabase.table('coaching_sessions')
        .select('candidate_id')
        .in_('candidate_id', candidate_ids)
        .eq('status', 'completed').execute().data
    )
    return {
        'team_size':        len(candidates),
        'avg_cdl':          avg_cdl,
        'cdl_distribution': distribution,
        'total_sessions':   len(sessions)
    }
 
 
ROLEPLAY_SCENARIOS = {
    'EMP-001': {
        'title':       'Performance Improvement Conversation',
        'description': 'Team member is missing targets for the third consecutive quarter.',
        'ai_role':     'You are a team member who has missed targets three quarters in a row. '
                       'You feel defensive and are worried about your job. '
                       'Respond realistically — not aggressively, but not fully open either.',
    },
    'EMP-002': {
        'title':       'AI Tool Resistance Conversation',
        'description': 'Team member refuses to use the new AI workflow tools.',
        'ai_role':     'You are a senior team member who distrusts AI tools. '
                       'You have 15 years of experience and believe the old way is better. '
                       'You are polite but resistant. Push back with specific concerns.',
    },
    'EMP-003': {
        'title':       'Delivering Difficult Feedback',
        'description': 'Telling a strong performer they were not selected for promotion.',
        'ai_role':     'You are a high performer who was passed over for promotion. '
                       'You are hurt and confused. You want to understand why. '
                       'Ask specific questions about what you could have done differently.',
    },
}
 
class RolePlayRequest(BaseModel):
    employer_id:          str
    scenario_id:          str = 'EMP-001'
    employer_message:     str
    conversation_history: list = []
 
@router.post('/roleplay/respond')
async def roleplay_respond(req: RolePlayRequest):
    scenario = ROLEPLAY_SCENARIOS.get(req.scenario_id)
    if not scenario:
        raise HTTPException(status_code=400, detail='Unknown scenario')
    messages = req.conversation_history + [
        {'role': 'user', 'content': req.employer_message}
    ]
    from openai import OpenAI
    import os
    client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
    resp = client.chat.completions.create(
        model='gpt-4o',
        messages=[{'role': 'system', 'content': scenario['ai_role']}] + messages,
        max_tokens=200, temperature=0.7
    )
    return {'employee_response': resp.choices[0].message.content}
 
 
@router.get('/scenarios')
async def list_scenarios():
    return [{'id': k, 'title': v['title'], 'description': v['description']}
            for k, v in ROLEPLAY_SCENARIOS.items()]
