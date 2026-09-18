import re
from typing import Literal
from pydantic import Field, field_validator, model_validator
from .schemas import StrictModel

TeamRole = Literal['doctor', 'radiologist', 'expert', 'quality', 'sender', 'admin', 'analyst']


class Register(StrictModel):
    clinic_name: str = Field(min_length=2, max_length=180)
    name: str = Field(min_length=2, max_length=180)
    email: str = Field(min_length=5, max_length=180)
    password: str = Field(min_length=10, max_length=200)
    phone: str = Field(min_length=7, max_length=30, pattern=r'^[+\d\s()-]+$')
    plan_id: str = Field(min_length=1, max_length=50)

    @field_validator('email')
    @classmethod
    def email_valid(cls, value):
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value):
            raise ValueError('Enter a valid email address.')
        return value.lower()


class TeamCreate(StrictModel):
    name: str = Field(min_length=2, max_length=180)
    email: str = Field(min_length=5, max_length=180)
    password: str = Field(min_length=10, max_length=200)
    role: TeamRole = 'doctor'
    _email_valid = field_validator('email')(Register.email_valid.__func__)


class TeamPatch(StrictModel):
    expected_version: int = Field(ge=1)
    name: str | None = Field(default=None, min_length=2, max_length=180)
    active: bool | None = None
    role: TeamRole | None = None
    password: str | None = Field(default=None, min_length=10, max_length=200)


class PlanCreate(StrictModel):
    id: str = Field(min_length=2, max_length=50, pattern=r'^[a-z0-9_-]+$')
    name: str = Field(min_length=2, max_length=100)
    description: str = Field(default='', max_length=2000)
    price_uzs: int | None = Field(default=None, ge=1, le=2000000000)
    doctor_limit: int | None = Field(default=None, ge=1, le=10000)
    period_months: Literal[1] = 1
    active: bool = True
    is_custom: bool = False
    sort_order: int = Field(default=0, ge=0, le=1000)

    @model_validator(mode='after')
    def valid_price(self):
        if not self.is_custom and (self.price_uzs is None or self.doctor_limit is None):
            raise ValueError('Fixed plans require a price and a doctor limit.')
        if self.is_custom and (self.price_uzs is not None or self.doctor_limit is not None):
            raise ValueError('Custom plans use an individual quote, without a fixed price or limit.')
        return self


class PlanPatch(StrictModel):
    expected_version: int = Field(ge=1)
    name: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    price_uzs: int | None = Field(default=None, ge=1, le=2000000000)
    doctor_limit: int | None = Field(default=None, ge=1, le=10000)
    active: bool | None = None
    is_custom: bool | None = None
    sort_order: int | None = Field(default=None, ge=0, le=1000)


class PaymentCreate(StrictModel):
    name: str = Field(min_length=2, max_length=100)
    card_number: str = Field(min_length=4, max_length=40)
    recipient: str = Field(min_length=2, max_length=150)
    instructions: str = Field(default='', max_length=2000)
    active: bool = True
    is_demo: bool = False

    @model_validator(mode='after')
    def valid_card(self):
        if not self.is_demo:
            digits = re.sub(r'\s', '', self.card_number)
            if not re.fullmatch(r'\d{16}', digits):
                raise ValueError('A payment card must contain 16 digits.')
            self.card_number = ' '.join(digits[i:i + 4] for i in range(0, 16, 4))
        return self


class PaymentPatch(StrictModel):
    expected_version: int = Field(ge=1)
    name: str | None = Field(default=None, min_length=2, max_length=100)
    card_number: str | None = Field(default=None, min_length=4, max_length=40)
    recipient: str | None = Field(default=None, min_length=2, max_length=150)
    instructions: str | None = Field(default=None, max_length=2000)
    active: bool | None = None
    is_demo: bool | None = None


class ReviewRequest(StrictModel):
    expected_version: int = Field(ge=1)
    decision: Literal['approved', 'rejected']
    note: str = Field(min_length=3, max_length=2000)


class ClinicPatch(StrictModel):
    expected_version: int = Field(ge=1)
    name: str | None = Field(default=None, min_length=2, max_length=180)
    phone: str | None = Field(default=None, min_length=7, max_length=30, pattern=r'^[+\d\s()-]+$')
    status: Literal['active', 'suspended'] | None = None


class ClinicCreate(StrictModel):
    name: str = Field(min_length=2, max_length=180)
    phone: str = Field(min_length=7, max_length=30, pattern=r'^[+\d\s()-]+$')
    owner_name: str = Field(min_length=2, max_length=180)
    owner_email: str = Field(min_length=5, max_length=180)
    owner_password: str = Field(min_length=10, max_length=200)
    plan_id: str = Field(min_length=1, max_length=50)
