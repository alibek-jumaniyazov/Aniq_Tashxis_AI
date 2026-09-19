import { useState } from 'react'
import { App } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { get, post } from '../api/client'
import { normalizeLanguage } from '../localeCodes'
import type { ClinicalEntriesResponse } from '../PatientDataSection'
import type { Case, Status } from '../types'
import { useAction } from '../ui'
import {
  comparisonDataReason,
  comparisonModelReason,
  comparisonReadinessReason,
} from './comparisonReadiness'
import type { ComparisonRun } from './comparisonTypes'

export type ComparisonView = 'comparison' | 'forecast'

/** One controller coordinates the header and both result views for a patient. */
export function useClinicalComparison({
  c,
  canEdit,
  active,
  externalBusy = false,
}: {
  c?: Case
  canEdit: boolean
  active: boolean
  externalBusy?: boolean
}) {
  const { t, i18n } = useTranslation()
  const { message } = App.useApp()
  const { act, busy } = useAction()
  const [selected, setSelected] = useState<Partial<Record<ComparisonView, string>>>({})
  const language = normalizeLanguage(i18n.resolvedLanguage || i18n.language)
  const records = useQuery({
    queryKey: ['clinical-entries', c?.id, c?.version],
    queryFn: ({ signal }) =>
      get<ClinicalEntriesResponse>(`/cases/${c!.id}/clinical-entries`, signal),
    enabled: !!c,
  })
  const runs = useQuery({
    queryKey: ['clinical-comparisons', c?.id, c?.version],
    queryFn: ({ signal }) =>
      get<{ items: ComparisonRun[] }>(`/cases/${c!.id}/clinical-comparisons`, signal),
    enabled: !!c && active,
    refetchInterval: (query) =>
      query.state.data?.items.some((run) => ['queued', 'running'].includes(run.status))
        ? 2000
        : false,
  })
  const model = useQuery({
    queryKey: ['status'],
    queryFn: ({ signal }) => get<Status>('/system/status', signal),
    enabled: !!c && canEdit && active,
    refetchInterval: 10000,
  })
  const pending =
    runs.data?.items.find((run) => ['queued', 'running'].includes(run.status)) ||
    c?.analyses.find((run) => ['queued', 'running'].includes(run.status))
  const readinessState = {
    canEdit,
    pending: !!pending,
    busy: busy || externalBusy,
    recordsPending: records.isPending,
    recordsError: records.error,
    readiness: records.data?.readiness,
    modelPending: model.isPending,
    model: model.data?.model,
  }
  const reason = comparisonReadinessReason(readinessState)
  const selectRun = (view: ComparisonView, runId: string) =>
    setSelected((previous) => ({ ...previous, [view]: runId }))

  const launch = (view: ComparisonView = 'comparison', refreshReadiness = false) => {
    if (!c || !canEdit || pending || externalBusy || (!refreshReadiness && reason)) return
    // useAction also guards synchronously, before React can render the busy state.
    return act(async () => {
      if (refreshReadiness) {
        const latestRecords = await get<ClinicalEntriesResponse>(`/cases/${c.id}/clinical-entries`)
        const dataReason = comparisonDataReason({
          ...readinessState,
          busy: false,
          recordsPending: false,
          recordsError: null,
          readiness: latestRecords.readiness,
        })
        if (dataReason) {
          void message.info(t(dataReason))
          return
        }
        const latestStatus = await get<Status>('/system/status')
        const modelReason = comparisonModelReason(latestStatus.model)
        if (modelReason) {
          void message.warning(t(modelReason))
          return
        }
      }
      const next = await post<{ run_id: string }>(`/cases/${c.id}/clinical-comparisons`, {
        expected_version: c.version,
        language,
      })
      selectRun(view, next.run_id)
    }, false)
  }

  const retry = (run: ComparisonRun, view: ComparisonView) => {
    if (!c || reason) return
    if (run.is_stale) return launch(view)
    return act(async () => {
      const next = await post<{ run_id: string }>(`/analyses/${run.id}/retry`, {
        expected_version: c.version,
        language,
      })
      selectRun(view, next.run_id)
    }, false)
  }

  const cancel = () => {
    if (canEdit && pending) return act(() => post(`/analyses/${pending.id}/cancel`))
  }

  return {
    records,
    runs,
    model,
    selected,
    selectRun,
    language,
    pending,
    reason,
    busy,
    launch,
    retry,
    cancel,
  }
}

export type ClinicalComparisonController = ReturnType<typeof useClinicalComparison>
