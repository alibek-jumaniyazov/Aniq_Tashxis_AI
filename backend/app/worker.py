from celery import Celery
from .config import settings

celery_app = Celery('aniq', broker=settings.redis_url)
celery_app.conf.update(task_serializer='json', accept_content=['json'], worker_prefetch_multiplier=1, task_acks_late=True, broker_connection_retry_on_startup=True, task_time_limit=300)


@celery_app.task(name='aniq.process')
def run(job_id):
    from .jobs import process_job
    process_job(job_id)
