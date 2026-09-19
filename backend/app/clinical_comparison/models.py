"""Strict public result contracts and bounded internal review phases."""

from typing import Literal

from pydantic import Field

from ..schemas import StrictModel


class CitedObservation(StrictModel):
    text: str = Field(min_length=1, max_length=700)
    refs: list[str] = Field(min_length=1, max_length=8)


class ReviewSection(StrictModel):
    status: Literal["consistent_with_data", "needs_review", "insufficient_data"]
    summary: str = Field(min_length=1, max_length=700)
    refs: list[str] = Field(max_length=8)


class OutlookScenario(StrictModel):
    scenario: str = Field(min_length=1, max_length=500)
    conditions: str = Field(min_length=1, max_length=500)
    monitoring: str = Field(min_length=1, max_length=500)
    refs: list[str] = Field(min_length=1, max_length=8)


class FiveYearOutlook(StrictModel):
    status: Literal["qualitative_only", "insufficient_data"]
    summary: str = Field(min_length=1, max_length=700)
    scenarios: list[OutlookScenario] = Field(max_length=3)


class ComparisonResult(StrictModel):
    case_version: int
    status: Literal["requires_clinician_review", "insufficient_data"]
    summary: str = Field(min_length=1, max_length=1000)
    diagnosis_review: ReviewSection
    treatment_review: ReviewSection
    supporting: list[CitedObservation] = Field(max_length=3)
    discrepancies: list[CitedObservation] = Field(max_length=3)
    questions: list[str] = Field(max_length=4)
    next_steps: list[str] = Field(max_length=3)
    five_year_outlook: FiveYearOutlook
    limitations: list[str] = Field(min_length=1, max_length=4)


class DiagnosisPass(StrictModel):
    case_version: int
    supporting: list[CitedObservation] = Field(max_length=3)
    discrepancies: list[CitedObservation] = Field(max_length=3)
    diagnosis_review: ReviewSection
    summary: str = Field(min_length=1, max_length=1000)


class TreatmentPass(StrictModel):
    case_version: int
    treatment_review: ReviewSection
    questions: list[str] = Field(max_length=4)
    next_steps: list[str] = Field(max_length=3)
    five_year_outlook: FiveYearOutlook
    limitations: list[str] = Field(min_length=1, max_length=4)
