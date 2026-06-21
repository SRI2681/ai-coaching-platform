  
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import coaching, voice, employer
 
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
 
@app.get('/')
def root():
    return {'status': 'AI Coaching Platform is running'}
