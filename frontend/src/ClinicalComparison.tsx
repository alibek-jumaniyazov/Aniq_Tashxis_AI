import AnalysisProvenance from './AnalysisProvenance'
import AiProcessingNotice from './AiProcessingNotice'
import { supportsClinicalModel } from './aiProvider'
import { useState } from 'react'
import { Alert, Button, Select, Space, Tag } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { normalizeLanguage } from './localeCodes'
import { analysisLanguage, localizedHistoryRuns, localizedRun, analysisOriginKey } from './analysisLocale'
import { ArrowUpRight, CheckCircle2, Circle, FileText, LoaderCircle, RefreshCw, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react'
import { get, post } from './api/client'
import type { Case, Run, Status, User } from './types'
import type { ClinicalEntriesResponse } from './PatientDataSection'
import { Failure, Loading, StateTag, time, useAction } from './ui'
import './patientWorkspace.css'

type ReviewStatus = 'consistent_with_data' | 'needs_review' | 'insufficient_data'
interface ComparisonEvidence { ref: string; entry_id?: string; fact_id?: string; category: string; text: string; source_id?: string | null; event_time?: string | null; available_time?: string | null; order_status?: string | null }
interface ComparisonReview { status: ReviewStatus; summary: string; refs: string[] }
export interface ComparisonReport {
  case_version: number; summary: string; status: 'requires_clinician_review' | 'insufficient_data'
  diagnosis_review: ComparisonReview; treatment_review: ComparisonReview
  supporting: { text: string; refs: string[] }[]; discrepancies: { text: string; refs: string[] }[]
  questions: string[]; next_steps: string[]; limitations: string[]; evidence: ComparisonEvidence[]
  five_year_outlook: { status: 'qualitative_only' | 'insufficient_data'; summary: string; scenarios: { scenario: string; conditions: string; monitoring: string; refs: string[] }[] }
  requires_clinician_review: true; validated_probability: false
}
export interface ComparisonRun extends Omit<Run, 'result' | 'review_focus'> {
  review_focus?: 'clinical_comparison'
  result: { language?: string; provenance?: string; demo_only?: boolean; comparison?: ComparisonReport | null; limitations?: string[]; model_id?: string; provider?: string; ai_backend?: string; prompt_version?: string }
}
interface ClinicalComparisonProps {
  c: Case; user: User; openSource: (id: string) => void; view?: 'comparison' | 'forecast'; openConclusion?: () => void
  initialRunId?: string; launchBusy?: boolean
}

/** A saved result is shown only after a terminal successful run, never from pending or failed payloads. */
export function ComparisonResult({ run, view = 'comparison', openSource }: { run?: ComparisonRun; view?: 'comparison' | 'forecast'; openSource: (id: string) => void }) {
  const { t, i18n } = useTranslation()
  const localeMismatch = !!run && analysisLanguage(run) !== normalizeLanguage(i18n.resolvedLanguage || i18n.language)
  const pending = !!run && ['queued', 'running'].includes(run.status)
  const report = run && ['succeeded', 'partial'].includes(run.status) ? run.result.comparison : null
  const evidence = report?.evidence || []
  const codes = [...new Set([...(run?.result.limitations || []), ...(run?.error_code ? [run.error_code] : [])])]
  const refs = (items: string[], compact = true) => <div className={`pw-reference-list${compact ? ' pw-reference-list--compact' : ''}`}>{items.map(ref => {
    const item = evidence.find(entry => entry.ref === ref)
    if (!item) return <span className="pw-reference-missing" key={ref}>{ref} · {t('pw_unknown_ref')}</span>
    const content = <><FileText size={compact ? 12 : 14}/><span><strong>{ref} · {t(`pw_${item.category}`, { defaultValue: t('source') })}</strong>{!compact && <><small>{item.text}</small>{item.fact_id && <span className="pw-evidence-context"><span>{t('eventTime')}: {item.event_time ? time(item.event_time) : t('unknown')}</span><span>{t('availableTime')}: {item.available_time ? time(item.available_time) : t('unknown')}</span>{item.order_status && item.order_status !== 'not_applicable' && <span>{t('orderStatus')}: {item.order_status === 'stopped' ? t('pw_order_stopped') : t(item.order_status, { defaultValue: t('unknown') })}</span>}</span>}</>}</span>{item.source_id && <ArrowUpRight size={compact ? 12 : 14}/>}</>
    return item.source_id ? <button type="button" className="pw-reference" key={ref} title={compact ? item.text : undefined} onClick={() => openSource(item.source_id!)} aria-label={`${t('openSource')}: ${ref}`}>{content}</button> : <div key={ref} className="pw-reference" title={compact ? item.text : undefined}>{content}</div>
  })}</div>
  const reviewCard = (review: ComparisonReview, title: string) => <article className={`pw-review-card pw-review-card--${review.status}`}><h3>{t(title)}</h3><Tag color={review.status === 'consistent_with_data' ? 'cyan' : 'gold'}>{t(`pw_${review.status}`)}</Tag><p>{review.summary}</p>{refs(review.refs)}</article>

  return <section className="pw-ai-result" data-testid="clinical-comparison-result" aria-busy={pending} aria-label={t(view === 'forecast' ? 'pw_forecast_title' : 'pw_comparisonResults')}>
    <header><span className="pw-ai-symbol">{view === 'forecast' ? <TrendingUp size={24}/> : <Sparkles size={24}/>}</span><div><span className="pw-ai-eyebrow">{t(analysisOriginKey(run))}</span><h2>{t(view === 'forecast' ? 'pw_forecast_title' : 'pw_comparisonResults')}</h2></div>{run && <StateTag status={run.status}/>}</header>
    <div className="pw-ai-body">
      {run && <div className="pw-ai-meta"><span>{t('evaluatedVersion')} <b>v{run.case_version}</b></span><span>{time(run.created_at)}</span></div>}
      <AnalysisProvenance run={run} mismatch={localeMismatch}/>
      {run?.is_stale && <Alert showIcon type="warning" message={t('stale')} description={t('aiResultStaleHint')}/>}
      {pending ? <div className="pw-ai-empty" role="status" aria-live="polite"><LoaderCircle size={32} className="spin"/><h3>{t('pw_compare_pending')}</h3><p>{t('pw_compare_pending_hint')}</p></div> : localeMismatch ? null : report ? <>
        {report.status === 'insufficient_data' && <Alert showIcon type="warning" message={t('pw_insufficient_data')}/>}
        {view === 'comparison' ? <>
          <section className="pw-ai-summary"><span>{t('pw_compare_summary')}</span><p>{report.summary}</p></section>
          <div className="pw-review-grid">{reviewCard(report.diagnosis_review, 'pw_diagnosis_review')}{reviewCard(report.treatment_review, 'pw_treatment_review')}</div>
          <div className="pw-review-grid">{(['supporting', 'discrepancies'] as const).map(key => <section key={key} className={`pw-findings pw-findings--${key}`}><h3>{t(`pw_${key}`)}</h3>{report[key].length ? report[key].map((item, index) => <article key={index}><p>{item.text}</p>{refs(item.refs)}</article>) : <p className="muted">{t('pw_no_items')}</p>}</section>)}</div>
          <div className="pw-review-grid">{(['questions', 'next_steps'] as const).map(key => <section className="pw-followup" key={key}><h3>{t(`pw_${key}`)}</h3>{report[key].length ? <ol>{report[key].map((item, index) => <li key={index}>{item}</li>)}</ol> : <p className="muted">{t('pw_no_items')}</p>}</section>)}</div>
        </> : <>
          <Alert showIcon type="info" message={t('pw_qualitative_only')} description={t('pw_forecast_hint')}/>
          <section className="pw-ai-summary"><Tag color={report.five_year_outlook.status === 'insufficient_data' ? 'gold' : 'cyan'}>{t(`pw_${report.five_year_outlook.status}`)}</Tag><p>{report.five_year_outlook.summary}</p></section>
          <div className="pw-scenarios">{report.five_year_outlook.scenarios.length ? report.five_year_outlook.scenarios.map((scenario, index) => <article key={index}><span className="pw-scenario-number">{String(index + 1).padStart(2, '0')}</span><div><h3>{scenario.scenario}</h3><h4>{t('pw_conditions')}</h4><p>{scenario.conditions}</p><h4>{t('pw_monitoring')}</h4><p>{scenario.monitoring}</p>{refs(scenario.refs)}</div></article>) : <p>{t('pw_no_scenarios')}</p>}</div>
        </>}
        {!!report.evidence.length && <details className="pw-all-evidence"><summary>{t('pw_evidence')} · {report.evidence.length}</summary>{refs(report.evidence.map(item => item.ref), false)}</details>}
        {!!report.limitations.length && <section className="pw-limitations"><h3>{t('limitations')}</h3><ul>{report.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></section>}
      </> : <div className="pw-ai-empty"><Sparkles size={32}/><h3>{t(!run ? 'pw_compare_empty' : run.status === 'cancelled' ? 'aiResultCancelled' : run.status === 'failed' ? 'aiResultFailed' : 'aiResultUnavailable')}</h3><p>{t(!run ? view === 'forecast' ? 'pw_forecast_empty' : 'pw_compare_empty_hint' : 'aiResultRetryHint')}</p></div>}
      {!pending && codes.map(code => <Alert key={code} showIcon type={run?.status === 'failed' ? 'error' : 'warning'} message={t(code)}/>)}
    </div>
    <footer><ShieldCheck size={18}/><span>{t('aiResultClinicianNotice')}</span></footer>
  </section>
}

export default function ClinicalComparison({ c, user, openSource, view = 'comparison', openConclusion, initialRunId, launchBusy }: ClinicalComparisonProps) {
  const { t, i18n } = useTranslation()
  const { act, busy } = useAction()
  const [selected, setSelected] = useState<string | undefined>(initialRunId)
  const canEdit = user.role === 'doctor'
  const records = useQuery({ queryKey: ['clinical-entries', c.id, c.version], queryFn: ({ signal }) => get<ClinicalEntriesResponse>(`/cases/${c.id}/clinical-entries`, signal) })
  const runs = useQuery({ queryKey: ['clinical-comparisons', c.id, c.version], queryFn: ({ signal }) => get<{ items: ComparisonRun[] }>(`/cases/${c.id}/clinical-comparisons`, signal), refetchInterval: query => query.state.data?.items.some(run => ['queued', 'running'].includes(run.status)) ? 2000 : false })
  const model = useQuery({ queryKey: ['status'], queryFn: ({ signal }) => get<Status>('/system/status', signal), enabled: canEdit, refetchInterval: 10000 })
  const language = normalizeLanguage(i18n.resolvedLanguage || i18n.language)
  const run = localizedRun(runs.data?.items || [], selected, language)
  const localeMismatch = !!run && analysisLanguage(run) !== language
  const pending = runs.data?.items.find(item => ['queued', 'running'].includes(item.status)) || c.analyses.find(item => ['queued', 'running'].includes(item.status))
  const ready = records.data?.readiness
  const reason = !canEdit ? t('clinicalOnlyDoctor') : pending || launchBusy ? t('clinicalPendingHint') : records.isPending ? t('clinicalReadyChecking') : records.error ? t('clinicalReadyFailed') : !ready?.comparison_ready ? t('pw_ready_hint') : model.isPending ? t('clinicalModelChecking') : !model.data?.model.ready ? t(model.data?.model.reason || 'clinicalModelUnavailable') : !supportsClinicalModel(model.data.model) ? t('clinicalModelProfile') : ''
  const launch = () => void act(async () => {
    const next = await post<{ run_id: string }>(`/cases/${c.id}/clinical-comparisons`, { expected_version: c.version, language })
    setSelected(next.run_id)
  }, false)
  const retry = () => {
    if (!run || reason) return
    if (run.is_stale) { launch(); return }
    void act(async () => {
      const next = await post<{ run_id: string }>(`/analyses/${run.id}/retry`, { expected_version: c.version, language })
      setSelected(next.run_id)
    }, false)
  }
  return <div className="patient-comparison-workspace">
    <section className="panel pw-comparison-launch"><div className="pw-section-intro"><span className="pw-section-icon"><Sparkles size={24}/></span><div><h2>{t(view === 'forecast' ? 'pw_forecast_title' : 'pw_compare_title')}</h2><p>{t(view === 'forecast' ? 'pw_forecast_hint' : 'pw_compare_hint')}</p></div></div>
      <AiProcessingNotice model={model.data?.model}/><div className="pw-readiness">{([{ key: 'has_confirmed_data', label: 'pw_data_ready' }, { key: 'has_confirmed_conclusion', label: 'pw_conclusion_ready' }, { key: 'adult_age_known', label: 'pw_age_ready' }] as const).map(item => <span key={item.key} className={ready?.[item.key] ? 'ready' : ''}>{ready?.[item.key] ? <CheckCircle2 size={17}/> : <Circle size={17}/>} {t(item.label)}</span>)}</div>
      {records.error && <Failure error={records.error} retry={() => void records.refetch()}/>}
      {model.error && <Failure error={model.error} retry={() => void model.refetch()}/>}
      <Space wrap>{canEdit && <Button type="primary" icon={<Sparkles size={16}/>} loading={busy} disabled={!!reason} onClick={launch}>{t('pw_compare_run')}</Button>}{canEdit && !ready?.has_confirmed_conclusion && openConclusion && <Button onClick={openConclusion}>{t('pw_goConclusion')}</Button>}{canEdit && pending && <Button loading={busy} onClick={() => void act(() => post(`/analyses/${pending.id}/cancel`))}>{t('cancel')}</Button>}{canEdit && !pending && model.data && !model.data.model.ready && <Button size="small" loading={model.isFetching} icon={<RefreshCw size={14}/>} onClick={() => void model.refetch()}>{t('refreshStatus')}</Button>}</Space>
      {reason && <p className="pw-action-hint">{reason}</p>}<p className="pw-method-note">{t('pw_language_hint')}</p>
    </section>
    <p className="pw-decision-notice"><ShieldCheck size={19}/>{t('pw_compare_notice')}</p>
    {runs.isPending ? <Loading/> : runs.error ? <Failure error={runs.error} retry={() => void runs.refetch()}/> : <>
      {!!runs.data?.items.length && <Select className="full-width pw-run-selector" aria-label={t('pw_comparisonResults')} value={run?.id} onChange={setSelected} options={localizedHistoryRuns(runs.data.items, language).map(item => ({ value: item.id, label: `${analysisLanguage(item).toUpperCase()} · v${item.case_version} · ${time(item.created_at)} · ${t(item.status)}` }))}/>}
      <ComparisonResult run={run} view={view} openSource={openSource}/>
      {canEdit && run && (run.is_stale || localeMismatch || ['partial', 'failed', 'cancelled'].includes(run.status)) && !['queued', 'running'].includes(run.status) && <div className="pw-retry"><Button icon={<RefreshCw size={16}/>} onClick={retry} loading={busy} disabled={!!reason}>{t(localeMismatch ? 'aiRegenerateLanguage' : run.is_stale ? 'aiResultRerun' : 'retry')}</Button>{reason && <span>{reason}</span>}</div>}
    </>}
  </div>
}
