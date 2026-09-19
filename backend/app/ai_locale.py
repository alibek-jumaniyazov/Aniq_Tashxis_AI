"""Language policy for generated clinical prose, never for source quotations.

Detection is deliberately bounded: script and common language markers catch clear
wrong-language responses, not grammatical errors or clinical correctness. No
external translation service receives patient data.
"""
import re
import unicodedata
from collections.abc import Iterable


class OutputLanguageMismatch(ValueError):
    """A structured response contains clearly incompatible generated prose."""


def normalize_language(value, default='ru'):
    fallback = default if default in {'ru', 'uz', 'en'} else 'ru'
    if not isinstance(value, str):
        return fallback
    code = value.strip().lower().replace('_', '-').split('-', 1)[0]
    return code if code in {'ru', 'uz', 'en'} else fallback


def language_instruction(language):
    language = normalize_language(language)
    instructions = {
        'ru': 'Write ALL generated explanatory prose in Russian. Весь поясняющий текст пишите по-русски.',
        'uz': "Write ALL generated explanatory prose in Uzbek using the Latin alphabet. Use standard Uzbek, not Turkish. "
              "Barcha izohlarni adabiy o'zbek tilida, lotin yozuvida yozing. "
              "Use Uzbek medical spelling, for example sil or tuberkulyoz; do not use Turkish spellings in generated prose.",
        'en': 'Write ALL generated explanatory prose in English. Use clear, complete English sentences.',
    }
    return (instructions[language] + ' This includes summaries, findings, diagnosis and treatment reviews, '
            'hypothesis labels, questions, next steps, scenarios and limitations. '
            'Do not translate JSON keys, enum statuses, evidence IDs, numbers or source units. '
            'Keep enum status strings only in their machine-readable JSON fields; never insert them '
            'into explanatory prose. Explain each status with ordinary words in the requested language. '
            'International medical abbreviations and explicitly quoted source terms may remain unchanged. '
            'The language of source records must not override this output language.')


_EN_WORDS = set('the a an is are was were be been being this that these those of for from '
                'with without and or but if as by at to in on has have had does do not no '
                'should must may can cannot could would will which what when whether how '
                'requires needs patient evidence findings documented insufficient unknown '
                'review assessment treatment diagnosis available provided confirm confirmed '
                'clinical uncertainty missing monitoring supports reported data results '
                'further limited limitations additional physician visible image frame '
                'intensity gradient synthetic anatomy normal readable study series '
                'no acute abnormality cannot assess diagnostic quality symptoms symptom '
                'cough pulse fever disease recommended inconsistent relevant'.split())
_UZ_WORDS = set("va yoki ammo lekin uchun bilan haqida bu ushbu shu ham faqat agar emas yo'q "
                "bor kerak zarur mumkin lozim ko'ra asosida yetarli yetarlicha hali qanday "
                "qaysi qachon qancha nima mavjud kam noma'lum mos qayd etilgan aniqlash "
                "aniq tashxis xulosa davolash tekshirish shifokor bemor dalil ma'lumot".split())
_UZ_STEMS = ('bemor', 'shifokor', 'ma\'lumot', 'dalil', 'hujjat', 'yetishmay',
             'aniqlan', 'tekshir', 'tasdiqlan', 'kuzatuv', 'ko\'rsat', 'tahlil',
             'savol', 'cheklov', 'o\'zgar', 'belgilan', 'natija')
_APOSTROPHES = str.maketrans({'’': "'", '‘': "'", 'ʻ': "'", 'ʼ': "'", '`': "'"})
_INTERNAL_STATUSES = re.compile(
    r'\b(?:needs_review|insufficient_data|consistent_with_data|requires_clinician_review|'
    r'qualitative_only|supported_on_selected_frame|supported_on_reviewed_frames|'
    r'possible_discrepancy|not_assessable|not_evaluable)\b', re.IGNORECASE)


def prose_language_issues(texts: Iterable[str], language):
    """Return safe correction reasons without copying rejected patient/model text.

    Pass only generated narrative fields; exclude source quotes, IDs and enum
    values. Short international labels such as COVID-19 or CT remain valid.
    """
    target = normalize_language(language)
    if isinstance(texts, str):
        texts = [texts]
    for raw in texts:
        if not isinstance(raw, str) or not raw.strip():
            continue
        value = unicodedata.normalize('NFKC', raw).translate(_APOSTROPHES)
        # A quoted source expression may remain in its original language, but an
        # entire quoted response is still narrative and must not evade the check.
        unquoted = re.sub(r'''«[^»]*»|“[^”]*”|"[^"\n]*"|(?<!\w)'[^'\n]+'(?!\w)''', ' ', value)
        if _INTERNAL_STATUSES.search(unquoted):
            return ['AI_LANGUAGE_MISMATCH: Keep internal status strings only in the JSON status fields. '
                    'Explain statuses in ordinary clinical prose. ' + language_instruction(target)]
        # A narrow observed spelling error, not a global ban on diacritics in
        # names, drug terms or quoted source language.
        if target == 'uz' and re.search(r'\btüberk(?:ülyoz|üloz|ulyoz)\w*', unquoted, re.IGNORECASE):
            return ['AI_LANGUAGE_MISMATCH: Use standard Uzbek medical spelling such as sil or tuberkulyoz '
                    'in generated prose; preserve explicitly quoted source terms. ' + language_instruction(target)]
        if len(re.findall(r'[^\W\d_]', unquoted)) >= 10:
            value = unquoted
        words = re.findall(r"[^\W\d_]+(?:'[^\W\d_]+)*", value.lower())
        letters = [c for c in value if c.isalpha()]
        if not letters:
            continue
        cyrillic = sum(bool(re.match('[А-Яа-яЁёЎўҚқҒғҲҳ]', c)) for c in letters)
        latin = sum(bool(re.match('[A-Za-z]', c)) for c in letters)
        english = sum(w in _EN_WORDS for w in words)
        uzbek = sum(w in _UZ_WORDS or w.startswith(_UZ_STEMS) for w in words)
        mismatch = len(letters) >= 12 and (latin + cyrillic) / len(letters) < .65
        if target == 'ru':
            mismatch |= (len(letters) >= 12 and not cyrillic and len(words) >= 3)
            mismatch |= english >= 2 and not cyrillic
            mismatch |= english >= 4 and latin > cyrillic * 2
            mismatch |= uzbek >= 3 and latin > cyrillic * 2
        else:
            mismatch |= cyrillic >= 8 and cyrillic / len(letters) > .35
            if target == 'uz':
                mismatch |= english >= 2 and english > uzbek * 2
            else:
                mismatch |= uzbek >= 2 and uzbek > english * 2
        if mismatch:
            return ['AI_LANGUAGE_MISMATCH: ' + language_instruction(target)]
    return []


def validate_prose_language(texts: Iterable[str], language):
    issues = prose_language_issues(texts, language)
    if issues:
        raise OutputLanguageMismatch(issues[0])
