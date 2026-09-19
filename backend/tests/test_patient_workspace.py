import copy
import json

import pytest
from sqlalchemy import select, update

from app import ai, jobs, patient_workspace, patient_workspace_ai
from app.config import settings
from app.db import Case, Job, Record, SessionLocal
from conftest import sign_in
from test_workflows import add, fact, mutate, new_case


def entry(client, case, category='subjective', **overrides):
    response = mutate(client, f'/cases/{case["id"]}/clinical-entries', {
        'expected_version': case['version'], 'category': category,
        'text': 'Documented cough for three days.', 'confirmed': True, **overrides,
    })
    assert response.status_code == 201, response.text
    case['version'] = response.json()['case_version']
    return response.json()


def revise(client, case, record, **changes):
    response = mutate(client, f'/cases/{case["id"]}/clinical-entries/{record["id"]}',
                      {'expected_version': case['version'], **changes}, method='patch')
    assert response.status_code == 200, response.text
    case['version'] = response.json()['case_version']
    return response.json()


def ready_case(client):
    case = new_case(client)
    entry(client, case)
    entry(client, case, 'doctor_conclusion', text='Doctor considers respiratory infection, needs examination.', diagnosis='Provisional respiratory infection')
    return case


def compare(client, case, **overrides):
    response = mutate(client, f'/cases/{case["id"]}/clinical-comparisons',
                      {'expected_version': case['version'], **overrides})
    assert response.status_code == 202, response.text
    return client.get('/api/v1/analyses/' + response.json()['run_id']).json()


def report(version):
    return {'case_version': version, 'status': 'requires_clinician_review',
            'summary': 'Кашель требует уточнения причины.',
            'diagnosis_review': {'status': 'insufficient_data', 'summary': 'Для подтверждения заключения нужен осмотр.', 'refs': ['E1', 'E2']},
            'treatment_review': {'status': 'insufficient_data', 'summary': 'Лечение не описано.', 'refs': ['E2']},
            'supporting': [{'text': 'Кашель описан пациентом.', 'refs': ['E1']}],
            'discrepancies': [], 'questions': ['Каковы результаты осмотра?'],
            'next_steps': ['Уточнить объективные данные.'],
            'five_year_outlook': {'status': 'insufficient_data', 'summary': 'Данных для долгосрочных сценариев недостаточно.', 'scenarios': []},
            'limitations': ['Это сопоставление записей, решение принимает врач.']}


def test_entry_versions_confirmation_and_diagnosis_preserve_history(client):
    case = new_case(client)
    first = entry(client, case)
    revision = revise(client, case, first, text='Cough is now reported as absent.')
    assert revision['confirmed'] is False and revision['supersedes'] == first['id']
    confirmed = revise(client, case, revision, confirmed=True)
    items = client.get(f'/api/v1/cases/{case["id"]}/clinical-entries').json()['items']
    assert [row['id'] for row in items] == [confirmed['id']]
    history = client.get(f'/api/v1/cases/{case["id"]}/versions').json()['items']
    assert {first['id'], revision['id'], confirmed['id']} <= {r['id'] for r in history}
    with SessionLocal() as db:
        assert db.get(Record, first['id']).data['text'] == 'Documented cough for three days.'
    obsolete = mutate(client, f'/cases/{case["id"]}/clinical-entries/{first["id"]}',
                       {'expected_version': case['version'], 'confirmed': True}, method='patch')
    assert obsolete.status_code == 409
    conclusion = entry(client, case, 'doctor_conclusion', diagnosis='Provisional diagnosis', confirmed=False)
    assert client.get(f'/api/v1/cases/{case["id"]}').json()['diagnosis'] == ''
    revise(client, case, conclusion, confirmed=True)
    assert client.get(f'/api/v1/cases/{case["id"]}').json()['diagnosis'] == 'Provisional diagnosis'


def test_entry_idempotency_stale_input_and_role_boundaries(client):
    case = new_case(client)
    path = f'/cases/{case["id"]}/clinical-entries'
    body = {'expected_version': 1, 'category': 'objective', 'text': 'Pulse 80 /min.'}
    first = mutate(client, path, body, key='clinical-entry-same-key')
    assert first.status_code == 201
    assert mutate(client, path, body, key='clinical-entry-same-key').json()['id'] == first.json()['id']
    assert mutate(client, path, body).status_code == 409
    assert mutate(client, path, {**body, 'text': '   ', 'expected_version': 2}).status_code == 422
    sign_in(client, 'other')
    assert client.get('/api/v1' + path).status_code == 404
    sign_in(client, 'analyst')
    assert mutate(client, path, {**body, 'expected_version': 2}).status_code == 403


def test_document_category_is_atomic_draft_and_wrong_case_sources_rejected(client):
    case = new_case(client)
    response = client.post(f'/api/v1/cases/{case["id"]}/documents',
                           headers={'Idempotency-Key': 'categorized-document-test'},
                           data={'expected_version': 1, 'identity_confirmed': 'true', 'category': 'doctor_conclusion'},
                           files={'file': ('conclusion.txt', b'Provisional diagnosis: respiratory infection.', 'text/plain')})
    assert response.status_code == 201, response.text
    case['version'] = response.json()['case_version']
    record = client.get(f'/api/v1/cases/{case["id"]}/clinical-entries').json()['items'][0]
    assert record['id'] == response.json()['clinical_entry_id']
    assert record['confirmed'] is False and record['source_mode'] == 'document'
    assert record['source_id'] == response.json()['id']
    other = new_case(client)
    wrong = mutate(client, f'/cases/{other["id"]}/clinical-entries', {
        'expected_version': 1, 'category': 'doctor_conclusion', 'source_id': response.json()['id'],
    })
    assert wrong.status_code == 422 and wrong.json()['error']['code'] == 'CLINICAL_ENTRY_SOURCE_MISMATCH'
    fake = mutate(client, f'/cases/{case["id"]}/clinical-entries', {
        'expected_version': case['version'], 'category': 'doctor_conclusion',
        'source_id': response.json()['id'], 'text': 'Invented quotation',
    })
    assert fake.status_code == 422
    copied = entry(client, case, 'doctor_conclusion', text='', source_id=response.json()['id'])
    assert copied['confirmed'] is False


def test_comparison_requires_adult_and_confirmed_patient_data_and_conclusion(client):
    case = new_case(client)
    path = f'/cases/{case["id"]}/clinical-comparisons'
    assert mutate(client, path, {'expected_version': case['version']}).status_code == 422
    entry(client, case, confirmed=False)
    entry(client, case, 'doctor_conclusion')
    missing = mutate(client, path, {'expected_version': case['version']})
    assert missing.status_code == 422 and missing.json()['error']['code'] == 'CLINICAL_COMPARISON_EVIDENCE_REQUIRED'
    add(client, case, [fact('symptom.complaint', 'Cough')])
    assert client.get(f'/api/v1/cases/{case["id"]}/clinical-entries').json()['readiness']['comparison_ready'] is True
    patch = mutate(client, f'/cases/{case["id"]}', {'expected_version': case['version'], 'age': 17}, method='patch')
    case['version'] = patch.json()['version']
    minor = mutate(client, path, {'expected_version': case['version']})
    assert minor.status_code == 422 and minor.json()['error']['code'] == 'OUTSIDE_DEMO_SCOPE'


def test_snapshot_uses_latest_confirmed_conclusion_old_facts_and_no_identity(client, monkeypatch):
    case = ready_case(client)
    latest = entry(client, case, 'doctor_conclusion', text='Latest working conclusion.', diagnosis='Latest diagnosis')
    entry(client, case, 'doctor_conclusion', text='Unconfirmed imported opinion.', confirmed=False)
    add(client, case, [fact('vital.pulse', '80', unit='/min'), fact('vital.spo2', '98', confirmed=False)])
    monkeypatch.setattr(jobs, 'dispatch', lambda _: None)
    job = compare(client, case, language='uz')
    with SessionLocal() as db:
        stored = db.get(Job, job['id'])
        snapshot = stored.payload['snapshot']
        assert stored.payload['language'] == 'uz'
        assert not {'full_name', 'patient_phone', 'alias', 'owner_id', 'author_name'} & snapshot.keys()
        assert snapshot['evaluated_conclusion_id'] == latest['id']
        assert len([r for r in snapshot['entries'] if r['category'] == 'doctor_conclusion']) == 1
        assert [f['key'] for f in snapshot['facts']] == ['vital.pulse']


def test_model_unavailable_is_failure_never_fake_success_and_retry_is_versioned(client):
    case = ready_case(client)
    job = compare(client, case)
    assert job['status'] == 'failed' and job['error_code'] == 'MODEL_WEIGHTS_MISSING'
    assert job['result']['comparison'] is None
    retried = mutate(client, f'/analyses/{job["id"]}/retry', {'expected_version': case['version']})
    assert retried.status_code == 202
    entry(client, case, 'laboratory', text='No laboratory result available.')
    assert mutate(client, f'/analyses/{job["id"]}/retry', {'expected_version': case['version']}).status_code == 409
    assert client.get('/api/v1/analyses/' + job['id']).json()['is_stale'] is True


def test_comparison_cancellation_survives_inflight_completion(client, monkeypatch):
    case = ready_case(client)

    def cancel(snapshot, language):
        with SessionLocal() as db:
            db.execute(update(Job).where(Job.kind == 'clinical_comparison').values(status='cancelled', stage='cancelled'))
            db.commit()
        return report(snapshot['version'])

    monkeypatch.setattr(patient_workspace_ai, 'review', cancel)
    job = compare(client, case)
    assert job['status'] == 'cancelled' and job['result'] == {}


def test_model_schema_validation_language_and_references(client, monkeypatch):
    case = ready_case(client)
    monkeypatch.setattr(settings, 'ai_backend', 'llama_cpp')
    monkeypatch.setattr(ai, 'model_status', lambda: {'ready': True})
    captured = {}
    localized = report(case['version'])
    localized['summary'] = 'Yo‘talning sababini aniqlash uchun ko‘rik kerak.'
    localized['diagnosis_review']['summary'] = 'Shifokor xulosasini tasdiqlash uchun ko‘rik kerak.'
    localized['treatment_review']['summary'] = 'Davolash rejasi hujjatda ko‘rsatilmagan.'
    localized['supporting'][0]['text'] = 'Bemor yo‘tal haqida ma’lumot bergan.'
    localized['questions'] = ['Ko‘rik natijalari qanday?']
    localized['next_steps'] = ['Obyektiv ma’lumotlarni hujjatda aniqlashtirish kerak.']
    localized['five_year_outlook']['summary'] = 'Uzoq muddatli kuzatuv uchun ma’lumot yetarli emas.'
    localized['limitations'] = ['Yakuniy qarorni shifokor qabul qiladi.']

    def completion(messages, schema, **kwargs):
        captured['messages'], captured['schema'] = messages, schema
        return json.dumps({key: value for key, value in localized.items() if key in schema['properties']}, ensure_ascii=False)

    from app import llama_adapter
    monkeypatch.setattr(llama_adapter, 'complete', completion)
    job = compare(client, case, language='uz')
    assert job['status'] == 'succeeded', job
    result = job['result']['comparison']
    assert result['validated_probability'] is False and result['horizon_years'] == 5
    assert 'Uzbek' in captured['messages'][0]['content']
    assert captured['schema']['$defs']['ReviewSection']['properties']['refs']['items']['enum'] == ['E1', 'E2']
    assert 'full_name' not in captured['messages'][1]['content'] and 'patient_phone' not in captured['messages'][1]['content']


@pytest.mark.parametrize('problem', ['reference', 'probability', 'number', 'extra_probability_field', 'target_range', 'unhelpful_questions'])
def test_model_rejects_fabricated_refs_numbers_and_unvalidated_probability(client, monkeypatch, problem):
    case = ready_case(client)
    monkeypatch.setattr(settings, 'ai_backend', 'llama_cpp')
    monkeypatch.setattr(ai, 'model_status', lambda: {'ready': True})
    invalid = copy.deepcopy(report(case['version']))
    if problem == 'reference':
        invalid['supporting'][0]['refs'] = ['F999']
    elif problem == 'probability':
        invalid['five_year_outlook']['summary'] = 'Risk over five years is 45%.'
    elif problem == 'number':
        invalid['summary'] = 'Температура 42 градуса.'
    elif problem == 'extra_probability_field':
        invalid['five_year_outlook']['probability'] = 0.8
    elif problem == 'target_range':
        invalid['summary'] = 'Давление выше целевого уровня.'
    else:
        invalid['questions'] = ['Недостаточно данных.', 'Недостаточно данных.']
    from app import llama_adapter
    monkeypatch.setattr(llama_adapter, 'complete', lambda messages, schema, **kwargs: json.dumps({key: value for key, value in invalid.items() if key in schema['properties']}))
    result = compare(client, case)
    assert result['status'] == 'failed' and result['error_code'] == 'MODEL_OUTPUT_REJECTED'
    assert result['result']['comparison'] is None


def test_dmed_demo_import_has_five_unconfirmed_categories_and_is_idempotent(client):
    case = new_case(client)
    connection = mutate(client, '/integrations/dmed/connect').json()
    path = f'/cases/{case["id"]}/imports'
    body = {'expected_version': case['version'], 'connection_id': connection['id'], 'scenario': 'success'}
    imported = mutate(client, path, body)
    assert imported.status_code == 200, imported.text
    rows = client.get(f'/api/v1/cases/{case["id"]}/clinical-entries').json()['items']
    assert len(rows) == 5 and all(not r['confirmed'] and r['source_mode'] == 'dmed_demo' for r in rows)
    assert {r['category'] for r in rows} == {'subjective', 'objective', 'laboratory', 'instrumental', 'doctor_conclusion'}
    repeat = mutate(client, path, body)
    assert repeat.json()['id'] == imported.json()['id']
    with SessionLocal() as db:
        assert len(list(db.scalars(select(Record).where(Record.kind == 'clinical_entry', Record.case_id == case['id'])))) == 5


def test_radiologist_uploads_instrumental_drafts_but_not_doctor_conclusions(client, case):
    sign_in(client, 'radiologist')
    path = f'/api/v1/cases/{case["id"]}/documents'
    form = {'expected_version': case['version'], 'identity_confirmed': 'true', 'category': 'doctor_conclusion'}
    assert client.post(path, headers={'Idempotency-Key': 'radiologist-restricted'}, data=form,
                       files={'file': ('report.txt', b'Instrumental report.', 'text/plain')}).status_code == 403
    form['category'] = 'instrumental'
    upload = client.post(path, headers={'Idempotency-Key': 'radiologist-instrumental'}, data=form,
                         files={'file': ('report.txt', b'Instrumental report.', 'text/plain')})
    assert upload.status_code == 201, upload.text
    rows = client.get(f'/api/v1/cases/{case["id"]}/clinical-entries').json()['items']
    assert rows[0]['category'] == 'instrumental' and rows[0]['confirmed'] is False


def test_bounded_model_correction_keeps_schema_and_does_not_publish_bad_attempt(client, monkeypatch):
    case = ready_case(client)
    monkeypatch.setattr(settings, 'ai_backend', 'llama_cpp')
    monkeypatch.setattr(ai, 'model_status', lambda: {'ready': True})
    from app import llama_adapter
    calls = []

    def completion(messages, schema, **kwargs):
        calls.append(messages)
        if 'FiveYearOutlook' in schema['$defs']:
            choices = schema['$defs']['FiveYearOutlook']['anyOf']
            assert choices[0]['properties']['scenarios']['maxItems'] == 0
            assert choices[1]['properties']['scenarios']['minItems'] == 1
        output = report(case['version'])
        if len(calls) == 1:
            output['discrepancies'] = [{'text': 'This is the rejected model text.', 'refs': ['E2']}]
        return json.dumps({key: value for key, value in output.items() if key in schema['properties']})

    monkeypatch.setattr(llama_adapter, 'complete', completion)
    job = compare(client, case)
    assert job['status'] == 'succeeded' and len(calls) == 3
    assert 'previous response failed validation' in calls[1][1]['content']
    assert 'This is the rejected model text.' not in calls[1][1]['content']
    assert job['result']['comparison']['discrepancies'] == []


def test_qualitative_outlook_requires_observations_and_accepts_probability_abstention():
    snapshot = {'version': 1, 'age': 52}
    evidence = [{'ref': 'E1', 'category': 'objective', 'text': 'Confirmed longitudinal observations.'},
                {'ref': 'E2', 'category': 'doctor_conclusion', 'text': 'Confirmed doctor conclusion.'}]
    output = report(1)
    output['five_year_outlook'] = {
        'status': 'qualitative_only', 'summary': 'Процентный риск не рассчитан; это условные сценарии наблюдения.',
        'scenarios': [{'scenario': 'Продолжение наблюдения при стабильном состоянии.',
                       'conditions': 'Если наблюдаемое состояние сохраняется.',
                       'monitoring': 'Обсудить динамику зарегистрированных наблюдений с врачом.', 'refs': ['E1']}],
    }
    assert patient_workspace_ai.validate_comparison(output, snapshot, evidence) is output
    output['five_year_outlook']['scenarios'][0]['refs'] = ['E2']
    with pytest.raises(ValueError, match='documented patient observations'):
        patient_workspace_ai.validate_comparison(output, snapshot, evidence)


def test_comparison_rechecks_version_after_concurrent_clinical_update(client, monkeypatch):
    case = ready_case(client)
    original_access = patient_workspace.access_case
    changed = False

    def access_then_another_doctor_updates(db, user, case_id):
        nonlocal changed
        loaded = original_access(db, user, case_id)
        if not changed:
            changed = True
            # A separate committed clinical mutation happens after the request
            # loaded Case but before its idempotency transaction owns the snapshot.
            with SessionLocal() as other:
                other.execute(update(Case).where(Case.id == case_id).values(version=loaded.version + 1))
                other.add(Record(tenant_id=user.tenant_id, actor_id=user.id, case_id=case_id,
                                 case_version=loaded.version + 1, kind='clinical_entry',
                                 data={'category': 'objective', 'text': 'New confirmed observation.',
                                       'confirmed': True, 'diagnosis': '', 'treatment': '',
                                       'source_id': None, 'source_mode': 'manual', 'author_name': user.name}))
                other.commit()
        return loaded

    monkeypatch.setattr(patient_workspace, 'access_case', access_then_another_doctor_updates)
    monkeypatch.setattr(jobs, 'dispatch', lambda _: None)
    response = mutate(client, f'/cases/{case["id"]}/clinical-comparisons', {'expected_version': case['version']})
    assert response.status_code == 409, response.text
    assert response.json()['error']['code'] == 'CASE_VERSION_CONFLICT'
    with SessionLocal() as db:
        assert not list(db.scalars(select(Job).where(Job.case_id == case['id'])))
    monkeypatch.setattr(patient_workspace, 'access_case', original_access)
    case['version'] += 1
    job = compare(client, case)
    with SessionLocal() as db:
        snapshot = db.get(Job, job['id']).payload['snapshot']
        assert snapshot['version'] == case['version']
        assert any(e['text'] == 'New confirmed observation.' for e in snapshot['entries'])


def test_legacy_dmed_import_backfills_drafts_once_without_fabricating_or_duplicating_data(client):
    case = new_case(client)
    connection = mutate(client, '/integrations/dmed/connect').json()
    original_text = 'Жалобы: контрольное обследование. Внешняя запись требует сверки врачом.'
    with SessionLocal() as db:
        patient = db.get(Case, case['id'])
        source = Record(tenant_id=patient.tenant_id, actor_id=patient.owner_id, case_id=patient.id,
                        case_version=patient.version, kind='source',
                        data={'type': 'dmed_demo', 'name': 'Legacy DMED fixture', 'text': original_text,
                              'external_version': 1, 'pages': [], 'limitations': ['DEMO_INTEGRATION']})
        db.add(source)
        db.flush()
        source_id = source.id
        imported = Record(tenant_id=patient.tenant_id, actor_id=patient.owner_id, case_id=patient.id,
                          case_version=patient.version, kind='import',
                          data={'source_id': source.id, 'connection_id': connection['id'], 'external_version': 1,
                                'mode': 'demo', 'status': 'awaiting_confirmation'})
        db.add(imported)
        db.add(Record(tenant_id=patient.tenant_id, actor_id=patient.owner_id, case_id=patient.id,
                      case_version=patient.version, kind='fact',
                      data={'key': 'symptom.complaint', 'label': 'Жалобы', 'value': 'контрольное обследование',
                            'source_id': source.id, 'confirmed': False}))
        db.commit()
        import_id = imported.id
    body = {'expected_version': case['version'], 'connection_id': connection['id'], 'scenario': 'success'}
    path = f'/cases/{case["id"]}/imports'
    response = mutate(client, path, body, key='legacy-category-backfill')
    assert response.status_code == 200, response.text
    assert response.json()['id'] == import_id and response.json()['source_id'] == source_id
    assert response.json()['clinical_backfill_version'] == case['version'] + 1
    result = client.get(f'/api/v1/cases/{case["id"]}/clinical-entries').json()
    assert len(result['items']) == 5
    assert all(not row['confirmed'] and row['source_id'] == source_id for row in result['items'])
    assert next(row['text'] for row in result['items'] if row['category'] == 'subjective') == original_text
    assert all(not row['text'] for row in result['items'] if row['category'] != 'subjective')
    assert not result['readiness']['comparison_ready']
    blank = next(row for row in result['items'] if row['category'] == 'doctor_conclusion')
    rejected = mutate(client, f'/cases/{case["id"]}/clinical-entries/{blank["id"]}',
                      {'expected_version': result['case_version'], 'confirmed': True}, method='patch')
    assert rejected.status_code == 422 and rejected.json()['error']['code'] == 'CLINICAL_ENTRY_TEXT_REQUIRED'
    assert mutate(client, path, body, key='legacy-category-backfill').json() == response.json()
    assert mutate(client, path, body).json() == response.json()
    current = client.get(f'/api/v1/cases/{case["id"]}').json()
    assert current['version'] == case['version'] + 1
    with SessionLocal() as db:
        records = list(db.scalars(select(Record).where(Record.case_id == case['id'])))
        assert sum(row.kind == 'source' for row in records) == 1
        assert sum(row.kind == 'fact' for row in records) == 1
        assert sum(row.kind == 'import' for row in records) == 1
        assert sum(row.kind == 'clinical_entry' for row in records) == 5
        assert db.get(Record, source_id).data['text'] == original_text
    # Returning to legacy v1 after a v2 update must not resurrect old categories.
    updated = mutate(client, path, {**body, 'expected_version': current['version'], 'scenario': 'updated'})
    assert updated.status_code == 200
    assert mutate(client, path, body).status_code == 200
    latest = client.get(f'/api/v1/cases/{case["id"]}/clinical-entries').json()
    assert len(latest['items']) == 5 and latest['case_version'] == current['version'] + 1
