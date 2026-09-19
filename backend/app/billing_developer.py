"""Developer-only commerce administration and subscription review."""

from datetime import timedelta

from fastapi import APIRouter, Depends
from pydantic import ValidationError
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DBSession

from .billing_models import Clinic, PaymentMethod, Plan, SubscriptionRequest
from .billing_registration import create_clinic
from .billing_schemas import (
    ClinicCreate,
    ClinicPatch,
    PaymentCreate,
    PaymentPatch,
    PlanCreate,
    PlanPatch,
    Register,
    ReviewRequest,
    TeamCreate,
    TeamPatch,
)
from .billing_service import (
    SEAT_ROLES,
    account_json,
    clinic_json,
    lock_clinic,
    next_month,
    own_clinic,
    payment_json,
    plan_json,
    request_json,
    subscription,
    usage,
    user_json,
    utc,
)
from .billing_team import add_user, change_user
from .db import Session, User, get_db, now
from .security import ApiError, audit, current_user, require_role

router = APIRouter()


def page_query(db, query, page, page_size, serializer):
    page, page_size = max(1, page), min(100, max(1, page_size))
    total = db.scalar(select(func.count()).select_from(query.order_by(None).subquery()))
    return {
        "items": [
            serializer(item)
            for item in db.scalars(query.offset((page - 1) * page_size).limit(page_size))
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/developer/overview")
def developer_overview(user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    require_role(user, "developer")
    clinics = list(db.scalars(select(Clinic)))
    return {
        "clinics_total": len(clinics),
        "active_subscriptions": sum(subscription(c)["active"] for c in clinics),
        "pending_requests": db.scalar(
            select(func.count())
            .select_from(SubscriptionRequest)
            .where(SubscriptionRequest.status == "pending")
        ),
        "doctors_total": db.scalar(
            select(func.count())
            .select_from(User)
            .where(User.active.is_(True), User.role.in_(SEAT_ROLES))
        ),
        "approved_revenue_uzs": db.scalar(
            select(func.coalesce(func.sum(SubscriptionRequest.price_uzs), 0)).where(
                SubscriptionRequest.status == "approved", SubscriptionRequest.is_demo.is_(False)
            )
        ),
        "expiring_soon": sum(
            bool(c.expires_at and now() < utc(c.expires_at) <= now() + timedelta(days=7))
            for c in clinics
        ),
    }


@router.get("/developer/clinics")
def developer_clinics(
    q: str = "",
    page: int = 1,
    page_size: int = 20,
    user: User = Depends(current_user),
    db: DBSession = Depends(get_db),
):
    require_role(user, "developer")
    query = select(Clinic).order_by(Clinic.created_at.desc())
    if q:
        query = query.where(Clinic.name.ilike("%" + q[:100] + "%"))
    return page_query(
        db,
        query,
        page,
        page_size,
        lambda c: {**clinic_json(c), "subscription": subscription(c), "usage": usage(db, c.id)},
    )


@router.get("/developer/clinics/{clinic_id}")
def developer_clinic(
    clinic_id: str, user: User = Depends(current_user), db: DBSession = Depends(get_db)
):
    require_role(user, "developer")
    clinic = own_clinic(db, user, clinic_id)
    return account_json(db, user, clinic)


@router.post("/developer/clinics", status_code=201)
def developer_create_clinic(
    body: ClinicCreate, user: User = Depends(current_user), db: DBSession = Depends(get_db)
):
    require_role(user, "developer")
    try:
        registration = Register(
            clinic_name=body.name,
            name=body.owner_name,
            email=body.owner_email,
            password=body.owner_password,
            phone=body.phone,
            plan_id=body.plan_id,
        )
    except ValidationError:
        raise ApiError(422, "INVALID_CLINIC", "Check clinic owner details.")
    try:
        _, clinic = create_clinic(db, registration)
        audit(db, user, "clinic.created", clinic.id)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ApiError(409, "EMAIL_EXISTS", "This email already has an account.")
    return account_json(db, user, clinic)


@router.patch("/developer/clinics/{clinic_id}")
def developer_patch_clinic(
    clinic_id: str,
    body: ClinicPatch,
    user: User = Depends(current_user),
    db: DBSession = Depends(get_db),
):
    require_role(user, "developer")
    clinic = own_clinic(db, user, clinic_id)
    lock_clinic(db, clinic, body.expected_version)
    changes = body.model_dump(exclude_unset=True, exclude={"expected_version"})
    if any(value is None for value in changes.values()):
        raise ApiError(422, "INVALID_CLINIC_UPDATE", "Fields cannot be null.")
    for key, value in changes.items():
        setattr(clinic, key, value)
    if body.status == "suspended":
        db.execute(
            delete(Session).where(
                Session.user_id.in_(select(User.id).where(User.tenant_id == clinic.id))
            )
        )
    audit(db, user, "clinic.updated", clinic.id)
    db.commit()
    return {
        **clinic_json(clinic),
        "subscription": subscription(clinic),
        "usage": usage(db, clinic.id),
    }


@router.get("/developer/users")
def developer_users(
    q: str = "",
    tenant_id: str = "",
    page: int = 1,
    page_size: int = 20,
    user: User = Depends(current_user),
    db: DBSession = Depends(get_db),
):
    require_role(user, "developer")
    query = select(User).order_by(User.name)
    if tenant_id:
        query = query.where(User.tenant_id == tenant_id)
    if q:
        query = query.where(
            or_(User.name.ilike("%" + q[:100] + "%"), User.email.ilike("%" + q[:100] + "%"))
        )
    return page_query(db, query, page, page_size, lambda item: user_json(db, item))


@router.post("/developer/clinics/{clinic_id}/users", status_code=201)
def developer_create_user(
    clinic_id: str,
    body: TeamCreate,
    user: User = Depends(current_user),
    db: DBSession = Depends(get_db),
):
    require_role(user, "developer")
    return add_user(db, user, own_clinic(db, user, clinic_id), body)


@router.patch("/developer/users/{user_id}")
def developer_patch_user(
    user_id: str,
    body: TeamPatch,
    user: User = Depends(current_user),
    db: DBSession = Depends(get_db),
):
    require_role(user, "developer")
    target = db.get(User, user_id)
    if not target:
        raise ApiError(404, "USER_NOT_FOUND", "Account not available.")
    return change_user(db, user, target, own_clinic(db, user, target.tenant_id), body)


@router.get("/developer/subscription-requests")
def developer_requests(
    status: str = "",
    q: str = "",
    page: int = 1,
    page_size: int = 20,
    user: User = Depends(current_user),
    db: DBSession = Depends(get_db),
):
    require_role(user, "developer")
    query = select(SubscriptionRequest).order_by(SubscriptionRequest.created_at.desc())
    if status:
        if status not in {"pending", "approved", "rejected"}:
            raise ApiError(422, "INVALID_STATUS", "Unknown application status.")
        query = query.where(SubscriptionRequest.status == status)
    if q:
        query = query.join(Clinic).where(Clinic.name.ilike("%" + q[:100] + "%"))
    return page_query(db, query, page, page_size, lambda item: request_json(db, item))


@router.post("/developer/subscription-requests/{request_id}/review")
def review_request(
    request_id: str,
    body: ReviewRequest,
    user: User = Depends(current_user),
    db: DBSession = Depends(get_db),
):
    require_role(user, "developer")
    request = db.get(SubscriptionRequest, request_id)
    if not request:
        raise ApiError(404, "REQUEST_NOT_FOUND", "Payment application not available.")
    clinic = own_clinic(db, user, request.tenant_id)
    lock_clinic(db, clinic)
    changed = db.execute(
        update(SubscriptionRequest)
        .where(
            SubscriptionRequest.id == request.id,
            SubscriptionRequest.version == body.expected_version,
            SubscriptionRequest.status == "pending",
        )
        .values(status=body.decision, version=SubscriptionRequest.version + 1)
    )
    if changed.rowcount != 1:
        db.rollback()
        raise ApiError(
            409, "REQUEST_ALREADY_REVIEWED", "The application has already been reviewed or changed."
        )
    db.refresh(request)
    if body.decision == "approved":
        if clinic.status != "active":
            raise ApiError(
                409, "CLINIC_SUSPENDED", "Restore the clinic before approving a subscription."
            )
        if usage(db, clinic.id)["doctors"] > request.doctor_limit:
            raise ApiError(409, "PLAN_TOO_SMALL", "This clinic exceeds the selected doctor limit.")
        if (
            subscription(clinic)["active"]
            and not clinic.internal_demo
            and clinic.plan_id != request.plan_id
        ):
            raise ApiError(
                409,
                "ACTIVE_PLAN_CHANGE_REQUIRES_SUPPORT",
                "The clinic already has a different active plan. Contact support.",
            )
        renew = (
            subscription(clinic)["active"]
            and clinic.plan_id == request.plan_id
            and not clinic.internal_demo
        )
        start = utc(clinic.expires_at) if renew else now()
        expiry = next_month(start)
        clinic.starts_at = clinic.starts_at if renew else start
        clinic.expires_at = expiry
        clinic.plan_id, clinic.plan_name = request.plan_id, request.plan_name
        clinic.price_uzs, clinic.doctor_limit = request.price_uzs, request.doctor_limit
        clinic.internal_demo = False
        request.granted_starts_at, request.granted_expires_at = start, expiry
    request.review_note, request.reviewer_id, request.reviewed_at = body.note, user.id, now()
    audit(db, user, "subscription." + body.decision, request.id)
    db.commit()
    return {"request": request_json(db, request), "subscription": subscription(clinic)}


@router.get("/developer/plans")
def developer_plans(user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    require_role(user, "developer")
    items = [plan_json(p) for p in db.scalars(select(Plan).order_by(Plan.sort_order, Plan.id))]
    return {"items": items, "total": len(items)}


@router.post("/developer/plans", status_code=201)
def developer_create_plan(
    body: PlanCreate, user: User = Depends(current_user), db: DBSession = Depends(get_db)
):
    require_role(user, "developer")
    if db.get(Plan, body.id):
        raise ApiError(409, "PLAN_EXISTS", "Choose a unique plan ID.")
    plan = Plan(**body.model_dump())
    db.add(plan)
    audit(db, user, "plan.created", plan.id)
    db.commit()
    return plan_json(plan)


def update_versioned(db, model, record, expected, changes):
    result = db.execute(
        update(model)
        .where(model.id == record.id, model.version == expected)
        .values(**changes, version=model.version + 1)
    )
    if result.rowcount != 1:
        db.rollback()
        raise ApiError(409, "VERSION_CONFLICT", "The record changed. Refresh and try again.")
    db.refresh(record)


@router.patch("/developer/plans/{plan_id}")
def developer_patch_plan(
    plan_id: str,
    body: PlanPatch,
    user: User = Depends(current_user),
    db: DBSession = Depends(get_db),
):
    require_role(user, "developer")
    plan = db.get(Plan, plan_id)
    if not plan:
        raise ApiError(404, "PLAN_NOT_FOUND", "Plan not found.")
    changes = body.model_dump(exclude_unset=True, exclude={"expected_version"})
    try:
        validated = PlanCreate.model_validate(
            {k: v for k, v in {**plan_json(plan), **changes}.items() if k != "version"}
        )
    except ValidationError:
        raise ApiError(422, "INVALID_PLAN", "Check the plan price, seat limit and fields.")
    update_versioned(
        db, Plan, plan, body.expected_version, {k: getattr(validated, k) for k in changes}
    )
    audit(db, user, "plan.updated", plan.id)
    db.commit()
    return plan_json(plan)


@router.get("/developer/payment-methods")
def developer_methods(user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    require_role(user, "developer")
    items = [
        payment_json(p) for p in db.scalars(select(PaymentMethod).order_by(PaymentMethod.name))
    ]
    return {"items": items, "total": len(items)}


@router.post("/developer/payment-methods", status_code=201)
def developer_create_method(
    body: PaymentCreate, user: User = Depends(current_user), db: DBSession = Depends(get_db)
):
    require_role(user, "developer")
    method = PaymentMethod(**body.model_dump())
    db.add(method)
    db.flush()
    audit(db, user, "payment_method.created", method.id)
    db.commit()
    return payment_json(method)


@router.patch("/developer/payment-methods/{method_id}")
def developer_patch_method(
    method_id: str,
    body: PaymentPatch,
    user: User = Depends(current_user),
    db: DBSession = Depends(get_db),
):
    require_role(user, "developer")
    method = db.get(PaymentMethod, method_id)
    if not method:
        raise ApiError(404, "PAYMENT_METHOD_NOT_FOUND", "Payment method not found.")
    changes = body.model_dump(exclude_unset=True, exclude={"expected_version"})
    try:
        validated = PaymentCreate.model_validate(
            {
                k: v
                for k, v in {**payment_json(method), **changes}.items()
                if k not in {"id", "version"}
            }
        )
    except ValidationError:
        raise ApiError(422, "INVALID_PAYMENT_METHOD", "Check the payment method details.")
    update_versioned(
        db,
        PaymentMethod,
        method,
        body.expected_version,
        {k: getattr(validated, k) for k in changes},
    )
    audit(db, user, "payment_method.updated", method.id)
    db.commit()
    return payment_json(method)
