from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from datetime import datetime, timezone
from sqlalchemy import select, update
from . import ai, ai_provider
from .config import settings
from .db import Job, Record, SessionLocal, User, now
from .rules import RULE_VERSION, review_snapshot
from .clinical import evidence_report, eligible_facts
from .ai_locale import normalize_language
from .security import access_case, audit, create_record

pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="aniq-job")


def process_job(job_id):
    with SessionLocal() as db:
        claimed = db.execute(
            update(Job)
            .where(Job.id == job_id, Job.status == "queued")
            .values(status="running", stage="rules", started_at=now())
        )
        db.commit()
        if not claimed.rowcount:
            return
        job = db.get(Job, job_id)
        try:
            user = db.get(User, job.actor_id)
            if not user or not user.active:
                raise PermissionError("USER_REVOKED")
            case = access_case(db, user, job.case_id)
            if job.kind == "imaging":
                from .radiology import process_image_job

                process_image_job(db, job, user, case)
                return
            if job.kind == "clinical_comparison":
                from .patient_workspace import process_comparison

                process_comparison(db, job, user, case)
                return
            language = normalize_language(job.payload.get("language"))
            snapshot = {**job.payload["snapshot"], "language": language}
            mode, cutoff = job.payload["mode"], job.payload.get("decision_time")
            coverage, candidates = review_snapshot(snapshot, mode, cutoff)
            result = {
                "coverage": coverage,
                "alert_ids": [],
                "ai": None,
                "limitations": [],
                "rule_catalog_version": RULE_VERSION,
                "prompt_version": ai.PROMPT_VERSION,
                "language": language,
                "provenance": "documentation_rules",
            }
            result["data_quality"] = evidence_report(snapshot["facts"], mode, cutoff)
            from .decision import review_decision

            result["decision_review"] = review_decision(snapshot, mode, cutoff)
            if job.payload.get("include_ai"):
                result.update(ai_provider.result_metadata())
                job.stage = "ai_inference"
                db.commit()
                model_snapshot = dict(snapshot)
                model_snapshot["facts"] = eligible_facts(snapshot["facts"], mode, cutoff)
                model_snapshot["review_focus"] = job.payload.get("review_focus", "documentation")
                # Notes/summary may have been written later. Never feed them retrospectively.
                if mode == "decision_time":
                    model_snapshot["summary"] = ""
                    model_snapshot["diagnosis"] = ""
                    model_snapshot["notes"] = [
                        n
                        for n in snapshot.get("notes", [])
                        if datetime.fromisoformat(n["created_at"]).replace(tzinfo=timezone.utc)
                        <= datetime.fromisoformat(cutoff)
                    ]
                try:
                    result["ai"] = ai.review(model_snapshot, coverage, mode, cutoff)
                except ai.ModelUnavailable as exc:
                    result["limitations"].append(str(exc))
                except Exception:
                    result["limitations"].append("MODEL_OUTPUT_REJECTED")
            else:
                result["limitations"].append("AI_NOT_REQUESTED")
            db.expire_all()
            job = db.get(Job, job_id)
            if job.status == "cancelled":
                return
            user = db.get(User, job.actor_id)
            if not user or not user.active:
                raise PermissionError("USER_REVOKED")
            case = access_case(db, user, job.case_id)
            finish_status = (
                "partial" if coverage["not_evaluable"] or result["limitations"] else "succeeded"
            )
            claimed_finish = db.execute(
                update(Job)
                .where(Job.id == job.id, Job.status == "running")
                .values(status=finish_status, stage="complete", finished_at=now())
            )
            if not claimed_finish.rowcount:
                db.rollback()
                return
            for item in candidates:
                existing = list(
                    db.scalars(
                        select(Record).where(
                            Record.kind == "alert",
                            Record.case_id == case.id,
                            Record.case_version == job.case_version,
                        )
                    )
                )
                record = next(
                    (
                        r
                        for r in existing
                        if r.data["rule_id"] == item["rule_id"]
                        and sorted(r.data["fact_ids"]) == sorted(item["fact_ids"])
                    ),
                    None,
                )
                if not record:
                    record = create_record(
                        db, user, "alert", {**item, "run_id": job.id}, case, job.case_version
                    )
                result["alert_ids"].append(record.id)
            job.result = result
            signature = hashlib.sha256(
                json.dumps([job.case_version, mode, result], sort_keys=True).encode()
            ).hexdigest()
            notifications = list(
                db.scalars(
                    select(Record).where(Record.kind == "notification", Record.case_id == case.id)
                )
            )
            if not any(r.data.get("signature") == signature for r in notifications):
                create_record(
                    db,
                    user,
                    "notification",
                    {
                        "run_id": job.id,
                        "read": False,
                        "status": finish_status,
                        "signature": signature,
                    },
                    case,
                    job.case_version,
                )
            audit(db, user, "analysis.completed", job.id)
            db.commit()
        except Exception:
            db.rollback()
            # Failure publication races with cancellation too. Only a still-owned
            # running job may transition; a terminal state must never be replaced.
            db.execute(
                update(Job)
                .where(Job.id == job_id, Job.status == "running")
                .values(status="failed", stage="failed", error_code="JOB_FAILED", finished_at=now())
            )
            db.commit()


def dispatch(job_id):
    if settings.queue_mode == "celery":
        from .worker import celery_app

        celery_app.send_task("aniq.process", args=[job_id])
    elif settings.queue_mode == "inline":
        process_job(job_id)
    else:
        pool.submit(process_job, job_id)


def recover():
    with SessionLocal() as db:
        # Local queue cannot own another process's live jobs: one local server only.
        if settings.queue_mode == "local":
            for job in db.scalars(select(Job).where(Job.status == "running")):
                job.status, job.stage, job.error_code, job.finished_at = (
                    "failed",
                    "failed",
                    "WORKER_INTERRUPTED",
                    now(),
                )
            db.commit()
        queued = list(db.scalars(select(Job.id).where(Job.status == "queued")))
    for job_id in queued:
        dispatch(job_id)
