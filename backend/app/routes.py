import hashlib
import re
import secrets
from datetime import timedelta
from fastapi import APIRouter, Depends, Request, Response
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError
from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session as DBSession
from .config import settings
from .db import Case, CaseAccess, Job, PatientCodeAllocation, Record, Session, User, get_db, now
from .schemas import AnalysisCreate, AnalysisRetry, AuthResponse, CaseCreate, ConfirmFacts, FactInput, FactsPatch, ForecastCreate, ImportCreate, Login, NoteCreate, NoteDraft, ReviewCreate
from .ai_locale import normalize_language
from .security import ApiError, access_case, access_record, account_enabled, audit, bump_case, create_record, current_facts, current_user, idem_key, idempotent, require_role, serialize
from . import jobs

router = APIRouter(prefix='/api/v1')
password_hasher = PasswordHasher()


def case_json(case):
    return {'id': case.id, 'alias': case.alias, 'full_name': case.full_name, 'patient_phone': case.patient_phone, 'age': case.age, 'sex': case.sex, 'summary': case.summary, 'diagnosis': case.diagnosis, 'version': case.version, 'demo': case.demo, 'owner_id': case.owner_id, 'created_at': case.created_at.isoformat(), 'updated_at': case.updated_at.isoformat()}


def case_snapshot(case):
    """Registration identity is not clinical evidence or model input."""
    return {key: value for key, value in case_json(case).items() if key not in {'full_name', 'patient_phone'}}


def user_json(user):
    from sqlalchemy.orm import object_session
    from .billing_models import Clinic
    db = object_session(user)
    clinic = db.get(Clinic, user.tenant_id) if db else None
    return {'id': user.id, 'name': user.name, 'email': user.email, 'role': user.role, 'tenant_id': user.tenant_id, 'is_clinic_owner': bool(clinic and clinic.owner_id == user.id)}


@router.post('/auth/login', response_model=AuthResponse)
def login(body: Login, response: Response, db: DBSession = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower(), User.active.is_(True)))
    valid = False
    if account_enabled(user):
        try:
            valid = password_hasher.verify(user.password_hash, body.password)
        except VerificationError:
            pass
    if not valid:
        raise ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.')
    token = secrets.token_urlsafe(32)
    session = Session(id=hashlib.sha256(token.encode()).hexdigest(), user_id=user.id, csrf=secrets.token_urlsafe(24), expires_at=now() + timedelta(hours=settings.session_hours))
    db.add(session)
    audit(db, user, 'session.login', user.id)
    db.commit()
    response.set_cookie('aniq_session', token, httponly=True, secure=settings.cookie_secure, samesite='strict', max_age=settings.session_hours * 3600, path='/')
    return {'user': user_json(user), 'csrf_token': session.csrf}


@router.get('/auth/me', response_model=AuthResponse)
def me(request: Request, user: User = Depends(current_user)):
    return {'user': user_json(user), 'csrf_token': request.state.session.csrf}


@router.post('/auth/logout')
def logout(request: Request, response: Response, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    db.delete(request.state.session)
    audit(db, user, 'session.logout', user.id)
    db.commit()
    response.delete_cookie('aniq_session', path='/')
    return {'ok': True}


@router.get('/cases')
def list_cases(q: str = '', bucket: str = 'all', page: int = 1, page_size: int = 20, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    require_role(user, 'doctor', 'radiologist', 'expert', 'quality', 'sender')
    granted = select(CaseAccess.case_id).where(CaseAccess.user_id == user.id)
    query = select(Case).where(Case.tenant_id == user.tenant_id, Case.archived.is_(False), or_(Case.owner_id == user.id, Case.id.in_(granted)))
    cases = list(db.scalars(query.order_by(Case.updated_at.desc())))
    if q.strip():
        # Python casefold handles Cyrillic and Uzbek names consistently on both
        # SQLite and PostgreSQL. Phone searches also ignore display punctuation.
        term = q.strip()[:200].casefold()
        phone_digits = re.sub(r'\D', '', term)
        cases = [case for case in cases if any(term in str(value or '').casefold() for value in (case.alias, case.full_name, case.patient_phone, case.summary, case.diagnosis)) or (len(phone_digits) >= 3 and all(char.isdigit() or char in '+- ()' for char in term) and phone_digits in re.sub(r'\D', '', case.patient_phone))]
    stats = {'total': len(cases), 'alerts': 0, 'reviewed': 0, 'analyses': 0}
    items = []
    for case in cases:
        alerts = list(db.scalars(select(Record).where(Record.case_id == case.id, Record.kind == 'alert')))
        runs = list(db.scalars(select(Job).where(Job.case_id == case.id).order_by(Job.created_at.desc())))
        open_alerts = sum(a.data['status'] not in {'closed', 'rejected'} for a in alerts)
        stats['alerts'] += open_alerts
        stats['analyses'] += len(runs)
        stats['reviewed'] += sum(a.data['status'] in {'closed', 'accepted', 'rejected'} for a in alerts)
        facts = current_facts(db, case.id)
        studies = list(db.scalars(select(Record).where(Record.case_id == case.id, Record.kind == 'study')))
        imaging_reviews = list(db.scalars(select(Record).where(Record.case_id == case.id, Record.kind == 'imaging_review')))
        reviewed_studies = {r.data['study_id'] for r in imaging_reviews}
        items.append({**case_json(case), 'alert_count': open_alerts, 'pending_facts': sum(not f['confirmed'] for f in facts), 'reviewed_count': sum(a.data['status'] in {'closed', 'accepted', 'rejected'} for a in alerts), 'study_count': len(studies), 'pending_imaging': sum(s.id not in reviewed_studies for s in studies), 'analysis_count': len(runs), 'latest_status': runs[0].status if runs else 'not_started', 'latest_version': runs[0].case_version if runs else None})
    filters = {'all': lambda item: True, 'alerts': lambda item: item['alert_count'] > 0, 'pending': lambda item: item['pending_facts'] > 0, 'reviewed': lambda item: item['reviewed_count'] > 0, 'analyses': lambda item: item['analysis_count'] > 0, 'imaging_pending': lambda item: item['pending_imaging'] > 0}
    if bucket not in filters:
        raise ApiError(422, 'INVALID_FILTER', 'Unknown case filter.')
    items = [item for item in items if filters[bucket](item)]
    page_size, page = min(max(page_size, 1), 100), max(page, 1)
    return {'items': items[(page - 1) * page_size:page * page_size], 'total': len(items), 'page': page, 'page_size': page_size, 'stats': stats}


@router.post('/cases', status_code=201)
def create_case(body: CaseCreate, user: User = Depends(current_user), db: DBSession = Depends(get_db), key=Depends(idem_key)):
    require_role(user, 'doctor')
    def run():
        # Database sequence reservations serialize concurrent registrations. Skip
        # any historical manually assigned codes without renaming old records.
        while True:
            reservation = PatientCodeAllocation()
            db.add(reservation)
            db.flush()
            alias = f'AT-{reservation.id:08d}'
            if not db.scalar(select(Case.id).where(Case.alias == alias).limit(1)):
                break
        case = Case(tenant_id=user.tenant_id, owner_id=user.id, alias=alias, **body.model_dump(), demo=settings.demo_mode)
        db.add(case)
        db.flush()
        # Demo collaborators are explicitly granted at creation, never by tenant alone.
        for collaborator in db.scalars(select(User).where(User.tenant_id == user.tenant_id, User.role.in_(['expert', 'quality', 'sender', 'radiologist']))):
            db.add(CaseAccess(case_id=case.id, user_id=collaborator.id))
        audit(db, user, 'case.created', case.id)
        return case_json(case)
    return idempotent(db, user, 'case.create', key, body.model_dump(), run)


@router.get('/cases/{case_id}')
def get_case(case_id: str, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    case = access_case(db, user, case_id)
    audit(db, user, 'case.viewed', case.id)
    db.commit()
    records = list(db.scalars(select(Record).where(Record.case_id == case.id).order_by(Record.created_at.desc())))
    runs = list(db.scalars(select(Job).where(Job.case_id == case.id).order_by(Job.created_at.desc())))
    staff = {u.id: u.name for u in db.scalars(select(User).where(User.tenant_id == user.tenant_id))}
    studies = [{**serialize(r), 'reviews': [{**serialize(review), 'reviewer_name': staff.get(review.actor_id, '')} for review in records if review.kind == 'imaging_review' and review.data.get('study_id') == r.id], 'measurements': [serialize(m) for m in records if m.kind == 'imaging_measurement' and m.data.get('study_id') == r.id], 'analyses': [job_json(j, case) for j in runs if j.kind == 'imaging' and j.payload.get('study_id') == r.id]} for r in records if r.kind == 'study']
    alerts = [{**serialize(r), 'reviews': [{**serialize(review), 'reviewer_name': staff.get(review.actor_id, '')} for review in reversed(records) if review.kind == 'review' and review.data.get('alert_id') == r.id]} for r in records if r.kind == 'alert']
    return {**case_json(case), 'facts': current_facts(db, case.id), 'notes': [serialize(r) for r in records if r.kind == 'note'], 'documents': [source_public(r) for r in records if r.kind == 'source'], 'alerts': alerts, 'analyses': [job_json(r, case) for r in runs], 'forecasts': [serialize(r) for r in records if r.kind == 'forecast'], 'studies': studies, 'clinical_conclusions': [serialize(r) for r in records if r.kind == 'clinical_conclusion']}


def source_public(record):
    data = serialize(record)
    data.pop('storage_path', None)
    return data


@router.get('/cases/{case_id}/versions')
def versions(case_id: str, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    access_case(db, user, case_id)
    records = db.scalars(select(Record).where(Record.case_id == case_id, Record.kind.in_(['fact', 'note', 'case_revision', 'clinical_conclusion', 'clinical_entry', 'imaging_report'])).order_by(Record.case_version.desc(), Record.created_at.desc()))
    return {'items': [serialize(r) for r in records]}


@router.get('/cases/{case_id}/facts')
def facts(case_id: str, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    case = access_case(db, user, case_id)
    return {'items': current_facts(db, case_id), 'version': case.version}


@router.patch('/cases/{case_id}/facts')
def add_facts(case_id: str, body: FactsPatch, user: User = Depends(current_user), db: DBSession = Depends(get_db), key=Depends(idem_key)):
    require_role(user, 'doctor')
    case = access_case(db, user, case_id)
    def run():
        if body.supersedes and len(body.supersedes) != len(body.facts):
            raise ApiError(422, 'INVALID_REVISIONS', 'Provide one previous fact per replacement.')
        version = bump_case(db, case, body.expected_version)
        ids = []
        for i, fact in enumerate(body.facts):
            data = fact.model_dump(mode='json')
            if fact.provenance in {'document', 'dmed_demo'} and not fact.source_id:
                raise ApiError(422, 'SOURCE_REQUIRED', 'Document and import facts require an original source.')
            if fact.source_id:
                source = access_record(db, user, fact.source_id, ['source', 'note'])
                if source.case_id != case.id:
                    raise ApiError(422, 'SOURCE_CASE_MISMATCH', 'Evidence belongs to a different case.')
                if fact.provenance == 'dmed_demo' and source.data.get('type') != 'dmed_demo':
                    raise ApiError(422, 'SOURCE_PROVENANCE_MISMATCH', 'This source is not a DMED import.')
                if not fact.span:
                    raise ApiError(422, 'SOURCE_SPAN_REQUIRED', 'Choose the source excerpt.')
                if fact.span.startswith('excerpt:'):
                    excerpt = fact.span.removeprefix('excerpt:').strip()
                    if not excerpt or excerpt not in source.data.get('text', ''):
                        raise ApiError(422, 'INVALID_SOURCE_SPAN', 'The quoted excerpt is absent from the source.')
                elif source.data.get('type') in {'pdf', 'txt', 'docx'}:
                    match = re.fullmatch(r'page:(\d+):chars:(\d+)-(\d+)', fact.span)
                    page = next((p for p in source.data.get('pages', []) if match and p['page'] == int(match[1])), None)
                    if not match or not page or not 0 <= int(match[2]) < int(match[3]) <= len(page['text']):
                        raise ApiError(422, 'INVALID_SOURCE_SPAN', 'Select a real source excerpt or valid page range.')
            else:
                source = create_record(db, user, 'source', {'name': 'Manual entry', 'type': 'manual', 'text': f'{fact.label}: {fact.value} {fact.unit or ""}', 'pages': [], 'sha256': hashlib.sha256(str(data).encode()).hexdigest(), 'limitations': []}, case)
                data['source_id'], data['span'] = source.id, 'form:' + fact.key
            if body.supersedes:
                previous = access_record(db, user, body.supersedes[i], ['fact'])
                if previous.case_id != case.id:
                    raise ApiError(422, 'FACT_CASE_MISMATCH', 'Fact belongs to a different case.')
                if previous.id not in {f['id'] for f in current_facts(db, case.id)}:
                    raise ApiError(409, 'FACT_SUPERSEDED', 'Fact already has a newer revision.')
                data['supersedes'] = previous.id
            record = create_record(db, user, 'fact', data, case, version)
            ids.append(record.id)
        audit(db, user, 'facts.updated', case.id)
        return {'case_id': case.id, 'version': version, 'fact_ids': ids}
    return idempotent(db, user, f'facts:{case_id}', key, body.model_dump(mode='json'), run)


@router.post('/cases/{case_id}/facts/confirm')
def confirm(case_id: str, body: ConfirmFacts, user: User = Depends(current_user), db: DBSession = Depends(get_db), key=Depends(idem_key)):
    require_role(user, 'doctor')
    case = access_case(db, user, case_id)
    def run():
        current_ids = {f['id'] for f in current_facts(db, case.id)}
        if not set(body.fact_ids) <= current_ids:
            raise ApiError(409, 'FACT_SUPERSEDED', 'Refresh the fact list.')
        bump_case(db, case, body.expected_version)
        for fact_id in body.fact_ids:
            record = access_record(db, user, fact_id, ['fact'])
            if record.case_id != case.id:
                raise ApiError(422, 'FACT_CASE_MISMATCH', 'Invalid fact.')
            create_record(db, user, 'fact', {**record.data, 'confirmed': True, 'supersedes': record.id}, case)
        audit(db, user, 'facts.confirmed', case.id)
        return {'version': case.version}
    return idempotent(db, user, f'confirm:{case_id}', key, body.model_dump(), run)


@router.post('/cases/{case_id}/notes', status_code=201)
def note(case_id: str, body: NoteCreate, user: User = Depends(current_user), db: DBSession = Depends(get_db), key=Depends(idem_key)):
    require_role(user, 'doctor')
    case = access_case(db, user, case_id)
    def run():
        bump_case(db, case, body.expected_version)
        record = create_record(db, user, 'note', body.model_dump(mode='json'), case)
        audit(db, user, 'note.created', record.id)
        return serialize(record)
    return idempotent(db, user, f'note:{case_id}', key, body.model_dump(mode='json'), run)


@router.get('/cases/{case_id}/drafts/note')
def get_note_draft(case_id: str, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    require_role(user, 'doctor')
    access_case(db, user, case_id)
    draft = db.scalar(select(Record).where(Record.kind == 'note_draft', Record.case_id == case_id, Record.actor_id == user.id).order_by(Record.created_at.desc()))
    return {'values': draft.data if draft else None}


@router.put('/cases/{case_id}/drafts/note')
def save_note_draft(case_id: str, body: NoteDraft, user: User = Depends(current_user), db: DBSession = Depends(get_db), key=Depends(idem_key)):
    require_role(user, 'doctor')
    case = access_case(db, user, case_id)
    def run():
        draft = create_record(db, user, 'note_draft', body.model_dump(), case)
        return {'saved_at': draft.created_at.isoformat()}
    return idempotent(db, user, f'note.draft:{case_id}', key, body.model_dump(), run)


def job_json(job, case):
    return {'id': job.id, 'run_id': job.id, 'case_id': job.case_id, 'case_version': job.case_version, 'kind': job.kind, 'review_focus': job.payload.get('review_focus', 'documentation'), 'include_ai': job.payload.get('include_ai', False), 'language': normalize_language(job.payload.get('language') or (job.result or {}).get('language')), 'mode': job.payload['mode'], 'status': job.status, 'stage': job.stage, 'is_stale': job.case_version != case.version, 'created_at': job.created_at.isoformat(), 'finished_at': job.finished_at.isoformat() if job.finished_at else None, 'error_code': job.error_code, 'result': job.result}


@router.post('/cases/{case_id}/analyses', status_code=202)
@router.post('/cases/{case_id}/second-opinions', status_code=202)
def analyse(case_id: str, body: AnalysisCreate, request: Request, user: User = Depends(current_user), db: DBSession = Depends(get_db), key=Depends(idem_key)):
    require_role(user, 'doctor')
    case = access_case(db, user, case_id)
    def run():
        if case.version != body.expected_version:
            raise ApiError(409, 'CASE_VERSION_CONFLICT', 'Refresh the case before analysis.', {'current_version': case.version})
        if body.mode == 'decision_time' and not body.decision_time:
            raise ApiError(422, 'CUTOFF_REQUIRED', 'Specify the decision time with timezone.')
        active = list(db.scalars(select(Job).where(Job.tenant_id == user.tenant_id, Job.status.in_(['queued', 'running']))))
        if len(active) >= 10:
            raise ApiError(429, 'QUEUE_FULL', 'Analysis queue is full.')
        if any(job.case_id == case.id for job in active):
            raise ApiError(409, 'ANALYSIS_ALREADY_RUNNING', 'An analysis is already running for this case.')
        notes = [serialize(r) for r in db.scalars(select(Record).where(Record.case_id == case.id, Record.kind == 'note').order_by(Record.created_at))]
        snapshot = {**case_snapshot(case), 'facts': current_facts(db, case.id), 'notes': notes, 'language': body.language}
        if body.review_focus == 'clinical_assessment':
            from .clinical import evidence_report
            if case.age is None or not 18 <= case.age <= 120:
                raise ApiError(422, 'OUTSIDE_DEMO_SCOPE', 'The current clinical review supports adults with a known age of 18–120 years.')
            quality = evidence_report(snapshot['facts'], body.mode, body.decision_time.isoformat() if body.decision_time else None)
            if not body.include_ai or not quality['clinical_review_ready']:
                raise ApiError(422, 'INSUFFICIENT_CONFIRMED_EVIDENCE', 'Confirm symptom evidence and at least one additional observation before clinical review.')
        job = Job(tenant_id=user.tenant_id, actor_id=user.id, case_id=case.id, case_version=case.version, kind='second_opinion' if request.url.path.endswith('second-opinions') else 'analysis', payload={**body.model_dump(mode='json'), 'snapshot': snapshot})
        db.add(job)
        db.flush()
        audit(db, user, 'analysis.queued', job.id)
        return {'run_id': job.id, 'case_version': case.version, 'status': 'queued', 'status_url': f'/api/v1/analyses/{job.id}'}
    result = idempotent(db, user, f'analysis:{case_id}:{request.url.path}', key, body.model_dump(mode='json'), run)
    jobs.dispatch(result['run_id'])
    return result


@router.get('/analyses/{job_id}')
@router.get('/second-opinions/{job_id}')
def get_job(job_id: str, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    job = db.get(Job, job_id)
    if not job or job.tenant_id != user.tenant_id:
        raise ApiError(404, 'JOB_NOT_FOUND', 'Job not available.')
    case = access_case(db, user, job.case_id)
    return job_json(job, case)


@router.post('/analyses/{job_id}/retry', status_code=202)
def retry_job(job_id: str, body: AnalysisRetry, user: User = Depends(current_user), db: DBSession = Depends(get_db), key=Depends(idem_key)):
    require_role(user, 'doctor', 'radiologist')
    get_job(job_id, user, db)
    original = db.get(Job, job_id)
    if user.role == 'radiologist' and original.kind != 'imaging':
        raise ApiError(403, 'ROLE_FORBIDDEN', 'Only the doctor can retry a clinical text review.')
    case = access_case(db, user, original.case_id)
    def run():
        if case.version != body.expected_version or case.version != original.case_version:
            raise ApiError(409, 'CASE_VERSION_CONFLICT', 'Start a new analysis for the current version.')
        language = body.language or normalize_language(original.payload.get('language'))
        locale_changed = language != normalize_language(original.payload.get('language'))
        if original.status not in {'partial', 'failed', 'cancelled'} and not (original.status == 'succeeded' and locale_changed):
            raise ApiError(409, 'JOB_NOT_RETRYABLE', 'Job is not retryable.')
        active = list(db.scalars(select(Job).where(Job.tenant_id == user.tenant_id, Job.status.in_(['queued', 'running']))))
        if len(active) >= 10:
            raise ApiError(429, 'QUEUE_FULL', 'Analysis queue is full.')
        if any(job.case_id == case.id for job in active):
            raise ApiError(409, 'ANALYSIS_ALREADY_RUNNING', 'An analysis is already running for this case.')
        payload = {**original.payload, 'retry_of': original.id, 'language': language}
        if original.kind in {'clinical_comparison', 'imaging'}:
            # A new inference from a prepared example is a real model request;
            # preserve the example itself but do not inherit its seed flags.
            payload['include_ai'] = True
            payload.pop('seed_only', None)
        if 'snapshot' in payload:
            payload['snapshot'] = {**payload['snapshot'], 'language': language}
        retry = Job(tenant_id=user.tenant_id, actor_id=user.id, case_id=case.id, case_version=case.version, kind=original.kind, payload=payload)
        db.add(retry)
        db.flush()
        audit(db, user, 'analysis.retry', retry.id)
        return {'run_id': retry.id, 'case_version': case.version, 'status': 'queued'}
    result = idempotent(db, user, f'retry:{job_id}', key, body.model_dump(), run)
    jobs.dispatch(result['run_id'])
    return result


@router.get('/cases/{case_id}/notes')
@router.get('/cases/{case_id}/alerts')
def case_records(case_id: str, request: Request, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    access_case(db, user, case_id)
    kind = 'note' if request.url.path.endswith('/notes') else 'alert'
    return {'items': [serialize(r) for r in db.scalars(select(Record).where(Record.case_id == case_id, Record.kind == kind).order_by(Record.created_at.desc()))]}


@router.get('/forecasts/{forecast_id}')
def get_forecast(forecast_id: str, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    return serialize(access_record(db, user, forecast_id, ['forecast']))


@router.post('/analyses/{job_id}/cancel')
def cancel_job(job_id: str, user: User = Depends(current_user), db: DBSession = Depends(get_db), key=Depends(idem_key)):
    require_role(user, 'doctor', 'radiologist')
    get_job(job_id, user, db)
    if user.role == 'radiologist' and db.get(Job, job_id).kind != 'imaging':
        raise ApiError(403, 'ROLE_FORBIDDEN', 'Only the doctor can cancel a clinical text review.')
    def run():
        changed = db.execute(update(Job).where(Job.id == job_id, Job.status.in_(['queued', 'running'])).values(status='cancelled', stage='cancelled', finished_at=now()))
        if changed.rowcount != 1:
            raise ApiError(409, 'JOB_TERMINAL', 'Job has already completed.')
        audit(db, user, 'analysis.cancelled', job_id)
        return {'status': 'cancelled'}
    return idempotent(db, user, f'cancel:{job_id}', key, {}, run)


@router.get('/alerts/{alert_id}')
def get_alert(alert_id: str, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    alert = access_record(db, user, alert_id, ['alert'])
    return {**serialize(alert), 'reviews': [serialize(r) for r in db.scalars(select(Record).where(Record.case_id == alert.case_id, Record.kind == 'review')) if r.data.get('alert_id') == alert_id]}


@router.post('/alerts/{alert_id}/reviews')
def alert_review(alert_id: str, body: ReviewCreate, user: User = Depends(current_user), db: DBSession = Depends(get_db), key=Depends(idem_key)):
    require_role(user, 'doctor')
    alert = access_record(db, user, alert_id, ['alert'])
    if body.status in {'rejected', 'closed'} and len(body.comment) < 3:
        raise ApiError(422, 'COMMENT_REQUIRED', 'Explain rejection or closure.')
    transitions = {'new': {'seen', 'accepted', 'rejected', 'information_requested'}, 'seen': {'accepted', 'rejected', 'information_requested'}, 'accepted': {'closed', 'information_requested'}, 'rejected': {'closed'}, 'information_requested': {'accepted', 'rejected', 'closed'}, 'closed': set()}
    def run():
        db.refresh(alert, with_for_update=True)
        if body.status not in transitions[alert.data['status']]:
            raise ApiError(409, 'INVALID_TRANSITION', 'This review transition is not allowed.')
        case = access_case(db, user, alert.case_id)
        record = create_record(db, user, 'review', {'alert_id': alert.id, **body.model_dump()}, case, alert.case_version)
        alert.data = {**alert.data, 'status': body.status}
        audit(db, user, 'alert.' + body.status, alert.id)
        return serialize(record)
    return idempotent(db, user, f'review:{alert_id}', key, body.model_dump(), run)


@router.post('/integrations/dmed/connect')
def dmed_connect(user: User = Depends(current_user), db: DBSession = Depends(get_db), key=Depends(idem_key)):
    require_role(user, 'doctor')
    def run():
        record = create_record(db, user, 'connection', {'mode': 'demo', 'active': True, 'external_account': 'DEMO-DOCTOR'})
        audit(db, user, 'dmed.demo_connected', record.id)
        return serialize(record)
    return idempotent(db, user, 'dmed.connect', key, {}, run)


@router.delete('/integrations/dmed/{connection_id}')
def dmed_revoke(connection_id: str, user: User = Depends(current_user), db: DBSession = Depends(get_db), key=Depends(idem_key)):
    require_role(user, 'doctor')
    record = access_record(db, user, connection_id, ['connection'])
    def run():
        record.data = {**record.data, 'active': False}
        audit(db, user, 'dmed.revoked', record.id)
        return {'active': False}
    return idempotent(db, user, f'dmed.revoke:{connection_id}', key, {}, run)


@router.post('/cases/{case_id}/imports')
def dmed_import(case_id: str, body: ImportCreate, user: User = Depends(current_user), db: DBSession = Depends(get_db), key=Depends(idem_key)):
    require_role(user, 'doctor')
    case = access_case(db, user, case_id)
    connection = access_record(db, user, body.connection_id, ['connection'])
    if not connection.data['active'] or body.scenario == 'denied':
        raise ApiError(403, 'DMED_ACCESS_DENIED', 'Demo access denied or revoked.')
    if body.scenario == 'disconnected':
        raise ApiError(503, 'DMED_UNAVAILABLE', 'Demo connection interrupted.')
    if body.scenario == 'identity_mismatch' or body.external_id != 'DEMO-001':
        raise ApiError(409, 'PATIENT_IDENTITY_MISMATCH', 'Patient identity mismatch. Merge blocked.')
    def run():
        db.refresh(case, with_for_update=True)
        ext_version = 2 if body.scenario == 'updated' else 1
        previous = [r for r in db.scalars(select(Record).where(Record.case_id == case_id, Record.kind == 'import')) if r.data.get('external_version') == ext_version]
        if previous:
            from .patient_workspace import backfill_legacy_dmed_entries
            return backfill_legacy_dmed_entries(db, user, case, previous[0], body.expected_version)
        bump_case(db, case, body.expected_version)
        from .patient_workspace import create_entry_record
        demo_entries = [
            ('subjective', 'Учебная история DMED: периодическая головная боль после нагрузки в течение недели. Со слов пациента, ранее давление повышалось.', '', ''),
            ('objective', 'Учебный осмотр: артериальное давление 140/90 мм рт. ст., пульс 78/мин. Данные одного визита, повторных измерений нет.', '', ''),
            ('laboratory', 'Учебный лабораторный документ: глюкоза натощак 5.4 ммоль/л. Другие лабораторные показатели в этом импорте не представлены.', '', ''),
            ('instrumental', 'Учебное инструментальное исследование: в описании ЭКГ указан синусовый ритм. Оригинал ЭКГ и DICOM в импорте отсутствуют.', '', ''),
            ('doctor_conclusion', 'Учебное заключение врача DMED: повышение артериального давления требует уточнения по повторным измерениям. Планируется повторный прием с дневником давления; лекарственная терапия в этой записи не указана.', 'Повышение артериального давления, требуется уточнение.', 'Повторный прием с дневником давления; лекарственная терапия не указана.'),
        ]
        source_text = 'Synthetic import: allergy.substance = DEMO-A; medication.substance = DEMO-A\n\n' + '\n\n'.join(entry[1] for entry in demo_entries)
        source = create_record(db, user, 'source', {'name': 'DMED · DEMO-001', 'type': 'dmed_demo', 'text': source_text, 'pages': [], 'limitations': ['DEMO_INTEGRATION'], 'external_version': ext_version}, case)
        previous_demo = {r.data['category']: r for r in db.scalars(select(Record).where(Record.case_id == case.id, Record.kind == 'clinical_entry').order_by(Record.created_at, Record.id)) if r.data.get('source_mode') == 'dmed_demo'}
        entry_ids = []
        for category, text, diagnosis, treatment in demo_entries:
            entry = create_entry_record(db, user, case, category, text, source=source, diagnosis=diagnosis, treatment=treatment)
            if category in previous_demo:
                entry.data = {**entry.data, 'supersedes': previous_demo[category].id}
            entry_ids.append(entry.id)
        timestamp = '2026-09-18T09:00:00+05:00' if ext_version == 1 else '2026-09-18T14:00:00+05:00'
        for k, value in [('allergy.substance', 'DEMO-A'), ('medication.substance', 'DEMO-A')]:
            fact = FactInput(key=k, label=k, value=value, source_id=source.id, provenance='dmed_demo', span='field:' + k, event_time=timestamp, available_time=timestamp, order_status='active' if k.startswith('medication') else 'not_applicable')
            create_record(db, user, 'fact', fact.model_dump(mode='json'), case)
        imported = create_record(db, user, 'import', {'source_id': source.id, 'external_version': ext_version, 'mode': 'demo', 'status': 'awaiting_confirmation', 'clinical_entry_ids': entry_ids}, case)
        audit(db, user, 'dmed.imported', imported.id)
        return serialize(imported)
    return idempotent(db, user, f'dmed.import:{case_id}', key, body.model_dump(), run)


@router.get('/imports/{import_id}')
def import_status(import_id: str, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    return serialize(access_record(db, user, import_id, ['import']))


@router.post('/cases/{case_id}/forecasts')
def forecast(case_id: str, body: ForecastCreate, user: User = Depends(current_user), db: DBSession = Depends(get_db), key=Depends(idem_key)):
    require_role(user, 'doctor')
    case = access_case(db, user, case_id)
    def run():
        if case.version != body.expected_version:
            raise ApiError(409, 'CASE_VERSION_CONFLICT', 'Refresh this case.')
        from .risk import calculate
        result = create_record(db, user, 'forecast', {**calculate(case, body), 'author_name': user.name}, case)
        audit(db, user, 'forecast.eligibility_checked', result.id)
        return serialize(result)
    return idempotent(db, user, f'forecast:{case_id}', key, body.model_dump(), run)


def notification_query(user):
    require_role(user, 'doctor', 'radiologist', 'expert', 'quality', 'sender')
    granted = select(CaseAccess.case_id).where(CaseAccess.user_id == user.id)
    return select(Record).join(Case, Case.id == Record.case_id).where(
        Record.tenant_id == user.tenant_id,
        Record.kind == 'notification',
        Case.tenant_id == user.tenant_id,
        or_(Case.owner_id == user.id, Case.id.in_(granted)),
    )


@router.get('/notifications')
def notifications(user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    query = notification_query(user)
    # Count read markers separately, without loading historical notification payloads.
    readers = list(db.scalars(query.with_only_columns(Record.data['read_by'])))
    records = db.execute(query.add_columns(Case.alias).order_by(Record.created_at.desc(), Record.id.desc()).limit(100))
    return {
        'items': [{**serialize(record), 'case_alias': alias} for record, alias in records],
        'total': len(readers),
        'unread_count': sum(user.id not in (read_by or []) for read_by in readers),
    }


@router.post('/notifications/read-all')
def read_all_notifications(user: User = Depends(current_user), db: DBSession = Depends(get_db), key=Depends(idem_key)):
    query = notification_query(user)

    def run():
        # PostgreSQL locks each row; SQLite's idempotency insert already holds the
        # write lock. Read after that lock so another reader's markers are preserved.
        records = db.scalars(query.order_by(Record.id).with_for_update(of=Record).execution_options(populate_existing=True))
        updated = 0
        for record in records:
            readers = record.data.get('read_by') or []
            if user.id not in readers:
                record.data = {**record.data, 'read_by': [*readers, user.id]}
                updated += 1
        db.flush()
        remaining = db.scalars(query.with_only_columns(Record.data['read_by']))
        return {'updated': updated, 'unread_count': sum(user.id not in (read_by or []) for read_by in remaining)}

    return idempotent(db, user, 'notifications:read-all', key, {}, run)


@router.post('/notifications/{notification_id}/read')
def read_notification(notification_id: str, user: User = Depends(current_user), db: DBSession = Depends(get_db), key=Depends(idem_key)):
    record = access_record(db, user, notification_id, ['notification'])
    def run():
        # The access check may have loaded this object before another reader wrote.
        db.refresh(record, with_for_update=True)
        readers = record.data.get('read_by') or []
        if user.id not in readers:
            record.data = {**record.data, 'read_by': [*readers, user.id]}
        return {'read': True}
    return idempotent(db, user, f'notification:{notification_id}', key, {}, run)
