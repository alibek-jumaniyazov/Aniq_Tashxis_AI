import calendar
import io
import warnings
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image
from pypdf import PdfReader
from sqlalchemy import delete, select, update
from .billing_models import Clinic, SubscriptionRequest, UserProfile
from .config import settings
from .db import Session, User, now
from .security import ApiError

SEAT_ROLES = {'doctor', 'radiologist', 'expert'}
SUPPORT = 'https://t.me/avilab_uz_support'


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value and value.tzinfo is None else value


def iso(value):
    return utc(value).isoformat() if value else None


def next_month(value: datetime):
    month = value.month % 12 + 1
    year = value.year + (value.month == 12)
    return value.replace(year=year, month=month, day=min(value.day, calendar.monthrange(year, month)[1]))


def subscription(clinic):
    active = clinic.status == 'active' and (clinic.internal_demo or bool(clinic.expires_at and utc(clinic.expires_at) > now()))
    status = 'suspended' if clinic.status != 'active' else 'active' if active else 'expired' if clinic.expires_at else 'pending'
    return {'status': status, 'active': active, 'plan_id': clinic.plan_id, 'plan_name': clinic.plan_name,
            'doctor_limit': clinic.doctor_limit, 'price_uzs': clinic.price_uzs,
            'starts_at': iso(clinic.starts_at), 'expires_at': iso(clinic.expires_at), 'internal_demo': clinic.internal_demo}


def usage(db, tenant_id):
    users = list(db.scalars(select(User).where(User.tenant_id == tenant_id, User.active.is_(True))))
    return {'doctors': sum(u.role in SEAT_ROLES for u in users), 'team_members': len(users)}


def require_entitlement(db, user, path):
    allowed = ('/api/v1/auth/', '/api/v1/billing/', '/api/v1/developer/', '/api/v1/health/', '/api/v1/system/status', '/api/v1/status')
    if any(path.startswith(prefix) for prefix in allowed):
        return
    if user.role in {'developer', 'owner'}:
        raise ApiError(403, 'ROLE_REQUIRED', 'This account manages the organization; use a clinical account for patient records.')
    clinic = db.get(Clinic, user.tenant_id)
    # Existing installations remain operational until they are explicitly enrolled.
    if clinic and not subscription(clinic)['active']:
        raise ApiError(402, 'SUBSCRIPTION_REQUIRED', 'An active clinic subscription is required.', {'account_url': '/account', 'status': subscription(clinic)['status']})


def clinic_json(clinic):
    return {'id': clinic.id, 'name': clinic.name, 'owner_id': clinic.owner_id, 'phone': clinic.phone,
            'status': clinic.status, 'version': clinic.version, 'created_at': iso(clinic.created_at)}


def plan_json(plan):
    return {key: getattr(plan, key) for key in ['id', 'name', 'description', 'price_uzs', 'doctor_limit', 'period_months', 'active', 'is_custom', 'sort_order', 'version']}


def payment_json(method):
    return {key: getattr(method, key) for key in ['id', 'name', 'card_number', 'recipient', 'instructions', 'active', 'is_demo', 'version']}


def user_json(db, user):
    profile = db.get(UserProfile, user.id)
    clinic = db.get(Clinic, user.tenant_id)
    return {'id': user.id, 'tenant_id': user.tenant_id, 'email': user.email, 'name': user.name, 'role': user.role,
            'active': user.active, 'version': profile.version if profile else 1,
            'is_clinic_owner': bool(clinic and clinic.owner_id == user.id), 'clinic_name': clinic.name if clinic else ''}


def request_json(db, request):
    clinic = db.get(Clinic, request.tenant_id)
    return {**{key: getattr(request, key) for key in ['id', 'tenant_id', 'plan_id', 'plan_name', 'price_uzs', 'doctor_limit',
            'payment_method_id', 'payment_method_name', 'payment_recipient', 'payment_card_last4', 'payment_reference', 'is_demo', 'receipt_name', 'status', 'review_note', 'version']},
            'clinic_name': clinic.name if clinic else '', 'receipt_url': f'/api/v1/billing/requests/{request.id}/receipt',
            'created_at': iso(request.created_at), 'reviewed_at': iso(request.reviewed_at),
            'granted_starts_at': iso(request.granted_starts_at), 'granted_expires_at': iso(request.granted_expires_at)}


def account_json(db, user, clinic=None):
    clinic = clinic or db.get(Clinic, user.tenant_id)
    if not clinic:
        return {'managed': False, 'can_use_workspace': user.role not in {'owner', 'developer'}, 'is_clinic_owner': False,
                'clinic': None, 'subscription': None, 'usage': usage(db, user.tenant_id), 'requests': []}
    owner = clinic.owner_id == user.id or user.role == 'developer'
    requests = list(db.scalars(select(SubscriptionRequest).where(SubscriptionRequest.tenant_id == clinic.id).order_by(SubscriptionRequest.created_at.desc()))) if owner else []
    return {'managed': True, 'can_use_workspace': subscription(clinic)['active'] and user.role not in {'owner', 'developer'},
            'is_clinic_owner': clinic.owner_id == user.id, 'clinic': clinic_json(clinic), 'subscription': subscription(clinic),
            'usage': usage(db, clinic.id), 'requests': [request_json(db, item) for item in requests]}


def own_clinic(db, user, tenant_id=None):
    clinic = db.get(Clinic, tenant_id or user.tenant_id)
    if not clinic or (user.role != 'developer' and (clinic.id != user.tenant_id or clinic.owner_id != user.id)):
        raise ApiError(403, 'CLINIC_OWNER_REQUIRED', 'Only the clinic owner can manage billing and team accounts.')
    return clinic


def lock_clinic(db, clinic, expected_version=None):
    query = update(Clinic).where(Clinic.id == clinic.id)
    if expected_version is not None:
        query = query.where(Clinic.version == expected_version)
    result = db.execute(query.values(version=Clinic.version + 1))
    if result.rowcount != 1:
        db.rollback()
        raise ApiError(409, 'VERSION_CONFLICT', 'The record changed. Refresh and try again.')
    db.refresh(clinic)


def enforce_seat(db, clinic, additional=1):
    if not subscription(clinic)['active']:
        raise ApiError(402, 'SUBSCRIPTION_REQUIRED', 'Activate a subscription before adding clinical accounts.')
    if usage(db, clinic.id)['doctors'] + additional > clinic.doctor_limit:
        raise ApiError(409, 'DOCTOR_LIMIT_REACHED', 'The plan doctor limit has been reached.', {'doctor_limit': clinic.doctor_limit})


def revoke_sessions(db, user_id):
    db.execute(delete(Session).where(Session.user_id == user_id))


def receipt_path(relative):
    root = settings.storage_root.resolve()
    path = (root / relative).resolve()
    if not path.is_relative_to(root / 'billing'):
        raise ApiError(404, 'RECEIPT_NOT_FOUND', 'Receipt not available.')
    return path


def validate_receipt(content, filename, declared_mime):
    if not content or len(content) > 10 * 1024 * 1024:
        raise ApiError(413, 'RECEIPT_SIZE', 'Receipt must be between 1 byte and 10 MB.')
    suffix = Path(filename or '').suffix.lower()
    formats = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.pdf': 'application/pdf'}
    mime = formats.get(suffix)
    if not mime or declared_mime not in {mime, 'application/octet-stream'}:
        raise ApiError(422, 'RECEIPT_TYPE', 'Upload a PNG, JPEG or PDF receipt.')
    try:
        if suffix == '.pdf':
            if not content.startswith(b'%PDF-'):
                raise ValueError('Invalid PDF')
            reader = PdfReader(io.BytesIO(content), strict=True)
            if reader.is_encrypted or not 1 <= len(reader.pages) <= 10:
                raise ValueError('Receipt must contain 1-10 unencrypted pages')
            # Reject active content and attachments; receipts are passive documents.
            forbidden = {'/JavaScript', '/JS', '/OpenAction', '/AA', '/EmbeddedFiles', '/RichMedia', '/Launch', '/SubmitForm', '/XFA'}
            seen = set()
            def inspect(obj, depth=0):
                if depth > 40:
                    raise ValueError('PDF nesting too deep')
                obj = obj.get_object() if hasattr(obj, 'get_object') else obj
                key = id(obj)
                if key in seen:
                    return
                seen.add(key)
                if hasattr(obj, 'keys'):
                    if forbidden.intersection(str(k) for k in obj.keys()):
                        raise ValueError('Active PDF content')
                    for value in obj.values():
                        inspect(value, depth + 1)
                elif isinstance(obj, list):
                    for value in obj:
                        inspect(value, depth + 1)
            inspect(reader.trailer)
        else:
            with warnings.catch_warnings():
                warnings.simplefilter('error', Image.DecompressionBombWarning)
                image = Image.open(io.BytesIO(content))
                if image.format != ('PNG' if suffix == '.png' else 'JPEG') or image.width * image.height > 25000000:
                    raise ValueError('Receipt format or dimensions invalid')
                image.verify()
                image = Image.open(io.BytesIO(content))
                image.load()
    except Exception:
        raise ApiError(422, 'INVALID_RECEIPT', 'The receipt is damaged, unsafe, encrypted or too complex.')
    return mime, suffix
