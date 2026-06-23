  
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import coaching, voice, employer, assessments, action_plans, goals, progress, reports, org, candidates, admin
 
app = FastAPI(title='AI Coaching Platform', version='1.0.0')
 
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)
 
app.include_router(coaching.router, prefix='/api/coaching', tags=['coaching'])
app.include_router(voice.router,    prefix='/api/voice',    tags=['voice'])
app.include_router(employer.router, prefix='/api/employer', tags=['employer'])
app.include_router(assessments.router, prefix='/api', tags=['assessments'])
app.include_router(action_plans.router, prefix='/api', tags=['action_plans'])
app.include_router(goals.router, prefix='/api', tags=['goals'])
app.include_router(progress.router, prefix='/api', tags=['progress'])
app.include_router(reports.router, prefix='/api', tags=['reports'])
app.include_router(org.router, prefix='/api', tags=['org'])
app.include_router(candidates.router, prefix='/api', tags=['candidates'])
app.include_router(admin.router, prefix='/api', tags=['admin'])
 
@app.get('/')
def root():
    return {'status': 'AI Coaching Platform is running'}
