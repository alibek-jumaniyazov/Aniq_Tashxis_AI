from sqlalchemy import select
from app import ai, jobs
from app.db import Job, SessionLocal, User
from test_workflows import mutate, new_case, run


def test_revoked_actor_cannot_publish_inflight_model_result(client, monkeypatch):
    c = new_case(client)
    def revoke(snapshot, *args):
        with SessionLocal() as db:
            doctor = db.scalar(select(User).where(User.email == 'doctor@demo.aniq'))
            doctor.active = False
            db.commit()
        return {'case_version': snapshot['version'], 'summary': 'Discard me', 'concerns': [], 'limitations': [], 'missing_fields': []}
    monkeypatch.setattr(ai, 'review', revoke)
    response = mutate(client, f'/cases/{c["id"]}/analyses', {'expected_version': c['version']})
    assert response.status_code == 202
    with SessionLocal() as db:
        job = db.get(Job, response.json()['run_id'])
        assert job.status == 'failed'
        assert not job.result


def test_cancelled_job_is_never_started_and_terminal_state_is_preserved(client, monkeypatch):
    c = new_case(client)
    monkeypatch.setattr(jobs, 'dispatch', lambda _: None)
    queued = mutate(client, f'/cases/{c["id"]}/analyses', {'expected_version': c['version']}).json()
    path = '/analyses/' + queued['run_id']
    assert mutate(client, path + '/cancel', key='cancel-job-key').status_code == 200
    jobs.process_job(queued['run_id'])
    job = client.get('/api/v1' + path).json()
    assert job['status'] == 'cancelled' and not job['result']
    assert mutate(client, path + '/cancel', key='cancel-job-key').status_code == 200
    assert mutate(client, path + '/cancel').status_code == 409


def test_retry_obeys_same_queue_budget_as_new_analysis(client, monkeypatch):
    c = new_case(client)
    first = run(client, c, include_ai=False)
    assert first['result']['model_revision']
    monkeypatch.setattr(jobs, 'dispatch', lambda _: None)
    for _ in range(10):
        assert mutate(client, f'/cases/{c["id"]}/analyses', {'expected_version': c['version']}).status_code == 202
    assert mutate(client, '/analyses/' + first['id'] + '/retry', {'expected_version': c['version']}).status_code == 429
