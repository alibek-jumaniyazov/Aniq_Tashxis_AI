from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class Login(StrictModel):
    email: str = Field(min_length=3, max_length=180)
    password: str = Field(min_length=1, max_length=200)


class UserResponse(StrictModel):
    id: str
    name: str
    email: str
    role: Literal['doctor', 'radiologist', 'expert', 'quality', 'sender', 'admin', 'analyst']
    tenant_id: str


class AuthResponse(StrictModel):
    user: UserResponse
    csrf_token: str


class CaseCreate(StrictModel):
    alias: str = Field(min_length=2, max_length=100)
    age: int | None = Field(default=None, ge=18, le=120)
    sex: Literal['female', 'male', 'unknown'] = 'unknown'
    summary: str = Field(default='', max_length=6000)
    diagnosis: str = Field(default='', max_length=2000)


class FactInput(StrictModel):
    key: str = Field(min_length=1, max_length=100, pattern=r'^[a-z][a-z0-9_.]*$')
    label: str = Field(min_length=1, max_length=200)
    value: str | float | None = None
    unit: str | None = Field(default=None, max_length=40)
    assertion: Literal['present', 'absent', 'unknown', 'not_documented'] = 'present'
    provenance: Literal['manual', 'patient_reported', 'paper', 'document', 'dmed_demo'] = 'manual'
    event_time: datetime | None = None
    available_time: datetime | None = None
    source_id: str | None = None
    span: str | None = Field(default=None, max_length=1000)
    confirmed: bool = False
    order_status: Literal['active', 'cancelled', 'not_applicable'] = 'not_applicable'

    @field_validator('event_time', 'available_time')
    @classmethod
    def timezone_required(cls, value):
        if value is not None and value.tzinfo is None:
            raise ValueError('Timezone is required; use an explicit UTC offset.')
        return value

    @field_validator('value')
    @classmethod
    def limit_value(cls, value):
        if isinstance(value, str) and len(value) > 6000:
            raise ValueError('Value too long')
        return value


class FactsPatch(StrictModel):
    expected_version: int = Field(ge=1)
    facts: list[FactInput] = Field(min_length=1, max_length=100)
    supersedes: list[str] = Field(default_factory=list, max_length=100)


class ConfirmFacts(StrictModel):
    expected_version: int = Field(ge=1)
    fact_ids: list[str] = Field(min_length=1, max_length=100)


class NoteCreate(StrictModel):
    expected_version: int = Field(ge=1)
    text: str = Field(min_length=3, max_length=6000)
    note_type: Literal['history', 'decision_rationale', 'alert_response'] = 'history'
    provenance: Literal['manual', 'patient_reported', 'paper'] = 'manual'
    event_time: datetime | None = None

    @field_validator('event_time')
    @classmethod
    def tz(cls, value):
        return FactInput.timezone_required(value)


class AnalysisCreate(StrictModel):
    expected_version: int = Field(ge=1)
    mode: Literal['current', 'decision_time'] = 'current'
    decision_time: datetime | None = None
    include_ai: bool = True
    review_focus: Literal['documentation', 'clinical_assessment'] = 'documentation'

    @field_validator('decision_time')
    @classmethod
    def tz(cls, value):
        return FactInput.timezone_required(value)


class NoteDraft(StrictModel):
    text: str = Field(default='', max_length=6000)
    note_type: Literal['history', 'decision_rationale', 'alert_response'] = 'history'
    provenance: Literal['manual', 'patient_reported', 'paper'] = 'manual'
    event_time: str = Field(default='', max_length=30)


class ReviewCreate(StrictModel):
    status: Literal['seen', 'accepted', 'rejected', 'information_requested', 'closed']
    comment: str = Field(default='', max_length=3000)


class ImportCreate(StrictModel):
    expected_version: int = Field(ge=1)
    connection_id: str
    scenario: Literal['success', 'denied', 'disconnected', 'updated', 'identity_mismatch'] = 'success'
    external_id: str = 'DEMO-001'


class ForecastCreate(StrictModel):
    expected_version: int = Field(ge=1)
    outcome_id: str = 'cardiovascular_event'
    horizon_years: int = Field(ge=1, le=10)


class IncidentCreate(StrictModel):
    case_id: str
    reason: str = Field(min_length=3, max_length=2000)


class IncidentDecision(StrictModel):
    status: Literal['awaiting_explanation', 'confirmed', 'not_confirmed', 'insufficient_information', 'corrective_actions', 'closed']
    explanation: str = Field(min_length=5, max_length=4000)
    expected_version: int = Field(ge=1)


class ExportCreate(StrictModel):
    incident_ids: list[str] = Field(min_length=1, max_length=100)
    purpose: str = Field(min_length=3, max_length=500)
    basis: str = Field(min_length=3, max_length=500)
    recipient: Literal['mock-ministry'] = 'mock-ministry'


class VersionBody(StrictModel):
    expected_version: int = Field(ge=1)


class CaseUpdate(CaseCreate):
    expected_version: int = Field(ge=1)


class ClinicalConclusion(StrictModel):
    expected_version: int = Field(ge=1)
    diagnosis: str = Field(min_length=3, max_length=2000)
    status: Literal['provisional', 'confirmed']
    rationale: str = Field(min_length=5, max_length=4000)
    fact_ids: list[str] = Field(min_length=1, max_length=100)
    run_id: str | None = None
    clinician_confirmed: Literal[True]


class ImagingReview(StrictModel):
    status: Literal['confirmed', 'rejected', 'clarified']
    comment: str = Field(min_length=3, max_length=3000)


class AIConcern(StrictModel):
    title: str = Field(max_length=250)
    explanation: str = Field(max_length=2000)
    source_ids: list[str] = Field(min_length=1, max_length=12)
    knowledge_id: str
    missing_fields: list[str] = Field(default_factory=list)


class AIResult(StrictModel):
    case_version: int
    summary: str = Field(max_length=3000)
    concerns: list[AIConcern] = Field(default_factory=list, max_length=12)
    limitations: list[str] = Field(default_factory=list, max_length=20)
    missing_fields: list[str] = Field(default_factory=list, max_length=30)


class ExtractedFact(StrictModel):
    key: Literal['symptom.complaint', 'vital.spo2', 'vital.pulse', 'vital.systolic_pressure', 'allergy.substance', 'medication.substance', 'lab.potassium', 'lab.total_cholesterol', 'imaging.side', 'smoking.status']
    label: str = Field(min_length=1, max_length=200)
    value: str = Field(min_length=1, max_length=500)
    unit: str | None = Field(default=None, max_length=40)
    assertion: Literal['present', 'absent', 'unknown', 'not_documented']
    page: int = Field(ge=1)
    quote: str = Field(min_length=1, max_length=1000)


class DocumentExtraction(StrictModel):
    facts: list[ExtractedFact] = Field(max_length=40)


class DiagnosticHypothesis(StrictModel):
    label: str = Field(min_length=3, max_length=180)
    supporting_refs: list[str] = Field(min_length=1, max_length=8)
    opposing_refs: list[str] = Field(default_factory=list, max_length=8)
    verification_needed: str = Field(min_length=3, max_length=500)


class ClinicalAssessment(StrictModel):
    status: Literal['insufficient_data', 'requires_clinician_review']
    differential: list[DiagnosticHypothesis] = Field(max_length=3)
    questions: list[str] = Field(max_length=5)


class ClinicalAIResult(AIResult):
    assessment: ClinicalAssessment
