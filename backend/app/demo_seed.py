"""Realistic, reproducible synthetic workspace. Never overwrites an existing database."""
from collections import Counter
from datetime import timedelta
import hashlib
import json
from sqlalchemy import select
from .config import ROOT, settings
from .db import Audit, Case, CaseAccess, Job, Record, SessionLocal, User, now, uid
from .demo_catalog import EPISODES, INCIDENTS, STAFF
from .documents import extract
from .rules import RULE_VERSION, review_snapshot
from .security import create_record, current_facts, serialize

SEED_VERSION = 'realistic-v1'
TENANT = 'avilab-demo'


def seed_realistic(anchor=None):
    if not settings.demo_mode:
        raise RuntimeError('Synthetic seed requires DEMO_MODE=true')
    anchor = (anchor or now()).replace(microsecond=0)
    from .routes import case_json, password_hasher
    from .seed import DEMO_PASSWORD
    from .files import parse_dicom
    with SessionLocal() as db:
        if db.scalar(select(User).limit(1)):
            return False
        # A single transaction commits the entire graph. The reset CLI stages files
        # and this transaction in a separate directory before touching the live DB.
        users = {}
        password_hash = password_hasher.hash(DEMO_PASSWORD)
        for role, name in STAFF.items():
            user = User(tenant_id=TENANT, email=f'{role}@demo.aniq', name=name, role=role, password_hash=password_hash)
            db.add(user)
            db.flush()
            users[role] = user
        other = User(tenant_id='other-demo', email='other@demo.aniq', name='Другой демо-центр', role='doctor', password_hash=password_hash)
        db.add(other)
        db.flush()
        db.add(Case(tenant_id=other.tenant_id, owner_id=other.id, alias='ISOLATED-001', age=45, sex='female', summary='Изолированный синтетический случай другого центра.', demo=True, created_at=anchor - timedelta(days=3), updated_at=anchor - timedelta(days=3)))

        def audit(actor, action, resource, at):
            db.add(Audit(tenant_id=actor.tenant_id, actor_id=actor.id, action=action, resource_id=resource, created_at=at))

        def record(kind, data, case, at, role='doctor', version=None, action=None):
            r = create_record(db, users[role], kind, data, case, version)
            r.created_at = at
            if action:
                audit(users[role], action, r.id, at)
            return r

        def document(case, title, lines, at):
            name = f'{case.alias}-{title}.txt'
            content = ('СИНТЕТИЧЕСКИЕ ДАННЫЕ · учебная клиника Avilab\n'
                       f'case_alias={case.alias}\n{title}\n'
                       f'Дата записи: {at.isoformat()}\n' + '\n'.join(lines) +
                       '\nСведения вымышлены. Не использовать для лечения реальных пациентов.\n').encode('utf-8')
            relative = f'{TENANT}/documents/{uid()}.txt'
            path = settings.storage_root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
            parsed = extract(content, name)
            return record('source', {'name': name, 'type': 'txt', **parsed, 'text': content.decode(), 'storage_path': relative, 'extraction_method': 'authored_synthetic_fixture', 'limitations': ['SYNTHETIC_DATA'], 'identity_confirmed_by': users['doctor'].id}, case, at, action='document.imported')

        def fact(case, source, spec, at, confirmed=True, **extra):
            key, label, value, unit = spec
            quote = f'{label}: {value if value is not None else "не указано"}{" " + unit if unit else ""}'
            page = next(p for p in source.data['pages'] if quote in p['text'])
            offset = page['text'].index(quote)
            return record('fact', {'key': key, 'label': label, 'value': value, 'unit': unit, 'source_id': source.id, 'span': f'page:{page["page"]}:chars:{offset}-{offset + len(quote)}', 'provenance': 'document', 'assertion': 'present' if value is not None else 'not_documented', 'confirmed': confirmed, 'event_time': at.isoformat(), 'available_time': at.isoformat(), 'order_status': 'active' if key == 'medication.substance' else 'not_applicable', **extra}, case, at + timedelta(minutes=2), action='fact.confirmed' if confirmed else 'fact.drafted')

        def analysis(case, at, mode='current', cutoff=None):
            snapshot = {**case_json(case), 'facts': current_facts(db, case.id), 'notes': [serialize(r) for r in db.scalars(select(Record).where(Record.case_id == case.id, Record.kind == 'note'))]}
            coverage, candidates = review_snapshot(snapshot, mode, cutoff)
            job = Job(tenant_id=TENANT, case_id=case.id, actor_id=users['doctor'].id, case_version=case.version, status='partial', stage='complete', payload={'snapshot': snapshot, 'mode': mode, 'decision_time': cutoff, 'include_ai': False}, created_at=at, started_at=at + timedelta(seconds=1), finished_at=at + timedelta(seconds=2), result={})
            db.add(job)
            db.flush()
            alerts = [record('alert', {**item, 'run_id': job.id}, case, at + timedelta(seconds=2)) for item in candidates]
            job.result = {'coverage': coverage, 'alert_ids': [a.id for a in alerts], 'ai': None, 'limitations': ['AI_NOT_REQUESTED'], 'rule_catalog_version': RULE_VERSION, 'seed_version': SEED_VERSION}
            record('notification', {'run_id': job.id, 'status': 'partial', 'read_by': [users['doctor'].id] if at < anchor - timedelta(days=2) else [], 'signature': hashlib.sha256(job.id.encode()).hexdigest()}, case, at + timedelta(seconds=3))
            audit(users['doctor'], 'analysis.completed', job.id, at + timedelta(seconds=2))
            return alerts

        phantom = parse_dicom((ROOT / 'demo' / 'synthetic-phantom.zip').read_bytes())
        cases, incidents = {}, {}
        # New admissions appear first, followed by active reviews and completed episodes.
        days_ago = [8, 9, 7, 0, 6, 5, 2, 1, 10, 4, 3, 2, 11, 4, 1, 0, 0, 1]
        for index, (age, sex, complaint, diagnosis, scenario, pulse, spo2, potassium) in enumerate(EPISODES):
            start = anchor - timedelta(days=days_ago[index], hours=12, minutes=index * 3)
            case = Case(tenant_id=TENANT, owner_id=users['doctor'].id, alias=f'AT-{anchor:%y%m}-{index + 1:03d}', age=age, sex=sex, summary=complaint, diagnosis=diagnosis, demo=True, version=1, created_at=start, updated_at=start)
            db.add(case)
            db.flush()
            cases[index] = case
            for role in ['expert', 'quality', 'sender'] + (['radiologist'] if scenario == 'side' else []):
                db.add(CaseAccess(case_id=case.id, user_id=users[role].id))
            audit(users['doctor'], 'case.created', case.id, start)
            observations = [('symptom.complaint', 'Жалобы', complaint, None), ('vital.pulse', 'Пульс', str(pulse), '/min'), ('vital.spo2', 'Сатурация', str(spo2), '%')]
            intake = document(case, 'Первичный приём', [f'{label}: {value}{" " + unit if unit else ""}' for _, label, value, unit in observations] + [f'Возраст: {age}', 'Пол: ' + ('мужской' if sex == 'male' else 'женский')], start)
            case.version = 2
            for spec in observations:
                fact(case, intake, spec, start, confirmed=scenario not in {'intake', 'import'})
            record('note', {'text': complaint + ' ' + diagnosis + '. Источники привязаны к эпизоду, идентификатор сверён.', 'note_type': 'decision_rationale', 'provenance': 'manual', 'event_time': start.isoformat()}, case, start + timedelta(minutes=5), action='note.created')
            at = start + timedelta(minutes=30)
            case.version = 3
            if potassium:
                unit = None if scenario == 'revision' else 'mmol/L'
                lab = document(case, 'Лабораторный бланк', [f'Калий: {potassium}' + (' mmol/L' if unit else ''), 'Материал: сыворотка; значения вымышлены для демонстрации.'], at)
                available = None if scenario == 'unknown_time' else (at + timedelta(hours=3) if scenario == 'late' else at).isoformat()
                old = fact(case, lab, ('lab.potassium', 'Калий', potassium, unit), at, confirmed=scenario != 'import', available_time=available)
                if scenario == 'revision':
                    analysis(case, start + timedelta(hours=1))
                    case.version = 4
                    correction = document(case, 'Уточнённый лабораторный бланк', [f'Калий: {potassium} mmol/L', 'Уточнение: восстановлена единица измерения по исходному бланку.'], start + timedelta(hours=2))
                    fact(case, correction, ('lab.potassium', 'Калий', potassium, 'mmol/L'), start + timedelta(hours=2), supersedes=old.id)
            if scenario in {'allergy', 'cancelled'}:
                substance = 'Амоксициллин' if index % 2 == 0 else 'Кларитромицин'
                for key, label, title in [('allergy.substance', 'Вещество в аллергологическом анамнезе', 'Лист аллергологического анамнеза'), ('medication.substance', 'Вещество в листе назначений', 'Лист назначений')]:
                    src = document(case, title, [f'{label}: {substance}', 'Статус назначения: ' + ('отменено' if scenario == 'cancelled' else 'активно') if key.startswith('medication') else 'Запись анамнеза подтверждена по синтетическому источнику.'], at)
                    fact(case, src, (key, label, substance, None), at, **({'order_status': 'cancelled'} if scenario == 'cancelled' and key.startswith('medication') else {}))
            elif scenario == 'complete':
                src = document(case, 'Уточнение анамнеза', ['Аллергия: отрицает', 'Со слов пациента; запись проверена врачом.'], at)
                fact(case, src, ('allergy.substance', 'Аллергия', 'отрицает', None), at, assertion='absent')
            if scenario == 'side':
                for title, side in [('Направление на исследование', 'left'), ('Текст заключения', 'right')]:
                    src = document(case, title, [f'Сторона: {side}', 'Вымышленный текст для сверки документов. Не является описанием прикреплённого DICOM-фантома.'], at)
                    fact(case, src, ('imaging.side', 'Сторона', side, None), at)
                study = record('study', {'name': 'CT · синтетический фантом · ' + case.alias, 'series': [], 'analysis_status': 'unavailable', 'reason': 'VALIDATED_CT_MODEL_NOT_CONFIGURED', 'mask_available': False, 'synthetic_phantom': True, 'deidentified_confirmed_by': users['radiologist'].id}, case, at, role='radiologist', action='imaging.imported')
                metadata = []
                for series_uid, instances in phantom.items():
                    series_id = uid()
                    for i, item in enumerate(instances):
                        path = settings.storage_root / TENANT / study.id / series_id / f'{i}.dcm'
                        path.parent.mkdir(parents=True, exist_ok=True)
                        path.write_bytes(item['raw'])
                    first = instances[0]
                    metadata.append({'id': series_id, 'uid': series_uid, 'count': len(instances), **{k: first[k] for k in ['orientation', 'spacing', 'rows', 'columns']}, 'positions': [i['position'] for i in instances]})
                study.data = {**study.data, 'series': metadata}
                if index in {1, 2, 13}:
                    record('imaging_review', {'study_id': study.id, 'status': 'clarified', 'comment': 'Просмотрен технический синтетический фантом: 12 последовательных срезов, геометрия согласована. Клиническое заключение по этому изображению не формируется. Расхождение стороны проверяется по текстовым источникам отдельно.', 'review_scope': 'clinician_visual_review_no_ai_finding'}, case, start + timedelta(hours=1), role='radiologist', action='imaging.reviewed')
            if scenario == 'import':
                connection = record('connection', {'mode': 'demo', 'active': True, 'external_account': 'DEMO-DOCTOR'}, None, start, action='dmed.demo_connected')
                src = record('source', {'name': 'DMED · синтетическая приёмная запись', 'type': 'dmed_demo', 'text': 'Жалобы: контрольное обследование. Внешняя запись требует сверки врачом.', 'pages': [], 'limitations': ['DEMO_INTEGRATION'], 'external_version': 1}, case, at)
                record('import', {'source_id': src.id, 'connection_id': connection.id, 'external_version': 1, 'mode': 'demo', 'status': 'awaiting_confirmation'}, case, at, action='dmed.imported')
            if scenario in {'intake', 'import'}:
                record('note_draft', {'text': 'Уточнить время появления симптомов и сверить единицы в исходном документе до подтверждения фактов.', 'note_type': 'decision_rationale'}, case, start + timedelta(hours=1))
            else:
                case.version += 1
                record('note', {'text': 'Выполнена сверка доступных источников. ' + ('Внешние данные поступили после исходного решения; времена сохранены раздельно.' if scenario == 'late' else diagnosis + '. Проверка правил ограничена демонстрационным каталогом.'), 'note_type': 'alert_response', 'provenance': 'manual', 'event_time': (start + timedelta(hours=3, minutes=45)).isoformat()}, case, start + timedelta(hours=3, minutes=45), action='note.created')
                case.updated_at = start + timedelta(hours=3, minutes=45)
                alerts = analysis(case, start + timedelta(hours=4))
                if scenario in {'late', 'unknown_time'}:
                    analysis(case, start + timedelta(hours=5), mode='decision_time', cutoff=(start + timedelta(hours=1)).isoformat())
                for alert in alerts:
                    states = ['seen', 'accepted', 'closed'] if index in {1, 12} else ['seen', 'accepted'] if index in {0, 2, 13} else ['information_requested'] if index in {6, 17} else []
                    for step, status in enumerate(states):
                        record('review', {'alert_id': alert.id, 'status': status, 'comment': {'seen': 'Исходные записи открыты и сопоставлены.', 'accepted': 'Расхождение передано на независимую оценку; нужна сверка документации.', 'closed': 'Сверка источников завершена, обоснование сохранено в экспертном решении.', 'information_requested': 'Запрошено уточнение исходного документа и актуальности записи.'}[status]}, case, start + timedelta(hours=5, minutes=step * 10), action='alert.' + status)
                        alert.data = {**alert.data, 'status': status}
            if scenario in {'intake', 'import'}:
                case.updated_at = start + timedelta(hours=1)
            if index in INCIDENTS:
                status, reason, explanation = INCIDENTS[index]
                incident = record('incident', {'reason': reason, 'status': 'under_review', 'version': 1, 'decisions': []}, case, start + timedelta(hours=7), role='quality', action='incident.opened')
                decisions = []
                stages = ['confirmed', status] if status in {'closed', 'corrective_actions'} else [status] if status != 'under_review' else []
                for step, stage in enumerate(stages):
                    when = start + timedelta(hours=8, minutes=step * 30)
                    decisions.append({'status': stage, 'explanation': explanation if step == 0 else 'Проверка завершена; ответственному за качество переданы результаты сверки и меры по улучшению заполнения документов.', 'actor_id': users['expert'].id, 'created_at': when.isoformat()})
                    audit(users['expert'], 'incident.' + stage, incident.id, when)
                incident.data = {**incident.data, 'status': status, 'version': 1 + len(decisions), 'decisions': decisions}
                incidents[index] = incident

        for indexes, status, purpose, hours in [([0, 1, 2, 4, 5], 'sent', 'Еженедельный обзор качества документации', 20), ([12, 13], 'approved', 'Повторная проверка завершённых эпизодов', 6), ([0, 4], 'draft', 'Сверка аллергологического и лабораторного разделов', 3)]:
            selected = [incidents[i] for i in indexes]
            at = anchor - timedelta(hours=hours)
            package = {'schema': 'aniqtashxis.aggregate.v1', 'mode': 'demo', 'period': anchor.strftime('%Y-%m'), 'confirmed_cases': len(selected) if len(selected) >= 5 else None, 'small_group_suppressed': len(selected) < 5, 'scope': 'Synthetic quality review demonstration', 'clinical_validation': 'not_validated'}
            digest = hashlib.sha256(json.dumps(package, sort_keys=True).encode()).hexdigest()
            export = record('export', {'purpose': purpose, 'basis': 'Независимые экспертные решения по синтетическим эпизодам; только агрегированные сведения.', 'recipient': 'mock-ministry', 'incident_ids': [r.id for r in selected], 'snapshots': [{'incident_id': r.id, 'version': r.data['version'], 'case_version': r.case_version} for r in selected], 'package': package, 'sha256': digest, 'version': {'draft': 1, 'approved': 2, 'sent': 3}[status], 'status': status, 'approved_by': users['sender'].id if status != 'draft' else None, 'receipt': None}, None, at, role='quality', action='export.created')
            if status != 'draft':
                audit(users['sender'], 'export.approved', export.id, at + timedelta(minutes=15))
            if status == 'sent':
                export.data = {**export.data, 'receipt': {'id': 'DEMO-' + export.id[:8], 'transport': 'mock', 'received_at': (at + timedelta(minutes=30)).isoformat(), 'sha256': digest}}
                audit(users['sender'], 'export.demo_sent', export.id, at + timedelta(minutes=30))
        record('seed_manifest', {'version': SEED_VERSION, 'anchor': anchor.isoformat(), 'synthetic': True, 'clinical_cases': len(cases), 'staff': len(users)}, None, anchor, role='admin', action='demo.seeded')
        db.commit()
    return True


def verify_seed():
    """Check persisted references, source bytes and export freshness before activation."""
    with SessionLocal() as db:
        records = list(db.scalars(select(Record)))
        by_id = {r.id: r for r in records}
        cases = {c.id: c for c in db.scalars(select(Case))}
        for r in records:
            if r.case_id:
                assert r.case_id in cases and r.tenant_id == cases[r.case_id].tenant_id
                assert r.case_version <= cases[r.case_id].version
            if r.kind == 'fact':
                source = by_id[r.data['source_id']]
                assert source.case_id == r.case_id
                if r.data.get('supersedes'):
                    assert by_id[r.data['supersedes']].case_id == r.case_id
            if r.kind == 'source' and r.data.get('storage_path'):
                raw = (settings.storage_root / r.data['storage_path']).read_bytes()
                assert hashlib.sha256(raw).hexdigest() == r.data['sha256']
            if r.kind == 'export':
                assert hashlib.sha256(json.dumps(r.data['package'], sort_keys=True).encode()).hexdigest() == r.data['sha256']
                for snap in r.data['snapshots']:
                    incident = by_id[snap['incident_id']]
                    assert incident.data['version'] == snap['version']
                    assert cases[incident.case_id].version == snap['case_version']
        return {'seed_version': SEED_VERSION, 'users': len(list(db.scalars(select(User)))), 'cases': len(cases), 'records': dict(Counter(r.kind for r in records)), 'analyses': len(list(db.scalars(select(Job)))), 'audit_events': len(list(db.scalars(select(Audit))))}
