# backend/api/action_plans.py
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services import action_plan_engine as ape
from services.supabase_client import supabase

router = APIRouter()


class GenerateReq(BaseModel):
    candidate_id: str
    goal: str
    baseline: dict[str, Any]
    goal_id: Optional[str] = None


class UpdateItemReq(BaseModel):
    is_completed: bool


def _fetch_plan_items(plan_id: str) -> list[dict]:
    return (
        supabase.table("action_items")
        .select("*")
        .eq("action_plan_id", plan_id)
        .order("created_at")
        .execute()
        .data
        or []
    )


def _get_active_plan(candidate_id: str) -> Optional[dict]:
    rows = (
        supabase.table("action_plans")
        .select("*")
        .eq("candidate_id", candidate_id)
        .eq("status", "active")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    return rows[0] if rows else None


@router.post("/action-plans/generate")
def generate_plan(req: GenerateReq):
    baseline = req.baseline
    if not baseline or not baseline.get('level'):
        loaded = ape.load_baseline_from_db(req.candidate_id)
        if loaded:
            baseline = loaded
    if not baseline:
        raise HTTPException(
            status_code=400,
            detail='Complete a baseline assessment before generating an action plan.',
        )

    plan_id = ape.generate_action_plan(
        req.candidate_id, req.goal, baseline, req.goal_id
    )
    plan = (
        supabase.table("action_plans")
        .select("*")
        .eq("id", plan_id)
        .single()
        .execute()
        .data
    )
    items = _fetch_plan_items(plan_id)
    return {"plan_id": plan_id, "plan": plan, "items": items}


@router.get("/action-plans/{candidate_id}")
def get_plan(candidate_id: str):
    plan = _get_active_plan(candidate_id)
    if not plan:
        raise HTTPException(status_code=404, detail="No active action plan found")
    items = _fetch_plan_items(plan["id"])
    return {"plan": plan, "items": items}


@router.patch("/action-items/{item_id}")
def update_item(item_id: str, req: UpdateItemReq):
    existing = (
        supabase.table("action_items")
        .select("*")
        .eq("id", item_id)
        .single()
        .execute()
        .data
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Action item not found")

    update: dict[str, Any] = {"is_completed": req.is_completed}
    if req.is_completed:
        update["completed_at"] = datetime.now(timezone.utc).isoformat()
    else:
        update["completed_at"] = None

    updated = (
        supabase.table("action_items")
        .update(update)
        .eq("id", item_id)
        .execute()
        .data
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Action item not found")
    return updated[0]
