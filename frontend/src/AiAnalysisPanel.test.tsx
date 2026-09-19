// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import AiAnalysisPanel from './AiAnalysisPanel'
import type { Run } from './types'

const locale = vi.hoisted(() => ({ language: 'ru' }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: locale.language, language: locale.language },
  }),
}))
afterEach(() => {
  cleanup()
  locale.language = 'ru'
})

function analysis(overrides: Partial<Run> = {}): Run {
  return {
    id: 'run-1',
    run_id: 'run-1',
    case_id: 'case-1',
    case_version: 2,
    mode: 'current',
    status: 'succeeded',
    stage: 'complete',
    is_stale: false,
    created_at: '2026-09-18T12:00:00Z',
    error_code: null,
    result: {
      ai: {
        summary: 'Confirmed observation only.',
        limitations: ['Review against source.'],
        missing_fields: [],
      },
    },
    ...overrides,
  }
}

describe('AI result trust and actions', () => {
  it('shows the actual saved OpenAI model without relabelling it as MedGemma', () => {
    const run = analysis()
    run.result.provenance = 'openai_api'
    run.result.provider = 'openai'
    run.result.model_id = 'actual-project-model'
    render(<AiAnalysisPanel run={run} />)
    expect(screen.getAllByText('aiOpenAIResult').length).toBeGreaterThan(0)
    expect(screen.getByText('actual-project-model')).toBeTruthy()
    expect(screen.queryByText('aiLocalResult')).toBeNull()
    expect(screen.getByText('Confirmed observation only.')).toBeTruthy()
  })

  it('recognizes the neutral inference stage without publishing incomplete prose', () => {
    render(<AiAnalysisPanel run={analysis({ status: 'running', stage: 'ai_inference' })} />)
    expect(screen.getByText('aiResultModelWorking')).toBeTruthy()
    expect(screen.queryByText('Confirmed observation only.')).toBeNull()
  })

  it('hides another-language clinical prose and offers regeneration in the interface language', () => {
    locale.language = 'uz'
    const retry = vi.fn()
    render(<AiAnalysisPanel run={analysis({ language: 'ru' })} onRetry={retry} />)
    expect(screen.queryByText('Confirmed observation only.')).toBeNull()
    expect(screen.queryByText('Review against source.')).toBeNull()
    expect(screen.getByText('aiLanguageMismatch')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'aiRegenerateLanguage' }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('labels illustrative seed analysis without presenting it as MedGemma inference', () => {
    const run = analysis()
    run.result.provenance = 'synthetic_seed'
    render(<AiAnalysisPanel run={run} />)
    expect(screen.getByText('aiSyntheticResultHint')).toBeTruthy()
    expect(screen.getByTestId('ai-analysis-panel').textContent).not.toContain('MEDGEMMA')
  })

  it.each(['running', 'cancelled', 'failed'])(
    'never presents leftover model text as the result of a %s run',
    (status) => {
      render(<AiAnalysisPanel run={analysis({ status })} />)
      expect(screen.queryByText('Confirmed observation only.')).toBeNull()
      expect(screen.getByTestId('ai-analysis-panel').getAttribute('aria-busy')).toBe(
        String(status === 'running'),
      )
    },
  )

  it('keeps unavailable AI distinct from completed rule checks and exposes the real limitation', () => {
    render(
      <AiAnalysisPanel
        run={analysis({
          status: 'partial',
          result: { ai: null, limitations: ['MODEL_OUTPUT_REJECTED'] },
        })}
      />,
    )
    expect(screen.getByText('aiResultUnavailable')).toBeTruthy()
    expect(screen.getByText('MODEL_OUTPUT_REJECTED')).toBeTruthy()
    expect(screen.queryByText('aiResultSummary')).toBeNull()
  })

  it('opens the exact evidence source and prevents recording a stale hypothesis', () => {
    const openSource = vi.fn()
    const review = vi.fn()
    const run = analysis({
      is_stale: true,
      result: {
        ai: {
          summary: 'Confirmed observation only.',
          limitations: [],
          missing_fields: [],
          evidence: [
            {
              ref: 'F1',
              fact_id: 'fact-1',
              source_id: 'document-42',
              label: 'Reported symptom',
              key: 'symptom.complaint',
              value: 'Cough',
              unit: null,
              assertion: 'present',
            },
          ],
          assessment: {
            status: 'requires_clinician_review',
            differential: [
              {
                label: 'Unconfirmed hypothesis',
                supporting_refs: ['F1'],
                opposing_refs: [],
                verification_needed: 'Confirm the history.',
              },
            ],
            questions: [],
          },
        },
      },
    })
    render(<AiAnalysisPanel run={run} openSource={openSource} onReviewHypothesis={review} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'openSource: Reported symptom' })[0])
    expect(openSource).toHaveBeenCalledWith('document-42')
    const action = screen.getByRole('button', { name: /reviewHypothesis/ }) as HTMLButtonElement
    expect(action.disabled).toBe(true)
    fireEvent.click(action)
    expect(review).not.toHaveBeenCalled()
    expect(screen.getByText('aiResultStaleHint')).toBeTruthy()
  })

  it('only runs a supplied retry when the request is allowed', () => {
    const retry = vi.fn()
    const view = render(
      <AiAnalysisPanel
        run={analysis({ status: 'failed' })}
        onRetry={retry}
        retryDisabledReason="Model unavailable"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    expect(retry).not.toHaveBeenCalled()
    view.rerender(<AiAnalysisPanel run={analysis({ status: 'failed' })} onRetry={retry} />)
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    expect(retry).toHaveBeenCalledOnce()
  })
})
