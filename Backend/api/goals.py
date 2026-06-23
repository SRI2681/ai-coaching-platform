from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.supabase_client import supabase

router = APIRouter()


class GoalCreate(BaseModel):
    candidate_id: str
    title: str
    description: Optional[str] = None
    theme: Optional[str] = None


class GoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    theme: Optional[str] = None


@router.get('/goals/{candidate_id}')
def list_goals(candidate_id: str):
    rows = (
        supabase.table('goals')
        .select('*')
        .eq('candidate_id', candidate_id)
        .eq('status', 'active')
        .execute()
        .data
    )
    return rows or []


@router.post('/goals')
def create_goal(req: GoalCreate):
    row = supabase.table('goals').insert({
        'candidate_id': req.candidate_id,
        'goal_text': req.title,
        'title': req.title,
        'description': req.description,
        'theme': req.theme,
        'status': 'active',
        'is_org_assigned': False,
    }).execute().data[0]
    return row


@router.patch('/goals/{goal_id}')
def update_goal(goal_id: str, req: GoalUpdate):
    existing = (
        supabase.table('goals')
        .select('*')
        .eq('id', goal_id)
        .single()
        .execute()
        .data
    )
    if not existing:
        raise HTTPException(status_code=404, detail='Goal not found')
    if existing.get('is_org_assigned'):
        raise HTTPException(status_code=403, detail='Org-assigned goals are read-only')

    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    if 'title' in updates:
        updates['goal_text'] = updates['title']
    if not updates:
        return existing

    updated = (
        supabase.table('goals')
        .update(updates)
        .eq('id', goal_id)
        .execute()
        .data
    )
    return updated[0] if updated else existing
