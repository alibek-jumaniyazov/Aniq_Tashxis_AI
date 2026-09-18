"""Evidence selection and clinician-authored conclusions; no automatic diagnosis."""
from collections import defaultdict
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession
from .db import Job, Record, User, get_db
from .schemas import CaseUpdate, ClinicalConclusion
from .security import ApiError, access_case, audit, bump_case, create_record, current_facts, current_user, idem_key, idempotent, require_role, serialize

router = APIRouter(prefix='/api/v1')


def eligible_facts(facts, mode='current', cutoff=None):
    eligible = []
    for fact in facts:
        if not fact.get('confirmed'):
            continue
        if mode == 'decision_time':
            if not cutoff or not fact.get('available_time'):
                continue
            if datetime.fromisoformat(fact['available_time']) > datetime.fromisoformat(cutoff):
                continue
            if fact.get('event_time') and datetime.fromisoformat(fact['event_time']) > datetime.fromisoformat(cutoff):
                continue
        eligible.append(fact)
    return eligible


def evidence_report(facts, mode='current', cutoff=None):
    eligible = eligible_facts(facts, mode, cutoff)
    groups = defaultdict(list)
    for fact in eligible:
        if fact.get('assertion') == 'present' and fact.get('value') not in (None, ''):
            groups[(fact['key'], fact.get('event_time'))].append(fact)
    conflicts = [{'key': key, 'fact_ids': [f['id'] for f in items]} for (key, _), items in groups.items() if len({(str(f['value']).strip().casefold(), f.get('unit')) for f in items}) > 1]
    usable = [f for f in eligible if f.get('assertion') in {'present', 'absent'} and f.get('value') not in (None, '')]
    symptom = any(f['key'].startswith('symptom.') and f.get('assertion') == 'present' for f in usable)
    return {'total_facts': len(facts), 'confirmed_facts': sum(bool(f.get('confirmed')) for f in facts), 'eligible_facts': len(eligible), 'unconfirmed_facts': sum(not f.get('confirmed') for f in facts), 'excluded_by_time': sum(bool(f.get('confirmed')) for f in facts) - len(eligible), 'missing_units': [f['id'] for f in usable if f['key'].startswith(('vital.', 'lab.')) and not f.get('unit')], 'unknown_times': [f['id'] for f in facts if not f.get('available_time')], 'potential_conflicts': conflicts, 'clinical_review_ready': symptom and len(usable) >= 2, 'evidence': [{'ref': f'F{i + 1}', 'fact_id': f['id'], 'source_id': f['source_id'], 'label': f['label'], 'key': f['key'], 'value': f.get('value'), 'unit': f.get('unit'), 'assertion': f.get('assertion')} for i, f in enumerate(usable)]}


@router.get('/cases/{case_id}/readiness')
def readiness(case_id: str, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    case = access_case(db, user, case_id)
    return {'case_version': case.version, **evidence_report(current_facts(db, case_id))}


@router.patch('/cases/{case_id}')
def edit_case(case_id: str, body: CaseUpdate, user: User = Depends(current_user), db: DBSession = Depends(get_db), key=Depends(idem_key)):
    from .routes import case_json
    require_role(user, 'doctor')
    case = access_case(db, user, case_id)
    def run():
        before = case_json(case)
        bump_case(db, case, body.expected_version)
        for field, value in body.model_dump(exclude={'expected_version'}).items():
            setattr(case, field, value)
        create_record(db, user, 'case_revision', {'before': before, 'after': case_json(case)}, case)
        audit(db, user, 'case.updated', case.id)
        return case_json(case)
    return idempotent(db, user, f'case.update:{case_id}', key, body.model_dump(), run)


@router.post('/cases/{case_id}/clinical-conclusions', status_code=201)
def conclude(case_id: str, body: ClinicalConclusion, user: User = Depends(current_user), db: DBSession = Depends(get_db), key=Depends(idem_key)):
    require_role(user, 'doctor')
    case = access_case(db, user, case_id)
    def run():
        if case.version != body.expected_version:
            raise ApiError(409, 'CASE_VERSION_CONFLICT', 'Reload the case before recording a clinical conclusion.')
        facts = {f['id']: f for f in current_facts(db, case.id)}
        if any(ref not in facts or not facts[ref]['confirmed'] for ref in body.fact_ids):
            raise ApiError(422, 'CONFIRMED_EVIDENCE_REQUIRED', 'Select current confirmed facts from this case.')
        if body.run_id:
            job = db.get(Job, body.run_id)
            if not job or job.case_id != case.id or job.tenant_id != user.tenant_id or job.case_version != case.version or job.status not in {'partial', 'succeeded'} or not (job.result.get('ai') or {}).get('assessment'):
                raise ApiError(409, 'CLINICAL_REVIEW_STALE', 'A current completed clinical review is required.')
        previous = case.diagnosis
        bump_case(db, case, body.expected_version)
        case.diagnosis = body.diagnosis
        result = create_record(db, user, 'clinical_conclusion', {**body.model_dump(), 'evaluated_version': body.expected_version, 'previous_diagnosis': previous, 'author_name': user.name, 'origin': 'clinician_authored'}, case)
        audit(db, user, 'clinical_conclusion.' + body.status, result.id)
        return serialize(result)
    return idempotent(db, user, f'clinical.conclusion:{case_id}', key, body.model_dump(), run)


@router.get('/integrations/dmed/connections')
def connections(user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    require_role(user, 'doctor')
    rows = db.scalars(select(Record).where(Record.kind == 'connection', Record.tenant_id == user.tenant_id, Record.actor_id == user.id).order_by(Record.created_at.desc()))
    return {'items': [serialize(r) for r in rows]}
