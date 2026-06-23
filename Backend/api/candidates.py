from fastapi import APIRouter, HTTPException

from services.candidate_profile import build_candidate_profile

router = APIRouter()


@router.get('/candidates/{candidate_id}/profile')
def get_candidate_profile(candidate_id: str):
    profile = build_candidate_profile(candidate_id)
    if not profile:
        raise HTTPException(status_code=404, detail='Candidate not found')
    return profile
