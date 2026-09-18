import json
import io
import zipfile

import httpx
import pytest
from PIL import Image
from sqlalchemy import select

from app import ai, radiology
from app.config import settings
from app.db import Record, SessionLocal
from conftest import sign_in
from test_radiology_workflow import image_data, upload_study
from test_workflows import mutate


@pytest.mark.parametrize('modality', ['MR', 'DX', 'CR'])
def test_mri_and_xray_zip_open_real_decoded_frame(client, case, modality):
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, 'w') as stream:
        stream.writestr('study/series/image.dcm', image_data(modality, spacing=False))
    uploaded = client.post(f'/api/v1/cases/{case["id"]}/imaging-studies', headers={'Idempotency-Key': 'zip-modality-import'}, data={'expected_version': case['version'], 'deidentified_confirmed': 'true'}, files={'file': ('study.zip', archive.getvalue(), 'application/zip')})
    assert uploaded.status_code == 201, uploaded.text
    study = uploaded.json()
    series = study['series'][0]
    assert series['modality'] == modality and series['count'] == 1
    response = client.get(f'/api/v1/imaging-studies/{study["id"]}/series/{series["id"]}/frames/0')
    assert response.status_code == 200 and response.headers['content-type'] == 'image/png'
    assert Image.open(io.BytesIO(response.content)).size == (16, 16)


def test_report_versions_persist_and_make_previous_image_review_stale(client, case):
    study, frame = upload_study(client, case)
    queued = mutate(client, f'/imaging-studies/{study["id"]}/analyses', frame)
    assert queued.status_code == 202
    path = f'/imaging-studies/{study["id"]}/reports'
    body = {'expected_version': frame['expected_version'], 'radiologist_report': '  Контуры чёткие. Требуется просмотр остальных серий.  '}
    saved = mutate(client, path, body, key='save-report-unique')
    assert saved.status_code == 201, saved.text
    assert saved.json()['radiologist_report'] == body['radiologist_report'].strip()
    assert saved.json()['case_version'] == frame['expected_version'] + 1
    assert mutate(client, path, body, key='save-report-unique').json()['id'] == saved.json()['id']
    assert mutate(client, path, body).status_code == 409
    history = client.get('/api/v1' + path).json()['items']
    assert len(history) == 1 and history[0]['id'] == saved.json()['id']
    assert client.get('/api/v1/analyses/' + queued.json()['run_id']).json()['is_stale']
    assert mutate(client, path, {**body, 'expected_version': frame['expected_version'] + 1, 'radiologist_report': '   '}).status_code == 422
    sign_in(client, 'radiologist')
    update = mutate(client, path, {**body, 'expected_version': frame['expected_version'] + 1, 'radiologist_report': 'Уточнённое заключение.'})
    assert update.status_code == 201, update.text
    assert len(client.get('/api/v1' + path).json()['items']) == 2


def test_report_source_is_bound_to_patient_and_quote(client, case):
    study, frame = upload_study(client, case)
    document = client.post(f'/api/v1/cases/{case["id"]}/documents', headers={'Idempotency-Key': 'radiology-report-doc'}, data={'expected_version': frame['expected_version'], 'identity_confirmed': 'true'}, files={'file': ('report.txt', 'Описание: ровные контуры.\nЗаключение требует проверки.'.encode())})
    assert document.status_code == 201, document.text
    source = document.json()
    body = {**frame, 'expected_version': frame['expected_version'] + 1, 'radiologist_report': 'Ровные контуры.', 'report_source_id': source['id'], 'report_quote': 'Описание: ровные контуры.'}
    path = f'/imaging-studies/{study["id"]}/analyses'
    invalid_quote = mutate(client, path, {**body, 'report_quote': 'Этого нет в документе'})
    assert invalid_quote.status_code == 422 and invalid_quote.json()['error']['code'] == 'REPORT_QUOTE_MISMATCH'
    assert mutate(client, path, {**body, 'report_quote': ''}).status_code == 422
    assert mutate(client, path, {**body, 'report_source_id': None}).status_code == 422
    other = mutate(client, '/cases', {'full_name': 'Other imaging test patient'}).json()
    with SessionLocal() as db:
        unrelated = Record(tenant_id=case['tenant_id'] if 'tenant_id' in case else db.scalar(select(Record).where(Record.id == study['id'])).tenant_id, case_id=other['id'], actor_id=db.scalar(select(Record).where(Record.id == study['id'])).actor_id, kind='source', case_version=1, data={'text': body['report_quote']})
        db.add(unrelated)
        db.commit()
        unrelated_id = unrelated.id
    mismatch = mutate(client, path, {**body, 'report_source_id': unrelated_id})
    assert mismatch.status_code == 422 and mismatch.json()['error']['code'] == 'REPORT_SOURCE_MISMATCH'
    accepted = mutate(client, path, body)
    assert accepted.status_code == 202, accepted.text
    result = client.get('/api/v1/analyses/' + accepted.json()['run_id']).json()['result']
    assert result['radiologist_report'] == body['radiologist_report']
    assert result['report_source_id'] == source['id'] and result['report_quote'] == body['report_quote']


def test_report_comparison_is_grounded_in_selected_frame_and_snapshot(client, case, monkeypatch):
    study, body = upload_study(client, case)
    with SessionLocal() as db:
        record = db.get(Record, study['id'])
        record.data = {**record.data, 'synthetic_phantom': False}
        db.commit()
    captured = []
    output = {'observations': ['На кадре виден округлый контур.'], 'limitations': ['Один выбранный кадр.'], 'report_comparison': {'status': 'possible_discrepancy', 'explanation': 'Локализацию необходимо сверить по всей серии.', 'points_to_verify': ['Просмотреть соседние срезы.']}}
    real_client = httpx.Client

    def respond(request):
        captured.append(json.loads(request.content))
        return httpx.Response(200, json={'choices': [{'finish_reason': 'stop', 'message': {'content': json.dumps(output, ensure_ascii=False)}}]})

    monkeypatch.setattr(settings, 'ai_backend', 'llama_cpp')
    monkeypatch.setattr(ai, 'model_status', lambda: {'ready': True, 'vision_ready': True})
    monkeypatch.setattr(radiology.httpx, 'Client', lambda **kw: real_client(transport=httpx.MockTransport(respond), **kw))
    report = 'Рентгенолог: требуется уточнение локализации.'
    queued = mutate(client, f'/imaging-studies/{study["id"]}/analyses', {**body, 'radiologist_report': report})
    assert queued.status_code == 202, queued.text
    result = client.get('/api/v1/analyses/' + queued.json()['run_id']).json()['result']
    assert result['image_review']['report_comparison'] == output['report_comparison']
    assert result['scope'] == 'selected_frame_only' and result['clinical_validation'] == 'not_validated'
    assert result['radiologist_report'] == report
    assert captured[0]['messages'][0]['role'] == 'system'
    assert 'Never declare a doctor correct or incorrect' in captured[0]['messages'][0]['content']
    assert report in captured[0]['messages'][1]['content'][0]['text']
    assert captured[0]['messages'][1]['content'][1]['image_url']['url'].startswith('data:image/png;base64,')


def test_phantom_never_validates_clinical_report(client, case, monkeypatch):
    study, body = upload_study(client, case)
    with SessionLocal() as db:
        record = db.get(Record, study['id'])
        record.data = {**record.data, 'synthetic_phantom': True}
        db.commit()
    real_client = httpx.Client
    output = {'observations': ['Геометрический фантом.'], 'limitations': ['Не анатомия.'], 'report_comparison': {'status': 'supported_on_selected_frame', 'explanation': 'Ошибочное подтверждение.', 'points_to_verify': ['Проверить.']}}
    monkeypatch.setattr(settings, 'ai_backend', 'llama_cpp')
    monkeypatch.setattr(ai, 'model_status', lambda: {'ready': True, 'vision_ready': True})
    monkeypatch.setattr(radiology.httpx, 'Client', lambda **kw: real_client(transport=httpx.MockTransport(lambda request: httpx.Response(200, json={'choices': [{'finish_reason': 'stop', 'message': {'content': json.dumps(output)}}]})), **kw))
    queued = mutate(client, f'/imaging-studies/{study["id"]}/analyses', {**body, 'radiologist_report': 'Клиническое заключение.'})
    result = client.get('/api/v1/analyses/' + queued.json()['run_id']).json()['result']
    assert result['image_review']['report_comparison']['status'] == 'not_assessable'
    assert 'фантом' in result['image_review']['report_comparison']['explanation']


def test_missing_report_comparison_is_not_silently_published(client, case, monkeypatch):
    study, body = upload_study(client, case)
    real_client = httpx.Client
    output = {'observations': ['Описание.'], 'limitations': ['Один кадр.']}
    monkeypatch.setattr(settings, 'ai_backend', 'llama_cpp')
    monkeypatch.setattr(ai, 'model_status', lambda: {'ready': True, 'vision_ready': True})
    monkeypatch.setattr(radiology.httpx, 'Client', lambda **kw: real_client(transport=httpx.MockTransport(lambda request: httpx.Response(200, json={'choices': [{'finish_reason': 'stop', 'message': {'content': json.dumps(output)}}]})), **kw))
    queued = mutate(client, f'/imaging-studies/{study["id"]}/analyses', {**body, 'radiologist_report': 'Нужна проверка.'})
    result = client.get('/api/v1/analyses/' + queued.json()['run_id']).json()['result']
    assert result['image_review'] is None and result['limitations'] == ['MODEL_OUTPUT_REJECTED']
