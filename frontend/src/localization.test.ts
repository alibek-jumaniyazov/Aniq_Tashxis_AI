// @vitest-environment jsdom
/// <reference types="vite/client" />
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import i18n, { supportedLanguages, translations } from './i18n'

const dictionaries = translations as Record<string, Record<string, string>>
const placeholders = (text: string) => [...text.matchAll(/{{\s*([^{}]+?)\s*}}/g)].map(match => match[1]).sort()
const sources = import.meta.glob<string>(['./**/*.ts', './**/*.tsx', '!./**/*.test.*', '!./**/*.spec.*', '!./api/generated.ts'], { eager: true, query: '?raw', import: 'default' })

/** Discover literal translation calls rather than maintaining a second hand-written key list. */
function interfaceKeys(): Map<string, string[]> {
  const keys = new Map<string, string[]>()
  for (const [file, text] of Object.entries(sources)) {
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
    const collect = (node: ts.Expression) => {
      if (ts.isStringLiteralLike(node)) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
        keys.set(node.text, [...(keys.get(node.text) || []), `${file.split(/[\\/]/).pop()}:${line}`])
      } else if (ts.isConditionalExpression(node)) {
        collect(node.whenTrue)
        collect(node.whenFalse)
      } else if (ts.isParenthesizedExpression(node)) collect(node.expression)
    }
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && node.arguments.length && (
        (ts.isIdentifier(node.expression) && node.expression.text === 't') ||
        (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 't')
      )) collect(node.arguments[0])
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return keys
}

const hasTranslation = (language: string, key: string) => !!dictionaries[language][key] || !!dictionaries[language][`${key}_other`]

describe('complete interface translations', () => {
  it('provides the same non-empty resource keys in Russian, Uzbek and English', () => {
    const expectedKeys = Object.keys(dictionaries.ru).sort()
    expect(expectedKeys.length).toBeGreaterThan(0)
    for (const language of supportedLanguages) {
      expect(Object.keys(dictionaries[language]).sort(), `${language}: resource keys`).toEqual(expectedKeys)
      expect(Object.entries(dictionaries[language]).filter(([, value]) => typeof value !== 'string' || !value.trim()), `${language}: blank translations`).toEqual([])
    }
  })

  it('preserves every interpolation variable in every language', () => {
    const mismatches: string[] = []
    for (const [key, value] of Object.entries(dictionaries.ru)) {
      for (const language of ['uz', 'en']) {
        if (JSON.stringify(placeholders(value)) !== JSON.stringify(placeholders(dictionaries[language][key] || ''))) mismatches.push(`${language}: ${key}`)
      }
    }
    expect(mismatches).toEqual([])
  })

  it('resolves flat dotted field codes through i18next in each selected language', () => {
    for (const language of supportedLanguages) {
      for (const key of ['active_medication.substance', 'lab.potassium.value_or_unit']) {
        expect(i18n.t(key, { lng: language })).toBe(dictionaries[language][key])
        expect(i18n.t(key, { lng: language })).not.toBe(key)
      }
    }
  })

  it('uses correct year forms for clinical ages and risk horizons', () => {
    expect(i18n.t('clinicalYears', { lng: 'ru', count: 21 })).toBe('21 год')
    expect(i18n.t('clinicalYears', { lng: 'ru', count: 32 })).toBe('32 года')
    expect(i18n.t('clinicalYears', { lng: 'ru', count: 10 })).toBe('10 лет')
    expect(i18n.t('clinicalYears', { lng: 'uz', count: 10 })).toBe('10 yil')
    expect(i18n.t('clinicalYears', { lng: 'en', count: 1 })).toBe('1 year')
    expect(i18n.t('clinicalYears', { lng: 'en', count: 10 })).toBe('10 years')
  })

  it('resolves all explicit interface translation calls without falling back to another language', () => {
    const missing: string[] = []
    for (const [key, locations] of interfaceKeys()) {
      for (const language of supportedLanguages) {
        if (!hasTranslation(language, key)) missing.push(`${language}: ${key} (${locations.join(', ')})`)
      }
    }
    expect(missing).toEqual([])
  })

  it('covers dynamic clinical states, reasons, check names and risk fields', () => {
    const dynamicKeys = [
      'queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled', 'not_started', 'unavailable',
      'current', 'decision_time', 'attention', 'checked', 'not_evaluable',
      'substance_overlap', 'laterality_consistency', 'observation_consistency', 'measurement_units', 'confirmation_completeness',
      'substance_overlapHint', 'laterality_consistencyHint', 'observation_consistencyHint', 'measurement_unitsHint', 'confirmation_completenessHint',
      'present', 'absent', 'not_documented', 'provisional', 'confirmed', 'rejected', 'clarified',
      'doctor', 'radiologist', 'expertRole', 'quality', 'sender', 'admin', 'analyst', 'owner', 'developer',
      'new', 'seen', 'accepted', 'information_requested', 'active', 'not_applicable',
      'under_review', 'awaiting_explanation', 'not_confirmed', 'insufficient_information', 'corrective_actions', 'closed',
      'draft', 'approved', 'sent', 'manual', 'paper', 'patient_reported', 'document', 'dmed_demo',
      'noteHistory', 'decision_rationale', 'alert_response',
      'draftRestored', 'draftPrivate', 'draftSaving', 'draftSaved', 'draftFailed', 'wpDraftLoadFailed',
      'nativeWindow', 'soft', 'lung', 'bone', 'customWindow',
      'age', 'sex', 'male', 'female', 'unknown', 'systolic_pressure', 'lipid_unit', 'total_cholesterol', 'hdl_cholesterol', 'smoker', 'diabetes', 'bp_treated', 'baseline_cvd',
      'FHS_AGE_OUTSIDE_RANGE', 'FHS_BASELINE_CVD', 'FHS_INPUT_OUTSIDE_SUPPORTED_RANGE', 'RISK_INPUT_CONFIRMATION_REQUIRED', 'UNSUPPORTED_HORIZON', 'UNSUPPORTED_OUTCOME',
      'AI_NOT_REQUESTED', 'MODEL_WEIGHTS_MISSING', 'AI_RUNTIME_MISSING', 'MODEL_SERVER_OFFLINE', 'MODEL_SERVER_UNAVAILABLE', 'MODEL_TIMEOUT', 'MODEL_OUTPUT_INCOMPLETE', 'MODEL_OUTPUT_REJECTED', 'MODEL_BUSY',
      'MODEL_MEMORY_BUDGET_TOO_SMALL', 'MODEL_CPU_MEMORY_INSUFFICIENT', 'MODEL_INPUT_TOO_LONG', 'CLINICAL_REVIEW_REQUIRES_GGUF_PROFILE', 'INSUFFICIENT_CONFIRMED_EVIDENCE',
      'JOB_FAILED', 'WORKER_INTERRUPTED', 'CLINICAL_REVIEW_STALE', 'VISION_MODEL_NOT_READY', 'PIXEL_SPACING_REQUIRED',
      'DOC-SIDE-01', 'DEMO-ALLERGY-01', 'DEMO-LAB-01', 'temporal_eligibility', 'population', 'clinical_lab_restriction', 'two_imaging_side_sources', 'active_medication.substance', 'lab.potassium.value_or_unit',
      'service_sqlite_local', 'service_postgresql', 'service_inline', 'service_local', 'service_redis', 'service_demo', 'service_mock',
    ]
    const missing = supportedLanguages.flatMap(language => dynamicKeys.filter(key => !hasTranslation(language, key)).map(key => `${language}: ${key}`))
    expect(missing).toEqual([])
  })
})
