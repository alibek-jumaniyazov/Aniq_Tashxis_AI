import hashlib
import io
import json
from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession
from . import ai
from .config import settings
from .db import Audit, Record, User, get_db, now
from .rules import CATALOG
from .schemas import ExportCreate, IncidentCreate, IncidentDecision, VersionBody
from .security import ApiError, access_case, access_record, audit, create_record, current_user, idem_key, idempotent, require_role, serialize

router = APIRouter(prefix='/api/v1')


@router.get('/incidents')
def incidents(user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    require_role(user, 'expert', 'quality', 'sender', 'doctor')
    result = []
    for record in db.scalars(select(Record).where(Record.kind == 'incident', Record.tenant_id == user.tenant_id).order_by(Record.created_at.desc())):
        try:
            case = access_case(db, user, record.case_id)
            result.append({**serialize(record), 'case_alias': case.alias})
        except ApiError:
            continue
    return {'items': result}


@router.post('/incidents', status_code=201)
def create_incident(body: IncidentCreate, user: User = Depends(current_user), db: DBSession = Depends(get_db), key=Depends(idem_key)):
    require_role(user, 'doctor', 'quality', 'expert')
    case = access_case(db, user, body.case_id)
    def run():
        record = create_record(db, user, 'incident', {'reason': body.reason, 'status': 'under_review', 'version': 1, 'decisions': []}, case)
        audit(db, user, 'incident.opened', record.id)
        return serialize(record)
    return idempotent(db, user, 'incident.create', key, body.model_dump(), run)


@router.post('/incidents/{incident_id}/decisions')
def decide(incident_id: str, body: IncidentDecision, user: User = Depends(current_user), db: DBSession = Depends(get_db), key=Depends(idem_key)):
    require_role(user, 'expert')
    record = access_record(db, user, incident_id, ['incident'])
    transitions = {'under_review': {'awaiting_explanation', 'confirmed', 'not_confirmed', 'insufficient_information'}, 'awaiting_explanation': {'confirmed', 'not_confirmed', 'insufficient_information'}, 'confirmed': {'corrective_actions', 'closed'}, 'not_confirmed': {'closed'}, 'insufficient_information': {'awaiting_explanation', 'confirmed', 'not_confirmed'}, 'corrective_actions': {'closed'}, 'closed': set()}
    def run():
        db.refresh(record, with_for_update=True)
        if record.data['version'] != body.expected_version:
            raise ApiError(409, 'VERSION_CONFLICT', 'Review has changed.')
        if body.status not in transitions[record.data['status']]:
            raise ApiError(409, 'INVALID_TRANSITION', 'This decision transition is not allowed.')
        decision = {'status': body.status, 'explanation': body.explanation, 'actor_id': user.id, 'created_at': now().isoformat()}
        record.data = {**record.data, 'status': body.status, 'version': body.expected_version + 1, 'decisions': record.data['decisions'] + [decision]}
        audit(db, user, 'incident.' + body.status, record.id)
        return serialize(record)
    return idempotent(db, user, f'incident.decision:{incident_id}', key, body.model_dump(), run)


def get_export(db, user, export_id):
    require_role(user, 'quality', 'sender', 'expert', 'analyst')
    record = access_record(db, user, export_id, ['export'])
    if user.role == 'analyst' and record.data['status'] != 'sent':
        raise ApiError(404, 'EXPORT_NOT_FOUND', 'Report not available.')
    if user.role != 'analyst':
        for incident_id in record.data['incident_ids']:
            access_record(db, user, incident_id, ['incident'])
    return record


def public_export(record, user):
    if user.role != 'analyst':
        return serialize(record)
    return {'id': record.id, 'status': record.data['status'], 'created_at': record.created_at.isoformat(), 'package': record.data['package'], 'sha256': record.data['sha256'], 'receipt': record.data['receipt']}


@router.get('/exports')
def exports(user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    require_role(user, 'quality', 'sender', 'expert', 'analyst')
    items = []
    for record in db.scalars(select(Record).where(Record.kind == 'export', Record.tenant_id == user.tenant_id).order_by(Record.created_at.desc())):
        try:
            get_export(db, user, record.id)
            items.append(public_export(record, user))
        except ApiError:
            continue
    return {'items': items}


@router.post('/exports', status_code=201)
def create_export(body: ExportCreate, user: User = Depends(current_user), db: DBSession = Depends(get_db), key=Depends(idem_key)):
    require_role(user, 'quality', 'expert', 'sender')
    def run():
        snapshots = []
        for incident_id in dict.fromkeys(body.incident_ids):
            incident = access_record(db, user, incident_id, ['incident'])
            if incident.data['status'] not in {'confirmed', 'corrective_actions', 'closed'} or not any(d['status'] == 'confirmed' for d in incident.data['decisions']):
                raise ApiError(422, 'EXPERT_CONFIRMATION_REQUIRED', 'Only independently confirmed incidents may be exported.')
            snapshots.append({'incident_id': incident.id, 'version': incident.data['version'], 'case_version': incident.case_version})
        # No identifiers, reasons, names, notes or raw files in the exported package.
        package = {'schema': 'aniqtashxis.aggregate.v1', 'mode': 'demo', 'period': now().strftime('%Y-%m'), 'confirmed_cases': len(snapshots) if len(snapshots) >= 5 else None, 'small_group_suppressed': len(snapshots) < 5, 'scope': 'Synthetic quality review demonstration', 'clinical_validation': 'not_validated'}
        encoded = json.dumps(package, sort_keys=True).encode()
        record = create_record(db, user, 'export', {**body.model_dump(), 'incident_ids': [s['incident_id'] for s in snapshots], 'snapshots': snapshots, 'package': package, 'sha256': hashlib.sha256(encoded).hexdigest(), 'version': 1, 'status': 'draft', 'approved_by': None, 'receipt': None})
        audit(db, user, 'export.created', record.id)
        return serialize(record)
    return idempotent(db, user, 'export.create', key, body.model_dump(), run)


def export_current(db, user, record):
    for snapshot in record.data['snapshots']:
        incident = access_record(db, user, snapshot['incident_id'], ['incident'])
        if incident.data['version'] != snapshot['version']:
            raise ApiError(409, 'EXPORT_STALE', 'Expert review changed. Create a new package.')
        case = access_case(db, user, incident.case_id)
        if case.version != snapshot['case_version']:
            raise ApiError(409, 'CASE_CHANGED_SINCE_REVIEW', 'New clinical data requires a fresh expert review.')


@router.get('/exports/{export_id}')
@router.get('/exports/{export_id}/preview')
def preview(export_id: str, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    record = get_export(db, user, export_id)
    audit(db, user, 'export.previewed', record.id)
    db.commit()
    return public_export(record, user)


@router.post('/exports/{export_id}/approve')
def approve(export_id: str, body: VersionBody, user: User = Depends(current_user), db: DBSession = Depends(get_db), key=Depends(idem_key)):
    require_role(user, 'sender')
    record = get_export(db, user, export_id)
    def run():
        db.refresh(record, with_for_update=True)
        if record.data['version'] != body.expected_version or record.data['status'] != 'draft':
            raise ApiError(409, 'VERSION_CONFLICT', 'Report is not an unchanged draft.')
        export_current(db, user, record)
        for incident_id in record.data['incident_ids']:
            incident = access_record(db, user, incident_id, ['incident'])
            if any(d['actor_id'] == user.id for d in incident.data['decisions']):
                raise ApiError(403, 'SEPARATE_APPROVER_REQUIRED', 'Expert and sender must be different people.')
        record.data = {**record.data, 'status': 'approved', 'approved_by': user.id, 'version': body.expected_version + 1}
        audit(db, user, 'export.approved', record.id)
        return serialize(record)
    return idempotent(db, user, f'export.approve:{export_id}', key, body.model_dump(), run)


@router.post('/exports/{export_id}/send')
def send(export_id: str, body: VersionBody, user: User = Depends(current_user), db: DBSession = Depends(get_db), key=Depends(idem_key)):
    require_role(user, 'sender')
    record = get_export(db, user, export_id)
    def run():
        db.refresh(record, with_for_update=True)
        if record.data['status'] != 'approved' or record.data['version'] != body.expected_version or not record.data.get('approved_by'):
            raise ApiError(409, 'APPROVAL_REQUIRED', 'Approve this exact package version first.')
        export_current(db, user, record)
        receipt = {'id': 'DEMO-' + record.id[:8], 'transport': 'mock', 'received_at': now().isoformat(), 'sha256': record.data['sha256']}
        record.data = {**record.data, 'status': 'sent', 'receipt': receipt, 'version': body.expected_version + 1}
        audit(db, user, 'export.demo_sent', record.id)
        return serialize(record)
    return idempotent(db, user, f'export.send:{export_id}', key, body.model_dump(), run)


@router.get('/exports/{export_id}/download')
def download_export(export_id: str, format: str = Query('json', pattern='^(json|pdf)$'), user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    record = get_export(db, user, export_id)
    package = record.data['package']
    audit(db, user, 'export.downloaded', record.id)
    db.commit()
    if format == 'pdf':
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen.canvas import Canvas
        out = io.BytesIO()
        canvas = Canvas(out, pagesize=A4)
        canvas.setTitle('AniqTashxis - demonstration report')
        canvas.setFillColorRGB(.03, .5, .51)
        canvas.setFont('Helvetica-Bold', 24)
        canvas.drawString(50, 780, 'AniqTashxis.ai')
        canvas.setFillColorRGB(.08, .16, .21)
        canvas.setFont('Helvetica', 12)
        for i, line in enumerate(['DEMONSTRATION REPORT - no real government transmission', '', *[f'{k}: {v}' for k, v in package.items()], '', 'Package SHA-256:', record.data['sha256']]):
            canvas.drawString(50, 738 - i * 23, line)
        canvas.save()
        content, media = out.getvalue(), 'application/pdf'
    else:
        content, media = json.dumps(package, sort_keys=True).encode(), 'application/json'
    return Response(content, media_type=media, headers={'Content-Disposition': f'attachment; filename="aniqtashxis-{record.id[:8]}.{format}"', 'Cache-Control': 'no-store'})


@router.get('/system/status')
def system_status(user: User = Depends(current_user)):
    return {'app': 'AniqTashxis.ai', 'version': '0.1.0', 'demo_mode': settings.demo_mode, 'database': 'sqlite_local' if settings.database_url.startswith('sqlite') else 'postgresql', 'queue': settings.queue_mode, 'model': ai.model_status(), 'dmed': 'demo', 'export_transport': 'mock', 'ct_model': 'not_configured', 'risk_model': 'framingham-general-cvd-lipids-2008', 'approved_clinical_rules': 0}


@router.get('/rules')
def rules(user: User = Depends(current_user)):
    return {'items': CATALOG}


@router.get('/models')
def models(user: User = Depends(current_user)):
    return {'items': [ai.model_status()]}


@router.get('/audit-events')
def audits(user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    require_role(user, 'admin', 'quality', 'expert')
    staff = {u.id: u.name for u in db.scalars(select(User).where(User.tenant_id == user.tenant_id))}
    rows = db.scalars(select(Audit).where(Audit.tenant_id == user.tenant_id).order_by(Audit.created_at.desc()).limit(100))
    return {'items': [{'id': r.id, 'actor_id': r.actor_id, 'actor_name': staff.get(r.actor_id, ''), 'action': r.action, 'resource_id': r.resource_id, 'created_at': r.created_at.isoformat()} for r in rows]}


@router.get('/team')
def team(user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    require_role(user, 'admin')
    users = db.scalars(select(User).where(User.tenant_id == user.tenant_id).order_by(User.role, User.name))
    return {'items': [{'id': u.id, 'name': u.name, 'email': u.email, 'role': u.role, 'active': u.active} for u in users]}
