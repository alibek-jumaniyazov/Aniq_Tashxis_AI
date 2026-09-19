import { describe, expect, it } from 'vitest'
import { comparisonReadinessReason, type ComparisonReadinessState } from './comparisonReadiness'

const ready: ComparisonReadinessState = {
  canEdit: true,
  pending: false,
  busy: false,
  recordsPending: false,
  recordsError: null,
  readiness: {
    comparison_ready: true,
    has_confirmed_data: true,
    has_confirmed_conclusion: true,
    adult_age_known: true,
  },
  modelPending: false,
  model: {
    model_id: 'configured-model',
    revision: '',
    ready: true,
    loaded: true,
    reason: null,
    quantization: '',
    backend: 'openai',
    clinical_validation: '',
  },
}

describe('comparison readiness messages', () => {
  it.each([
    [{ canEdit: false, pending: true }, 'clinicalOnlyDoctor'],
    [{ pending: true, recordsPending: true }, 'clinicalPendingHint'],
    [{ busy: true }, 'clinicalPendingHint'],
    [{ recordsPending: true }, 'clinicalReadyChecking'],
    [{ recordsError: new Error('offline') }, 'clinicalReadyFailed'],
    [{ readiness: undefined, modelPending: true }, 'pw_ready_hint'],
    [{ modelPending: true }, 'clinicalModelChecking'],
    [{ model: undefined }, 'clinicalModelUnavailable'],
  ] satisfies [Partial<ComparisonReadinessState>, string][])(
    'preserves readiness priority and its translation key',
    (overrides, expected) => {
      expect(comparisonReadinessReason({ ...ready, ...overrides })).toBe(expected)
    },
  )

  it.each(['openai', 'llama_cpp'])('accepts the existing %s clinical provider', (backend) => {
    expect(comparisonReadinessReason({ ...ready, model: { ...ready.model!, backend } })).toBe('')
  })
})
