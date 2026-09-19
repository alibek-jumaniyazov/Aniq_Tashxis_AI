import type { Run } from '../types'

type ReviewStatus = 'consistent_with_data' | 'needs_review' | 'insufficient_data'
interface ComparisonEvidence {
  ref: string
  entry_id?: string
  fact_id?: string
  category: string
  text: string
  source_id?: string | null
  event_time?: string | null
  available_time?: string | null
  order_status?: string | null
}
export interface ComparisonReview {
  status: ReviewStatus
  summary: string
  refs: string[]
}
export interface ComparisonReport {
  case_version: number
  summary: string
  status: 'requires_clinician_review' | 'insufficient_data'
  diagnosis_review: ComparisonReview
  treatment_review: ComparisonReview
  supporting: { text: string; refs: string[] }[]
  discrepancies: { text: string; refs: string[] }[]
  questions: string[]
  next_steps: string[]
  limitations: string[]
  evidence: ComparisonEvidence[]
  five_year_outlook: {
    status: 'qualitative_only' | 'insufficient_data'
    summary: string
    scenarios: { scenario: string; conditions: string; monitoring: string; refs: string[] }[]
  }
  requires_clinician_review: true
  validated_probability: false
}
export interface ComparisonRun extends Omit<Run, 'result' | 'review_focus'> {
  review_focus?: 'clinical_comparison'
  result: {
    language?: string
    provenance?: string
    demo_only?: boolean
    comparison?: ComparisonReport | null
    limitations?: string[]
    model_id?: string
    provider?: string
    ai_backend?: string
    prompt_version?: string
  }
}
