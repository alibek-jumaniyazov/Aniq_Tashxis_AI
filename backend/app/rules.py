from datetime import datetime

RULE_VERSION = 'demo-2026.09.18'
CATALOG = [
    {'id': 'DOC-SIDE-01', 'name': 'Cross-document laterality', 'approval_status': 'demo_only', 'required_fields': ['imaging.side'], 'source': 'Synthetic engineering fixture, not a clinical guideline', 'version': RULE_VERSION},
    {'id': 'DEMO-ALLERGY-01', 'name': 'Documented substance overlap', 'approval_status': 'demo_only', 'required_fields': ['allergy.substance', 'medication.substance'], 'source': 'Synthetic engineering fixture, not a clinical guideline', 'version': RULE_VERSION},
    {'id': 'DEMO-LAB-01', 'name': 'Fixture laboratory completeness', 'approval_status': 'demo_only', 'required_fields': ['lab.potassium'], 'source': 'Completeness check only; no clinical threshold', 'version': RULE_VERSION},
]


def review_snapshot(snapshot, mode, cutoff):
    facts = snapshot['facts']
    skipped, alerts, completed = [], [], []
    eligible = []
    for fact in facts:
        if not fact.get('confirmed'):
            continue
        if mode == 'decision_time':
            available = fact.get('available_time')
            if not available:
                skipped.append({'check_id': 'temporal_eligibility', 'reason_code': 'UNKNOWN_AVAILABLE_TIME', 'missing_fields': [fact['id'] + '.available_time']})
                continue
            if datetime.fromisoformat(available) > datetime.fromisoformat(cutoff):
                continue
            if fact.get('event_time') and datetime.fromisoformat(fact['event_time']) > datetime.fromisoformat(cutoff):
                continue
        eligible.append(fact)

    def matching(key):
        return [f for f in eligible if f['key'] == key and f.get('assertion') == 'present' and f.get('value') is not None and str(f['value']).strip()]

    def alert(rule_id, title, description, severity, evidence):
        alerts.append({'rule_id': rule_id, 'rule_version': RULE_VERSION, 'title': title, 'description': description, 'severity': severity, 'source_ids': list(dict.fromkeys(f['source_id'] for f in evidence)), 'fact_ids': [f['id'] for f in evidence], 'status': 'new', 'demo_only': True, 'missing_fields': [], 'suggested_action': 'review_source', 'applicability': 'Synthetic M0 demonstration; clinician confirmation required.'})

    if not snapshot.get('demo') or not snapshot.get('age') or snapshot['age'] < 18:
        return {'completed': [], 'not_evaluable': [{'check_id': 'population', 'reason_code': 'OUTSIDE_DEMO_SCOPE', 'missing_fields': []}]}, []
    sides = matching('imaging.side')
    if len(sides) >= 2:
        completed.append('DOC-SIDE-01')
        if len({str(f['value']).lower().strip() for f in sides}) > 1:
            alert('DOC-SIDE-01', 'Несовпадение стороны в документах', 'Подтверждённые источники указывают разные стороны. Проверьте исходные записи.', 'documentation_clarification', sides)
    else:
        skipped.append({'check_id': 'DOC-SIDE-01', 'reason_code': 'MISSING_REQUIRED_FIELD', 'missing_fields': ['two_imaging_side_sources']})
    allergy = matching('allergy.substance')
    medication = [f for f in matching('medication.substance') if f.get('order_status') == 'active']
    if allergy and medication:
        completed.append('DEMO-ALLERGY-01')
        for a in allergy:
            for m in medication:
                if str(a['value']).strip().casefold() == str(m['value']).strip().casefold():
                    alert('DEMO-ALLERGY-01', 'Совпадение вещества в аллергии и назначении', 'В синтетическом примере одно вещество указано в подтверждённой аллергии и активном назначении. Требуется проверка врача.', 'potential_serious_risk', [a, m])
    else:
        skipped.append({'check_id': 'DEMO-ALLERGY-01', 'reason_code': 'MISSING_REQUIRED_FIELD', 'missing_fields': ['allergy.substance', 'active_medication.substance']})
    labs = matching('lab.potassium')
    if labs and all(f.get('unit') for f in labs):
        completed.append('DEMO-LAB-01')
    else:
        skipped.append({'check_id': 'DEMO-LAB-01', 'reason_code': 'MISSING_REQUIRED_FIELD', 'missing_fields': ['lab.potassium.value_or_unit']})
    skipped.append({'check_id': 'clinical_lab_restriction', 'reason_code': 'APPROVED_RULE_CATALOG_REQUIRED', 'missing_fields': []})
    return {'completed': completed, 'not_evaluable': skipped}, alerts
