from sqlalchemy import select
from .db import Case, CaseAccess, SessionLocal, User
from .routes import password_hasher
from .security import create_record

DEMO_PASSWORD = "AniqDemo!2026"


def seed_minimal():
    with SessionLocal() as db:
        if db.scalar(select(User).limit(1)):
            return
        users = {}
        for role, name in [
            ("doctor", "Д-р Азиза Каримова"),
            ("radiologist", "Д-р Тимур Рахимов"),
            ("expert", "Д-р Малика Юсупова"),
            ("quality", "Сардор Алиев"),
            ("sender", "Дилноза Саидова"),
            ("admin", "Администратор"),
            ("analyst", "Аналитик"),
        ]:
            user = User(
                tenant_id="avilab-demo",
                email=f"{role}@demo.aniq",
                name=name,
                role=role,
                password_hash=password_hasher.hash(DEMO_PASSWORD),
            )
            db.add(user)
            db.flush()
            users[role] = user
        other = User(
            tenant_id="other-demo",
            email="other@demo.aniq",
            name="Other organization",
            role="doctor",
            password_hash=password_hasher.hash(DEMO_PASSWORD),
        )
        db.add(other)
        cases = [
            (
                "AT-2026-001",
                58,
                "male",
                "Дискомфорт в грудной клетке. Сопоставление клинических записей и назначений.",
                "Предварительное заключение требует уточнения",
            ),
            (
                "AT-2026-002",
                42,
                "female",
                "Кашель и одышка. Проверка полноты лабораторных данных.",
                "Под наблюдением",
            ),
            (
                "AT-2026-003",
                67,
                "male",
                "Контрольное обследование. Сверка стороны в заключениях КТ.",
                "Контроль после обследования",
            ),
            (
                "AT-2026-004",
                35,
                "female",
                "Плановый приём. Подготовка истории к проверке.",
                "Данные собираются",
            ),
        ]
        for index, (alias, age, sex, summary, diagnosis) in enumerate(cases):
            case = Case(
                tenant_id="avilab-demo",
                owner_id=users["doctor"].id,
                alias=alias,
                age=age,
                sex=sex,
                summary=summary,
                diagnosis=diagnosis,
            )
            db.add(case)
            db.flush()
            for role in ["expert", "quality", "sender", "radiologist"]:
                db.add(CaseAccess(case_id=case.id, user_id=users[role].id))
            if index == 3:
                continue
            timestamp = "2026-09-18T09:00:00+05:00"
            values = [
                ("vital.spo2", "Сатурация", "97", "%"),
                ("vital.pulse", "Пульс", "78", "/min"),
            ]
            if index == 0:
                values += [
                    ("allergy.substance", "Аллергия · вещество", "DEMO-A", None),
                    ("medication.substance", "Назначение · вещество", "DEMO-A", None),
                ]
            if index == 2:
                values += [
                    ("imaging.side", "Сторона · заключение A", "left", None),
                    ("imaging.side", "Сторона · заключение B", "right", None),
                ]
            for key, label, value, unit in values:
                source = create_record(
                    db,
                    users["doctor"],
                    "source",
                    {
                        "name": "Синтетическая карта · " + label,
                        "type": "manual",
                        "text": f"{label}: {value} {unit or ''}\nУчебные синтетические данные. Не клиническая рекомендация.",
                        "pages": [],
                        "limitations": ["SYNTHETIC_DATA"],
                    },
                    case,
                )
                create_record(
                    db,
                    users["doctor"],
                    "fact",
                    {
                        "key": key,
                        "label": label,
                        "value": value,
                        "unit": unit,
                        "source_id": source.id,
                        "span": "form:" + key,
                        "assertion": "present",
                        "provenance": "manual",
                        "confirmed": True,
                        "event_time": timestamp,
                        "available_time": timestamp,
                        "order_status": "active"
                        if key.startswith("medication")
                        else "not_applicable",
                    },
                    case,
                )
        db.commit()


def seed():
    from .config import settings

    if not settings.demo_mode:
        return
    if settings.seed_profile == "minimal":
        seed_minimal()
    else:
        from .demo_seed import seed_realistic

        seed_realistic()


if __name__ == "__main__":
    seed()
