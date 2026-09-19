"""Realistic, reproducible synthetic workspace. Never overwrites an existing database."""

from collections import Counter
from datetime import timedelta
import hashlib
import json
from sqlalchemy import select
from .config import ROOT, settings
from .db import Audit, Case, CaseAccess, Job, Record, SessionLocal, User, now, uid
from .demo_catalog import (
    COMPARISON_COPY,
    EPISODES,
    INCIDENTS,
    PATIENT_NAMES,
    STAFF,
    clinical_profile,
)
from .documents import extract
from .rules import RULE_VERSION, review_snapshot
from .security import create_record, current_facts, serialize

SEED_VERSION = "realistic-workspace-v2"
TENANT = "avilab-demo"


def seed_realistic(anchor=None):
    if not settings.demo_mode:
        raise RuntimeError("Synthetic seed requires DEMO_MODE=true")
    anchor = (anchor or now()).replace(microsecond=0)
    from .routes import case_snapshot, password_hasher
    from .seed import DEMO_PASSWORD
    from .files import parse_dicom

    with SessionLocal() as db:
        if db.scalar(select(User).limit(1)):
            return False
        # The clinical graph commits together. The reset CLI stages and validates
        # clinical data, commerce and files before touching the live DB.
        users = {}
        password_hash = password_hasher.hash(DEMO_PASSWORD)
        for role, name in STAFF.items():
            user = User(
                tenant_id=TENANT,
                email=f"{role}@demo.aniq",
                name=name,
                role=role,
                password_hash=password_hash,
            )
            db.add(user)
            db.flush()
            users[role] = user
        other = User(
            tenant_id="other-demo",
            email="other@demo.aniq",
            name="Другой демо-центр",
            role="doctor",
            password_hash=password_hash,
        )
        db.add(other)
        db.flush()
        db.add(
            Case(
                tenant_id=other.tenant_id,
                owner_id=other.id,
                alias="ISOLATED-001",
                full_name="Лола Демирова",
                age=45,
                sex="female",
                summary="Изолированный синтетический случай другого центра. Первичная запись; данные ещё собираются.",
                demo=True,
                created_at=anchor - timedelta(days=3),
                updated_at=anchor - timedelta(days=3),
            )
        )

        def audit(actor, action, resource, at):
            db.add(
                Audit(
                    tenant_id=actor.tenant_id,
                    actor_id=actor.id,
                    action=action,
                    resource_id=resource,
                    created_at=at,
                )
            )

        def record(kind, data, case, at, role="doctor", version=None, action=None):
            r = create_record(
                db,
                users[role],
                kind,
                {**data, "synthetic": True, "seed_version": SEED_VERSION},
                case,
                version,
            )
            r.created_at = at
            if action:
                audit(users[role], action, r.id, at)
            return r

        def document(case, title, lines, at):
            name = f"{case.alias}-{title}.txt"
            content = (
                "СИНТЕТИЧЕСКИЕ ДАННЫЕ · учебная клиника Avilab\n"
                f"case_alias={case.alias}\n{title}\n"
                f"Дата записи: {at.isoformat()}\n"
                + "\n".join(lines)
                + "\nСведения вымышлены. Не использовать для лечения реальных пациентов.\n"
            ).encode("utf-8")
            relative = f"{TENANT}/documents/{uid()}.txt"
            path = settings.storage_root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
            parsed = extract(content, name)
            return record(
                "source",
                {
                    "name": name,
                    "type": "txt",
                    **parsed,
                    "text": content.decode(),
                    "storage_path": relative,
                    "extraction_method": "authored_synthetic_fixture",
                    "limitations": ["SYNTHETIC_DATA"],
                    "identity_confirmed_by": users["doctor"].id,
                },
                case,
                at,
                action="document.imported",
            )

        def fact(case, source, spec, at, confirmed=True, **extra):
            key, label, value, unit = spec
            quote = f"{label}: {value if value is not None else 'не указано'}{' ' + unit if unit else ''}"
            page = next(p for p in source.data["pages"] if quote in p["text"])
            offset = page["text"].index(quote)
            return record(
                "fact",
                {
                    "key": key,
                    "label": label,
                    "value": value,
                    "unit": unit,
                    "source_id": source.id,
                    "span": f"page:{page['page']}:chars:{offset}-{offset + len(quote)}",
                    "provenance": "document",
                    "assertion": "present" if value is not None else "not_documented",
                    "confirmed": confirmed,
                    "event_time": at.isoformat(),
                    "available_time": at.isoformat(),
                    "order_status": "active" if key == "medication.substance" else "not_applicable",
                    **extra,
                },
                case,
                at + timedelta(minutes=2),
                action="fact.confirmed" if confirmed else "fact.drafted",
            )

        def analysis(case, at, mode="current", cutoff=None):
            snapshot = {
                **case_snapshot(case),
                "facts": current_facts(db, case.id),
                "notes": [
                    serialize(r)
                    for r in db.scalars(
                        select(Record).where(Record.case_id == case.id, Record.kind == "note")
                    )
                ],
            }
            coverage, candidates = review_snapshot(snapshot, mode, cutoff)
            snapshot["language"] = "ru"
            job = Job(
                tenant_id=TENANT,
                case_id=case.id,
                actor_id=users["doctor"].id,
                case_version=case.version,
                status="partial",
                stage="complete",
                payload={
                    "snapshot": snapshot,
                    "mode": mode,
                    "decision_time": cutoff,
                    "include_ai": False,
                    "language": "ru",
                },
                created_at=at,
                started_at=at + timedelta(seconds=1),
                finished_at=at + timedelta(seconds=2),
                result={},
            )
            db.add(job)
            db.flush()
            alerts = [
                record("alert", {**item, "run_id": job.id}, case, at + timedelta(seconds=2))
                for item in candidates
            ]
            job.result = {
                "coverage": coverage,
                "alert_ids": [a.id for a in alerts],
                "ai": None,
                "limitations": ["AI_NOT_REQUESTED"],
                "rule_catalog_version": RULE_VERSION,
                "seed_version": SEED_VERSION,
                "provenance": "synthetic_seed",
                "engine": "deterministic_rules",
                "demo_only": True,
                "model_id": "synthetic-demo",
                "language": "ru",
            }
            record(
                "notification",
                {
                    "run_id": job.id,
                    "status": "partial",
                    "read_by": [users["doctor"].id] if at < anchor - timedelta(days=2) else [],
                    "signature": hashlib.sha256(job.id.encode()).hexdigest(),
                },
                case,
                at + timedelta(seconds=3),
            )
            audit(users["doctor"], "analysis.completed", job.id, at + timedelta(seconds=2))
            return alerts

        def clinical_entries(case, profile, at, *, confirmed, dmed_source=None):
            entries = []
            for offset, category in enumerate(
                ("subjective", "objective", "laboratory", "instrumental", "doctor_conclusion")
            ):
                when = at + timedelta(minutes=offset * 4)
                text = profile[category]
                source = dmed_source or document(
                    case,
                    {
                        "subjective": "Субъективные данные",
                        "objective": "Объективный осмотр",
                        "laboratory": "Лабораторные данные",
                        "instrumental": "Инструментальные данные",
                        "doctor_conclusion": "Заключение врача",
                    }[category],
                    [text] + ([profile["treatment"]] if category == "doctor_conclusion" else []),
                    when,
                )
                entries.append(
                    record(
                        "clinical_entry",
                        {
                            "category": category,
                            "text": text,
                            "confirmed": confirmed,
                            "diagnosis": text if category == "doctor_conclusion" else "",
                            "treatment": profile["treatment"]
                            if category == "doctor_conclusion"
                            else "",
                            "source_id": source.id,
                            "source_mode": "dmed_demo" if dmed_source else "document",
                            "author_name": users["doctor"].name,
                            "supersedes": None,
                            "event_time": when.isoformat(),
                            "available_time": when.isoformat(),
                        },
                        case,
                        when + timedelta(seconds=30),
                        action="clinical_entry.created",
                    )
                )
            case.diagnosis = profile["doctor_conclusion"] if confirmed else ""
            return entries

        def comparison_examples(case, entries, profile, pulse, spo2, at):
            from .patient_workspace import comparison_snapshot
            from .patient_workspace_ai import (
                ComparisonResult,
                evidence_context,
                validate_comparison,
            )

            snapshot = comparison_snapshot(case, entries, current_facts(db, case.id))
            evidence = evidence_context(snapshot)
            refs = {e["category"]: e["ref"] for e in evidence if e["category"] != "confirmed_fact"}
            kind = profile["comparison_type"]
            documented_regimen = kind in {"hypertension", "diabetes"}
            supporting_refs = (
                [refs["laboratory"]] if kind.startswith("tb_") else [refs["objective"]]
            )
            review_refs = (
                [refs["laboratory"], refs["doctor_conclusion"]]
                if kind.startswith("tb_")
                else [refs["subjective"], refs["doctor_conclusion"]]
            )
            if kind == "side":
                review_refs = [refs["instrumental"], refs["doctor_conclusion"]]
            for offset, language in enumerate(("ru", "uz", "en")):
                copy = COMPARISON_COPY[language]
                subject = copy[kind]
                result = {
                    "case_version": case.version,
                    "status": "requires_clinician_review",
                    "summary": copy["intro"] + subject,
                    "diagnosis_review": {
                        "status": "needs_review"
                        if kind == "tb_wrong"
                        else "consistent_with_data"
                        if kind == "tb_supported" or documented_regimen
                        else "insufficient_data",
                        "summary": subject[0].upper() + subject[1:]
                        if kind.startswith("tb_") or documented_regimen
                        else copy["diagnosis_generic"],
                        "refs": review_refs,
                    },
                    "treatment_review": {
                        "status": "consistent_with_data"
                        if documented_regimen
                        else "needs_review"
                        if kind == "allergy"
                        else "insufficient_data",
                        "summary": copy[kind + "_treatment"]
                        if documented_regimen
                        else subject[0].upper() + subject[1:]
                        if kind == "allergy"
                        else copy["treatment"],
                        "refs": [
                            refs["subjective"],
                            refs["objective" if kind == "hypertension" else "laboratory"],
                            refs["doctor_conclusion"],
                        ]
                        if documented_regimen
                        else [refs["subjective"], refs["doctor_conclusion"]],
                    },
                    "supporting": [
                        {
                            "text": copy["tb_support"]
                            if kind.startswith("tb_")
                            else copy["support"].format(pulse=pulse, spo2=spo2),
                            "refs": supporting_refs,
                        }
                    ],
                    "discrepancies": [
                        {"text": subject[0].upper() + subject[1:], "refs": review_refs}
                    ]
                    if kind == "tb_wrong"
                    else [],
                    "questions": [
                        copy["followup_question"]
                        if documented_regimen
                        else copy["tb_question"]
                        if kind.startswith("tb_")
                        else copy["question"]
                    ],
                    "next_steps": [copy["next"]],
                    "five_year_outlook": {
                        "status": "qualitative_only",
                        "summary": copy["outlook"],
                        "scenarios": [
                            {
                                "scenario": copy["scenario"],
                                "conditions": copy["condition"],
                                "monitoring": copy["monitor"],
                                "refs": [refs["subjective"], refs["objective"]],
                            }
                        ],
                    },
                    "limitations": [copy["limit"]],
                }
                result = ComparisonResult.model_validate(result).model_dump()
                validate_comparison(result, snapshot, evidence)
                result.update(
                    evidence=evidence,
                    requires_clinician_review=True,
                    validated_probability=False,
                    horizon_years=5,
                    language=language,
                    evaluated_conclusion_id=snapshot["evaluated_conclusion_id"],
                )
                when = at + timedelta(seconds=offset * 10)
                job = Job(
                    tenant_id=TENANT,
                    case_id=case.id,
                    actor_id=users["doctor"].id,
                    case_version=case.version,
                    kind="clinical_comparison",
                    status="succeeded",
                    stage="complete",
                    payload={
                        "snapshot": {**snapshot, "language": language},
                        "mode": "current",
                        "include_ai": False,
                        "review_focus": "clinical_comparison",
                        "language": language,
                        "seed_only": True,
                    },
                    result={
                        "comparison": result,
                        "ai": None,
                        "limitations": [],
                        "language": language,
                        "model_id": "synthetic-demo",
                        "model_revision": "authored-fixture-v2",
                        "prompt_version": "authored-synthetic-v2",
                        "provenance": "synthetic_seed",
                        "engine": "synthetic_seed/template",
                        "demo_only": True,
                        "clinical_validation": "not_validated",
                        "seed_version": SEED_VERSION,
                    },
                    created_at=when,
                    started_at=when,
                    finished_at=when + timedelta(seconds=1),
                )
                db.add(job)
                db.flush()
                audit(
                    users["doctor"], "demo.comparison_prepared", job.id, when + timedelta(seconds=1)
                )
                if language == "ru":
                    record(
                        "notification",
                        {
                            "run_id": job.id,
                            "status": "succeeded",
                            "read_by": [users["doctor"].id]
                            if when < anchor - timedelta(days=2)
                            else [],
                            "signature": "clinical-comparison:" + job.id,
                            "demo_only": True,
                        },
                        case,
                        when + timedelta(seconds=2),
                    )

        phantom = parse_dicom((ROOT / "demo" / "synthetic-phantom.zip").read_bytes())
        cases, incidents = {}, {}
        # New admissions appear first, followed by active reviews and completed episodes.
        days_ago = [8, 9, 7, 0, 6, 5, 2, 1, 10, 4, 3, 2, 11, 4, 1, 0, 0, 1]
        for index, (age, sex, complaint, diagnosis, scenario, pulse, spo2, potassium) in enumerate(
            EPISODES
        ):
            start = anchor - timedelta(days=days_ago[index], hours=12, minutes=index * 3)
            profile = clinical_profile(index, pulse, spo2, potassium, scenario)
            if index in {8, 14}:
                # Both compared conclusions use the same evidence cutoff. The
                # intentionally wrong one is written AFTER the positive result.
                profile["laboratory"] += (
                    f" Результаты доступны и проверены {(start + timedelta(hours=3, minutes=23)).isoformat()}."
                )
                profile["doctor_conclusion"] += (
                    f" Заключение после получения этих результатов: {(start + timedelta(hours=3, minutes=31)).isoformat()}."
                )
            case = Case(
                tenant_id=TENANT,
                owner_id=users["doctor"].id,
                alias=f"AT-{anchor:%y%m}-{index + 1:03d}",
                full_name=PATIENT_NAMES[index],
                patient_phone="",
                age=age,
                sex=sex,
                summary=complaint,
                diagnosis=diagnosis,
                demo=True,
                version=1,
                created_at=start,
                updated_at=start,
            )
            db.add(case)
            db.flush()
            cases[index] = case
            for role in ["expert", "quality", "sender"] + (
                ["radiologist"] if scenario == "side" else []
            ):
                db.add(CaseAccess(case_id=case.id, user_id=users[role].id))
            audit(users["doctor"], "case.created", case.id, start)
            observations = [
                ("symptom.complaint", "Жалобы", complaint, None),
                ("vital.pulse", "Пульс", str(pulse), "/min"),
                ("vital.spo2", "Сатурация", str(spo2), "%"),
            ]
            intake = document(
                case,
                "Первичный приём",
                [
                    f"{label}: {value}{' ' + unit if unit else ''}"
                    for _, label, value, unit in observations
                ]
                + [f"Возраст: {age}", "Пол: " + ("мужской" if sex == "male" else "женский")],
                start,
            )
            case.version = 2
            for spec in observations:
                fact(case, intake, spec, start, confirmed=scenario not in {"intake", "import"})
            record(
                "note",
                {
                    "text": complaint
                    + " "
                    + diagnosis
                    + ". Источники привязаны к эпизоду, идентификатор сверён.",
                    "note_type": "decision_rationale",
                    "provenance": "manual",
                    "event_time": start.isoformat(),
                },
                case,
                start + timedelta(minutes=5),
                action="note.created",
            )
            at = start + timedelta(minutes=30)
            case.version = 3
            if potassium:
                unit = None if scenario == "revision" else "mmol/L"
                lab = document(
                    case,
                    "Лабораторный бланк",
                    [
                        f"Калий: {potassium}" + (" mmol/L" if unit else ""),
                        "Материал: сыворотка; значения вымышлены для демонстрации.",
                    ],
                    at,
                )
                available = (
                    None
                    if scenario == "unknown_time"
                    else (at + timedelta(hours=3) if scenario == "late" else at).isoformat()
                )
                old = fact(
                    case,
                    lab,
                    ("lab.potassium", "Калий", potassium, unit),
                    at,
                    confirmed=scenario != "import",
                    available_time=available,
                )
                if scenario == "revision":
                    analysis(case, start + timedelta(hours=1))
                    case.version = 4
                    correction = document(
                        case,
                        "Уточнённый лабораторный бланк",
                        [
                            f"Калий: {potassium} mmol/L",
                            "Уточнение: восстановлена единица измерения по исходному бланку.",
                        ],
                        start + timedelta(hours=2),
                    )
                    fact(
                        case,
                        correction,
                        ("lab.potassium", "Калий", potassium, "mmol/L"),
                        start + timedelta(hours=2),
                        supersedes=old.id,
                    )
            if scenario in {"allergy", "cancelled"}:
                substance = "Амоксициллин" if index % 2 == 0 else "Кларитромицин"
                for key, label, title in [
                    (
                        "allergy.substance",
                        "Вещество в аллергологическом анамнезе",
                        "Лист аллергологического анамнеза",
                    ),
                    ("medication.substance", "Вещество в листе назначений", "Лист назначений"),
                ]:
                    src = document(
                        case,
                        title,
                        [
                            f"{label}: {substance}",
                            "Статус назначения: "
                            + ("отменено" if scenario == "cancelled" else "активно")
                            if key.startswith("medication")
                            else "Запись анамнеза подтверждена по синтетическому источнику.",
                        ],
                        at,
                    )
                    fact(
                        case,
                        src,
                        (key, label, substance, None),
                        at,
                        **(
                            {"order_status": "cancelled"}
                            if scenario == "cancelled" and key.startswith("medication")
                            else {}
                        ),
                    )
            elif scenario == "complete":
                src = document(
                    case,
                    "Уточнение анамнеза",
                    ["Аллергия: отрицает", "Со слов пациента; запись проверена врачом."],
                    at,
                )
                fact(
                    case,
                    src,
                    ("allergy.substance", "Аллергия", "отрицает", None),
                    at,
                    assertion="absent",
                )
            if scenario == "side":
                for title, side in [
                    ("Направление на исследование", "left"),
                    ("Текст заключения", "right"),
                ]:
                    src = document(
                        case,
                        title,
                        [
                            f"Сторона: {side}",
                            "Вымышленный текст для сверки документов. Не является описанием прикреплённого DICOM-фантома.",
                        ],
                        at,
                    )
                    fact(case, src, ("imaging.side", "Сторона", side, None), at)
                study = record(
                    "study",
                    {
                        "name": "CT · синтетический фантом · " + case.alias,
                        "series": [],
                        "analysis_status": "unavailable",
                        "reason": "VALIDATED_CT_MODEL_NOT_CONFIGURED",
                        "mask_available": False,
                        "synthetic_phantom": True,
                        "deidentified_confirmed_by": users["radiologist"].id,
                    },
                    case,
                    at,
                    role="radiologist",
                    action="imaging.imported",
                )
                metadata = []
                for series_uid, instances in phantom.items():
                    series_id = uid()
                    for i, item in enumerate(instances):
                        path = settings.storage_root / TENANT / study.id / series_id / f"{i}.dcm"
                        path.parent.mkdir(parents=True, exist_ok=True)
                        path.write_bytes(item["raw"])
                    first = instances[0]
                    metadata.append(
                        {
                            "id": series_id,
                            "uid": series_uid,
                            "count": len(instances),
                            **{
                                k: first[k]
                                for k in [
                                    "orientation",
                                    "spacing",
                                    "rows",
                                    "columns",
                                    "modality",
                                    "description",
                                    "body_part",
                                    "photometric",
                                    "frame_of_reference_uid",
                                ]
                                if k in first
                            },
                            "positions": [i["position"] for i in instances],
                        }
                    )
                study.data = {**study.data, "series": metadata}
                record(
                    "imaging_report",
                    {
                        "study_id": study.id,
                        "expected_version": case.version,
                        "radiologist_report": "Учебный технический фантом. Видны синтетические геометрические структуры; анатомические органы и клинические находки по этому файлу не оцениваются. Текстовое расхождение стороны относится к отдельным документам.",
                        "report_source_id": None,
                        "report_quote": "",
                        "author_name": users["radiologist"].name,
                        "origin": "synthetic_seed",
                        "demo_only": True,
                    },
                    case,
                    start + timedelta(hours=3, minutes=5),
                    role="radiologist",
                    action="imaging.report_saved",
                )
                if index in {1, 2, 13}:
                    record(
                        "imaging_review",
                        {
                            "study_id": study.id,
                            "status": "clarified",
                            "comment": "Просмотрен технический синтетический фантом: 12 последовательных срезов, геометрия согласована. Клиническое заключение по этому изображению не формируется. Расхождение стороны проверяется по текстовым источникам отдельно.",
                            "review_scope": "clinician_visual_review_no_ai_finding",
                        },
                        case,
                        start + timedelta(hours=1),
                        role="radiologist",
                        action="imaging.reviewed",
                    )
            dmed_source = None
            if scenario == "import":
                connection = record(
                    "connection",
                    {"mode": "demo", "active": True, "external_account": "DEMO-DOCTOR"},
                    None,
                    start,
                    action="dmed.demo_connected",
                )
                dmed_source = record(
                    "source",
                    {
                        "name": "DMED · синтетическая приёмная запись",
                        "type": "dmed_demo",
                        "text": "СИНТЕТИЧЕСКИЙ ИМПОРТ · нет реального подключения DMED\n"
                        + "\n\n".join(
                            profile[key]
                            for key in (
                                "subjective",
                                "objective",
                                "laboratory",
                                "instrumental",
                                "doctor_conclusion",
                                "treatment",
                            )
                        ),
                        "pages": [],
                        "limitations": ["DEMO_INTEGRATION", "SYNTHETIC_DATA"],
                        "external_version": 1,
                    },
                    case,
                    at,
                )
                imported = record(
                    "import",
                    {
                        "source_id": dmed_source.id,
                        "connection_id": connection.id,
                        "external_version": 1,
                        "mode": "demo",
                        "status": "awaiting_confirmation",
                    },
                    case,
                    at,
                    action="dmed.imported",
                )
            case.version += 1
            entries = clinical_entries(
                case,
                profile,
                start + timedelta(hours=3, minutes=15),
                confirmed=scenario not in {"intake", "import"},
                dmed_source=dmed_source,
            )
            if dmed_source:
                imported.data = {
                    **imported.data,
                    "clinical_entry_ids": [entry.id for entry in entries],
                }
            if scenario in {"intake", "import"}:
                record(
                    "note_draft",
                    {
                        "text": "Уточнить время появления симптомов и сверить единицы в исходном документе до подтверждения фактов.",
                        "note_type": "decision_rationale",
                    },
                    case,
                    start + timedelta(hours=1),
                )
            else:
                case.version += 1
                record(
                    "note",
                    {
                        "text": "Выполнена сверка доступных источников. "
                        + (
                            "Внешние данные поступили после исходного решения; времена сохранены раздельно."
                            if scenario == "late"
                            else diagnosis
                            + ". Проверка правил ограничена демонстрационным каталогом."
                        ),
                        "note_type": "alert_response",
                        "provenance": "manual",
                        "event_time": (start + timedelta(hours=3, minutes=45)).isoformat(),
                    },
                    case,
                    start + timedelta(hours=3, minutes=45),
                    action="note.created",
                )
                case.updated_at = start + timedelta(hours=3, minutes=45)
                alerts = analysis(case, start + timedelta(hours=4))
                if scenario in {"late", "unknown_time"}:
                    analysis(
                        case,
                        start + timedelta(hours=5),
                        mode="decision_time",
                        cutoff=(start + timedelta(hours=1)).isoformat(),
                    )
                comparison_examples(
                    case, entries, profile, pulse, spo2, start + timedelta(hours=5, minutes=35)
                )
                for alert in alerts:
                    states = (
                        ["seen", "accepted", "closed"]
                        if index in {1, 12}
                        else ["seen", "accepted"]
                        if index in {0, 2, 13}
                        else ["information_requested"]
                        if index in {6, 17}
                        else []
                    )
                    for step, status in enumerate(states):
                        record(
                            "review",
                            {
                                "alert_id": alert.id,
                                "status": status,
                                "comment": {
                                    "seen": "Исходные записи открыты и сопоставлены.",
                                    "accepted": "Расхождение передано на независимую оценку; нужна сверка документации.",
                                    "closed": "Сверка источников завершена, обоснование сохранено в экспертном решении.",
                                    "information_requested": "Запрошено уточнение исходного документа и актуальности записи.",
                                }[status],
                            },
                            case,
                            start + timedelta(hours=5, minutes=step * 10),
                            action="alert." + status,
                        )
                        alert.data = {**alert.data, "status": status}
            if scenario in {"intake", "import"}:
                case.updated_at = start + timedelta(hours=3, minutes=32)
            if index in INCIDENTS:
                status, reason, explanation = INCIDENTS[index]
                incident = record(
                    "incident",
                    {"reason": reason, "status": "under_review", "version": 1, "decisions": []},
                    case,
                    start + timedelta(hours=7),
                    role="quality",
                    action="incident.opened",
                )
                decisions = []
                stages = (
                    ["confirmed", status]
                    if status in {"closed", "corrective_actions"}
                    else [status]
                    if status != "under_review"
                    else []
                )
                for step, stage in enumerate(stages):
                    when = start + timedelta(hours=8, minutes=step * 30)
                    decisions.append(
                        {
                            "status": stage,
                            "explanation": explanation
                            if step == 0
                            else "Проверка завершена; ответственному за качество переданы результаты сверки и меры по улучшению заполнения документов.",
                            "actor_id": users["expert"].id,
                            "created_at": when.isoformat(),
                        }
                    )
                    audit(users["expert"], "incident." + stage, incident.id, when)
                incident.data = {
                    **incident.data,
                    "status": status,
                    "version": 1 + len(decisions),
                    "decisions": decisions,
                }
                incidents[index] = incident

        for indexes, status, purpose, hours in [
            ([0, 1, 2, 4, 5], "sent", "Еженедельный обзор качества документации", 20),
            ([12, 13], "approved", "Повторная проверка завершённых эпизодов", 6),
            ([0, 4], "draft", "Сверка аллергологического и лабораторного разделов", 3),
        ]:
            selected = [incidents[i] for i in indexes]
            at = anchor - timedelta(hours=hours)
            package = {
                "schema": "aniqtashxis.aggregate.v1",
                "mode": "demo",
                "period": anchor.strftime("%Y-%m"),
                "confirmed_cases": len(selected) if len(selected) >= 5 else None,
                "small_group_suppressed": len(selected) < 5,
                "scope": "Synthetic quality review demonstration",
                "clinical_validation": "not_validated",
            }
            digest = hashlib.sha256(json.dumps(package, sort_keys=True).encode()).hexdigest()
            export = record(
                "export",
                {
                    "purpose": purpose,
                    "basis": "Независимые экспертные решения по синтетическим эпизодам; только агрегированные сведения.",
                    "recipient": "mock-ministry",
                    "incident_ids": [r.id for r in selected],
                    "snapshots": [
                        {
                            "incident_id": r.id,
                            "version": r.data["version"],
                            "case_version": r.case_version,
                        }
                        for r in selected
                    ],
                    "package": package,
                    "sha256": digest,
                    "version": {"draft": 1, "approved": 2, "sent": 3}[status],
                    "status": status,
                    "approved_by": users["sender"].id if status != "draft" else None,
                    "receipt": None,
                },
                None,
                at,
                role="quality",
                action="export.created",
            )
            if status != "draft":
                audit(users["sender"], "export.approved", export.id, at + timedelta(minutes=15))
            if status == "sent":
                export.data = {
                    **export.data,
                    "receipt": {
                        "id": "DEMO-" + export.id[:8],
                        "transport": "mock",
                        "received_at": (at + timedelta(minutes=30)).isoformat(),
                        "sha256": digest,
                    },
                }
                audit(users["sender"], "export.demo_sent", export.id, at + timedelta(minutes=30))
        record(
            "seed_manifest",
            {
                "version": SEED_VERSION,
                "anchor": anchor.isoformat(),
                "synthetic": True,
                "clinical_cases": len(cases),
                "staff": len(users),
            },
            None,
            anchor,
            role="admin",
            action="demo.seeded",
        )
        db.commit()
    seed_commerce(anchor)
    return True


def seed_commerce(anchor):
    """Populate editable subscription workflows without pretending money moved."""
    from PIL import Image, ImageDraw
    from .billing import bootstrap
    from .billing_models import Clinic, PaymentMethod, Plan, SubscriptionRequest, UserProfile
    from .billing_service import next_month
    from .routes import password_hasher
    from .seed import DEMO_PASSWORD

    with SessionLocal() as db:
        bootstrap(db)
        developer = db.scalar(select(User).where(User.email == "developer@demo.aniq"))
        password_hash = password_hasher.hash(DEMO_PASSWORD)
        owners = {}
        for email, tenant, name in (
            ("owner@demo.aniq", TENANT, "Акмал Алимов · демо-владелец"),
            ("owner.pending@demo.aniq", "clinic-pending-demo", "Феруза Саидова · демо-владелец"),
            ("owner.expired@demo.aniq", "clinic-expired-demo", "Даврон Эркинов · демо-владелец"),
        ):
            owner = User(
                tenant_id=tenant, email=email, name=name, role="owner", password_hash=password_hash
            )
            db.add(owner)
            db.flush()
            db.add(UserProfile(user_id=owner.id))
            owners[tenant] = owner
        main = db.get(Clinic, TENANT)
        main.owner_id = owners[TENANT].id
        main.name = "Avilab · учебная многопрофильная клиника"
        main.plan_id, main.plan_name, main.price_uzs, main.doctor_limit = (
            "clinic10",
            "Clinic 10",
            1390000,
            10,
        )
        main.created_at = anchor - timedelta(days=40)
        main.starts_at = anchor - timedelta(days=12)
        main.expires_at = next_month(main.starts_at)
        other = db.get(Clinic, "other-demo")
        other.name = "Navbahor · изолированный учебный кабинет"
        other.plan_id, other.plan_name, other.price_uzs, other.doctor_limit = (
            "solo",
            "Doctor",
            150000,
            1,
        )
        other.created_at = anchor - timedelta(days=8)
        other.starts_at, other.expires_at = anchor - timedelta(days=7), anchor + timedelta(days=23)
        pending = Clinic(
            id="clinic-pending-demo",
            owner_id=owners["clinic-pending-demo"].id,
            name="Shifo Plus · синтетическая заявка",
            created_at=anchor - timedelta(days=1),
            internal_demo=False,
            doctor_limit=0,
        )
        expired = Clinic(
            id="clinic-expired-demo",
            owner_id=owners["clinic-expired-demo"].id,
            name="Mehr Medical · учебное продление",
            created_at=anchor - timedelta(days=65),
            plan_id="clinic25",
            plan_name="Clinic 25",
            price_uzs=2390000,
            doctor_limit=25,
            starts_at=anchor - timedelta(days=35),
            expires_at=anchor - timedelta(days=5),
            internal_demo=False,
        )
        db.add_all([pending, expired])
        db.flush()
        method = db.scalar(select(PaymentMethod).order_by(PaymentMethod.name))
        for index, (clinic, plan_id, status, days) in enumerate(
            (
                (main, "clinic10", "approved", 12),
                (pending, "clinic10", "pending", 0),
                (expired, "clinic25", "rejected", 2),
            )
        ):
            plan = db.get(Plan, plan_id)
            # The receipt is a purpose-made illustration with conspicuous labels,
            # never a real-looking bank receipt or evidence of an actual payment.
            relative = f"billing/{clinic.id}/synthetic-receipt-{index + 1}.png"
            path = settings.storage_root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            receipt = Image.new("RGB", (840, 420), "#eef8f7")
            draw = ImageDraw.Draw(receipt)
            draw.rectangle((24, 24, 816, 396), outline="#168781", width=4)
            for row, line in enumerate(
                (
                    "SYNTHETIC DEMO - NOT A BANK RECEIPT",
                    "NO MONEY WAS TRANSFERRED",
                    f"Fixture: {clinic.id}",
                    f"Plan: {plan.name}",
                    f"Illustrative amount: {plan.price_uzs:,} UZS",
                    f"Reference: DEMO-SEED-{index + 1:03d}",
                )
            ):
                draw.text((55, 60 + row * 48), line, fill="#073e3a", font_size=23)
            receipt.save(path, "PNG")
            created = anchor - timedelta(days=days, hours=4)
            req = SubscriptionRequest(
                tenant_id=clinic.id,
                actor_id=clinic.owner_id,
                plan_id=plan.id,
                plan_name=plan.name,
                price_uzs=plan.price_uzs,
                doctor_limit=plan.doctor_limit,
                payment_method_id=method.id,
                payment_method_name=method.name,
                payment_recipient=method.recipient,
                payment_card_last4=method.card_number.replace(" ", "")[-4:],
                payment_reference=f"SYNTHETIC-DEMO-{index + 1:03d}",
                is_demo=True,
                receipt_name=f"SYNTHETIC-NOT-PAYMENT-{index + 1}.png",
                receipt_path=relative,
                receipt_mime="image/png",
                receipt_hash=hashlib.sha256(path.read_bytes()).hexdigest(),
                status=status,
                created_at=created,
                version=1 if status == "pending" else 2,
                reviewer_id=None if status == "pending" else developer.id,
                reviewed_at=None if status == "pending" else created + timedelta(hours=1),
                review_note=""
                if status == "pending"
                else (
                    "Учебная заявка одобрена. Это синтетическая демонстрация, реального платежа нет."
                    if status == "approved"
                    else "Учебный пример отказа: в приложении отсутствует подтверждение реальной операции. Можно подать новую заявку."
                ),
                granted_starts_at=main.starts_at if status == "approved" else None,
                granted_expires_at=main.expires_at if status == "approved" else None,
            )
            db.add(req)
            db.flush()
            db.add(
                Audit(
                    tenant_id=clinic.id,
                    actor_id=clinic.owner_id,
                    action="billing.requested",
                    resource_id=req.id,
                    created_at=created,
                )
            )
            if status != "pending":
                db.add(
                    Audit(
                        tenant_id=clinic.id,
                        actor_id=developer.id,
                        action="billing." + status,
                        resource_id=req.id,
                        created_at=req.reviewed_at,
                    )
                )
        db.commit()


def verify_seed():
    """Check persisted references, source bytes and export freshness before activation."""
    with SessionLocal() as db:
        records = list(db.scalars(select(Record)))
        by_id = {r.id: r for r in records}
        cases = {c.id: c for c in db.scalars(select(Case))}
        jobs = list(db.scalars(select(Job)))
        for r in records:
            if r.case_id:
                assert r.case_id in cases and r.tenant_id == cases[r.case_id].tenant_id
                assert r.case_version <= cases[r.case_id].version
            if r.kind == "fact":
                source = by_id[r.data["source_id"]]
                assert source.case_id == r.case_id
                if r.data.get("supersedes"):
                    assert by_id[r.data["supersedes"]].case_id == r.case_id
            if r.kind == "source" and r.data.get("storage_path"):
                raw = (settings.storage_root / r.data["storage_path"]).read_bytes()
                assert hashlib.sha256(raw).hexdigest() == r.data["sha256"]
            if r.kind == "clinical_entry":
                source = by_id[r.data["source_id"]]
                assert source.case_id == r.case_id and r.data["text"] in source.data["text"]
                assert r.data["synthetic"] and r.created_at >= source.created_at
            if r.kind == "imaging_report":
                assert by_id[r.data["study_id"]].case_id == r.case_id
            if r.kind == "export":
                assert (
                    hashlib.sha256(
                        json.dumps(r.data["package"], sort_keys=True).encode()
                    ).hexdigest()
                    == r.data["sha256"]
                )
                for snap in r.data["snapshots"]:
                    incident = by_id[snap["incident_id"]]
                    assert incident.data["version"] == snap["version"]
                    assert cases[incident.case_id].version == snap["case_version"]
        from .patient_workspace_ai import ComparisonResult, evidence_context, validate_comparison

        for job in jobs:
            assert job.created_at <= job.started_at <= job.finished_at
            assert job.case_version <= cases[job.case_id].version
            assert job.result["provenance"] == "synthetic_seed" and job.result["demo_only"] is True
            if job.kind == "clinical_comparison":
                snapshot, result = job.payload["snapshot"], job.result["comparison"]
                assert job.case_version == cases[job.case_id].version
                assert (
                    result["language"]
                    == job.result["language"]
                    == job.payload["language"]
                    == snapshot["language"]
                )
                assert snapshot["evaluated_conclusion_id"] in by_id
                schema = {key: result[key] for key in ComparisonResult.model_fields}
                validate_comparison(
                    ComparisonResult.model_validate(schema).model_dump(),
                    snapshot,
                    evidence_context(snapshot),
                )
                assert job.result["model_id"] == "synthetic-demo" and not job.payload["include_ai"]
        from .billing_models import Clinic, PaymentMethod, Plan, SubscriptionRequest

        requests = list(db.scalars(select(SubscriptionRequest)))
        for request in requests:
            assert request.is_demo
            assert (
                hashlib.sha256(
                    (settings.storage_root / request.receipt_path).read_bytes()
                ).hexdigest()
                == request.receipt_hash
            )
            assert (
                db.get(Clinic, request.tenant_id)
                and db.get(Plan, request.plan_id)
                and db.get(PaymentMethod, request.payment_method_id)
            )
        return {
            "seed_version": SEED_VERSION,
            "users": len(list(db.scalars(select(User)))),
            "cases": len(cases),
            "records": dict(Counter(r.kind for r in records)),
            "analyses": len(jobs),
            "analysis_kinds": dict(Counter(job.kind for job in jobs)),
            "comparison_languages": dict(
                Counter(
                    job.payload["language"] for job in jobs if job.kind == "clinical_comparison"
                )
            ),
            "clinics": len(list(db.scalars(select(Clinic)))),
            "subscription_requests": dict(Counter(request.status for request in requests)),
            "audit_events": len(list(db.scalars(select(Audit)))),
        }
