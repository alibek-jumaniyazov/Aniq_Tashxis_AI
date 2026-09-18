// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ComparisonResult, type ComparisonReport, type ComparisonRun } from './ClinicalComparison'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
afterEach(cleanup)

const report: ComparisonReport = {
  case_version: 4, summary: 'The treatment decision needs clinician review.', status: 'requires_clinician_review',
  diagnosis_review: { status: 'consistent_with_data', summary: 'Diagnosis matches this limited record.', refs: ['E1'] },
  treatment_review: { status: 'needs_review', summary: 'Verify the allergy before prescribing.', refs: ['E1'] },
  supporting: [{ text: 'The patient reports a compatible history.', refs: ['E1'] }],
  discrepancies: [{ text: 'The recorded allergy requires clarification.', refs: ['E1'] }],
  questions: ['What was the prior reaction?'], next_steps: ['Check the original medication record.'], limitations: ['This is not a validated risk model.'],
  evidence: [{ ref: 'E1', entry_id: 'entry-1', category: 'subjective', text: 'Patient-reported allergy.', source_id: 'source-42' }],
  five_year_outlook: { status: 'qualitative_only', summary: 'Long-term outcomes depend on follow-up.', scenarios: [{ scenario: 'Stable symptoms with monitoring', conditions: 'Follow-up confirms treatment response.', monitoring: 'Review changes in symptoms.', refs: ['E1'] }] },
  requires_clinician_review: true, validated_probability: false,
}
function analysis(overrides: Partial<ComparisonRun> = {}): ComparisonRun {
  return { id: 'comparison-1', run_id: 'comparison-1', case_id: 'case-1', case_version: 4, status: 'succeeded', stage: 'complete', is_stale: false, review_focus: 'clinical_comparison', mode: 'current', created_at: '2026-09-18T12:00:00Z', error_code: null, result: { comparison: report }, ...overrides }
}

describe('Clinical comparison evidence and result states', () => {
  it.each(['queued', 'running', 'failed', 'cancelled'])('hides a leftover result when the run is %s', status => {
    render(<ComparisonResult run={analysis({ status })} openSource={vi.fn()}/>)
    expect(screen.queryByText(report.summary)).toBeNull()
    expect(screen.queryByText(report.diagnosis_review.summary)).toBeNull()
    expect(screen.getByTestId('clinical-comparison-result').getAttribute('aria-busy')).toBe(String(['queued', 'running'].includes(status)))
  })

  it('links the exact supplied evidence source and exposes a stale version warning', () => {
    const openSource = vi.fn()
    render(<ComparisonResult run={analysis({ is_stale: true })} openSource={openSource}/>)
    const citation = screen.getAllByRole('button', { name: 'openSource: E1' })[0]
    expect(citation.getAttribute('title')).toBe(report.evidence[0].text)
    expect(citation.querySelector('small')).toBeNull()
    expect(screen.getByText(report.evidence[0].text).closest('.pw-all-evidence')).toBeTruthy()
    fireEvent.click(citation)
    expect(openSource).toHaveBeenCalledWith('source-42')
    expect(screen.getByText('aiResultStaleHint')).toBeTruthy()
    expect(screen.getByText('Verify the allergy before prescribing.')).toBeTruthy()
  })

  it('presents a five-year scenario with its conditions and monitoring, without inventing a percentage', () => {
    render(<ComparisonResult run={analysis()} view="forecast" openSource={vi.fn()}/>)
    expect(screen.getByText('Stable symptoms with monitoring')).toBeTruthy()
    expect(screen.getByText('Follow-up confirms treatment response.')).toBeTruthy()
    expect(screen.getByText('Review changes in symptoms.')).toBeTruthy()
    expect(screen.getByText('pw_forecast_hint')).toBeTruthy()
    expect(screen.queryByText(report.diagnosis_review.summary)).toBeNull()
    expect(screen.getByTestId('clinical-comparison-result').textContent).not.toContain('%')
  })

  it('shows a real backend failure without substituting a clinical conclusion', () => {
    render(<ComparisonResult run={analysis({ status: 'failed', error_code: 'MODEL_OUTPUT_REJECTED', result: { comparison: null } })} openSource={vi.fn()}/>)
    expect(screen.getByText('MODEL_OUTPUT_REJECTED')).toBeTruthy()
    expect(screen.getByText('aiResultFailed')).toBeTruthy()
    expect(screen.queryByText('pw_compare_summary')).toBeNull()
  })

  it('does not make an unresolvable reference clickable', () => {
    const openSource = vi.fn()
    render(<ComparisonResult run={analysis({ result: { comparison: { ...report, diagnosis_review: { ...report.diagnosis_review, refs: ['E99'] } } } })} openSource={openSource}/>)
    expect(screen.getByText('E99 · pw_unknown_ref')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'openSource: E99' })).toBeNull()
    expect(openSource).not.toHaveBeenCalled()
  })

  it('exposes chronology and stopped medication status beside the original fact', () => {
    const fact = { ref: 'F1', fact_id: 'fact-1', category: 'confirmed_fact', text: 'Medication documented in the prior visit.', order_status: 'stopped', event_time: '2026-08-01T10:00:00+05:00', available_time: null }
    render(<ComparisonResult run={analysis({ result: { comparison: { ...report, evidence: [...report.evidence, fact] } } })} openSource={vi.fn()}/>)
    const evidence = screen.getByText(fact.text).closest('.pw-reference')!
    expect(evidence.textContent).toContain('orderStatus: pw_order_stopped')
    expect(evidence.textContent).toContain('availableTime: unknown')
    expect(evidence.textContent).toContain('eventTime:')
    expect(evidence.textContent).not.toContain('eventTime: unknown')
  })
})
