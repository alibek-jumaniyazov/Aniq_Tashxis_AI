"""Published 2008 FHS general CVD equation, not a locally calibrated clinical model."""

import math

MODEL_ID = "framingham-general-cvd-lipids-2008"
SOURCE_URL = "https://www.framinghamheartstudy.org/fhs-for-researchers/fhs-risk-functions/cardiovascular-disease-10-year-risk/"
FIELDS = [
    "systolic_pressure",
    "total_cholesterol",
    "hdl_cholesterol",
    "smoker",
    "diabetes",
    "bp_treated",
    "baseline_cvd",
]


def calculate(case, body):
    inputs = body.inputs.model_dump() if body.inputs else {}
    missing = [key for key in FIELDS if inputs.get(key) is None]
    if case.age is None:
        missing.append("age")
    if case.sex not in {"male", "female"}:
        missing.append("sex")
    reasons = []
    if body.horizon_years != 10:
        reasons.append("UNSUPPORTED_HORIZON")
    if body.outcome_id != "cardiovascular_event":
        reasons.append("UNSUPPORTED_OUTCOME")
    if case.age is not None and not 30 <= case.age <= 74:
        reasons.append("FHS_AGE_OUTSIDE_RANGE")
    if inputs.get("baseline_cvd") is True:
        reasons.append("FHS_BASELINE_CVD")
    if body.inputs and not body.inputs.confirmed:
        reasons.append("RISK_INPUT_CONFIRMATION_REQUIRED")
    probability = None
    normalized = {**inputs, "age": case.age, "sex": case.sex}
    if not reasons and not missing:
        factor = 38.67 if inputs["lipid_unit"] == "mmol/L" else 1
        total, hdl = inputs["total_cholesterol"] * factor, inputs["hdl_cholesterol"] * factor
        if not (
            100 <= total <= 400
            and 10 <= hdl <= 100
            and hdl < total
            and 90 <= inputs["systolic_pressure"] <= 200
        ):
            reasons.append("FHS_INPUT_OUTSIDE_SUPPORTED_RANGE")
        else:
            # Sex-specific coefficients, baseline survival and centering from the source table.
            if case.sex == "male":
                age_b, total_b, hdl_b, sbp_b, smoke_b, dm_b, survival, mean = (
                    3.06117,
                    1.12370,
                    -0.93263,
                    (1.99881 if inputs["bp_treated"] else 1.93303),
                    0.65451,
                    0.57367,
                    0.88936,
                    23.9802,
                )
            else:
                age_b, total_b, hdl_b, sbp_b, smoke_b, dm_b, survival, mean = (
                    2.32888,
                    1.20904,
                    -0.70833,
                    (2.82263 if inputs["bp_treated"] else 2.76157),
                    0.52873,
                    0.69154,
                    0.95012,
                    26.1931,
                )
            score = (
                age_b * math.log(case.age)
                + total_b * math.log(total)
                + hdl_b * math.log(hdl)
                + sbp_b * math.log(inputs["systolic_pressure"])
                + smoke_b * inputs["smoker"]
                + dm_b * inputs["diabetes"]
            )
            probability = 1 - survival ** math.exp(score - mean)
            normalized.update(total_cholesterol_mg_dl=total, hdl_cholesterol_mg_dl=hdl)
    return {
        "outcome_id": body.outcome_id,
        "horizon_years": body.horizon_years,
        "eligibility_status": "calculated" if probability is not None else "not_available",
        "probability": probability,
        "model_id": MODEL_ID,
        "model_version": "2008-lipids-1.0",
        "source_url": SOURCE_URL,
        "inputs": normalized,
        "missing_fields": missing,
        "unsupported_reasons": reasons,
        "validation_status": "published_equation_not_locally_validated",
        "limitations": ["FHS_NOT_LOCALLY_CALIBRATED", "FHS_NOT_DIAGNOSIS"],
        "provenance": "clinician_confirmed_calculator_inputs",
    }
