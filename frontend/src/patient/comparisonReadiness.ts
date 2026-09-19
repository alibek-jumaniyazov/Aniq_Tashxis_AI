import { supportsClinicalModel } from '../aiProvider'
import type { ClinicalEntriesResponse } from '../PatientDataSection'
import type { Status } from '../types'

export interface ComparisonReadinessState {
  canEdit: boolean
  pending: boolean
  busy: boolean
  recordsPending: boolean
  recordsError: unknown
  readiness?: ClinicalEntriesResponse['readiness']
  modelPending: boolean
  model?: Status['model']
}

export function comparisonDataReason(state: ComparisonReadinessState): string {
  if (!state.canEdit) return 'clinicalOnlyDoctor'
  if (state.pending || state.busy) return 'clinicalPendingHint'
  if (state.recordsPending) return 'clinicalReadyChecking'
  if (state.recordsError) return 'clinicalReadyFailed'
  return state.readiness?.comparison_ready ? '' : 'pw_ready_hint'
}

export function comparisonModelReason(model: Status['model'] | undefined, pending = false): string {
  if (pending) return 'clinicalModelChecking'
  if (!model?.ready) return model?.reason || 'clinicalModelUnavailable'
  return supportsClinicalModel(model) ? '' : 'clinicalModelProfile'
}

export function comparisonReadinessReason(state: ComparisonReadinessState): string {
  return comparisonDataReason(state) || comparisonModelReason(state.model, state.modelPending)
}
