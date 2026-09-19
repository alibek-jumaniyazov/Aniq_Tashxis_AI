import { normalizeLanguage, type LanguageCode } from './localeCodes'

export interface AnalysisLanguageRun {
  id: string
  language?: string
  include_ai?: boolean
  is_stale?: boolean
  result: {
    language?: string
    provenance?: string
    demo_only?: boolean
    model_id?: string
    provider?: string
    ai_backend?: string
  }
}

export function analysisLanguage(run?: AnalysisLanguageRun): LanguageCode {
  return normalizeLanguage(run?.language || run?.result.language || null)
}

export function syntheticAnalysis(run?: AnalysisLanguageRun): boolean {
  return (
    run?.result.provenance === 'synthetic_seed' ||
    run?.result.demo_only === true ||
    run?.result.model_id === 'synthetic-demo'
  )
}

export function analysisOriginKey(run?: AnalysisLanguageRun): string {
  if (syntheticAnalysis(run)) return 'aiSyntheticResult'
  if (run?.result.provenance === 'openai_api') return 'aiOpenAIResult'
  if (run?.result.provenance === 'local_medgemma') return 'aiLocalResult'
  if (run?.include_ai === false || run?.result.provenance === 'documentation_rules')
    return 'aiRuleResult'
  if (run?.result.provider === 'openai' || run?.result.ai_backend === 'openai')
    return 'aiOpenAIResult'
  if (
    /medgemma/i.test(run?.result.model_id || '') ||
    ['llama_cpp', 'transformers'].includes(run?.result.ai_backend || '')
  )
    return 'aiLocalResult'
  return 'aiUnknownResult'
}

/** Only offer history entries that selection can retain in the current language. */
export function localizedHistoryRuns<T extends AnalysisLanguageRun>(
  runs: T[],
  language: string,
): T[] {
  const locale = normalizeLanguage(language)
  const matching = runs.filter((run) => analysisLanguage(run) === locale)
  return matching.length ? matching : runs
}

/** Stored clinical prose is never silently translated or relabelled as another language. */
export function localizedRun<T extends AnalysisLanguageRun>(
  runs: T[],
  selected: string | null | undefined,
  language: string,
): T | undefined {
  const locale = normalizeLanguage(language)
  const matching = runs.filter((run) => analysisLanguage(run) === locale)
  return (
    matching.find((run) => run.id === selected) ||
    matching.find((run) => !run.is_stale) ||
    matching[0] ||
    runs.find((run) => run.id === selected) ||
    runs[0]
  )
}
