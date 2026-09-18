import { Alert, Button, Tag } from 'antd'
import { ArrowUpRight, BookOpenCheck, CircleHelp, ClipboardCheck, FileText, Info, LoaderCircle, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { EvidenceRef, Run } from './types'
import { StateTag, time } from './ui'
import './aiAnalysis.css'

type Hypothesis = NonNullable<NonNullable<Run['result']['ai']>['assessment']>['differential'][number]

export interface AiAnalysisPanelProps {
  run?: Run
  kind?: 'clinical' | 'decision' | 'radiology'
  openSource?: (sourceId: string) => void
  onRetry?: () => void
  retryDisabledReason?: string
  onCancel?: () => void
  busy?: boolean
  onReviewHypothesis?: (hypothesis: Hypothesis, evidence: EvidenceRef[]) => void
}

/** Keep model output as escaped text while preserving its paragraphs and lists. */
function ResultText({ text }: { text: string }) {
  return <div className="ai-result-prose">{text.split(/\n\s*\n/).filter(part => part.trim()).map((part, i) => <p key={i}>{part.trim()}</p>)}</div>
}

export default function AiAnalysisPanel({ run, kind = 'decision', openSource, onRetry, retryDisabledReason, onCancel, busy = false, onReviewHypothesis }: AiAnalysisPanelProps) {
  const { t } = useTranslation()
  const pending = !!run && ['queued', 'running'].includes(run.status)
  const ai = run?.result.ai
  const assessment = ai?.assessment
  const evidence = ai?.evidence || []
  const observations = run?.result.image_review?.observations || []
  const limitationCodes = [...new Set([...(run?.result.limitations || []), ...(run?.error_code ? [run.error_code] : [])])]
  const limitations = [...new Set([...(ai?.limitations || []), ...(run?.result.image_review?.limitations || [])])]
  const missingFields = [...new Set(ai?.missing_fields || [])]
  const hasContent = !!ai?.summary?.trim() || !!observations.length
  const terminalFailure = !!run && ['failed', 'cancelled'].includes(run.status)
  const mayShowContent = !pending && !terminalFailure && hasContent
  const stateKey = !run ? 'aiResultNotStarted' : run.status === 'cancelled' ? 'aiResultCancelled' : run.status === 'failed' ? 'aiResultFailed' : limitationCodes.includes('AI_NOT_REQUESTED') ? 'aiResultNotRequested' : 'aiResultUnavailable'
  const hintKey = !run ? 'aiResultStartHint' : terminalFailure ? 'aiResultRetryHint' : limitationCodes.includes('AI_NOT_REQUESTED') ? 'aiResultEnableHint' : 'aiResultUnavailableHint'

  const sourceItems = (refs: string[]) => <div className="ai-evidence-list">{refs.map(ref => {
    const item = evidence.find(entry => entry.ref === ref)
    if (!item) return <span className="ai-evidence-unavailable" key={ref}>{ref} · {t('aiEvidenceUnavailable')}</span>
    const content = <><FileText size={15}/><span><b>{item.ref} · {item.label}</b><small>{item.value ?? '—'} {item.unit || ''} · {t(item.assertion)}</small></span>{openSource && <ArrowUpRight size={15}/>}</>
    return openSource && item.source_id
      ? <button key={ref} type="button" className="ai-evidence-item" onClick={() => openSource(item.source_id)} aria-label={`${t('openSource')}: ${item.label}`}>{content}</button>
      : <div className="ai-evidence-item" key={ref}>{content}</div>
  })}</div>

  return <section className={`ai-analysis-panel ai-analysis-panel--${kind}`} data-testid="ai-analysis-panel" aria-label={t('aiResultTitle')} aria-busy={pending}>
    <header className="ai-analysis-header">
      <div className="ai-analysis-brand"><span className="ai-analysis-symbol"><Sparkles size={23}/></span><div><span className="ai-analysis-eyebrow">MEDGEMMA · 4B · {t('aiLocalModel')}</span><h2>{t(kind === 'clinical' ? 'aiClinicalResult' : kind === 'radiology' ? 'aiRadiologyResult' : 'aiDecisionResult')}</h2></div></div>
      {run ? <StateTag status={run.status}/> : <Tag>{t('not_started')}</Tag>}
    </header>
    <div className="ai-analysis-body">
      {run && <div className="ai-analysis-meta"><span>{t('evaluatedVersion')} <b>v{run.case_version}</b></span><span>{time(run.created_at)}</span><span>{t(run.mode)}</span></div>}
      {run?.is_stale && <Alert type="warning" showIcon message={t('stale')} description={t('aiResultStaleHint')}/>}
      {pending ? <div className="ai-result-progress" role="status" aria-live="polite"><LoaderCircle size={30} className="spin"/><div><h3>{t(run?.status === 'queued' ? 'aiResultQueued' : 'aiResultRunning')}</h3><p>{t(run?.stage === 'medgemma' ? 'aiResultModelWorking' : 'aiResultPreparing')}</p><small>{t('aiResultProgressHint')}</small></div></div> : mayShowContent ? <>
        {ai?.summary?.trim() && <section className="ai-result-summary"><div className="ai-result-section-label"><BookOpenCheck size={17}/>{t('aiResultSummary')}</div><ResultText text={ai.summary}/></section>}
        {!!observations.length && <section className="ai-result-observations"><h3><FileText size={17}/>{t('aiImageObservations')}</h3><ol>{observations.map((observation, i) => <li key={i}>{observation}</li>)}</ol></section>}
        {assessment?.status === 'insufficient_data' && <Alert type="warning" showIcon message={t('insufficientDiagnosticData')} description={t('aiNoGuessing')}/>}
        {!!assessment?.differential.length && <div className="ai-hypotheses"><div className="ai-result-section-label"><CircleHelp size={17}/>{t('aiHypothesesTitle')}</div>{assessment.differential.map((hypothesis, index) => <article className="ai-hypothesis" key={`${hypothesis.label}-${index}`}>
          <div className="ai-hypothesis-heading"><span className="ai-hypothesis-number">{String(index + 1).padStart(2, '0')}</span><div><Tag color="gold">{t('unconfirmedHypothesis')}</Tag><h3>{hypothesis.label}</h3></div></div>
          <div className="ai-hypothesis-evidence"><section><h4>{t('supportingEvidence')}</h4>{sourceItems(hypothesis.supporting_refs)}</section>{!!hypothesis.opposing_refs.length && <section><h4>{t('opposingEvidence')}</h4>{sourceItems(hypothesis.opposing_refs)}</section>}</div>
          <div className="ai-verification"><ClipboardCheck size={18}/><div><strong>{t('verificationNeeded')}</strong><p>{hypothesis.verification_needed}</p></div></div>
          {onReviewHypothesis && <><Button onClick={() => onReviewHypothesis(hypothesis, evidence)} disabled={!!run?.is_stale || busy}>{t('reviewHypothesis')}<ArrowUpRight size={15}/></Button>{run?.is_stale && <p className="ai-action-reason">{t('aiHypothesisStale')}</p>}</>}
        </article>)}</div>}
        {!!assessment?.questions.length && <section className="ai-result-questions"><h3><CircleHelp size={18}/>{t('clarifyingQuestions')}</h3><p>{t('aiQuestionsHint')}</p><ol>{assessment.questions.map((question, i) => <li key={i}>{question}</li>)}</ol></section>}
        {!!missingFields.length && <section className="ai-result-questions"><h3>{t('aiMissingData')}</h3><ul>{missingFields.map(field => <li key={field}>{t(field)}</li>)}</ul></section>}
        {!!evidence.length && <details className="ai-evidence-details"><summary>{t('aiAllEvidence', { count: evidence.length })}</summary><p>{t('aiEvidenceHint')}</p>{sourceItems(evidence.map(item => item.ref))}</details>}
      </> : <div className="ai-result-empty"><Info size={28}/><div><h3>{t(stateKey)}</h3><p>{t(hintKey)}</p></div></div>}
      {!pending && !!limitationCodes.length && <div className="ai-result-code-notes">{limitationCodes.map(code => <Alert key={code} type={run?.status === 'failed' ? 'error' : 'warning'} showIcon message={t(code)} description={!code.includes(' ') && code !== t(code) ? <code>{code}</code> : undefined}/>)}</div>}
      {!pending && !!limitations.length && <section className="ai-result-limitations"><h3><Info size={17}/>{t('limitations')}</h3><ul>{limitations.map((limitation, i) => <li key={i}>{limitation}</li>)}</ul></section>}
      {(onRetry || (pending && onCancel)) && <div className="ai-result-actions">{!pending && onRetry && <Button icon={<RefreshCw size={16}/>} onClick={onRetry} disabled={!!retryDisabledReason} loading={busy}>{t(run?.is_stale ? 'aiResultRerun' : 'retry')}</Button>}{pending && onCancel && <Button onClick={onCancel} loading={busy}>{t('cancel')}</Button>}{!pending && retryDisabledReason && <p className="ai-action-reason">{retryDisabledReason}</p>}</div>}
    </div>
    <footer className="ai-analysis-footer"><ShieldCheck size={17}/><span>{t('aiResultClinicianNotice')}</span></footer>
  </section>
}
