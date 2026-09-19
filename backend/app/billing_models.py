"""Commerce records are separate from clinical records and never expose patient data."""

from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from .db import Base, now, uid


class Plan(Base):
    __tablename__ = "billing_plans"
    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text, default="")
    price_uzs: Mapped[int | None] = mapped_column(Integer)
    doctor_limit: Mapped[int | None] = mapped_column(Integer)
    period_months: Mapped[int] = mapped_column(Integer, default=1)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_custom: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    version: Mapped[int] = mapped_column(Integer, default=1)


class PaymentMethod(Base):
    __tablename__ = "billing_payment_methods"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(100))
    card_number: Mapped[str] = mapped_column(String(40))
    recipient: Mapped[str] = mapped_column(String(150))
    instructions: Mapped[str] = mapped_column(Text, default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    version: Mapped[int] = mapped_column(Integer, default=1)


class Clinic(Base):
    __tablename__ = "billing_clinics"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True)
    name: Mapped[str] = mapped_column(String(180))
    phone: Mapped[str] = mapped_column(String(30), default="")
    status: Mapped[str] = mapped_column(String(20), default="active")
    plan_id: Mapped[str | None] = mapped_column(ForeignKey("billing_plans.id"))
    plan_name: Mapped[str] = mapped_column(String(100), default="")
    doctor_limit: Mapped[int] = mapped_column(Integer, default=0)
    price_uzs: Mapped[int] = mapped_column(Integer, default=0)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    internal_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class UserProfile(Base):
    __tablename__ = "billing_user_profiles"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    version: Mapped[int] = mapped_column(Integer, default=1)


class SubscriptionRequest(Base):
    __tablename__ = "billing_subscription_requests"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("billing_clinics.id"), index=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    plan_id: Mapped[str] = mapped_column(ForeignKey("billing_plans.id"))
    plan_name: Mapped[str] = mapped_column(String(100))
    price_uzs: Mapped[int] = mapped_column(Integer)
    doctor_limit: Mapped[int] = mapped_column(Integer)
    payment_method_id: Mapped[str] = mapped_column(ForeignKey("billing_payment_methods.id"))
    payment_method_name: Mapped[str] = mapped_column(String(100))
    payment_recipient: Mapped[str] = mapped_column(String(150))
    payment_card_last4: Mapped[str] = mapped_column(String(4))
    payment_reference: Mapped[str] = mapped_column(String(120), default="")
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    receipt_name: Mapped[str] = mapped_column(String(180))
    receipt_path: Mapped[str] = mapped_column(String(250))
    receipt_mime: Mapped[str] = mapped_column(String(50))
    receipt_hash: Mapped[str] = mapped_column(String(64), unique=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    review_note: Mapped[str] = mapped_column(Text, default="")
    reviewer_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    granted_starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    granted_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    version: Mapped[int] = mapped_column(Integer, default=1)
