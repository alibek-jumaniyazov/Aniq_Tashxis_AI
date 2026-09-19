import { describe, expect, it } from 'vitest'
import {
  analysisLanguage,
  analysisOriginKey,
  localizedHistoryRuns,
  localizedRun,
  syntheticAnalysis,
} from './analysisLocale'

describe('Saved AI report language and origin', () => {
  const ru = { id: 'ru', language: 'ru', result: {} }
  const uz = { id: 'uz', language: 'uz', result: {} }
  const en = { id: 'en', language: 'en', result: {} }
  it('selects prose in the new interface language instead of retaining an earlier selection', () => {
    expect(localizedRun([en, ru, uz], 'ru', 'uz-Latn')).toBe(uz)
    expect(localizedRun([ru, uz, en], 'uz', 'en-US')).toBe(en)
  })
  it('prefers the current version over a stale localized result', () => {
    expect(localizedRun([{ ...uz, id: 'old', is_stale: true }, uz], null, 'uz')).toBe(uz)
  })
  it('keeps a known mismatched result for explicit regeneration without relabelling it', () => {
    expect(localizedRun([ru], null, 'en')).toBe(ru)
    expect(analysisLanguage(ru)).toBe('ru')
  })
  it('offers every selectable current-language history version without nonfunctional other-language options', () => {
    const oldUz = { ...uz, id: 'uz-old', is_stale: true }
    const runs = [en, uz, ru, oldUz]
    const history = localizedHistoryRuns(runs, 'uz-Latn')
    expect(history).toEqual([uz, oldUz])
    for (const choice of history) expect(localizedRun(runs, choice.id, 'uz')).toBe(choice)
    expect(runs).toEqual([en, uz, ru, oldUz])
    expect(localizedHistoryRuns(runs, 'en-US')).toEqual([en])
  })
  it('retains selectable original-language history when no matching report exists, for explicit regeneration', () => {
    const runs = [ru, en]
    const history = localizedHistoryRuns(runs, 'uz')
    expect(history).toEqual(runs)
    for (const choice of history) expect(localizedRun(runs, choice.id, 'uz')).toBe(choice)
    expect(localizedHistoryRuns([], 'uz')).toEqual([])
  })
  it('does not confuse prepared seed examples with local model output', () => {
    expect(syntheticAnalysis({ ...uz, result: { provenance: 'synthetic_seed' } })).toBe(true)
    expect(syntheticAnalysis({ ...uz, result: { provenance: 'local_medgemma' } })).toBe(false)
    expect(
      analysisOriginKey({ ...uz, include_ai: false, result: { provenance: 'local_medgemma' } }),
    ).toBe('aiLocalResult')
    expect(analysisOriginKey({ ...uz, include_ai: false, result: {} })).toBe('aiRuleResult')
    expect(
      analysisOriginKey({ ...uz, include_ai: true, result: { provenance: 'synthetic_seed' } }),
    ).toBe('aiSyntheticResult')
  })
})
