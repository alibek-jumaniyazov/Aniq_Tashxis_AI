"""Versioned clinical intake and evidence-based physician comparison jobs."""
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import Field, model_validator
from sqlalchemy import select, update
from sqlalchemy.orm import Session as DBSession

from .ai_locale import normalize_language
from .db import Job, Record, User, get_db, now
from .schemas import StrictModel, VersionBody
from .security import (ApiError, access_case, access_record, audit, bump_case,
                       create_record, current_facts, current_user, idem_key,
                       idempotent, require_role, serialize)

router = APIRouter(prefix='/api/v1')
Category = Literal['subjective', 'objective', 'laboratory', 'instrumental', 'doctor_conclusion']


class EntryCreate(StrictModel):
    expected_version: int = Field(ge=1)
    category: Category
    text: str = Field(default='', max_length=20000)
    diagnosis: str = Field(default='', max_length=6000)
    treatment: str = Field(default='', max_length=6000)
    confirmed: bool = False
    source_id: str | None = Field(default=None, max_length=36)


class EntryUpdate(StrictModel):
    expected_version: int = Field(ge=1)
    text: str = Field(default='', min_length=1, max_length=20000)
    diagnosis: str = Field(default='', max_length=6000)
    treatment: str = Field(default='', max_length=6000)
    confirmed: bool = False

    @model_validator(mode='after')
    def requires_change(self):
        if not self.model_fields_set - {'expected_version'}:
            raise ValueError('Supply at least one field to update.')
        return self


class ComparisonCreate(VersionBody):
    language: Literal['ru', 'uz', 'en'] = 'ru'


def current_entries(db, case_id):
    records = list(db.scalars(select(Record).where(
        Record.case_id == case_id, Record.kind == 'clinical_entry'
    ).order_by(Record.created_at, Record.id)))
    replaced = {r.data.get('supersedes') for r in records}
    return [r for r in records if r.id not in replaced]


def create_entry_record(db, user, case, category, text, *, source=None,
                        diagnosis='', treatment='', confirmed=False):
    mode = ('dmed_demo' if source.data.get('type') == 'dmed_demo' else 'document') if source else 'manual'
    return create_record(db, user, 'clinical_entry', {
        'category': category, 'text': text, 'diagnosis': diagnosis,
        'treatment': treatment, 'confirmed': confirmed,
        'source_id': source.id if source else None, 'source_mode': mode,
        'author_name': user.name, 'supersedes': None,
    }, case)


def backfill_legacy_dmed_entries(db, user, case, imported, expected_version):
    """Expose old demo imports without inventing absent observations or conclusions."""
    source = access_record(db, user, imported.data.get('source_id'), ['source'])
    if source.case_id != case.id or source.data.get('type') != 'dmed_demo':
        raise ApiError(422, 'CLINICAL_ENTRY_SOURCE_MISMATCH', 'The legacy demo source does not belong to this patient.')
    # Include history: superseded v1 entries must not be recreated after a v2 import.
    records = [r for r in db.scalars(select(Record).where(
        Record.case_id == case.id, Record.kind == 'clinical_entry'
    ).order_by(Record.created_at, Record.id)) if r.data.get('source_id') == source.id]
    present = {r.data['category'] for r in records}
    missing = [category for category in ('subjective', 'objective', 'laboratory', 'instrumental', 'doctor_conclusion') if category not in present]
    if not missing:
        return serialize(imported)
    original_text = source.data.get('text', '').strip()
    if 'subjective' in missing and len(original_text) > 20000:
        raise ApiError(422, 'CLINICAL_ENTRY_SOURCE_TOO_LONG', 'Select an excerpt from the original demo source.')
    bump_case(db, case, expected_version)
    for category in missing:
        # Legacy fixtures contain patient-reported/allergy/medication context.
        # Empty linked drafts explicitly require entry/review, never fake labs.
        entry = create_entry_record(db, user, case, category,
                                    original_text if category == 'subjective' else '', source=source)
        entry.data = {**entry.data, 'legacy_import_backfill': True}
        records.append(entry)
    imported.data = {**imported.data, 'clinical_entry_ids': [r.id for r in records],
                     'clinical_backfill_version': case.version}
    audit(db, user, 'dmed.categories_backfilled', imported.id)
    return serialize(imported)


def comparison_readiness(case, entries, facts):
    data = any(r.data['confirmed'] and r.data['category'] != 'doctor_conclusion' for r in entries)
    data = data or any(f.get('confirmed') and f.get('assertion') in {'present', 'absent'}
                       and f.get('value') not in (None, '') for f in facts)
    conclusion = any(r.data['confirmed'] and r.data['category'] == 'doctor_conclusion' for r in entries)
    adult = case.age is not None and 18 <= case.age <= 120
    return {'comparison_ready': bool(data and conclusion and adult),
            'has_confirmed_data': bool(data), 'has_confirmed_conclusion': conclusion,
            'adult_age_known': adult}


@router.get('/cases/{case_id}/clinical-entries')
def list_entries(case_id: str, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    case = access_case(db, user, case_id)
    records = current_entries(db, case_id)
    return {'items': [serialize(r) for r in records], 'case_version': case.version,
            'readiness': comparison_readiness(case, records, current_facts(db, case_id))}


@router.post('/cases/{case_id}/clinical-entries', status_code=201)
def add_entry(case_id: str, body: EntryCreate, user: User = Depends(current_user),
              db: DBSession = Depends(get_db), key=Depends(idem_key)):
    require_role(user, 'doctor', 'radiologist')
    if user.role == 'radiologist' and body.category != 'instrumental':
        raise ApiError(403, 'ROLE_REQUIRED', 'Radiologists can record instrumental findings.')
    case = access_case(db, user, case_id)

    def run():
        source = None
        text = body.text
        if body.source_id:
            source = access_record(db, user, body.source_id, ['source'])
            if source.case_id != case.id:
                raise ApiError(422, 'CLINICAL_ENTRY_SOURCE_MISMATCH', 'The source belongs to another patient.')
            if source.data.get('type') not in {'pdf', 'docx', 'txt', 'dmed_demo'}:
                raise ApiError(422, 'DOCUMENT_TEXT_REQUIRED', 'Choose a document with extracted text.')
            text = text or source.data.get('text', '').strip()
            if len(text) > 20000:
                raise ApiError(422, 'CLINICAL_ENTRY_SOURCE_TOO_LONG', 'Select a source excerpt of at most 20000 characters.')
            if text not in source.data.get('text', ''):
                raise ApiError(422, 'INVALID_SOURCE_SPAN', 'The selected text is absent from the source.')
        if not text:
            raise ApiError(422, 'CLINICAL_ENTRY_TEXT_REQUIRED', 'Enter clinical observations or choose a source with text.')
        bump_case(db, case, body.expected_version)
        record = create_entry_record(db, user, case, body.category, text,
                                     source=source, diagnosis=body.diagnosis,
                                     treatment=body.treatment,
                                     confirmed=body.confirmed if source is None else False)
        if record.data['category'] == 'doctor_conclusion' and record.data['confirmed'] and record.data['diagnosis']:
            case.diagnosis = record.data['diagnosis']
        audit(db, user, 'clinical_entry.created', record.id)
        return serialize(record)

    return idempotent(db, user, f'clinical_entry.create:{case_id}', key, body.model_dump(), run)


@router.patch('/cases/{case_id}/clinical-entries/{entry_id}')
def update_entry(case_id: str, entry_id: str, body: EntryUpdate,
                 user: User = Depends(current_user), db: DBSession = Depends(get_db), key=Depends(idem_key)):
    require_role(user, 'doctor', 'radiologist')
    case = access_case(db, user, case_id)
    original = access_record(db, user, entry_id, ['clinical_entry'])
    if original.case_id != case.id:
        raise ApiError(404, 'RECORD_NOT_FOUND', 'Record is not available.')
    if user.role == 'radiologist' and original.data['category'] != 'instrumental':
        raise ApiError(403, 'ROLE_REQUIRED', 'Radiologists can edit instrumental findings.')

    def run():
        if original.id not in {r.id for r in current_entries(db, case.id)}:
            raise ApiError(409, 'CLINICAL_ENTRY_NOT_CURRENT', 'This entry has been revised. Reload its current version.')
        changes = body.model_dump(exclude={'expected_version'}, exclude_unset=True)
        if changes.get('confirmed', original.data['confirmed']) and not changes.get('text', original.data['text']).strip():
            raise ApiError(422, 'CLINICAL_ENTRY_TEXT_REQUIRED', 'Enter the missing clinical data before confirming this draft.')
        # Editing confirmed evidence requires explicit re-attestation.
        if any(field in changes and changes[field] != original.data.get(field)
               for field in ('text', 'diagnosis', 'treatment')):
            changes['confirmed'] = changes.get('confirmed', False)
        bump_case(db, case, body.expected_version)
        revision = create_record(db, user, 'clinical_entry', {
            **original.data, **changes, 'supersedes': original.id,
            'author_name': user.name,
            'clinician_edited': bool(original.data.get('clinician_edited') or
                                     any(field in changes for field in ('text', 'diagnosis', 'treatment'))),
        }, case)
        if revision.data['category'] == 'doctor_conclusion' and revision.data['confirmed'] and revision.data['diagnosis']:
            case.diagnosis = revision.data['diagnosis']
        audit(db, user, 'clinical_entry.revised', revision.id)
        return serialize(revision)

    return idempotent(db, user, f'clinical_entry.update:{entry_id}', key,
                      body.model_dump(exclude_unset=True), run)


def comparison_snapshot(case, entries, facts):
    # Deliberately allowlist clinical data; no name, phone, alias, author or tenant.
    conclusion = next(r for r in reversed(entries) if r.data['confirmed'] and r.data['category'] == 'doctor_conclusion')
    return {'version': case.version, 'age': case.age, 'sex': case.sex,
            'evaluated_conclusion_id': conclusion.id,
            'entries': [{'id': r.id, **{k: r.data.get(k) for k in
                        ('category', 'text', 'diagnosis', 'treatment', 'source_id')}}
                        for r in entries if r.data['confirmed'] and
                        (r.data['category'] != 'doctor_conclusion' or r.id == conclusion.id)],
            'facts': [f for f in facts if f.get('confirmed') and f.get('assertion') in {'present', 'absent'}
                      and f.get('value') not in (None, '')]}


@router.post('/cases/{case_id}/clinical-comparisons', status_code=202)
def compare(case_id: str, body: ComparisonCreate, user: User = Depends(current_user),
            db: DBSession = Depends(get_db), key=Depends(idem_key)):
    from . import jobs
    require_role(user, 'doctor')
    case = access_case(db, user, case_id)

    def run():
        # Re-read after the idempotency transaction starts. The row lock also
        # serializes snapshot/queue checks with patient mutations on PostgreSQL.
        db.refresh(case, with_for_update=True)
        if case.version != body.expected_version:
            raise ApiError(409, 'CASE_VERSION_CONFLICT', 'Reload the patient before comparison.')
        entries, facts = current_entries(db, case.id), current_facts(db, case.id)
        ready = comparison_readiness(case, entries, facts)
        if not ready['adult_age_known']:
            raise ApiError(422, 'OUTSIDE_DEMO_SCOPE', 'Clinical AI currently supports known adult ages 18–120.')
        if not ready['comparison_ready']:
            raise ApiError(422, 'CLINICAL_COMPARISON_EVIDENCE_REQUIRED', 'Confirm patient data and a doctor conclusion before comparison.', ready)
        active = list(db.scalars(select(Job).where(Job.tenant_id == user.tenant_id, Job.status.in_(['queued', 'running']))))
        if len(active) >= 10:
            raise ApiError(429, 'QUEUE_FULL', 'Analysis queue is full.')
        if any(job.case_id == case.id for job in active):
            raise ApiError(409, 'ANALYSIS_ALREADY_RUNNING', 'An analysis is already running for this patient.')
        job = Job(tenant_id=user.tenant_id, actor_id=user.id, case_id=case.id,
                  case_version=case.version, kind='clinical_comparison',
                  payload={'snapshot': {**comparison_snapshot(case, entries, facts), 'language': body.language},
                           'mode': 'current', 'include_ai': True, 'review_focus': 'clinical_comparison',
                           'language': body.language})
        db.add(job)
        db.flush()
        audit(db, user, 'clinical_comparison.queued', job.id)
        return {'run_id': job.id, 'case_version': case.version, 'status': 'queued',
                'status_url': f'/api/v1/analyses/{job.id}'}

    result = idempotent(db, user, f'clinical_comparison:{case_id}', key, body.model_dump(), run)
    jobs.dispatch(result['run_id'])
    return result


@router.get('/cases/{case_id}/clinical-comparisons')
def comparisons(case_id: str, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    from .routes import job_json
    case = access_case(db, user, case_id)
    records = db.scalars(select(Job).where(Job.case_id == case.id, Job.kind == 'clinical_comparison').order_by(Job.created_at.desc()))
    return {'items': [job_json(job, case) for job in records], 'case_version': case.version}


def process_comparison(db, job, user, case):
    from . import ai, ai_provider
    from .patient_workspace_ai import PROMPT_VERSION, review
    job.stage = 'ai_inference'
    db.commit()
    error = None
    comparison = None
    try:
        language = normalize_language(job.payload.get('language'))
        comparison = review({**job.payload['snapshot'], 'language': language}, language)
    except ai.ModelUnavailable as exc:
        error = str(exc)
    except Exception:
        error = 'MODEL_OUTPUT_REJECTED'
    db.expire_all()
    job = db.get(Job, job.id)
    if job.status == 'cancelled':
        return
    user = db.get(User, job.actor_id)
    if not user or not user.active:
        raise PermissionError('USER_REVOKED')
    access_case(db, user, job.case_id)
    status = 'failed' if error else 'succeeded'
    result = {'comparison': comparison, 'ai': None, 'limitations': [error] if error else [],
              'prompt_version': PROMPT_VERSION, 'clinical_validation': 'not_validated',
              'language': normalize_language(job.payload.get('language')),
              **ai_provider.result_metadata()}
    claimed = db.execute(update(Job).where(Job.id == job.id, Job.status == 'running').values(
        status=status, stage='failed' if error else 'complete', error_code=error,
        finished_at=now(), result=result))
    if not claimed.rowcount:
        db.rollback()
        return
    create_record(db, user, 'notification', {'run_id': job.id, 'read': False, 'status': status,
                                           'signature': 'clinical-comparison:' + job.id}, case, job.case_version)
    audit(db, user, 'clinical_comparison.' + status, job.id)
    db.commit()
