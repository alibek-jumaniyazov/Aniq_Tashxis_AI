"""Public checkout, account access, and protected payment receipts."""

import hashlib
import secrets
from datetime import timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DBSession

from .billing_models import Clinic, PaymentMethod, Plan, SubscriptionRequest
from .billing_registration import create_clinic, get_plan
from .billing_schemas import Register
from .billing_service import (
    SUPPORT,
    account_json,
    lock_clinic,
    own_clinic,
    payment_json,
    plan_json,
    receipt_path,
    request_json,
    subscription,
    usage,
    user_json,
    validate_receipt,
)
from .config import settings
from .db import Session, User, get_db, now, uid
from .security import ApiError, audit, cached_idempotent, current_user, idem_key, idempotent

router = APIRouter()


@router.get("/billing/plans")
def public_plans(db: DBSession = Depends(get_db)):
    return {
        "items": [
            plan_json(p)
            for p in db.scalars(
                select(Plan).where(Plan.active.is_(True)).order_by(Plan.sort_order, Plan.id)
            )
        ],
        "support_telegram": SUPPORT,
        "demo_mode": settings.demo_mode,
    }


@router.get("/billing/payment-methods")
def public_methods(db: DBSession = Depends(get_db)):
    return {
        "items": [
            payment_json(p)
            for p in db.scalars(
                select(PaymentMethod)
                .where(PaymentMethod.active.is_(True))
                .order_by(PaymentMethod.name)
            )
        ]
    }


@router.post("/auth/register", status_code=201)
def register(body: Register, response: Response, db: DBSession = Depends(get_db)):
    try:
        user, clinic = create_clinic(db, body)
        token = secrets.token_urlsafe(32)
        session = Session(
            id=hashlib.sha256(token.encode()).hexdigest(),
            user_id=user.id,
            csrf=secrets.token_urlsafe(24),
            expires_at=now() + timedelta(hours=settings.session_hours),
        )
        db.add(session)
        audit(db, user, "clinic.registered", clinic.id)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ApiError(409, "EMAIL_EXISTS", "This email already has an account.")
    response.set_cookie(
        "aniq_session",
        token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
        max_age=settings.session_hours * 3600,
        path="/",
    )
    return {
        "user": {
            key: value
            for key, value in user_json(db, user).items()
            if key in {"id", "tenant_id", "email", "name", "role", "is_clinic_owner"}
        },
        "csrf_token": session.csrf,
    }


@router.get("/billing/account")
def account(user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    return account_json(db, user)


@router.post("/billing/requests", status_code=201)
async def submit_request(
    plan_id: str = Form(..., max_length=50),
    payment_method_id: str = Form(..., max_length=36),
    plan_version: int = Form(..., ge=1),
    payment_method_version: int = Form(..., ge=1),
    payment_reference: str = Form("", max_length=120),
    file: UploadFile = File(...),
    user: User = Depends(current_user),
    db: DBSession = Depends(get_db),
    key=Depends(idem_key),
):
    clinic = own_clinic(db, user)
    if clinic.status != "active":
        raise ApiError(403, "CLINIC_SUSPENDED", "Contact support to restore this clinic.")
    plan = get_plan(db, plan_id)
    method = db.get(PaymentMethod, payment_method_id)
    if not method or not method.active:
        raise ApiError(404, "PAYMENT_METHOD_NOT_AVAILABLE", "Select an available payment method.")
    if plan.version != plan_version:
        raise ApiError(
            409,
            "PRICE_CHANGED",
            "The plan changed. Refresh and review the current price before paying.",
        )
    if method.version != payment_method_version:
        raise ApiError(
            409,
            "PAYMENT_METHOD_CHANGED",
            "Payment details changed. Refresh and review them before paying.",
        )
    if subscription(clinic)["active"] and not clinic.internal_demo and clinic.plan_id != plan.id:
        raise ApiError(
            409,
            "ACTIVE_PLAN_CHANGE_REQUIRES_SUPPORT",
            "Contact support to change an active plan, or select a new plan after the current subscription expires.",
        )
    content = bytearray()
    while chunk := await file.read(1024 * 1024):
        content.extend(chunk)
        if len(content) > 10 * 1024 * 1024:
            raise ApiError(413, "RECEIPT_SIZE", "Receipt must not exceed 10 MB.")
    content = bytes(content)
    mime, suffix = validate_receipt(content, file.filename, file.content_type)
    digest = hashlib.sha256(content).hexdigest()
    payload = {
        "plan_id": plan.id,
        "payment_method_id": method.id,
        "plan_version": plan_version,
        "payment_method_version": payment_method_version,
        "sha256": digest,
        "payment_reference": payment_reference,
    }
    cached = cached_idempotent(db, user, "billing.request", key, payload)
    if cached:
        return cached
    saved = []

    def execute():
        lock_clinic(db, clinic)
        db.refresh(user)
        if not user.active:
            raise ApiError(401, "SESSION_EXPIRED", "Please sign in again.")
        if clinic.status != "active":
            raise ApiError(403, "CLINIC_SUSPENDED", "Contact support to restore this clinic.")
        db.refresh(plan)
        db.refresh(method)
        if not plan.active or plan.version != plan_version:
            raise ApiError(409, "PRICE_CHANGED", "The plan changed. Refresh and review it.")
        if not method.active or method.version != payment_method_version:
            raise ApiError(
                409, "PAYMENT_METHOD_CHANGED", "Payment details changed. Refresh and review them."
            )
        if db.scalar(
            select(SubscriptionRequest.id).where(
                SubscriptionRequest.tenant_id == clinic.id, SubscriptionRequest.status == "pending"
            )
        ):
            raise ApiError(
                409, "PENDING_REQUEST_EXISTS", "A payment application is already awaiting review."
            )
        if db.scalar(
            select(SubscriptionRequest.id).where(SubscriptionRequest.receipt_hash == digest)
        ):
            raise ApiError(
                409,
                "RECEIPT_ALREADY_SUBMITTED",
                "This receipt has already been submitted. Upload a receipt for a new payment.",
            )
        if usage(db, clinic.id)["doctors"] > plan.doctor_limit:
            raise ApiError(
                409,
                "PLAN_TOO_SMALL",
                "Deactivate excess clinical accounts before selecting this plan.",
            )
        ident = uid()
        relative = f"billing/{clinic.id}/{ident}{suffix}"
        path = receipt_path(relative)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        saved.append(path)
        request = SubscriptionRequest(
            id=ident,
            tenant_id=clinic.id,
            actor_id=user.id,
            plan_id=plan.id,
            plan_name=plan.name,
            price_uzs=plan.price_uzs,
            doctor_limit=plan.doctor_limit,
            payment_method_id=method.id,
            payment_method_name=method.name,
            payment_recipient=method.recipient,
            payment_card_last4="".join(c for c in method.card_number if c.isdigit())[-4:],
            payment_reference=payment_reference,
            is_demo=method.is_demo,
            receipt_name=Path(file.filename or ("receipt" + suffix)).name[:180],
            receipt_path=relative,
            receipt_mime=mime,
            receipt_hash=digest,
        )
        db.add(request)
        db.flush()
        audit(db, user, "subscription.requested", request.id)
        return request_json(db, request)

    try:
        return idempotent(db, user, "billing.request", key, payload, execute)
    except Exception:
        db.rollback()
        for path in saved:
            path.unlink(missing_ok=True)
        raise


@router.get("/billing/requests/{request_id}/receipt")
def receipt(request_id: str, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    request = db.get(SubscriptionRequest, request_id)
    clinic = db.get(Clinic, request.tenant_id) if request else None
    if not request or (
        user.role != "developer"
        and (user.tenant_id != request.tenant_id or not clinic or clinic.owner_id != user.id)
    ):
        raise ApiError(404, "RECEIPT_NOT_FOUND", "Receipt not available.")
    path = receipt_path(request.receipt_path)
    if not path.is_file():
        raise ApiError(404, "RECEIPT_NOT_FOUND", "Receipt file not available.")
    audit(db, user, "subscription.receipt_viewed", request.id)
    db.commit()
    return FileResponse(
        path,
        media_type=request.receipt_mime,
        filename=request.receipt_name,
        content_disposition_type="inline",
        headers={
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
        },
    )
