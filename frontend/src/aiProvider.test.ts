// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { analysisOriginKey } from './analysisLocale'
import {
  isCloudModel,
  processingHintKey,
  processingLabelKey,
  providerName,
  supportsClinicalModel,
} from './aiProvider'
import { translations } from './i18n'

describe('AI provider identity and processing', () => {
  it('permits the configured OpenAI clinical backend and exposes cloud processing even before readiness', () => {
    const model = {
      provider: 'openai',
      backend: 'openai',
      ready: false,
      configured: false,
      model_id: 'actual-project-model',
    }
    expect(supportsClinicalModel(model)).toBe(true)
    expect(providerName(model)).toBe('OpenAI')
    expect(processingLabelKey(model)).toBe('aiCloudProcessing')
    expect(processingHintKey(model)).toBe('aiCloudProcessingHint')
    expect(isCloudModel({ data_processing: 'openai_cloud' })).toBe(true)
  })

  it('does not promise local processing for unknown or unavailable status', () => {
    expect(processingLabelKey(undefined)).toBe('aiProcessing')
    expect(processingHintKey(undefined)).toBe('aiProviderHint')
    expect(providerName(undefined)).toBe('AI')
    expect(supportsClinicalModel(undefined)).toBe(false)
    expect(processingLabelKey({ backend: 'llama_cpp' })).toBe('aiLocalProcessing')
    expect(supportsClinicalModel({ backend: 'llama_cpp' })).toBe(true)
    expect(processingLabelKey({ provider: 'openai', backend: 'llama_cpp' })).toBe(
      'aiCloudProcessing',
    )
  })

  it('uses immutable saved provenance rather than the current deployment provider', () => {
    expect(
      analysisOriginKey({
        id: 'cloud',
        include_ai: false,
        result: { provenance: 'openai_api', model_id: 'actual-project-model' },
      }),
    ).toBe('aiOpenAIResult')
    expect(
      analysisOriginKey({
        id: 'old-local',
        result: { provenance: 'local_medgemma', provider: 'openai' },
      }),
    ).toBe('aiLocalResult')
    expect(
      analysisOriginKey({ id: 'legacy-local', result: { model_id: 'google/medgemma-1.5-4b-it' } }),
    ).toBe('aiLocalResult')
    expect(analysisOriginKey({ id: 'legacy-cloud', result: { provider: 'openai' } })).toBe(
      'aiOpenAIResult',
    )
    expect(
      analysisOriginKey({
        id: 'seed',
        result: {
          provenance: 'synthetic_seed',
          provider: 'openai',
          model_id: 'actual-project-model',
        },
      }),
    ).toBe('aiSyntheticResult')
    expect(
      analysisOriginKey({
        id: 'rules',
        include_ai: false,
        result: { model_id: 'google/medgemma-1.5-4b-it' },
      }),
    ).toBe('aiRuleResult')
    expect(analysisOriginKey({ id: 'unknown', result: {} })).toBe('aiUnknownResult')
    expect(analysisOriginKey()).toBe('aiUnknownResult')
  })

  it('has actionable cloud errors and truthful processing copy in all three languages', () => {
    const errors = [
      'OPENAI_API_KEY_MISSING',
      'OPENAI_AUTH_ERROR',
      'OPENAI_RATE_LIMIT',
      'OPENAI_QUOTA_EXCEEDED',
      'OPENAI_MODEL_UNAVAILABLE',
      'OPENAI_UNAVAILABLE',
      'OPENAI_INVALID_REQUEST',
      'MODEL_TIMEOUT',
      'MODEL_OUTPUT_REJECTED',
      'MODEL_OUTPUT_INCOMPLETE',
      'AI_RESPONSE_REFUSED',
    ]
    for (const dictionary of Object.values(translations)) {
      for (const code of errors)
        expect((dictionary as Record<string, string>)[code]?.length, code).toBeGreaterThan(30)
      expect(dictionary.aiCloudProcessingHint).toContain('OpenAI API')
      for (const key of [
        'localHint',
        'includeAI',
        'aiSummary',
        'extractWithAI',
        'imageAIReview',
        'aiSyntheticResultHint',
        'clinicalReviewNotice',
      ] as const) {
        expect(dictionary[key]).not.toMatch(/MedGemma|4B|локаль|lokal|local model/i)
      }
    }
  })
})
