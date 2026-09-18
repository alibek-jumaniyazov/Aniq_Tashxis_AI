from sqlalchemy import event, select, update
from app import ai, jobs
from app.config import settings
from app.db import Job, SessionLocal, User, engine, now
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
        queued_case = new_case(client)
        assert mutate(client, f'/cases/{queued_case["id"]}/analyses', {'expected_version': queued_case['version']}).status_code == 202
    assert mutate(client, '/analyses/' + first['id'] + '/retry', {'expected_version': c['version']}).status_code == 429


def test_worker_failure_cannot_overwrite_a_concurrent_cancel(client, monkeypatch):
    c = new_case(client)
    monkeypatch.setattr(jobs, 'dispatch', lambda _: None)
    queued = mutate(client, f'/cases/{c["id"]}/analyses', {'expected_version': c['version']}).json()
    job_id = queued['run_id']

    def broken_review(*args):
        raise RuntimeError('Reproduce a worker failure')

    monkeypatch.setattr(jobs, 'review_snapshot', broken_review)
    cancelled = False

    def cancel_before_failure_write(connection, cursor, statement, parameters, context, executemany):
        nonlocal cancelled
        if not cancelled and statement.startswith('UPDATE jobs SET') and 'JOB_FAILED' in parameters:
            cancelled = True
            with engine.begin() as other:
                other.execute(update(Job).where(Job.id == job_id).values(status='cancelled', stage='cancelled', finished_at=now()))

    event.listen(engine, 'before_cursor_execute', cancel_before_failure_write)
    try:
        jobs.process_job(job_id)
    finally:
        event.remove(engine, 'before_cursor_execute', cancel_before_failure_write)
    assert cancelled
    result = client.get('/api/v1/analyses/' + job_id).json()
    assert result['status'] == 'cancelled' and result['stage'] == 'cancelled'
    assert result['error_code'] is None and result['result'] == {}


def test_interrupted_worker_recovery_resets_stage_and_allows_retry(client, monkeypatch):
    c = new_case(client)
    monkeypatch.setattr(jobs, 'dispatch', lambda _: None)
    queued = mutate(client, f'/cases/{c["id"]}/analyses', {'expected_version': c['version']}).json()
    with SessionLocal() as db:
        db.execute(update(Job).where(Job.id == queued['run_id']).values(status='running', stage='medgemma'))
        db.commit()
    monkeypatch.setattr(settings, 'queue_mode', 'local')
    jobs.recover()
    result = client.get('/api/v1/analyses/' + queued['run_id']).json()
    assert result['status'] == 'failed' and result['stage'] == 'failed'
    assert result['error_code'] == 'WORKER_INTERRUPTED'
    assert mutate(client, '/analyses/' + queued['run_id'] + '/retry', {'expected_version': c['version']}).status_code == 202
