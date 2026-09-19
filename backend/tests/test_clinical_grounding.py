"""Reject plausible-looking but unsupported clinical model output before publication."""
import copy
import json

import pytest

from app import ai, clinical_ai, llama_adapter, patient_workspace_ai
from app.config import settings


def snapshot():
    return {
        'version': 4, 'age': 52, 'sex': 'unknown', 'evaluated_conclusion_id': 'doctor-note',
        'entries': [
            {'id': 'exam', 'category': 'objective', 'text': 'Pulse 72 /min.', 'source_id': 'exam-source'},
            {'id': 'doctor-note', 'category': 'doctor_conclusion', 'text': 'Follow-up requires examination.',
             'diagnosis': '', 'treatment': '', 'source_id': None},
        ],
        'facts': [
            {'id': 'oxygen', 'source_id': 'oximetry-source', 'key': 'vital.spo2', 'label': 'SpO2',
             'value': '98', 'unit': '%', 'confirmed': True, 'assertion': 'present',
             'event_time': '2026-09-01T10:00:00+05:00', 'available_time': '2026-09-01T10:05:00+05:00'},
            {'id': 'order', 'source_id': 'order-source', 'key': 'medication.substance', 'label': 'Medication',
             'value': 'Documented substance', 'confirmed': True, 'assertion': 'present', 'order_status': 'stopped',
             'event_time': '2026-08-01T10:00:00+05:00', 'available_time': '2026-08-01T10:05:00+05:00'},
        ],
    }


def comparison():
    return {
        'case_version': 4, 'status': 'insufficient_data',
        'summary': 'В записи указан пульс 72 /min.',
        'diagnosis_review': {'status': 'insufficient_data', 'summary': 'Для заключения нужен дополнительный осмотр.', 'refs': ['E1', 'E2']},
        'treatment_review': {'status': 'insufficient_data', 'summary': 'Текущая схема лечения не описана.', 'refs': ['E2']},
        'supporting': [{'text': 'Пульс 72 /min.', 'refs': ['E1']}],
        'discrepancies': [], 'questions': ['Какая схема лечения назначена сейчас?'],
        'next_steps': ['Уточнить данные осмотра.'],
        'five_year_outlook': {'status': 'insufficient_data', 'summary': 'Данных для долгосрочных сценариев недостаточно.', 'scenarios': []},
        'limitations': ['Клиническая валидация модели не выполнена; заключение проверяет врач.'],
    }


def validate(result):
    data = snapshot()
    return patient_workspace_ai.validate_comparison(result, data, patient_workspace_ai.evidence_context(data))


def test_grounded_comparison_preserves_documented_measurements():
    result = comparison()
    assert validate(result) is result


@pytest.mark.parametrize('block', ['diagnosis_review', 'treatment_review', 'supporting', 'discrepancies'])
def test_measurements_cannot_be_invented_outside_the_top_summary(block):
    result = comparison()
    if block in ('diagnosis_review', 'treatment_review'):
        result[block]['summary'] = 'Температура 42 градуса.'
    else:
        result[block] = [{'text': 'Температура 42 градуса.', 'refs': ['E1', 'E2']}]
    with pytest.raises(ValueError, match='Unsupported numeric observation in cited review'):
        validate(result)


def test_real_number_from_an_uncited_observation_cannot_validate_wrong_citation():
    result = comparison()
    # 98 is present in F1, but absent from E1. Chart-wide number checking misses it.
    result['supporting'] = [{'text': 'Пульс 98 /min.', 'refs': ['E1']}]
    with pytest.raises(ValueError, match='Unsupported numeric observation in cited review'):
        validate(result)


def test_explicit_observation_date_is_not_rejected_as_an_invented_number():
    result = comparison()
    result['summary'] = 'В записи от 2026-09-01 SpO2 98%.'
    result['supporting'] = [{'text': 'В записи от 2026-09-01 SpO2 98%.', 'refs': ['F1']}]
    assert validate(result) is result


def test_doctors_hypothesis_is_not_its_own_supporting_patient_evidence():
    result = comparison()
    result['supporting'] = [{'text': 'Заключение врача подтверждает гипотезу.', 'refs': ['E2']}]
    with pytest.raises(ValueError, match='patient observations'):
        validate(result)


def test_comparison_rejects_unsupported_patient_sex():
    result = comparison()
    result['summary'] = 'Мужчина с пульсом 72 /min.'
    with pytest.raises(ValueError, match='unsupported patient sex'):
        validate(result)


def test_partial_abstention_still_requires_an_actionable_question():
    result = comparison()
    result['questions'] = []
    with pytest.raises(ValueError, match='clarification question'):
        validate(result)


def test_citations_cannot_repeat_to_appear_better_supported():
    result = comparison()
    result['supporting'][0]['refs'] = ['E1', 'E1']
    with pytest.raises(ValueError, match='distinct'):
        validate(result)


def test_comparison_preserves_timing_and_stopped_orders_and_corrects_bad_output_once(monkeypatch):
    monkeypatch.setattr(settings, 'ai_backend', 'llama_cpp')
    monkeypatch.setattr(ai, 'model_status', lambda: {'ready': True})
    calls = []

    def complete(messages, schema, **kwargs):
        calls.append(copy.deepcopy(messages))
        result = comparison()
        if len(calls) == 1:
            result['supporting'][0]['text'] = 'Недостоверная температура 42.'
        return json.dumps({key: value for key, value in result.items() if key in schema['properties']}, ensure_ascii=False)

    monkeypatch.setattr(llama_adapter, 'complete', complete)
    result = patient_workspace_ai.review(snapshot(), 'ru')
    assert len(calls) == 3
    assert 'Unsupported numeric observation in cited review' in calls[1][1]['content']
    assert 'Недостоверная температура' not in calls[1][1]['content']
    context = json.loads(calls[0][1]['content'].split('UNTRUSTED PATIENT DATA\n')[1].split('\nEND DATA')[0])
    medication = context['evidence'][-1]
    assert context['available_categories'] == {
        'objective': ['E1'], 'doctor_conclusion': ['E2'], 'confirmed_fact': ['F1', 'F2'],
    }
    assert 'An incomplete evaluation' in calls[0][0]['content']
    assert medication['order_status'] == 'stopped'
    assert medication['event_time'] == '2026-08-01T10:00:00+05:00'
    assert medication['available_time'] == '2026-08-01T10:05:00+05:00'
    assert not any(key in medication for key in ('source_id', 'fact_id', 'author_name'))
    assert result['supporting'][0]['text'] == comparison()['supporting'][0]['text']


def test_failed_correction_is_failure_and_never_returns_a_fabricated_diagnosis(monkeypatch):
    monkeypatch.setattr(settings, 'ai_backend', 'llama_cpp')
    monkeypatch.setattr(ai, 'model_status', lambda: {'ready': True})
    bad = comparison()
    bad['supporting'] = [{'text': 'Гипотеза подтверждена самим заключением.', 'refs': ['E2']}]
    calls = []

    def complete(messages, schema, **kwargs):
        calls.append(True)
        return json.dumps({key: value for key, value in bad.items() if key in schema['properties']})

    monkeypatch.setattr(llama_adapter, 'complete', complete)
    with pytest.raises(ai.ModelUnavailable, match='MODEL_OUTPUT_REJECTED'):
        patient_workspace_ai.review(snapshot())
    assert len(calls) == 2


def test_incomplete_model_response_retries_once_with_compact_complete_schema(monkeypatch):
    monkeypatch.setattr(settings, 'ai_backend', 'llama_cpp')
    monkeypatch.setattr(settings, 'max_new_tokens', 768)
    monkeypatch.setattr(ai, 'model_status', lambda: {'ready': True})
    calls = []

    def complete(messages, schema, **kwargs):
        calls.append((messages, schema, kwargs))
        if len(calls) == 1:
            raise ai.ModelUnavailable('MODEL_OUTPUT_INCOMPLETE')
        return json.dumps({key: value for key, value in comparison().items() if key in schema['properties']})

    monkeypatch.setattr(llama_adapter, 'complete', complete)
    result = patient_workspace_ai.review(snapshot())
    assert result['summary'] == comparison()['summary']
    assert len(calls) == 3
    assert all(call[2]['max_tokens'] == 1800 for call in calls)
    assert calls[1][1]['properties']['summary']['maxLength'] < calls[0][1]['properties']['summary']['maxLength']
    assert calls[1][1]['properties']['supporting']['maxItems'] == 1
    assert set(calls[1][1]['required']) == set(calls[0][1]['required'])
    assert 'output budget' in calls[1][0][1]['content']


@pytest.mark.parametrize('code,attempts', [('MODEL_OUTPUT_INCOMPLETE', 2), ('MODEL_TIMEOUT', 1)])
def test_incomplete_retry_is_bounded_and_unrelated_runtime_failures_are_not_retried(monkeypatch, code, attempts):
    monkeypatch.setattr(settings, 'ai_backend', 'llama_cpp')
    monkeypatch.setattr(ai, 'model_status', lambda: {'ready': True})
    calls = []

    def complete(*args, **kwargs):
        calls.append(True)
        raise ai.ModelUnavailable(code)

    monkeypatch.setattr(llama_adapter, 'complete', complete)
    with pytest.raises(ai.ModelUnavailable, match=code):
        patient_workspace_ai.review(snapshot())
    assert len(calls) == attempts


@pytest.mark.parametrize('command', ['Назначить лекарственные препараты.', 'Начать терапию.',
                                   'Increase the medication dose.', 'Dorilarni buyuring.'])
def test_next_steps_do_not_turn_abstention_into_a_new_prescription(command):
    result = comparison()
    result['next_steps'] = [command]
    with pytest.raises(ValueError, match='not prescribe'):
        validate(result)


def test_documentation_question_about_existing_prescription_is_allowed():
    result = comparison()
    result['next_steps'] = ['Уточнить, кто решил назначить препарат и где записано назначение.']
    assert validate(result) is result


def test_repeated_narrative_cannot_masquerade_as_distinct_review_sections():
    result = comparison()
    repeated = 'Врач отмечает стабильность состояния на фоне наблюдения и отсутствие текущих жалоб.'
    result['summary'] = repeated
    result['diagnosis_review']['summary'] = repeated
    result['treatment_review']['summary'] = repeated
    with pytest.raises(ValueError, match='not repeat the patient narrative'):
        validate(result)


def test_retry_schema_leaves_room_for_complete_questions_and_review_sentences():
    data = snapshot()
    schema = patient_workspace_ai.output_schema(data, patient_workspace_ai.evidence_context(data), compact=True)
    assert schema['$defs']['ReviewSection']['properties']['summary']['maxLength'] >= 300
    assert schema['properties']['questions']['items']['maxLength'] >= 200
    assert schema['properties']['questions']['maxItems'] == 1


def test_actual_same_sentence_documented_dose_and_missing_dose_is_rejected():
    data = snapshot()
    data['entries'][1]['treatment'] = 'В истории записан прием амлодипина 5 мг в день.'
    result = comparison()
    result['treatment_review'] = {
        'status': 'insufficient_data', 'refs': ['E1', 'E2'],
        'summary': 'Врач указывает на прием амлодипина 5 мг в день, но не предоставляет информации о переносимости или дозировке.',
    }
    with pytest.raises(ValueError, match='quotes a documented dose'):
        patient_workspace_ai.validate_comparison(result, data, patient_workspace_ai.evidence_context(data))


@pytest.mark.parametrize('text', [
    'Указан прием амлодипина 5 мг в день, но не предоставлена информация о переносимости.',
    'Указан прием амлодипина 5 мг в день, но не указана дозировка лизиноприла.',
    'Указан прием амлодипина 5 мг в день, но о лизиноприле не предоставлены данные о дозировке.',
    'Не предоставлены данные о дозировке препарата.',
])
def test_dose_guard_does_not_assume_other_treatment_details_are_known(text):
    assert not patient_workspace_ai.contradictory_dose_claim(text)


def test_diagnostic_follow_up_questions_cannot_be_duplicates_or_statements():
    result = {'summary': 'Наблюдение требует проверки.', 'limitations': ['Проверяет врач.'],
              'assessment': {'status': 'insufficient_data', 'differential': [],
                             'questions': ['Что показал осмотр?', 'Что показал осмотр?']}}
    assert clinical_ai.presentation_issues(result)
    result['assessment']['questions'] = ['Недостаточно данных.']
    assert clinical_ai.presentation_issues(result)
    result['assessment']['questions'] = ['Что показал осмотр?']
    assert not clinical_ai.presentation_issues(result)


def test_comparison_phases_keep_original_evidence_and_do_not_promote_generated_diagnosis(monkeypatch):
    monkeypatch.setattr(settings, 'ai_backend', 'llama_cpp')
    monkeypatch.setattr(ai, 'model_status', lambda: {'ready': True})
    calls = []
    authored = comparison()
    authored['diagnosis_review']['summary'] = 'Уникальная сформулированная моделью гипотеза требует проверки.'

    def complete(messages, schema, **kwargs):
        calls.append((copy.deepcopy(messages), schema))
        return json.dumps({key: value for key, value in authored.items() if key in schema['properties']})

    monkeypatch.setattr(llama_adapter, 'complete', complete)
    result = patient_workspace_ai.review(snapshot())
    assert len(calls) == 2
    assert list(calls[0][1]['properties']) == ['case_version', 'supporting', 'discrepancies', 'diagnosis_review', 'summary']
    assert set(calls[1][1]['properties']) == set(patient_workspace_ai.TreatmentPass.model_fields)
    assert 'FiveYearOutlook' not in calls[0][1]['$defs']
    assert 'CitedObservation' not in calls[1][1]['$defs']
    assert (calls[0][0][1]['content'].split('END DATA.')[0] ==
            calls[1][0][1]['content'].split('END DATA.')[0])
    assert authored['diagnosis_review']['summary'] not in calls[1][0][1]['content']
    assert result['diagnosis_review']['summary'] == authored['diagnosis_review']['summary']
    assert set(patient_workspace_ai.ComparisonResult.model_fields) <= set(result)


def test_treatment_phase_failure_cannot_return_partial_diagnostic_success(monkeypatch):
    monkeypatch.setattr(settings, 'ai_backend', 'llama_cpp')
    monkeypatch.setattr(ai, 'model_status', lambda: {'ready': True})
    calls = []

    def complete(messages, schema, **kwargs):
        calls.append(schema['title'])
        output = comparison()
        output['questions'] = []
        return json.dumps({key: value for key, value in output.items() if key in schema['properties']})

    monkeypatch.setattr(llama_adapter, 'complete', complete)
    with pytest.raises(ai.ModelUnavailable, match='MODEL_OUTPUT_REJECTED'):
        patient_workspace_ai.review(snapshot())
    assert calls == ['DiagnosisPass', 'TreatmentPass', 'TreatmentPass']
    assert not ai._lock.locked()


def test_each_phase_can_repair_once_without_erasing_prior_guarded_work(monkeypatch):
    monkeypatch.setattr(settings, 'ai_backend', 'llama_cpp')
    monkeypatch.setattr(ai, 'model_status', lambda: {'ready': True})
    calls = []

    def complete(messages, schema, **kwargs):
        calls.append(schema['title'])
        output = comparison()
        if len(calls) == 1:
            output['supporting'][0]['refs'] = ['E999']
        elif len(calls) == 3:
            output['questions'] = []
        return json.dumps({key: value for key, value in output.items() if key in schema['properties']})

    monkeypatch.setattr(llama_adapter, 'complete', complete)
    result = patient_workspace_ai.review(snapshot())
    assert calls == ['DiagnosisPass', 'DiagnosisPass', 'TreatmentPass', 'TreatmentPass']
    assert result['questions'] == comparison()['questions']
    assert result['supporting'] == comparison()['supporting']


def test_phase_repair_consumes_shared_time_budget_instead_of_resetting_it(monkeypatch):
    monkeypatch.setattr(settings, 'ai_backend', 'llama_cpp')
    monkeypatch.setattr(settings, 'inference_timeout_seconds', 150)
    monkeypatch.setattr(ai, 'model_status', lambda: {'ready': True})
    clock = [0.0]
    budgets = []
    monkeypatch.setattr(patient_workspace_ai, 'monotonic', lambda: clock[0])

    def complete(messages, schema, **kwargs):
        budgets.append(kwargs['timeout_seconds'])
        output = comparison()
        if len(budgets) == 1:
            output['supporting'][0]['refs'] = ['E999']
            clock[0] += 140
        elif len(budgets) == 2:
            clock[0] += 130
        else:
            clock[0] += 20
        return json.dumps({key: value for key, value in output.items() if key in schema['properties']})

    monkeypatch.setattr(llama_adapter, 'complete', complete)
    assert patient_workspace_ai.review(snapshot())['questions'] == comparison()['questions']
    assert budgets == [150, 150, 30]


def test_shared_budget_expiration_does_not_retry_or_publish_a_late_result(monkeypatch):
    monkeypatch.setattr(settings, 'ai_backend', 'llama_cpp')
    monkeypatch.setattr(settings, 'inference_timeout_seconds', 150)
    monkeypatch.setattr(ai, 'model_status', lambda: {'ready': True})
    clock = [0.0]
    calls = []
    monkeypatch.setattr(patient_workspace_ai, 'monotonic', lambda: clock[0])

    def complete(messages, schema, **kwargs):
        calls.append(schema['title'])
        clock[0] = 301
        return json.dumps({key: value for key, value in comparison().items() if key in schema['properties']})

    monkeypatch.setattr(llama_adapter, 'complete', complete)
    with pytest.raises(ai.ModelUnavailable, match='MODEL_TIMEOUT'):
        patient_workspace_ai.review(snapshot())
    assert calls == ['DiagnosisPass']
    assert not ai._lock.locked()


def test_echoing_doctors_diagnoses_is_not_a_specific_cited_discrepancy():
    output = comparison()
    output['diagnosis_review'].update(status='needs_review', summary='Врач исключил активный туберкулёз, но диагностировал внебольничную пневмонию.')
    with pytest.raises(ValueError, match='requires a specific cited discrepancy'):
        validate(output)


def test_needs_review_must_cite_the_finding_that_supports_its_discrepancy():
    output = comparison()
    output['diagnosis_review']['status'] = 'needs_review'
    output['discrepancies'] = [{'text': 'Наблюдение расходится с заключением врача.', 'refs': ['F1', 'E2']}]
    with pytest.raises(ValueError, match='support its specific discrepancy'):
        validate(output)


def test_needs_review_accepts_specific_finding_and_conclusion_comparison():
    data = snapshot()
    data['entries'][1]['text'] = 'Пульс не измеряли.'
    output = comparison()
    output['diagnosis_review'].update(status='needs_review', summary='Врач пишет, что пульс не измеряли, хотя в осмотре записан пульс 72 /min.')
    output['discrepancies'] = [{'text': 'Отрицание измерения пульса противоречит записанному значению 72 /min.', 'refs': ['E1', 'E2']}]
    assert patient_workspace_ai.validate_comparison(output, data, patient_workspace_ai.evidence_context(data)) is output


@pytest.mark.parametrize('text,refs', [
    ('E5da dori rejasi hujjatlashtirilmagan.', ['E1', 'E2', 'E3', 'E4']),
    ('E1-E4 record observations.', ['E1', 'E3', 'E4', 'E5']),
    ('E1–E4 dagi ma’lumotlar.', ['E1', 'E3', 'E4', 'E5']),
    ('E1—4 describe observations.', ['E1', 'E3', 'E4', 'E5']),
    ('The observation is in F2.', ['F1']),
])
def test_inline_source_citations_must_be_in_the_same_blocks_refs(text, refs):
    with pytest.raises(ValueError, match='Inline evidence'):
        patient_workspace_ai.validate_inline_references(text, refs)


@pytest.mark.parametrize('text,refs', [
    ('E5da dori rejasi hujjatlashtirilmagan.', ['E5']),
    ('E1-E4 record observations.', ['E1', 'E2', 'E3', 'E4']),
    ('See F1–F3.', ['F1', 'F2', 'F3']),
    ('ICD-10: E11; other source is E2.', ['E2']),
    ('МКБ-10 E11 и код E11.9 записаны в источнике.', []),
])
def test_complete_inline_source_ranges_and_explicit_diagnostic_codes_are_allowed(text, refs):
    patient_workspace_ai.validate_inline_references(text, refs)


def test_actual_uzbek_missing_conclusion_citation_is_rejected_even_for_insufficient_data():
    output = comparison()
    output['treatment_review'].update(summary='E2da dori rejasi hujjatlashtirilmagan.', refs=['E1'])
    with pytest.raises(ValueError, match='Inline evidence reference is missing'):
        validate(output)


def test_oversized_and_reversed_inline_ranges_are_bounded_and_rejected():
    for text in ('E1-E9999999999', 'E5-E1', 'E1-F2'):
        with pytest.raises(ValueError, match='Inline evidence range'):
            patient_workspace_ai.validate_inline_references(text, ['E1', 'E2'])


@pytest.mark.parametrize('remote,limit', [(False, 4), (True, 8)])
def test_generation_reference_limit_respects_provider_capacity_and_public_schema(monkeypatch, remote, limit):
    from app import ai_provider
    monkeypatch.setattr(ai_provider, 'is_openai', lambda: remote)
    data = snapshot()
    schema = patient_workspace_ai.output_schema(data, patient_workspace_ai.evidence_context(data))
    assert schema['$defs']['ReviewSection']['properties']['refs']['maxItems'] == limit
    assert schema['$defs']['CitedObservation']['properties']['refs']['maxItems'] == limit
    assert schema['$defs']['OutlookScenario']['properties']['refs']['maxItems'] == limit


def test_openai_review_can_cite_all_five_sources_instead_of_omitting_conclusion(monkeypatch):
    from app import ai_provider
    monkeypatch.setattr(ai_provider, 'is_openai', lambda: True)
    monkeypatch.setattr(ai, 'model_status', lambda: {'ready': True})
    data = snapshot()
    data['entries'].append({'id': 'lab', 'category': 'laboratory', 'text': 'A documented laboratory observation.'})
    output = comparison()
    output['treatment_review'].update(
        summary='В E1-E3 и F1-F2 не описана текущая схема лечения.',
        refs=['E1', 'E2', 'E3', 'F1', 'F2'],
    )

    def complete(messages, schema, **kwargs):
        if 'treatment_review' in schema['properties']:
            assert len(output['treatment_review']['refs']) <= schema['$defs']['ReviewSection']['properties']['refs']['maxItems']
        return json.dumps({key: value for key, value in output.items() if key in schema['properties']})

    monkeypatch.setattr(ai_provider, 'complete', complete)
    result = patient_workspace_ai.review(data)
    assert result['treatment_review']['refs'] == ['E1', 'E2', 'E3', 'F1', 'F2']
