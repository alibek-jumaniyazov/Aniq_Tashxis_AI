import hashlib
import json
import re
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from app.config import settings
from app.db import Base, Job, Record, SessionLocal, engine
from app.demo_seed import seed_realistic, verify_seed
from app.main import app, login_attempts
from conftest import sign_in


@pytest.fixture
def seeded(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, 'seed_profile', 'realistic')
    monkeypatch.setattr(settings, 'storage_root', tmp_path / 'files')
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    login_attempts.clear()
    with TestClient(app) as client:
        sign_in(client)
        yield client
    engine.dispose()


def post(client, path, body):
    return client.post('/api/v1' + path, json=body, headers={'Idempotency-Key': str(uuid4())})


def test_seed_references_files_timeline_and_idempotency(seeded):
    counts = verify_seed()
    assert counts['cases'] == 19 and counts['users'] == 8
    assert seed_realistic() is False
    assert counts == verify_seed()
    with SessionLocal() as db:
        for fact in db.scalars(select(Record).where(Record.kind == 'fact')):
            source = db.get(Record, fact.data['source_id'])
            match = re.fullmatch(r'page:(\d+):chars:(\d+)-(\d+)', fact.data['span'])
            page, start, end = map(int, match.groups())
            text = next(p['text'] for p in source.data['pages'] if p['page'] == page)
            quote = text[start:end]
            assert str(fact.data['value']) in quote
            if fact.data['unit']:
                assert fact.data['unit'] in quote
        for job in db.scalars(select(Job)):
            assert job.created_at <= job.started_at <= job.finished_at
            assert job.result['ai'] is None and not job.payload['include_ai']
            assert all(f['case_version'] <= job.case_version for f in job.payload['snapshot']['facts'])


def test_roles_scope_team_and_aggregate_privacy(seeded):
    c = seeded
    doctor_cases = c.get('/api/v1/cases?page_size=100').json()['items']
    assert len(doctor_cases) == 18 and all(x['demo'] for x in doctor_cases)
    reviewed = next(x for x in doctor_cases if x['alias'].endswith('-002'))
    history = c.get('/api/v1/cases/' + reviewed['id']).json()['alerts'][0]['reviews']
    assert [r['status'] for r in history] == ['seen', 'accepted', 'closed']
    assert all(r['reviewer_name'] for r in history)
    assert c.get('/api/v1/team').status_code == 403
    for role in ['expert', 'quality', 'sender']:
        sign_in(c, role)
        assert len(c.get('/api/v1/incidents').json()['items']) == 13
        assert len(c.get('/api/v1/exports').json()['items']) == 3
    sign_in(c, 'radiologist')
    assert c.get('/api/v1/cases').json()['total'] == 5
    assert c.get('/api/v1/exports').status_code == 403
    sign_in(c, 'admin')
    team = c.get('/api/v1/team').json()['items']
    assert len(team) == 7 and all('password_hash' not in u for u in team)
    assert all(u['email'] != 'other@demo.aniq' for u in team)
    assert c.get('/api/v1/cases/' + doctor_cases[0]['id']).status_code == 404
    assert all(r['actor_name'] for r in c.get('/api/v1/audit-events').json()['items'])
    sign_in(c, 'analyst')
    exports = c.get('/api/v1/exports').json()['items']
    assert len(exports) == 1 and exports[0]['package']['confirmed_cases'] == 5
    assert not {'incident_ids', 'snapshots', 'actor_id', 'purpose', 'basis'} & exports[0].keys()
    assert not any(x['id'] in json.dumps(exports) for x in doctor_cases)
    assert c.get('/api/v1/cases/' + doctor_cases[0]['id']).status_code == 404
    sign_in(c, 'other')
    assert c.get('/api/v1/cases').json()['total'] == 1
    assert c.get('/api/v1/cases/' + doctor_cases[0]['id']).status_code == 404


def test_sender_can_finish_prepared_packages_and_download(seeded):
    c = seeded
    sign_in(c, 'sender')
    exports = c.get('/api/v1/exports').json()['items']
    draft = next(r for r in exports if r['status'] == 'draft')
    approved = post(c, f'/exports/{draft["id"]}/approve', {'expected_version': draft['version']})
    assert approved.status_code == 200, approved.text
    sent = post(c, f'/exports/{draft["id"]}/send', {'expected_version': approved.json()['version']})
    assert sent.status_code == 200, sent.text
    download = c.get(f'/api/v1/exports/{draft["id"]}/download?format=json')
    assert hashlib.sha256(download.content).hexdigest() == sent.json()['sha256']
    assert sent.json()['receipt']['sha256'] == sent.json()['sha256']
    assert download.json()['small_group_suppressed'] is True
    assert c.get(f'/api/v1/exports/{draft["id"]}/download?format=pdf').content.startswith(b'%PDF')
    sign_in(c, 'analyst')
    assert len(c.get('/api/v1/exports').json()['items']) == 2


def test_radiologist_frames_and_review_persist(seeded):
    c = seeded
    sign_in(c, 'radiologist')
    cases = c.get('/api/v1/cases').json()['items']
    loaded = [c.get('/api/v1/cases/' + x['id']).json() for x in cases]
    pending = next(x for x in loaded if not x['studies'][0]['reviews'])
    study = pending['studies'][0]
    series = study['series'][0]
    frame = c.get(f'/api/v1/imaging-studies/{study["id"]}/series/{series["id"]}/frames/{series["count"] - 1}')
    assert frame.status_code == 200 and frame.content.startswith(b'\x89PNG')
    response = post(c, f'/imaging-findings/{study["id"]}/reviews', {'status': 'clarified', 'comment': 'Synthetic phantom inspected; no clinical interpretation.'})
    assert response.status_code == 200, response.text
    refreshed = c.get('/api/v1/cases/' + pending['id']).json()['studies'][0]
    assert refreshed['reviews'][0]['reviewer_name'] == 'Д-р Тимур Рахимов'
    assert len(refreshed['reviews']) == 1
    sign_in(c, 'doctor')
    assert post(c, f'/imaging-findings/{study["id"]}/reviews', {'status': 'confirmed', 'comment': 'Unauthorized doctor'}).status_code == 403


def test_expert_pending_decision_and_doctor_confirmation(seeded):
    c = seeded
    sign_in(c, 'expert')
    incident = next(r for r in c.get('/api/v1/incidents').json()['items'] if r['status'] == 'under_review')
    result = post(c, f'/incidents/{incident["id"]}/decisions', {'expected_version': incident['version'], 'status': 'awaiting_explanation', 'explanation': 'Please clarify source availability before a final decision.'})
    assert result.status_code == 200, result.text
    sign_in(c, 'doctor')
    cases = c.get('/api/v1/cases?page_size=100').json()['items']
    intake = next(r for r in cases if r['alias'].endswith('-004'))
    detail = c.get('/api/v1/cases/' + intake['id']).json()
    assert not detail['analyses'] and all(not f['confirmed'] for f in detail['facts'])
    result = post(c, f'/cases/{intake["id"]}/facts/confirm', {'expected_version': detail['version'], 'fact_ids': [f['id'] for f in detail['facts']]})
    assert result.status_code == 200, result.text
    refreshed = c.get('/api/v1/cases/' + intake['id']).json()
    assert all(f['confirmed'] for f in refreshed['facts'])
    analysis = post(c, f'/cases/{intake["id"]}/analyses', {'expected_version': refreshed['version'], 'include_ai': False})
    assert analysis.status_code == 202, analysis.text
    assert c.get('/api/v1/analyses/' + analysis.json()['run_id']).json()['status'] == 'partial'


def test_revisions_and_late_results_are_not_silently_overwritten(seeded):
    c = seeded
    cases = c.get('/api/v1/cases?page_size=100').json()['items']
    corrected = c.get('/api/v1/cases/' + next(r['id'] for r in cases if r['alias'].endswith('-005'))).json()
    potassium = next(f for f in corrected['facts'] if f['key'] == 'lab.potassium')
    assert potassium['unit'] == 'mmol/L' and potassium['supersedes']
    assert any(r['is_stale'] for r in corrected['analyses'])
    assert not corrected['analyses'][0]['is_stale']
    late = c.get('/api/v1/cases/' + next(r['id'] for r in cases if r['alias'].endswith('-006'))).json()
    historical = next(r for r in late['analyses'] if r['mode'] == 'decision_time')
    current = next(r for r in late['analyses'] if r['mode'] == 'current')
    assert 'DEMO-LAB-01' in current['result']['coverage']['completed']
    assert 'DEMO-LAB-01' not in historical['result']['coverage']['completed']
