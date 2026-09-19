"""Deterministic documentation review; it does not adjudicate treatment correctness."""

from .clinical import evidence_report, eligible_facts


def review_decision(snapshot, mode, cutoff):
    facts = eligible_facts(snapshot["facts"], mode, cutoff)
    quality = evidence_report(snapshot["facts"], mode, cutoff)
    checks = []

    def add(code, status, evidence):
        checks.append(
            {
                "code": code,
                "status": status,
                "evidence": [
                    {
                        "fact_id": f["id"],
                        "source_id": f["source_id"],
                        "label": f["label"],
                        "value": f.get("value"),
                        "unit": f.get("unit"),
                    }
                    for f in evidence
                ],
            }
        )

    def present(key):
        return [
            f
            for f in facts
            if f["key"] == key
            and f.get("assertion") == "present"
            and f.get("value") not in (None, "")
        ]

    allergy = present("allergy.substance")
    orders = [f for f in present("medication.substance") if f.get("order_status") == "active"]
    overlap = []
    for a in allergy:
        for m in orders:
            if str(a["value"]).strip().casefold() == str(m["value"]).strip().casefold():
                overlap.extend([a, m])
    add(
        "substance_overlap",
        "attention" if overlap else "checked" if allergy and orders else "not_evaluable",
        overlap or allergy + orders,
    )
    sides = present("imaging.side")
    side_map = {
        "left": "left",
        "слева": "left",
        "лево": "left",
        "левая": "left",
        "chap": "left",
        "right": "right",
        "справа": "right",
        "правая": "right",
        "право": "right",
        "o‘ng": "right",
        "o'ng": "right",
        "bilateral": "bilateral",
        "двусторонний": "bilateral",
    }
    normalized = {
        side_map.get(str(f["value"]).strip().casefold(), str(f["value"]).strip().casefold())
        for f in sides
    }
    add(
        "laterality_consistency",
        "attention"
        if len(normalized) > 1
        else "checked"
        if len({f["source_id"] for f in sides}) >= 2
        else "not_evaluable",
        sides,
    )
    conflict_ids = {i for conflict in quality["potential_conflicts"] for i in conflict["fact_ids"]}
    add(
        "observation_consistency",
        "attention" if conflict_ids else "checked" if facts else "not_evaluable",
        [f for f in facts if f["id"] in conflict_ids],
    )
    quantitative = [
        f
        for f in facts
        if f["key"].startswith(("lab.", "vital.")) and f.get("assertion") == "present"
    ]
    add(
        "measurement_units",
        "attention" if quality["missing_units"] else "checked" if quantitative else "not_evaluable",
        [f for f in quantitative if not f.get("unit")],
    )
    add(
        "confirmation_completeness",
        "attention" if quality["unconfirmed_facts"] else "checked" if facts else "not_evaluable",
        [f for f in snapshot["facts"] if not f.get("confirmed")],
    )
    return {
        "version": "documentation-review-1.0",
        "mode": mode,
        "decision_time": cutoff,
        "checks": checks,
        "evaluated_facts": len(facts),
        "excluded_facts": len(snapshot["facts"]) - len(facts),
        "clinical_correctness": "not_assessed",
    }
