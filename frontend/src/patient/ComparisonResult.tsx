import { Alert, Tag } from 'antd'
import { useTranslation } from 'react-i18next'
import {
  ArrowUpRight,
  FileText,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import AnalysisProvenance from '../AnalysisProvenance'
import { normalizeLanguage } from '../localeCodes'
import { analysisLanguage, analysisOriginKey } from '../analysisLocale'
import { StateTag, time } from '../ui'
import type { ComparisonRun, ComparisonReview } from './comparisonTypes'

/** A saved result is shown only after a terminal successful run, never from pending or failed payloads. */
export function ComparisonResult({
  run,
  view = 'comparison',
  openSource,
}: {
  run?: ComparisonRun
  view?: 'comparison' | 'forecast'
  openSource: (id: string) => void
}) {
  const { t, i18n } = useTranslation()
  const localeMismatch =
    !!run && analysisLanguage(run) !== normalizeLanguage(i18n.resolvedLanguage || i18n.language)
  const pending = !!run && ['queued', 'running'].includes(run.status)
  const report = run && ['succeeded', 'partial'].includes(run.status) ? run.result.comparison : null
  const evidence = report?.evidence || []
  const codes = [
    ...new Set([...(run?.result.limitations || []), ...(run?.error_code ? [run.error_code] : [])]),
  ]
  const refs = (items: string[], compact = true) => (
    <div className={`pw-reference-list${compact ? ' pw-reference-list--compact' : ''}`}>
      {items.map((ref) => {
        const item = evidence.find((entry) => entry.ref === ref)
        if (!item)
          return (
            <span className="pw-reference-missing" key={ref}>
              {ref} · {t('pw_unknown_ref')}
            </span>
          )
        const content = (
          <>
            <FileText size={compact ? 12 : 14} />
            <span>
              <strong>
                {ref} · {t(`pw_${item.category}`, { defaultValue: t('source') })}
              </strong>
              {!compact && (
                <>
                  <small>{item.text}</small>
                  {item.fact_id && (
                    <span className="pw-evidence-context">
                      <span>
                        {t('eventTime')}: {item.event_time ? time(item.event_time) : t('unknown')}
                      </span>
                      <span>
                        {t('availableTime')}:{' '}
                        {item.available_time ? time(item.available_time) : t('unknown')}
                      </span>
                      {item.order_status && item.order_status !== 'not_applicable' && (
                        <span>
                          {t('orderStatus')}:{' '}
                          {item.order_status === 'stopped'
                            ? t('pw_order_stopped')
                            : t(item.order_status, { defaultValue: t('unknown') })}
                        </span>
                      )}
                    </span>
                  )}
                </>
              )}
            </span>
            {item.source_id && <ArrowUpRight size={compact ? 12 : 14} />}
          </>
        )
        return item.source_id ? (
          <button
            type="button"
            className="pw-reference"
            key={ref}
            title={compact ? item.text : undefined}
            onClick={() => openSource(item.source_id!)}
            aria-label={`${t('openSource')}: ${ref}`}
          >
            {content}
          </button>
        ) : (
          <div key={ref} className="pw-reference" title={compact ? item.text : undefined}>
            {content}
          </div>
        )
      })}
    </div>
  )
  const reviewCard = (review: ComparisonReview, title: string) => (
    <article className={`pw-review-card pw-review-card--${review.status}`}>
      <h3>{t(title)}</h3>
      <Tag color={review.status === 'consistent_with_data' ? 'cyan' : 'gold'}>
        {t(`pw_${review.status}`)}
      </Tag>
      <p>{review.summary}</p>
      {refs(review.refs)}
    </article>
  )

  return (
    <section
      className="pw-ai-result"
      data-testid="clinical-comparison-result"
      aria-busy={pending}
      aria-label={t(view === 'forecast' ? 'pw_forecast_title' : 'pw_comparisonResults')}
    >
      <header>
        <span className="pw-ai-symbol">
          {view === 'forecast' ? <TrendingUp size={24} /> : <Sparkles size={24} />}
        </span>
        <div>
          <span className="pw-ai-eyebrow">{t(analysisOriginKey(run))}</span>
          <h2>{t(view === 'forecast' ? 'pw_forecast_title' : 'pw_comparisonResults')}</h2>
        </div>
        {run && <StateTag status={run.status} />}
      </header>
      <div className="pw-ai-body">
        {run && (
          <div className="pw-ai-meta">
            <span>
              {t('evaluatedVersion')} <b>v{run.case_version}</b>
            </span>
            <span>{time(run.created_at)}</span>
          </div>
        )}
        <AnalysisProvenance run={run} mismatch={localeMismatch} />
        {run?.is_stale && (
          <Alert
            showIcon
            type="warning"
            message={t('stale')}
            description={t('aiResultStaleHint')}
          />
        )}
        {pending ? (
          <div className="pw-ai-empty" role="status" aria-live="polite">
            <LoaderCircle size={32} className="spin" />
            <h3>{t('pw_compare_pending')}</h3>
            <p>{t('pw_compare_pending_hint')}</p>
          </div>
        ) : localeMismatch ? null : report ? (
          <>
            {report.status === 'insufficient_data' && (
              <Alert showIcon type="warning" message={t('pw_insufficient_data')} />
            )}
            {view === 'comparison' ? (
              <>
                <section className="pw-ai-summary">
                  <span>{t('pw_compare_summary')}</span>
                  <p>{report.summary}</p>
                </section>
                <div className="pw-review-grid">
                  {reviewCard(report.diagnosis_review, 'pw_diagnosis_review')}
                  {reviewCard(report.treatment_review, 'pw_treatment_review')}
                </div>
                <div className="pw-review-grid">
                  {(['supporting', 'discrepancies'] as const).map((key) => (
                    <section key={key} className={`pw-findings pw-findings--${key}`}>
                      <h3>{t(`pw_${key}`)}</h3>
                      {report[key].length ? (
                        report[key].map((item, index) => (
                          <article key={index}>
                            <p>{item.text}</p>
                            {refs(item.refs)}
                          </article>
                        ))
                      ) : (
                        <p className="muted">{t('pw_no_items')}</p>
                      )}
                    </section>
                  ))}
                </div>
                <div className="pw-review-grid">
                  {(['questions', 'next_steps'] as const).map((key) => (
                    <section className="pw-followup" key={key}>
                      <h3>{t(`pw_${key}`)}</h3>
                      {report[key].length ? (
                        <ol>
                          {report[key].map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ol>
                      ) : (
                        <p className="muted">{t('pw_no_items')}</p>
                      )}
                    </section>
                  ))}
                </div>
              </>
            ) : (
              <>
                <Alert
                  showIcon
                  type="info"
                  message={t('pw_qualitative_only')}
                  description={t('pw_forecast_hint')}
                />
                <section className="pw-ai-summary">
                  <Tag
                    color={
                      report.five_year_outlook.status === 'insufficient_data' ? 'gold' : 'cyan'
                    }
                  >
                    {t(`pw_${report.five_year_outlook.status}`)}
                  </Tag>
                  <p>{report.five_year_outlook.summary}</p>
                </section>
                <div className="pw-scenarios">
                  {report.five_year_outlook.scenarios.length ? (
                    report.five_year_outlook.scenarios.map((scenario, index) => (
                      <article key={index}>
                        <span className="pw-scenario-number">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div>
                          <h3>{scenario.scenario}</h3>
                          <h4>{t('pw_conditions')}</h4>
                          <p>{scenario.conditions}</p>
                          <h4>{t('pw_monitoring')}</h4>
                          <p>{scenario.monitoring}</p>
                          {refs(scenario.refs)}
                        </div>
                      </article>
                    ))
                  ) : (
                    <p>{t('pw_no_scenarios')}</p>
                  )}
                </div>
              </>
            )}
            {!!report.evidence.length && (
              <details className="pw-all-evidence">
                <summary>
                  {t('pw_evidence')} · {report.evidence.length}
                </summary>
                {refs(
                  report.evidence.map((item) => item.ref),
                  false,
                )}
              </details>
            )}
            {!!report.limitations.length && (
              <section className="pw-limitations">
                <h3>{t('limitations')}</h3>
                <ul>
                  {report.limitations.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : (
          <div className="pw-ai-empty">
            <Sparkles size={32} />
            <h3>
              {t(
                !run
                  ? 'pw_compare_empty'
                  : run.status === 'cancelled'
                    ? 'aiResultCancelled'
                    : run.status === 'failed'
                      ? 'aiResultFailed'
                      : 'aiResultUnavailable',
              )}
            </h3>
            <p>
              {t(
                !run
                  ? view === 'forecast'
                    ? 'pw_forecast_empty'
                    : 'pw_compare_empty_hint'
                  : 'aiResultRetryHint',
              )}
            </p>
          </div>
        )}
        {!pending &&
          codes.map((code) => (
            <Alert
              key={code}
              showIcon
              type={run?.status === 'failed' ? 'error' : 'warning'}
              message={t(code)}
            />
          ))}
      </div>
      <footer>
        <ShieldCheck size={18} />
        <span>{t('aiResultClinicianNotice')}</span>
      </footer>
    </section>
  )
}
