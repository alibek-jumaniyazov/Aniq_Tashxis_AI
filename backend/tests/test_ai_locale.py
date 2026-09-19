"""Localized prose must stay grounded and never silently succeed in another language."""
import copy
import json

import pytest

from app import ai, clinical_ai, llama_adapter, patient_workspace_ai
from app.ai_locale import OutputLanguageMismatch, language_instruction, normalize_language, validate_prose_language
from app.config import settings


@pytest.mark.parametrize('value,expected', [('RU-ru', 'ru'), ('uz-Latn-UZ', 'uz'), ('en_US', 'en'),
                                         (' en ', 'en'), ('fr', 'ru'), (None, 'ru'), ({}, 'ru')])
def test_language_normalization_is_allowlisted(value, expected):
    assert normalize_language(value) == expected


PROSE = {
    'ru': ['Зафиксирован пульс 72 /min.', 'Для оценки лечения данных недостаточно.',
           'Требуется проверка врачом; клиническая валидация не выполнена.'],
    'uz': ["Bemorning pulsi 72 /min. deb qayd etilgan.", "Davolashni baholash uchun ma'lumotlar yetarli emas.",
           "Shifokor tekshiruvi kerak; model klinik tekshiruvdan o'tmagan."],
    'en': ['The documented pulse is 72 /min.', 'The treatment data are insufficient for assessment.',
           'The physician must review this assessment; the model has no clinical validation.'],
}


@pytest.mark.parametrize('language', ['ru', 'uz', 'en'])
def test_localized_sentences_allow_source_units_and_international_abbreviations(language):
    validate_prose_language([*PROSE[language], 'CT', 'MRI', 'COVID-19', 'MTB/RIF'], language)
    assert 'JSON keys' in language_instruction(language)


@pytest.mark.parametrize('requested,actual', [('ru', 'en'), ('ru', 'uz'), ('uz', 'ru'),
                                            ('uz', 'en'), ('en', 'ru'), ('en', 'uz')])
def test_wrong_language_is_rejected_even_when_it_uses_the_same_alphabet(requested, actual):
    with pytest.raises(OutputLanguageMismatch, match='AI_LANGUAGE_MISMATCH'):
        validate_prose_language(PROSE[actual], requested)


@pytest.mark.parametrize('text', ['Synthetic image.', 'Visible intensity gradient.', 'The image is readable.'])
def test_short_english_radiology_sentences_cannot_pass_as_uzbek(text):
    with pytest.raises(OutputLanguageMismatch):
        validate_prose_language([text], 'uz')


def test_quoted_source_expression_does_not_force_its_language_on_the_report():
    validate_prose_language(['В исходном документе записано «No acute abnormality». Требуется проверка врача.'], 'ru')
    with pytest.raises(OutputLanguageMismatch):
        validate_prose_language(['"The documented findings require further clinical review."'], 'ru')


def snapshot(language):
    return {'version': 4, 'age': 52, 'sex': 'unknown', 'language': language,
            'evaluated_conclusion_id': 'conclusion',
            'entries': [{'id': 'exam', 'category': 'objective', 'text': 'Pulse 72 /min.'},
                        {'id': 'conclusion', 'category': 'doctor_conclusion', 'text': 'Clinical follow-up.',
                         'diagnosis': '', 'treatment': ''}],
            'facts': [{'id': 'pulse', 'source_id': 's1', 'key': 'vital.pulse', 'label': 'Pulse',
                       'value': '72', 'unit': '/min', 'assertion': 'present', 'confirmed': True},
                      {'id': 'symptom', 'source_id': 's2', 'key': 'symptom.complaint', 'label': 'Complaint',
                       'value': 'Cough.', 'assertion': 'present', 'confirmed': True}]}


QUESTIONS = {'ru': 'Есть ли повышение температуры?', 'uz': 'Bemorning harorati ko‘tarilganmi?',
             'en': 'Has the patient reported fever?'}


def comparison(language):
    summaries = {
        'ru': ('Для оценки диагноза требуется документированное заключение.', 'Уточнить документированный диагноз.',
               'Данных для долгосрочного сценария недостаточно.'),
        'uz': ("Tashxisni baholash uchun hujjatdagi xulosa kerak.", "Hujjatdagi tashxisni aniqlashtirish kerak.",
               "Uzoq muddatli holatni baholash uchun ma'lumotlar yetarli emas."),
        'en': ('The diagnosis cannot be assessed without a documented conclusion.', 'Clarify the documented diagnosis.',
               'The data are insufficient for a long-term scenario.'),
    }[language]
    return {'case_version': 4, 'status': 'insufficient_data', 'summary': PROSE[language][0],
            'diagnosis_review': {'status': 'insufficient_data', 'summary': summaries[0], 'refs': ['E2']},
            'treatment_review': {'status': 'insufficient_data', 'summary': PROSE[language][1], 'refs': ['E2']},
            'supporting': [{'text': PROSE[language][0], 'refs': ['E1']}], 'discrepancies': [],
            'questions': [QUESTIONS[language]], 'next_steps': [summaries[1]],
            'five_year_outlook': {'status': 'insufficient_data', 'summary': summaries[2], 'scenarios': []},
            'limitations': [PROSE[language][2]]}


def mock_completion(monkeypatch, outputs):
    calls = []
    monkeypatch.setattr(settings, 'ai_backend', 'llama_cpp')
    monkeypatch.setattr(ai, 'model_status', lambda: {'ready': True})

    def complete(messages, schema, **kwargs):
        calls.append(copy.deepcopy(messages))
        output = outputs[min(len(calls) - 1, len(outputs) - 1)]
        return json.dumps({key: value for key, value in output.items() if key in schema['properties']}, ensure_ascii=False)

    monkeypatch.setattr(llama_adapter, 'complete', complete)
    return calls


@pytest.mark.parametrize('language', ['ru', 'uz', 'en'])
def test_comparison_respects_snapshot_language_with_all_sections_and_citations(monkeypatch, language):
    calls = mock_completion(monkeypatch, [comparison(language)])
    output = patient_workspace_ai.review(snapshot(language))
    assert output['language'] == language
    assert output['supporting'][0]['refs'] == ['E1']
    assert len(calls) == 2
    assert language_instruction(language) in calls[0][0]['content']
    assert all(call[1]['content'].endswith(language_instruction(language)) for call in calls)
    assert patient_workspace_ai.PHASE_REQUESTS[language]['diagnosis'] in calls[0][1]['content']
    assert patient_workspace_ai.PHASE_REQUESTS[language]['treatment'] in calls[1][1]['content']


@pytest.mark.parametrize('language', ['uz', 'en'])
def test_comparison_retries_wrong_language_once_without_translation_or_fallback(monkeypatch, language):
    calls = mock_completion(monkeypatch, [comparison('ru'), comparison(language)])
    output = patient_workspace_ai.review(snapshot(language))
    assert len(calls) == 3
    assert 'AI_LANGUAGE_MISMATCH' in calls[1][1]['content']
    assert calls[1][1]['content'].endswith(language_instruction(language))
    assert output['summary'] == PROSE[language][0]
    assert PROSE['ru'][0] not in calls[1][1]['content']


def test_comparison_cannot_publish_a_mixed_language_limitation(monkeypatch):
    output = comparison('uz')
    output['limitations'] = PROSE['en'][2:]
    calls = mock_completion(monkeypatch, [output])
    with pytest.raises(ai.ModelUnavailable, match='^AI_LANGUAGE_MISMATCH$'):
        patient_workspace_ai.review(snapshot('uz'))
    assert len(calls) == 3
    assert not ai._lock.locked()


def test_language_retry_never_weakens_citation_validation(monkeypatch):
    broken = comparison('en')
    broken['supporting'][0]['refs'] = ['E99']
    calls = mock_completion(monkeypatch, [comparison('ru'), broken])
    with pytest.raises(ai.ModelUnavailable, match='^MODEL_OUTPUT_REJECTED$'):
        patient_workspace_ai.review(snapshot('en'))
    assert len(calls) == 2


@pytest.mark.parametrize('language', ['ru', 'uz', 'en'])
def test_differential_review_has_localized_complete_prose(monkeypatch, language):
    output = {'case_version': 4, 'summary': PROSE[language][0], 'concerns': [],
              'limitations': [PROSE[language][2]], 'missing_fields': [],
              'assessment': {'status': 'insufficient_data', 'differential': [], 'questions': [QUESTIONS[language]]}}
    calls = mock_completion(monkeypatch, [output])
    result = clinical_ai.review(snapshot(language))
    assert result['language'] == language
    assert len(calls) == 1
    assert 'Never answer in English' not in calls[0][0]['content']
    assert calls[0][1]['content'].endswith(language_instruction(language))


@pytest.mark.parametrize('language', ['ru', 'uz', 'en'])
def test_general_summary_checks_selected_language_and_preserves_missing_keys(monkeypatch, language):
    monkeypatch.setattr(settings, 'ai_backend', 'llama_cpp')
    monkeypatch.setattr(ai, 'model_status', lambda: {'ready': True})
    calls = []

    def generate(snapshot, coverage, mode, cutoff, system_prompt):
        calls.append(system_prompt)
        actual = 'en' if language == 'ru' else 'ru'
        if len(calls) == 2:
            actual = language
        return json.dumps({'case_version': 4, 'summary': PROSE[actual][0], 'concerns': [],
                           'limitations': [PROSE[actual][2]], 'missing_fields': ['sex']}, ensure_ascii=False)

    monkeypatch.setattr(llama_adapter, 'generate', generate)
    result = ai.review(snapshot(language), {}, 'current', None)
    assert len(calls) == 2
    assert result['language'] == language
    assert result['missing_fields'] == ['sex']


def test_general_summary_language_failure_is_bounded_and_releases_model_lock(monkeypatch):
    monkeypatch.setattr(settings, 'ai_backend', 'llama_cpp')
    monkeypatch.setattr(ai, 'model_status', lambda: {'ready': True})
    calls = []

    def generate(*args):
        calls.append(True)
        return json.dumps({'case_version': 4, 'summary': PROSE['ru'][0], 'limitations': [PROSE['ru'][2]]})

    monkeypatch.setattr(llama_adapter, 'generate', generate)
    with pytest.raises(ai.ModelUnavailable, match='^AI_LANGUAGE_MISMATCH$'):
        ai.review(snapshot('en'), {}, 'current', None)
    assert len(calls) == 2
    assert not ai._lock.locked()


@pytest.mark.parametrize('question', ['Сколько лет пациенту?', 'Какой пульс у пациента?',
                                     "What is the patient's age?", "What is the patient's pulse?",
                                     'Bemorning yoshi qancha?', 'Bemorning pulsi qancha?'])
def test_direct_questions_for_known_values_are_rejected_in_all_languages(question):
    with pytest.raises(ValueError, match='already documented'):
        ai.validate_known_questions([question], snapshot('ru'))


@pytest.mark.parametrize('question', ['Изменился ли пульс после нагрузки?',
                                     'What is the current pulse after exercise?',
                                     'Bemorning pulsi jismoniy yuklamadan keyin o‘zgarganmi?',
                                     'Какой пол у пациента?'])
def test_new_context_and_genuinely_missing_values_remain_valid_questions(question):
    ai.validate_known_questions([question], snapshot('ru'))


@pytest.mark.parametrize('text', ['Amlodipine 5 mg daily, but the dose is not documented.',
                                 "Amlodipin 5 mg, lekin dozasi ko'rsatilmagan."])
def test_same_dose_known_and_missing_contradiction_is_multilingual(text):
    assert patient_workspace_ai.contradictory_dose_claim(text)


@pytest.mark.parametrize('text', ['Amlodipine 5 mg daily, but the dose of lisinopril is unknown.',
                                 "Amlodipin 5 mg, lekin lisinopril dozasi ko'rsatilmagan."])
def test_dose_guard_does_not_apply_one_drugs_dose_to_another(text):
    assert not patient_workspace_ai.contradictory_dose_claim(text)


def test_transformers_final_user_instruction_keeps_language_on_initial_and_repair(monkeypatch):
    import sys
    from contextlib import nullcontext
    from types import SimpleNamespace

    monkeypatch.setattr(settings, 'ai_backend', 'transformers')
    monkeypatch.setattr(ai, 'model_status', lambda: {'ready': True})
    messages_seen = []

    class Input:
        shape = (1, 1)

        def to(self, device):
            return self

    class Processor:
        def apply_chat_template(self, messages, **kwargs):
            messages_seen.append(messages)
            return {'input_ids': Input()}

        def decode(self, *args, **kwargs):
            language = 'en' if len(messages_seen) == 1 else 'ru'
            return json.dumps({'case_version': 4, 'summary': PROSE[language][0], 'concerns': [],
                               'limitations': [PROSE[language][2]], 'missing_fields': []})

    monkeypatch.setitem(sys.modules, 'torch', SimpleNamespace(inference_mode=nullcontext))
    monkeypatch.setitem(sys.modules, 'psutil', SimpleNamespace())
    monkeypatch.setitem(sys.modules, 'transformers', SimpleNamespace(AutoModelForImageTextToText=None,
                         AutoProcessor=None, BitsAndBytesConfig=None))
    monkeypatch.setattr(ai, '_model', SimpleNamespace(device='cpu', generate=lambda **kwargs: [[0, 1]]))
    monkeypatch.setattr(ai, '_processor', Processor())
    result = ai.review(snapshot('ru'), {}, 'current', None)
    assert result['language'] == 'ru'
    assert len(messages_seen) == 2
    assert all(messages[-1]['content'][-1]['text'].endswith(language_instruction('ru')) for messages in messages_seen)
