import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from uuid import uuid4
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import text
from .config import ROOT, settings
from .db import Base, engine
from .security import ApiError
from . import clinical, files, governance, jobs, routes


@asynccontextmanager
async def lifespan(app):
    if settings.demo_mode and settings.database_url.startswith('sqlite'):
        Base.metadata.create_all(engine)
        from .seed import seed
        seed()
    jobs.recover()
    yield


app = FastAPI(title='AniqTashxis.ai', version='0.1.0', lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.allowed_origins.split(','), allow_credentials=True, allow_methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], allow_headers=['Content-Type', 'X-CSRF-Token', 'Idempotency-Key', 'X-Request-ID'])
login_attempts = defaultdict(deque)


@app.middleware('http')
async def headers(request: Request, call_next):
    request.state.request_id = str(uuid4())
    if request.url.path == '/api/v1/auth/login' and request.method == 'POST':
        bucket = login_attempts[request.client.host if request.client else 'unknown']
        while bucket and bucket[0] < time.monotonic() - 60:
            bucket.popleft()
        if len(bucket) >= 12:
            return JSONResponse({'error': {'code': 'RATE_LIMIT', 'message': 'Too many login attempts.', 'request_id': request.state.request_id, 'details': {}}}, status_code=429, headers={'Retry-After': '60'})
        bucket.append(time.monotonic())
    if request.method not in {'GET', 'HEAD', 'OPTIONS'}:
        origin = request.headers.get('origin')
        if origin and origin not in settings.allowed_origins.split(','):
            return JSONResponse({'error': {'code': 'ORIGIN_REJECTED', 'message': 'Origin not permitted.', 'request_id': request.state.request_id, 'details': {}}}, status_code=403)
    response = await call_next(request)
    response.headers.update({'X-Request-ID': request.state.request_id, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'SAMEORIGIN'})
    if request.url.path.startswith('/api'):
        response.headers['Cache-Control'] = 'no-store'
    return response


@app.exception_handler(ApiError)
async def api_error(request, error):
    return JSONResponse({'error': {'code': error.code, 'message': error.message, 'request_id': getattr(request.state, 'request_id', ''), 'details': error.details}}, status_code=error.status)


@app.exception_handler(RequestValidationError)
async def validation_error(request, error):
    details = [{'field': '.'.join(map(str, item['loc'])), 'message': item['msg'], 'type': item['type']} for item in error.errors()]
    return JSONResponse({'error': {'code': 'VALIDATION_ERROR', 'message': 'Please check the input fields.', 'request_id': getattr(request.state, 'request_id', ''), 'details': {'fields': details}}}, status_code=422)


@app.exception_handler(Exception)
async def unexpected_error(request, error):
    return JSONResponse({'error': {'code': 'INTERNAL_ERROR', 'message': 'Request failed. Original data is preserved.', 'request_id': getattr(request.state, 'request_id', ''), 'details': {}}}, status_code=500)


app.include_router(routes.router)
app.include_router(files.router)
app.include_router(governance.router)
app.include_router(clinical.router)


@app.get('/api/v1/health/live')
def live():
    return {'status': 'alive'}


@app.get('/api/v1/health/ready')
def ready():
    with engine.connect() as connection:
        connection.execute(text('SELECT 1'))
    from .ai import model_status
    return {'status': 'ready', 'inference_ready': model_status()['ready'], 'clinical_validation': 'not_validated'}


@app.get('/{path:path}', include_in_schema=False)
def frontend(path: str):
    if path.startswith('api/'):
        raise ApiError(404, 'NOT_FOUND', 'Endpoint not found.')
    root = (ROOT / 'frontend' / 'dist').resolve()
    target = (root / path).resolve()
    if not target.is_relative_to(root):
        raise ApiError(404, 'NOT_FOUND', 'Not found.')
    if target.is_file():
        return FileResponse(target)
    if (root / 'index.html').is_file():
        return FileResponse(root / 'index.html')
    return JSONResponse({'app': 'AniqTashxis', 'frontend': 'Run npm run dev in frontend or build it.', 'docs': '/docs'})
