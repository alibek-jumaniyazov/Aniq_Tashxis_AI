import hashlib
import json
import re
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from app.config import settings
from app.db import Base, Job, Record, SessionLocal, User, engine
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
    assert counts['cases'] == 19 and counts['users'] == 12
    assert counts['records']['clinical_entry'] == 90
    assert counts['analysis_kinds']['clinical_comparison'] == 45
    assert counts['comparison_languages'] == {'ru': 15, 'uz': 15, 'en': 15}
    assert counts['clinics'] == 4
    assert counts['subscription_requests'] == {'approved': 1, 'pending': 1, 'rejected': 1}
    assert seed_realistic() is False
    assert counts == verify_seed()
    with SessionLocal() as db:
        users = list(db.scalars(select(User)))
        assert len([u for u in users if u.tenant_id in {'avilab-demo', 'other-demo'}]) == 9
        platform = [u for u in users if u.tenant_id == 'avilab-platform']
        assert len(platform) == 1 and platform[0].role == 'developer'
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
            assert job.result['model_id'] == 'synthetic-demo'
            assert job.result['provenance'] == 'synthetic_seed' and job.result['demo_only']
            assert not {'full_name', 'patient_phone'} & job.payload['snapshot'].keys()
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
    assert len(team) == 8 and all('password_hash' not in u for u in team)
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
    current = next(r for r in late['analyses'] if r['mode'] == 'current' and r['kind'] == 'analysis')
    assert 'DEMO-LAB-01' in current['result']['coverage']['completed']
    assert 'DEMO-LAB-01' not in historical['result']['coverage']['completed']


def test_current_patient_sections_sources_and_language_variants(seeded):
    patients = seeded.get('/api/v1/cases?page_size=100').json()['items']
    assert len({patient['full_name'] for patient in patients}) == 18
    assert all(patient['full_name'] and patient['patient_phone'] == '' for patient in patients)
    for patient in patients:
        entries = seeded.get(f'/api/v1/cases/{patient["id"]}/clinical-entries').json()
        assert {entry['category'] for entry in entries['items']} == {'subjective', 'objective', 'laboratory', 'instrumental', 'doctor_conclusion'}
        runs = seeded.get(f'/api/v1/cases/{patient["id"]}/clinical-comparisons').json()['items']
        pending = patient['alias'].endswith(('-004', '-016', '-017'))
        assert entries['readiness']['comparison_ready'] is not pending
        if pending:
            assert not runs and not any(entry['confirmed'] for entry in entries['items'])
            continue
        assert {run['language'] for run in runs} == {'ru', 'uz', 'en'}
        assert len(runs) == 3
        for run in runs:
            report = run['result']['comparison']
            assert not run['is_stale'] and run['status'] == 'succeeded'
            assert report['language'] == run['language'] == run['result']['language']
            assert report['validated_probability'] is False and report['requires_clinician_review'] is True
            assert run['result']['demo_only'] and run['result']['model_id'] == 'synthetic-demo'
            entry_ids = {entry['id'] for entry in entries['items']}
            assert all(item['entry_id'] in entry_ids for item in report['evidence'] if 'entry_id' in item)
            # Names and registration identity never become evidence or model input.
            assert patient['full_name'] not in json.dumps(report, ensure_ascii=False)
        imported = [entry for entry in entries['items'] if entry['source_mode'] == 'dmed_demo']
        assert not imported
    with SessionLocal() as db:
        dmed = list(db.scalars(select(Record).where(Record.kind == 'clinical_entry')))
        assert len([entry for entry in dmed if entry.data['source_mode'] == 'dmed_demo']) == 5


def test_tb_same_cutoff_and_source_grounded_difference(seeded):
    patients = seeded.get('/api/v1/cases?page_size=100').json()['items']
    for suffix, expected in (('-009', 'consistent_with_data'), ('-015', 'needs_review')):
        patient = next(p for p in patients if p['alias'].endswith(suffix))
        runs = seeded.get(f'/api/v1/cases/{patient["id"]}/clinical-comparisons').json()['items']
        for run in runs:
            report = run['result']['comparison']
            assert report['diagnosis_review']['status'] == expected
            assert bool(report['discrepancies']) is (suffix == '-015')
            lab = next(e for e in report['evidence'] if e['category'] == 'laboratory')
            conclusion = next(e for e in report['evidence'] if e['category'] == 'doctor_conclusion')
            assert 'MTB detected MEDIUM' in lab['text'] and 'КУМ 2+' in lab['text']
            assert {lab['ref'], conclusion['ref']} <= set(report['diagnosis_review']['refs'])
            with SessionLocal() as db:
                assert db.get(Record, lab['entry_id']).created_at < db.get(Record, conclusion['entry_id']).created_at


def test_documented_regimens_have_grounded_complete_treatment_reviews(seeded):
    patients = seeded.get('/api/v1/cases?page_size=100').json()['items']
    for suffix, dose in (('-005', '5'), ('-012', '500')):
        patient = next(p for p in patients if p['alias'].endswith(suffix))
        runs = seeded.get(f'/api/v1/cases/{patient["id"]}/clinical-comparisons').json()['items']
        assert len(runs) == 3
        for run in runs:
            report = run['result']['comparison']
            section = report['treatment_review']
            assert section['status'] == 'consistent_with_data'
            assert dose in section['summary']
            references = {e['ref']: e for e in report['evidence']}
            assert 'doctor_conclusion' in {references[ref]['category'] for ref in section['refs']}
            assert any(references[ref]['category'] in {'laboratory', 'objective'} for ref in section['refs'])
            assert not any(phrase in section['summary'].casefold() for phrase in ('не указана', 'не представлены', 'without the regimen', 'sxema yo‘q'))
            assert report['questions'] and 'доз' not in report['questions'][0].casefold()
            assert report['diagnosis_review']['status'] == 'consistent_with_data'


def test_clinic_owner_receipts_and_developer_approval_are_usable(seeded):
    c = seeded
    sign_in(c, 'owner')
    account = c.get('/api/v1/billing/account').json()
    assert account['is_clinic_owner'] and account['subscription']['doctor_limit'] == 10
    assert account['usage']['doctors'] == 3
    assert c.get('/api/v1/cases').status_code == 403
    sign_in(c, 'owner.pending')
    pending = c.get('/api/v1/billing/account').json()
    assert pending['subscription']['status'] == 'pending'
    request = pending['requests'][0]
    assert request['status'] == 'pending' and request['is_demo']
    receipt = c.get(request['receipt_url'])
    assert receipt.status_code == 200 and receipt.content.startswith(b'\x89PNG')
    sign_in(c, 'developer')
    overview = c.get('/api/v1/developer/overview').json()
    assert overview['approved_revenue_uzs'] == 0 and overview['pending_requests'] == 1
    reviewed = post(c, f'/developer/subscription-requests/{request["id"]}/review', {
        'expected_version': request['version'], 'decision': 'approved',
        'note': 'Synthetic review for testing, no actual payment.'})
    assert reviewed.status_code == 200, reviewed.text
    assert reviewed.json()['subscription']['active']
    assert c.get('/api/v1/developer/overview').json()['approved_revenue_uzs'] == 0
    sign_in(c, 'owner.pending')
    assert c.get('/api/v1/billing/account').json()['subscription']['status'] == 'active'
    sign_in(c, 'owner.expired')
    assert c.get('/api/v1/billing/account').json()['subscription']['status'] == 'expired'


def test_reset_preserves_access_config_only_without_old_patient_data(seeded, tmp_path):
    import importlib.util
    from pathlib import Path
    import sqlite3
    spec = importlib.util.spec_from_file_location('reset_demo_test', Path(__file__).resolve().parents[2] / 'scripts/reset_demo.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    old_path, staged_path = tmp_path / 'old.db', tmp_path / 'new.db'
    # Copy the isolated test schema; neither file is the running application's DB.
    with sqlite3.connect(engine.url.database) as current:
        for target_path in (old_path, staged_path):
            with sqlite3.connect(target_path) as target:
                current.backup(target)
    with sqlite3.connect(old_path) as previous:
        previous.execute("UPDATE users SET password_hash='retained-hash' WHERE email='developer@demo.aniq'")
        previous.execute("INSERT INTO users VALUES ('custom-dev', 'custom-platform', 'maintainer@example.test', 'Maintainer', 'developer', 'custom-hash', 1)")
        previous.execute("INSERT INTO users VALUES ('old-customer', 'old-clinic', 'customer@example.test', 'Previous customer', 'doctor', 'old-hash', 1)")
        previous.execute("UPDATE billing_payment_methods SET instructions='Retain configured public instructions'")
        previous.execute("UPDATE billing_plans SET description='Retain custom plan description' WHERE id='clinic10'")
        previous.execute("UPDATE cases SET full_name='Old history must not be copied'")
    result = module.preserve_access_and_configuration(old_path, staged_path)
    assert result['matched_accounts'] == 12 and result['retained_accounts'] == 1
    with sqlite3.connect(staged_path) as staged:
        assert staged.execute("SELECT password_hash FROM users WHERE email='developer@demo.aniq'").fetchone()[0] == 'retained-hash'
        assert staged.execute("SELECT role FROM users WHERE id='custom-dev'").fetchone()[0] == 'developer'
        assert staged.execute("SELECT 1 FROM users WHERE id='old-customer'").fetchone() is None
        assert staged.execute("SELECT 1 FROM cases WHERE full_name='Old history must not be copied'").fetchone() is None
        assert staged.execute('SELECT instructions FROM billing_payment_methods').fetchone()[0] == 'Retain configured public instructions'
        assert staged.execute("SELECT description FROM billing_plans WHERE id='clinic10'").fetchone()[0] == 'Retain custom plan description'
        assert not staged.execute('PRAGMA foreign_key_check').fetchall()
    assert module.bounded(tmp_path / 'inside', tmp_path) == (tmp_path / 'inside').resolve()
    with pytest.raises(RuntimeError):
        module.bounded(tmp_path, tmp_path)


def test_reset_fresh_subprocess_registers_all_tables_before_seed(tmp_path):
    """Exercise the real reset build entrypoint without TestClient's imports."""
    import importlib.util
    import os
    from pathlib import Path
    import subprocess
    import sys
    root = Path(__file__).resolve().parents[2]
    spec = importlib.util.spec_from_file_location('reset_fresh_process', root / 'scripts/reset_demo.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    environment = {**os.environ, 'PYTHONUTF8': '1', 'PYTHONPATH': str(root / 'backend'),
                   'DATABASE_URL': 'sqlite:///' + (tmp_path / 'fresh.db').as_posix(),
                   'STORAGE_ROOT': str(tmp_path / 'files'), 'DEMO_MODE': 'true',
                   'SEED_PROFILE': 'realistic', 'MODEL_PATH': '', 'AI_BACKEND': 'transformers'}
    result = subprocess.run([sys.executable, '-c', module.BUILD_CODE], cwd=root, env=environment,
                            capture_output=True, text=True, encoding='utf-8', timeout=120, check=False)
    assert result.returncode == 0, result.stderr
    counts = json.loads(result.stdout)
    assert counts['users'] == 12 and counts['clinics'] == 4
    assert counts['records']['clinical_entry'] == 90
    assert counts['subscription_requests'] == {'approved': 1, 'pending': 1, 'rejected': 1}
