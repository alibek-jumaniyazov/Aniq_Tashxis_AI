"""Manual transfer subscriptions: receipt submission never proves or moves money."""
import hashlib
import secrets
from datetime import timedelta
from pathlib import Path
from fastapi import APIRouter, Depends, File, Form, Response, UploadFile
from fastapi.responses import FileResponse
from pydantic import ValidationError
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DBSession
from .billing_models import Clinic, PaymentMethod, Plan, SubscriptionRequest, UserProfile
from .billing_schemas import ClinicCreate, ClinicPatch, PaymentCreate, PaymentPatch, PlanCreate, PlanPatch, Register, ReviewRequest, TeamCreate, TeamPatch
from .billing_service import SEAT_ROLES, SUPPORT, account_json, clinic_json, enforce_seat, lock_clinic, next_month, own_clinic, payment_json, plan_json, receipt_path, request_json, revoke_sessions, subscription, usage, user_json, utc, validate_receipt
from .config import settings
from .db import Session, User, get_db, now, uid
from .routes import password_hasher
from .security import ApiError, audit, cached_idempotent, current_user, idem_key, idempotent, require_role

router = APIRouter(prefix='/api/v1')


def bootstrap(db):
    """Add commerce defaults without replacing any clinical records or edited plans."""
    defaults = [
        ('solo', 'Doctor', 'Bir shifokor uchun shaxsiy ish maydoni.', 150000, 1),
        ('clinic10', 'Clinic 10', '10 shifokorgacha klinika jamoasi uchun.', 1390000, 10),
        ('clinic25', 'Clinic 25', '25 shifokorgacha klinika jamoasi uchun.', 2390000, 25),
        ('custom', 'Individual', 'Katta klinikalar uchun individual shartlar.', None, None),
    ]
    for index, (ident, name, description, price, seats) in enumerate(defaults):
        if not db.get(Plan, ident):
            db.add(Plan(id=ident, name=name, description=description, price_uzs=price, doctor_limit=seats, is_custom=ident == 'custom', sort_order=index))
    if not db.scalar(select(PaymentMethod).limit(1)):
        db.add(PaymentMethod(name='Humo', card_number='9860 1866 1499 7226', recipient='Alibek Jumaniyazov', instructions='Tanlangan tarif summasini o‘tkazing va to‘lov chekini yuklang. Obuna tekshiruvdan keyin faollashadi.', is_demo=False))
    if settings.demo_mode:
        for tenant_id in ['avilab-demo', 'other-demo']:
            owner = db.scalar(select(User).where(User.tenant_id == tenant_id, User.role == 'doctor').order_by(User.email))
            if owner and not db.get(Clinic, tenant_id):
                db.add(Clinic(id=tenant_id, owner_id=owner.id, name='Avilab demo klinika' if tenant_id == 'avilab-demo' else 'Boshqa demo klinika', internal_demo=True, doctor_limit=25, plan_name='Ichki namoyish', starts_at=now()))
        if not db.scalar(select(User).where(User.email == 'developer@demo.aniq')):
            db.add(User(tenant_id='avilab-platform', email='developer@demo.aniq', name='Avilab Developer', role='developer', password_hash=password_hasher.hash('AniqDemo!2026')))
    db.flush()
    for user in db.scalars(select(User)):
        if not db.get(UserProfile, user.id):
            db.add(UserProfile(user_id=user.id))
    db.commit()


def get_plan(db, plan_id):
    plan = db.get(Plan, plan_id)
    if not plan or not plan.active:
        raise ApiError(404, 'PLAN_NOT_AVAILABLE', 'This plan is not available.')
    if plan.is_custom:
        raise ApiError(422, 'CUSTOM_PLAN_CONTACT', 'Contact Avilab support for an individual plan.', {'support_telegram': SUPPORT})
    return plan


def create_clinic(db, body):
    plan = get_plan(db, body.plan_id)
    if db.scalar(select(User.id).where(User.email == body.email.lower())):
        raise ApiError(409, 'EMAIL_EXISTS', 'This email already has an account. Sign in to continue.')
    tenant_id = uid()
    user = User(tenant_id=tenant_id, name=body.name, email=body.email.lower(), role='doctor' if plan.doctor_limit == 1 else 'owner', password_hash=password_hasher.hash(body.password))
    db.add(user)
    db.flush()
    clinic = Clinic(id=tenant_id, owner_id=user.id, name=body.clinic_name, phone=body.phone)
    db.add(clinic)
    db.add(UserProfile(user_id=user.id))
    db.flush()
    return user, clinic


@router.get('/billing/plans')
def public_plans(db: DBSession = Depends(get_db)):
    return {'items': [plan_json(p) for p in db.scalars(select(Plan).where(Plan.active.is_(True)).order_by(Plan.sort_order, Plan.id))], 'support_telegram': SUPPORT, 'demo_mode': settings.demo_mode}


@router.get('/billing/payment-methods')
def public_methods(db: DBSession = Depends(get_db)):
    return {'items': [payment_json(p) for p in db.scalars(select(PaymentMethod).where(PaymentMethod.active.is_(True)).order_by(PaymentMethod.name))]}


@router.post('/auth/register', status_code=201)
def register(body: Register, response: Response, db: DBSession = Depends(get_db)):
    try:
        user, clinic = create_clinic(db, body)
        token = secrets.token_urlsafe(32)
        session = Session(id=hashlib.sha256(token.encode()).hexdigest(), user_id=user.id, csrf=secrets.token_urlsafe(24), expires_at=now() + timedelta(hours=settings.session_hours))
        db.add(session)
        audit(db, user, 'clinic.registered', clinic.id)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ApiError(409, 'EMAIL_EXISTS', 'This email already has an account.')
    response.set_cookie('aniq_session', token, httponly=True, secure=settings.cookie_secure, samesite='strict', max_age=settings.session_hours * 3600, path='/')
    return {'user': {key: value for key, value in user_json(db, user).items() if key in {'id', 'tenant_id', 'email', 'name', 'role', 'is_clinic_owner'}}, 'csrf_token': session.csrf}


@router.get('/billing/account')
def account(user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    return account_json(db, user)


@router.post('/billing/requests', status_code=201)
async def submit_request(plan_id: str = Form(..., max_length=50), payment_method_id: str = Form(..., max_length=36), plan_version: int = Form(..., ge=1), payment_method_version: int = Form(..., ge=1), payment_reference: str = Form('', max_length=120), file: UploadFile = File(...), user: User = Depends(current_user), db: DBSession = Depends(get_db), key=Depends(idem_key)):
    clinic = own_clinic(db, user)
    if clinic.status != 'active':
        raise ApiError(403, 'CLINIC_SUSPENDED', 'Contact support to restore this clinic.')
    plan = get_plan(db, plan_id)
    method = db.get(PaymentMethod, payment_method_id)
    if not method or not method.active:
        raise ApiError(404, 'PAYMENT_METHOD_NOT_AVAILABLE', 'Select an available payment method.')
    if plan.version != plan_version:
        raise ApiError(409, 'PRICE_CHANGED', 'The plan changed. Refresh and review the current price before paying.')
    if method.version != payment_method_version:
        raise ApiError(409, 'PAYMENT_METHOD_CHANGED', 'Payment details changed. Refresh and review them before paying.')
    if subscription(clinic)['active'] and not clinic.internal_demo and clinic.plan_id != plan.id:
        raise ApiError(409, 'ACTIVE_PLAN_CHANGE_REQUIRES_SUPPORT', 'Contact support to change an active plan, or select a new plan after the current subscription expires.')
    content = bytearray()
    while chunk := await file.read(1024 * 1024):
        content.extend(chunk)
        if len(content) > 10 * 1024 * 1024:
            raise ApiError(413, 'RECEIPT_SIZE', 'Receipt must not exceed 10 MB.')
    content = bytes(content)
    mime, suffix = validate_receipt(content, file.filename, file.content_type)
    digest = hashlib.sha256(content).hexdigest()
    payload = {'plan_id': plan.id, 'payment_method_id': method.id, 'plan_version': plan_version, 'payment_method_version': payment_method_version, 'sha256': digest, 'payment_reference': payment_reference}
    cached = cached_idempotent(db, user, 'billing.request', key, payload)
    if cached:
        return cached
    saved = []
    def execute():
        lock_clinic(db, clinic)
        db.refresh(user)
        if not user.active:
            raise ApiError(401, 'SESSION_EXPIRED', 'Please sign in again.')
        if clinic.status != 'active':
            raise ApiError(403, 'CLINIC_SUSPENDED', 'Contact support to restore this clinic.')
        db.refresh(plan)
        db.refresh(method)
        if not plan.active or plan.version != plan_version:
            raise ApiError(409, 'PRICE_CHANGED', 'The plan changed. Refresh and review it.')
        if not method.active or method.version != payment_method_version:
            raise ApiError(409, 'PAYMENT_METHOD_CHANGED', 'Payment details changed. Refresh and review them.')
        if db.scalar(select(SubscriptionRequest.id).where(SubscriptionRequest.tenant_id == clinic.id, SubscriptionRequest.status == 'pending')):
            raise ApiError(409, 'PENDING_REQUEST_EXISTS', 'A payment application is already awaiting review.')
        if db.scalar(select(SubscriptionRequest.id).where(SubscriptionRequest.receipt_hash == digest)):
            raise ApiError(409, 'RECEIPT_ALREADY_SUBMITTED', 'This receipt has already been submitted. Upload a receipt for a new payment.')
        if usage(db, clinic.id)['doctors'] > plan.doctor_limit:
            raise ApiError(409, 'PLAN_TOO_SMALL', 'Deactivate excess clinical accounts before selecting this plan.')
        ident = uid()
        relative = f'billing/{clinic.id}/{ident}{suffix}'
        path = receipt_path(relative)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        saved.append(path)
        request = SubscriptionRequest(id=ident, tenant_id=clinic.id, actor_id=user.id, plan_id=plan.id, plan_name=plan.name, price_uzs=plan.price_uzs,
            doctor_limit=plan.doctor_limit, payment_method_id=method.id, payment_method_name=method.name, payment_recipient=method.recipient, payment_card_last4=''.join(c for c in method.card_number if c.isdigit())[-4:], payment_reference=payment_reference,
            is_demo=method.is_demo, receipt_name=Path(file.filename or ('receipt' + suffix)).name[:180], receipt_path=relative, receipt_mime=mime, receipt_hash=digest)
        db.add(request)
        db.flush()
        audit(db, user, 'subscription.requested', request.id)
        return request_json(db, request)
    try:
        return idempotent(db, user, 'billing.request', key, payload, execute)
    except Exception:
        db.rollback()
        for path in saved:
            path.unlink(missing_ok=True)
        raise


@router.get('/billing/requests/{request_id}/receipt')
def receipt(request_id: str, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    request = db.get(SubscriptionRequest, request_id)
    clinic = db.get(Clinic, request.tenant_id) if request else None
    if not request or (user.role != 'developer' and (user.tenant_id != request.tenant_id or not clinic or clinic.owner_id != user.id)):
        raise ApiError(404, 'RECEIPT_NOT_FOUND', 'Receipt not available.')
    path = receipt_path(request.receipt_path)
    if not path.is_file():
        raise ApiError(404, 'RECEIPT_NOT_FOUND', 'Receipt file not available.')
    audit(db, user, 'subscription.receipt_viewed', request.id)
    db.commit()
    return FileResponse(path, media_type=request.receipt_mime, filename=request.receipt_name, content_disposition_type='inline', headers={'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox"})


def team_json(db, clinic):
    return {'items': [user_json(db, u) for u in db.scalars(select(User).where(User.tenant_id == clinic.id).order_by(User.name))], 'doctor_limit': clinic.doctor_limit, 'doctors_used': usage(db, clinic.id)['doctors']}


@router.get('/billing/team')
def team(user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    clinic = db.get(Clinic, user.tenant_id)
    if not clinic:
        return {'items': [], 'doctor_limit': 0, 'doctors_used': 0}
    return team_json(db, clinic)


def add_user(db, actor, clinic, body):
    lock_clinic(db, clinic)
    if db.scalar(select(User.id).where(User.email == body.email)):
        raise ApiError(409, 'EMAIL_EXISTS', 'This email already has an account.')
    if not subscription(clinic)['active']:
        raise ApiError(402, 'SUBSCRIPTION_REQUIRED', 'Activate a subscription before adding team accounts.')
    if body.role in SEAT_ROLES:
        enforce_seat(db, clinic)
    if usage(db, clinic.id)['team_members'] >= max(10, clinic.doctor_limit * 4 + 1):
        raise ApiError(409, 'TEAM_LIMIT_REACHED', 'Contact support to expand this team.')
    new_user = User(tenant_id=clinic.id, email=body.email, name=body.name, role=body.role, password_hash=password_hasher.hash(body.password))
    try:
        db.add(new_user)
        db.flush()
        db.add(UserProfile(user_id=new_user.id))
        audit(db, actor, 'team.user_created', new_user.id)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ApiError(409, 'EMAIL_EXISTS', 'This email already has an account.')
    return user_json(db, new_user)


@router.post('/billing/team', status_code=201)
def create_team_user(body: TeamCreate, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    return add_user(db, user, own_clinic(db, user), body)


def change_user(db, actor, target, clinic, body):
    if target.role == 'developer' or target.id == clinic.owner_id:
        raise ApiError(403, 'PROTECTED_ACCOUNT', 'Clinic owners and developer accounts cannot be changed through team management.')
    lock_clinic(db, clinic)
    profile = db.get(UserProfile, target.id)
    if not profile:
        profile = UserProfile(user_id=target.id, version=1)
        db.add(profile)
        db.flush()
    result = db.execute(update(UserProfile).where(UserProfile.user_id == target.id, UserProfile.version == body.expected_version).values(version=UserProfile.version + 1))
    if result.rowcount != 1:
        db.rollback()
        raise ApiError(409, 'VERSION_CONFLICT', 'The team account changed. Refresh and retry.')
    changes = body.model_dump(exclude_unset=True, exclude={'expected_version'})
    if any(value is None for value in changes.values()):
        raise ApiError(422, 'INVALID_USER_UPDATE', 'Fields cannot be null.')
    next_role, next_active = changes.get('role', target.role), changes.get('active', target.active)
    if next_active and next_role in SEAT_ROLES and not (target.active and target.role in SEAT_ROLES):
        enforce_seat(db, clinic)
    if 'password' in changes:
        target.password_hash = password_hasher.hash(changes.pop('password'))
        revoke_sessions(db, target.id)
    if changes.get('active') is False or ('role' in changes and changes['role'] != target.role):
        revoke_sessions(db, target.id)
    for key, value in changes.items():
        setattr(target, key, value)
    audit(db, actor, 'team.user_updated', target.id)
    db.commit()
    return user_json(db, target)


@router.patch('/billing/team/{user_id}')
def patch_team_user(user_id: str, body: TeamPatch, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    clinic = own_clinic(db, user)
    target = db.get(User, user_id)
    if not target or target.tenant_id != clinic.id:
        raise ApiError(404, 'USER_NOT_FOUND', 'Team account not available.')
    return change_user(db, user, target, clinic, body)


def page_query(db, query, page, page_size, serializer):
    page, page_size = max(1, page), min(100, max(1, page_size))
    total = db.scalar(select(func.count()).select_from(query.order_by(None).subquery()))
    return {'items': [serializer(item) for item in db.scalars(query.offset((page - 1) * page_size).limit(page_size))], 'total': total, 'page': page, 'page_size': page_size}


@router.get('/developer/overview')
def developer_overview(user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    require_role(user, 'developer')
    clinics = list(db.scalars(select(Clinic)))
    return {'clinics_total': len(clinics), 'active_subscriptions': sum(subscription(c)['active'] for c in clinics),
            'pending_requests': db.scalar(select(func.count()).select_from(SubscriptionRequest).where(SubscriptionRequest.status == 'pending')),
            'doctors_total': db.scalar(select(func.count()).select_from(User).where(User.active.is_(True), User.role.in_(SEAT_ROLES))),
            'approved_revenue_uzs': db.scalar(select(func.coalesce(func.sum(SubscriptionRequest.price_uzs), 0)).where(SubscriptionRequest.status == 'approved', SubscriptionRequest.is_demo.is_(False))),
            'expiring_soon': sum(bool(c.expires_at and now() < utc(c.expires_at) <= now() + timedelta(days=7)) for c in clinics)}


@router.get('/developer/clinics')
def developer_clinics(q: str = '', page: int = 1, page_size: int = 20, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    require_role(user, 'developer')
    query = select(Clinic).order_by(Clinic.created_at.desc())
    if q:
        query = query.where(Clinic.name.ilike('%' + q[:100] + '%'))
    return page_query(db, query, page, page_size, lambda c: {**clinic_json(c), 'subscription': subscription(c), 'usage': usage(db, c.id)})


@router.get('/developer/clinics/{clinic_id}')
def developer_clinic(clinic_id: str, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    require_role(user, 'developer')
    clinic = own_clinic(db, user, clinic_id)
    return account_json(db, user, clinic)


@router.post('/developer/clinics', status_code=201)
def developer_create_clinic(body: ClinicCreate, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    require_role(user, 'developer')
    try:
        registration = Register(clinic_name=body.name, name=body.owner_name, email=body.owner_email, password=body.owner_password, phone=body.phone, plan_id=body.plan_id)
    except ValidationError:
        raise ApiError(422, 'INVALID_CLINIC', 'Check clinic owner details.')
    try:
        _, clinic = create_clinic(db, registration)
        audit(db, user, 'clinic.created', clinic.id)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ApiError(409, 'EMAIL_EXISTS', 'This email already has an account.')
    return account_json(db, user, clinic)


@router.patch('/developer/clinics/{clinic_id}')
def developer_patch_clinic(clinic_id: str, body: ClinicPatch, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    require_role(user, 'developer')
    clinic = own_clinic(db, user, clinic_id)
    lock_clinic(db, clinic, body.expected_version)
    changes = body.model_dump(exclude_unset=True, exclude={'expected_version'})
    if any(value is None for value in changes.values()):
        raise ApiError(422, 'INVALID_CLINIC_UPDATE', 'Fields cannot be null.')
    for key, value in changes.items():
        setattr(clinic, key, value)
    if body.status == 'suspended':
        db.execute(delete(Session).where(Session.user_id.in_(select(User.id).where(User.tenant_id == clinic.id))))
    audit(db, user, 'clinic.updated', clinic.id)
    db.commit()
    return {**clinic_json(clinic), 'subscription': subscription(clinic), 'usage': usage(db, clinic.id)}


@router.get('/developer/users')
def developer_users(q: str = '', tenant_id: str = '', page: int = 1, page_size: int = 20, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    require_role(user, 'developer')
    query = select(User).order_by(User.name)
    if tenant_id:
        query = query.where(User.tenant_id == tenant_id)
    if q:
        query = query.where(or_(User.name.ilike('%' + q[:100] + '%'), User.email.ilike('%' + q[:100] + '%')))
    return page_query(db, query, page, page_size, lambda item: user_json(db, item))


@router.post('/developer/clinics/{clinic_id}/users', status_code=201)
def developer_create_user(clinic_id: str, body: TeamCreate, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    require_role(user, 'developer')
    return add_user(db, user, own_clinic(db, user, clinic_id), body)


@router.patch('/developer/users/{user_id}')
def developer_patch_user(user_id: str, body: TeamPatch, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    require_role(user, 'developer')
    target = db.get(User, user_id)
    if not target:
        raise ApiError(404, 'USER_NOT_FOUND', 'Account not available.')
    return change_user(db, user, target, own_clinic(db, user, target.tenant_id), body)


@router.get('/developer/subscription-requests')
def developer_requests(status: str = '', q: str = '', page: int = 1, page_size: int = 20, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    require_role(user, 'developer')
    query = select(SubscriptionRequest).order_by(SubscriptionRequest.created_at.desc())
    if status:
        if status not in {'pending', 'approved', 'rejected'}:
            raise ApiError(422, 'INVALID_STATUS', 'Unknown application status.')
        query = query.where(SubscriptionRequest.status == status)
    if q:
        query = query.join(Clinic).where(Clinic.name.ilike('%' + q[:100] + '%'))
    return page_query(db, query, page, page_size, lambda item: request_json(db, item))


@router.post('/developer/subscription-requests/{request_id}/review')
def review_request(request_id: str, body: ReviewRequest, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    require_role(user, 'developer')
    request = db.get(SubscriptionRequest, request_id)
    if not request:
        raise ApiError(404, 'REQUEST_NOT_FOUND', 'Payment application not available.')
    clinic = own_clinic(db, user, request.tenant_id)
    lock_clinic(db, clinic)
    changed = db.execute(update(SubscriptionRequest).where(SubscriptionRequest.id == request.id, SubscriptionRequest.version == body.expected_version, SubscriptionRequest.status == 'pending').values(status=body.decision, version=SubscriptionRequest.version + 1))
    if changed.rowcount != 1:
        db.rollback()
        raise ApiError(409, 'REQUEST_ALREADY_REVIEWED', 'The application has already been reviewed or changed.')
    db.refresh(request)
    if body.decision == 'approved':
        if clinic.status != 'active':
            raise ApiError(409, 'CLINIC_SUSPENDED', 'Restore the clinic before approving a subscription.')
        if usage(db, clinic.id)['doctors'] > request.doctor_limit:
            raise ApiError(409, 'PLAN_TOO_SMALL', 'This clinic exceeds the selected doctor limit.')
        if subscription(clinic)['active'] and not clinic.internal_demo and clinic.plan_id != request.plan_id:
            raise ApiError(409, 'ACTIVE_PLAN_CHANGE_REQUIRES_SUPPORT', 'The clinic already has a different active plan. Contact support.')
        renew = subscription(clinic)['active'] and clinic.plan_id == request.plan_id and not clinic.internal_demo
        start = utc(clinic.expires_at) if renew else now()
        expiry = next_month(start)
        clinic.starts_at = clinic.starts_at if renew else start
        clinic.expires_at = expiry
        clinic.plan_id, clinic.plan_name = request.plan_id, request.plan_name
        clinic.price_uzs, clinic.doctor_limit = request.price_uzs, request.doctor_limit
        clinic.internal_demo = False
        request.granted_starts_at, request.granted_expires_at = start, expiry
    request.review_note, request.reviewer_id, request.reviewed_at = body.note, user.id, now()
    audit(db, user, 'subscription.' + body.decision, request.id)
    db.commit()
    return {'request': request_json(db, request), 'subscription': subscription(clinic)}


@router.get('/developer/plans')
def developer_plans(user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    require_role(user, 'developer')
    items = [plan_json(p) for p in db.scalars(select(Plan).order_by(Plan.sort_order, Plan.id))]
    return {'items': items, 'total': len(items)}


@router.post('/developer/plans', status_code=201)
def developer_create_plan(body: PlanCreate, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    require_role(user, 'developer')
    if db.get(Plan, body.id):
        raise ApiError(409, 'PLAN_EXISTS', 'Choose a unique plan ID.')
    plan = Plan(**body.model_dump())
    db.add(plan)
    audit(db, user, 'plan.created', plan.id)
    db.commit()
    return plan_json(plan)


def update_versioned(db, model, record, expected, changes):
    result = db.execute(update(model).where(model.id == record.id, model.version == expected).values(**changes, version=model.version + 1))
    if result.rowcount != 1:
        db.rollback()
        raise ApiError(409, 'VERSION_CONFLICT', 'The record changed. Refresh and try again.')
    db.refresh(record)


@router.patch('/developer/plans/{plan_id}')
def developer_patch_plan(plan_id: str, body: PlanPatch, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    require_role(user, 'developer')
    plan = db.get(Plan, plan_id)
    if not plan:
        raise ApiError(404, 'PLAN_NOT_FOUND', 'Plan not found.')
    changes = body.model_dump(exclude_unset=True, exclude={'expected_version'})
    try:
        validated = PlanCreate.model_validate({k: v for k, v in {**plan_json(plan), **changes}.items() if k != 'version'})
    except ValidationError:
        raise ApiError(422, 'INVALID_PLAN', 'Check the plan price, seat limit and fields.')
    update_versioned(db, Plan, plan, body.expected_version, {k: getattr(validated, k) for k in changes})
    audit(db, user, 'plan.updated', plan.id)
    db.commit()
    return plan_json(plan)


@router.get('/developer/payment-methods')
def developer_methods(user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    require_role(user, 'developer')
    items = [payment_json(p) for p in db.scalars(select(PaymentMethod).order_by(PaymentMethod.name))]
    return {'items': items, 'total': len(items)}


@router.post('/developer/payment-methods', status_code=201)
def developer_create_method(body: PaymentCreate, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    require_role(user, 'developer')
    method = PaymentMethod(**body.model_dump())
    db.add(method)
    db.flush()
    audit(db, user, 'payment_method.created', method.id)
    db.commit()
    return payment_json(method)


@router.patch('/developer/payment-methods/{method_id}')
def developer_patch_method(method_id: str, body: PaymentPatch, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    require_role(user, 'developer')
    method = db.get(PaymentMethod, method_id)
    if not method:
        raise ApiError(404, 'PAYMENT_METHOD_NOT_FOUND', 'Payment method not found.')
    changes = body.model_dump(exclude_unset=True, exclude={'expected_version'})
    try:
        validated = PaymentCreate.model_validate({k: v for k, v in {**payment_json(method), **changes}.items() if k not in {'id', 'version'}})
    except ValidationError:
        raise ApiError(422, 'INVALID_PAYMENT_METHOD', 'Check the payment method details.')
    update_versioned(db, PaymentMethod, method, body.expected_version, {k: getattr(validated, k) for k in changes})
    audit(db, user, 'payment_method.updated', method.id)
    db.commit()
    return payment_json(method)
