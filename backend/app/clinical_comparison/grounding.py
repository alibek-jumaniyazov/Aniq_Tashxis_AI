"""Evidence construction and deterministic clinical comparison output checks."""

import json
import re


def numeric_values(text):
    """A bounded hallucinated-number guard, not semantic clinical validation."""
    return {float(n.replace(",", ".")) for n in re.findall(r"(?<!\w)\d+(?:[.,]\d+)?", str(text))}


def contradictory_dose_claim(text):
    """Catch the observed same-sentence dose-present/dose-missing contradiction.

    This deliberately does not infer medication names or absent doses globally:
    another drug may legitimately have an unknown dose.
    """
    sentence = re.sub(r"\s+", " ", text).strip()
    dose = re.search(
        r"\b(?P<medicine>[A-Za-zА-Яа-яЁё][\w-]{2,})\s+\d+(?:[.,]\d+)?\s*(?:мг|мкг|mg|mcg|µg)\b(?!\s*/)",
        sentence,
        re.IGNORECASE,
    )
    if not dose:
        return False
    remainder = sentence[dose.end() :]
    clause = re.search(
        r"\b(?:но|однако|but|however|lekin|ammo)\b([^.!?]*)", remainder, re.IGNORECASE
    )
    if not clause:
        return False
    # Only impersonal claims about the just-quoted dose; a second named drug
    # cannot match these patterns and may legitimately have an unknown dose.
    other_languages = (
        r"\s*(?:the\s+)?(?:dose|dosage)\s+(?:is|was)\s+(?:not\s+(?:documented|provided|specified|recorded)|unknown)\s*",
        r"\s*(?:does\s+not|do\s+not)\s+(?:provide|specify|document)\s+(?:the\s+)?(?:dose|dosage)\s*",
        r"\s*(?:uning\s+)?dozasi\s+(?:ko.rsatilmagan|berilmagan|qayd\s+etilmagan|noma.lum)\s*",
    )
    if any(re.fullmatch(pattern, clause.group(1), re.IGNORECASE) for pattern in other_languages):
        return True
    # Limit intervening words to an impersonal documentation claim. This avoids
    # applying the first drug's documented dose to a second named medication.
    missing = re.fullmatch(
        r"\s*не\s+(?:предостав\w*|указ\w*|сообщ\w*|опис\w*|документир\w*)\s+"
        r"(?:(?:информаци\w*|сведени\w*|данн\w*|о|об|по|переносимост\w*|или|и)\s+)*"
        r"доз\w*(?:\s+(?P<medicine>[A-Za-zА-Яа-яЁё][\w-]*))?\s*",
        clause.group(1),
        re.IGNORECASE,
    )
    if not missing:
        return False
    named = missing.group("medicine")
    return not named or named.casefold() == dose.group("medicine").casefold()


def evidence_context(snapshot):
    evidence = []
    for index, entry in enumerate(snapshot["entries"], 1):
        text = entry["text"]
        if entry.get("diagnosis"):
            text += "\nDocumented diagnosis: " + entry["diagnosis"]
        if entry.get("treatment"):
            text += "\nDocumented treatment: " + entry["treatment"]
        evidence.append(
            {
                "ref": f"E{index}",
                "entry_id": entry["id"],
                "category": entry["category"],
                "text": text,
                "source_id": entry.get("source_id"),
            }
        )
    for index, fact in enumerate(snapshot["facts"], 1):
        evidence.append(
            {
                "ref": f"F{index}",
                "fact_id": fact["id"],
                "category": "confirmed_fact",
                "text": f"{fact['label']}: {fact.get('value')} {fact.get('unit') or ''}; assertion={fact.get('assertion')}",
                "source_id": fact.get("source_id"),
                **{
                    key: fact.get(key)
                    for key in ("key", "assertion", "event_time", "available_time", "order_status")
                },
            }
        )
    return evidence


def validate_inline_references(text, cited_refs):
    """Check explicit E/F source mentions, including Uzbek suffixes and ranges.

    Do not silently add citations. Explicit ICD/MKB codes and decimal diagnostic
    codes are not interpreted as evidence IDs. This is a citation check only.
    """
    cited = set(cited_refs)
    pattern = r"(?<!\w)([EF])([1-9]\d*)(?:\s*[-–—]\s*([EF]?)([1-9]\d*))?"
    for match in re.finditer(pattern, text):
        prefix, start, end_prefix, end = match.groups()
        before, after = text[max(0, match.start() - 25) : match.start()], text[match.end() :]
        if re.search(r"(?:ICD|МКБ|MKB|XKT)(?:[- ]?(?:10|11))?\s*[:=]?\s*$", before, re.IGNORECASE):
            continue
        if re.match(r"\.\d", after):
            continue
        first, last = int(start), int(end or start)
        if (end_prefix and end_prefix != prefix) or last < first or last - first + 1 > len(cited):
            raise ValueError(
                "Inline evidence range must be valid and every member must be in this block refs. "
                "Keep source IDs in refs, not prose; do not invent or silently omit citations."
            )
        if any(f"{prefix}{number}" not in cited for number in range(first, last + 1)):
            raise ValueError(
                "Inline evidence reference is missing from this block refs. "
                "Put every source used by this block in its refs array; preferably keep IDs out of prose."
            )


def validate_comparison(result, snapshot, evidence, *, diagnostic_pass=False):
    from ..ai import validate_known_questions, validate_summary

    if result["case_version"] != snapshot["version"]:
        raise ValueError("Output version mismatch")
    validate_summary(result, snapshot)
    refs = {item["ref"]: item for item in evidence}
    sections = [result[key] for key in ("diagnosis_review", "treatment_review") if key in result]
    outlook = result.get("five_year_outlook")
    scenarios = outlook["scenarios"] if outlook is not None else []
    items = [*sections, *result["supporting"], *result["discrepancies"], *scenarios]
    for item in items:
        if any(ref not in refs for ref in item["refs"]):
            raise ValueError("Fabricated evidence reference")
        if len(item["refs"]) != len(set(item["refs"])):
            raise ValueError("Evidence references must be distinct")
        prose = " ".join(
            item[key]
            for key in ("summary", "text", "scenario", "conditions", "monitoring")
            if key in item
        )
        validate_inline_references(prose, item["refs"])
    for section in sections:
        if section["status"] != "insufficient_data":
            categories = {refs[ref]["category"] for ref in section["refs"]}
            if "doctor_conclusion" not in categories or len(categories) < 2:
                raise ValueError("A comparison must cite a conclusion and observed patient data")
    for item in result["supporting"]:
        if all(refs[ref]["category"] == "doctor_conclusion" for ref in item["refs"]):
            raise ValueError(
                "Supporting evidence needs patient observations, not just a doctor hypothesis"
            )
    for item in result["discrepancies"]:
        categories = {refs[ref]["category"] for ref in item["refs"]}
        if "doctor_conclusion" not in categories or len(categories) < 2:
            raise ValueError(
                "A discrepancy must cite the conflicting conclusion and patient observation"
            )
    if result["diagnosis_review"]["status"] == "needs_review":
        discrepancies = result["discrepancies"]
        if not discrepancies:
            raise ValueError(
                "A needs_review diagnosis requires a specific cited discrepancy between a patient "
                "finding and the doctor conclusion. Explain that relationship, do not merely repeat "
                "the diagnoses. Missing evidence alone requires insufficient_data, not an invented conflict."
            )
        review_refs = set(result["diagnosis_review"]["refs"])
        if not any(set(item["refs"]).issubset(review_refs) for item in discrepancies):
            raise ValueError(
                "The diagnosis review must cite the patient finding and doctor conclusion "
                "that support its specific discrepancy"
            )
    if outlook is not None and (outlook["status"] == "qualitative_only") != bool(scenarios):
        raise ValueError("Outlook status does not match scenarios")
    for scenario in scenarios:
        if all(refs[ref]["category"] == "doctor_conclusion" for ref in scenario["refs"]):
            raise ValueError(
                "A scenario needs documented patient observations, not just a hypothesis"
            )
    # No calibrated probability fields exist in the schema. Reject numeric chances
    # hidden in prognosis prose, including copied baseline measurement percentages.
    forecast_text = json.dumps(outlook, ensure_ascii=False)
    numeric_probability = r"\d+(?:[.,]\d+)?\s*(?:%|percent\w*|процент\w*|foiz\w*)|\b0[.,]\d+\b|\b\d+\s*(?:из|out of|dan)\s*\d+|\b\d+(?:[.,]\d+)?\s*(?:раз\w*|times|baravar)"
    if re.search(numeric_probability, forecast_text, re.IGNORECASE):
        raise ValueError("Unvalidated numerical prognosis")
    # Summary is a factual synopsis: new numbers are not patient observations.
    age_numbers = numeric_values(snapshot.get("age") or "")

    def evidence_numbers(item):
        return (
            numeric_values(item["text"])
            | numeric_values(item.get("event_time") or "")
            | numeric_values(item.get("available_time") or "")
        )

    allowed = set(age_numbers)
    for item in evidence:
        allowed |= evidence_numbers(item)
    if not numeric_values(result["summary"]).issubset(allowed):
        raise ValueError("Unsupported numeric observation")
    # A real number elsewhere in the chart must not launder an invented claim
    # under an unrelated citation. Evaluate each factual block independently.
    for item in [*sections, *result["supporting"], *result["discrepancies"]]:
        cited_numbers = set(age_numbers)
        for ref in item["refs"]:
            cited_numbers |= evidence_numbers(refs[ref])
        if not numeric_values(item.get("summary", item.get("text", ""))).issubset(cited_numbers):
            raise ValueError("Unsupported numeric observation in cited review")
    # Check at both phase boundaries: a bad diagnosis must be repaired by the
    # diagnosis pass, rather than asking the treatment pass to change its input.
    source_text = "\n".join(e["text"] for e in evidence)
    prose = json.dumps(result, ensure_ascii=False)
    target_claim = r"(?:выше|ниже).{0,30}(?:целев|норм)|(?:above|below|outside).{0,30}(?:target|normal)|maqsad.{0,25}(?:yuqori|past)"
    if re.search(target_claim, prose, re.IGNORECASE) and not re.search(
        r"целев|норм|target|normal|maqsad|me.?yor", source_text, re.IGNORECASE
    ):
        raise ValueError(
            "No target or normal range was supplied; remove unsupported target-range claims"
        )
    if diagnostic_pass:
        # Internal phase boundary only. The assembled result must pass the entire
        # validator below before anything is returned or persisted as a result.
        return result
    if contradictory_dose_claim(result["treatment_review"]["summary"]):
        raise ValueError(
            "Treatment summary quotes a documented dose and then calls that same dose unknown. "
            "Preserve the documented dose; do not claim it missing or ask for it again. "
            "Ask only about genuinely undocumented treatment details."
        )
    if not result["questions"] and (
        result["status"] == "insufficient_data"
        or any(section["status"] == "insufficient_data" for section in sections)
    ):
        raise ValueError("Insufficient evidence requires a clarification question")
    questions = [q.strip().casefold() for q in result["questions"]]
    if len(set(questions)) != len(questions) or any(not q.endswith("?") for q in questions):
        raise ValueError(
            "Questions must be distinct actionable questions ending in a question mark"
        )
    validate_known_questions(result["questions"], snapshot)
    section_texts = [
        result["summary"],
        *(section["summary"] for section in sections),
        outlook["summary"],
        *result["next_steps"],
        *result["limitations"],
    ]
    normalized = [text.strip().casefold() for text in section_texts if len(text.strip()) > 50]
    if any(normalized.count(text) >= 3 for text in normalized):
        raise ValueError("Each section must address its own task, not repeat the patient narrative")
    # Observed local-model failure: a sparse case produced "Назначить
    # лекарственные препараты" in next_steps despite the no-prescribing prompt.
    # This targets direct treatment commands; it is not a semantic safety proof.
    prescribe = (
        r"^\s*(?:(?:рекомендуется|необходимо|следует)\s+)?(?:назначить|назначьте|начать|начните|отменить|отмените|заменить|замените|увеличить|увеличьте|снизить|снизьте)\b"
        r".{0,70}\b(?:препарат\w*|лекарств\w*|терапи\w*|лечени\w*|доз\w*)|"
        r"^\s*(?:prescribe|start|stop|switch|increase|reduce)\b.{0,70}\b(?:medication\w*|drug\w*|treatment\w*|therapy|dose\w*)|"
        r"^\s*(?:dori\w*|preparat\w*|doza\w*|davolash\w*)\b.{0,70}\b(?:buyur\w*|boshl\w*|oshir\w*|kamaytir\w*|bekor\w*|to.xtat\w*)"
    )
    if any(re.search(prescribe, step, re.IGNORECASE) for step in result["next_steps"]):
        raise ValueError("Next steps must verify documentation, not prescribe or change treatment")
    return result


def comparison_prose(result):
    """Exclude technical enum values and source quotations from language checks."""
    values = [result["summary"], result["diagnosis_review"]["summary"]]
    if "treatment_review" in result:
        values.extend(
            [
                result["treatment_review"]["summary"],
                *result["questions"],
                *result["next_steps"],
                *result["limitations"],
                result["five_year_outlook"]["summary"],
            ]
        )
    values.extend(item["text"] for item in [*result["supporting"], *result["discrepancies"]])
    for item in result.get("five_year_outlook", {}).get("scenarios", []):
        values.extend(item[key] for key in ("scenario", "conditions", "monitoring"))
    return values
