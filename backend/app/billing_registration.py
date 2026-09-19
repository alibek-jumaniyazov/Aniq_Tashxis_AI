"""Clinic registration and non-destructive commerce bootstrap."""

from sqlalchemy import select

from .billing_models import Clinic, PaymentMethod, Plan, UserProfile
from .billing_service import SUPPORT
from .config import settings
from .db import User, now, uid
from .routes import password_hasher
from .security import ApiError


def bootstrap(db):
    """Add commerce defaults without replacing any clinical records or edited plans."""
    defaults = [
        ("solo", "Doctor", "Bir shifokor uchun shaxsiy ish maydoni.", 150000, 1),
        ("clinic10", "Clinic 10", "10 shifokorgacha klinika jamoasi uchun.", 1390000, 10),
        ("clinic25", "Clinic 25", "25 shifokorgacha klinika jamoasi uchun.", 2390000, 25),
        ("custom", "Individual", "Katta klinikalar uchun individual shartlar.", None, None),
    ]
    for index, (ident, name, description, price, seats) in enumerate(defaults):
        if not db.get(Plan, ident):
            db.add(
                Plan(
                    id=ident,
                    name=name,
                    description=description,
                    price_uzs=price,
                    doctor_limit=seats,
                    is_custom=ident == "custom",
                    sort_order=index,
                )
            )
    if not db.scalar(select(PaymentMethod).limit(1)):
        db.add(
            PaymentMethod(
                name="Humo",
                card_number="9860 1866 1499 7226",
                recipient="Alibek Jumaniyazov",
                instructions="Tanlangan tarif summasini o‘tkazing va to‘lov chekini yuklang. Obuna tekshiruvdan keyin faollashadi.",
                is_demo=False,
            )
        )
    if settings.demo_mode:
        for tenant_id in ["avilab-demo", "other-demo"]:
            owner = db.scalar(
                select(User)
                .where(User.tenant_id == tenant_id, User.role == "doctor")
                .order_by(User.email)
            )
            if owner and not db.get(Clinic, tenant_id):
                db.add(
                    Clinic(
                        id=tenant_id,
                        owner_id=owner.id,
                        name="Avilab demo klinika"
                        if tenant_id == "avilab-demo"
                        else "Boshqa demo klinika",
                        internal_demo=True,
                        doctor_limit=25,
                        plan_name="Ichki namoyish",
                        starts_at=now(),
                    )
                )
        if not db.scalar(select(User).where(User.email == "developer@demo.aniq")):
            db.add(
                User(
                    tenant_id="avilab-platform",
                    email="developer@demo.aniq",
                    name="Avilab Developer",
                    role="developer",
                    password_hash=password_hasher.hash("AniqDemo!2026"),
                )
            )
    db.flush()
    for user in db.scalars(select(User)):
        if not db.get(UserProfile, user.id):
            db.add(UserProfile(user_id=user.id))
    db.commit()


def get_plan(db, plan_id):
    plan = db.get(Plan, plan_id)
    if not plan or not plan.active:
        raise ApiError(404, "PLAN_NOT_AVAILABLE", "This plan is not available.")
    if plan.is_custom:
        raise ApiError(
            422,
            "CUSTOM_PLAN_CONTACT",
            "Contact Avilab support for an individual plan.",
            {"support_telegram": SUPPORT},
        )
    return plan


def create_clinic(db, body):
    plan = get_plan(db, body.plan_id)
    if db.scalar(select(User.id).where(User.email == body.email.lower())):
        raise ApiError(
            409, "EMAIL_EXISTS", "This email already has an account. Sign in to continue."
        )
    tenant_id = uid()
    user = User(
        tenant_id=tenant_id,
        name=body.name,
        email=body.email.lower(),
        role="doctor" if plan.doctor_limit == 1 else "owner",
        password_hash=password_hasher.hash(body.password),
    )
    db.add(user)
    db.flush()
    clinic = Clinic(id=tenant_id, owner_id=user.id, name=body.clinic_name, phone=body.phone)
    db.add(clinic)
    db.add(UserProfile(user_id=user.id))
    db.flush()
    return user, clinic
