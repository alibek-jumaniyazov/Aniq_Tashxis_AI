import AiProcessingNotice from './AiProcessingNotice'
import { Button, Select, Space } from 'antd'
import { useTranslation } from 'react-i18next'
import { analysisLanguage, localizedHistoryRuns, localizedRun } from './analysisLocale'
import { CheckCircle2, Circle, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { Failure, Loading, time } from './ui'
import { ComparisonResult } from './patient/ComparisonResult'
import type { ClinicalComparisonController, ComparisonView } from './patient/useClinicalComparison'
import './patientWorkspace.css'

export { ComparisonResult } from './patient/ComparisonResult'
export type { ComparisonReport, ComparisonRun } from './patient/comparisonTypes'

interface ClinicalComparisonProps {
  comparison: ClinicalComparisonController
  canEdit: boolean
  openSource: (id: string) => void
  view?: ComparisonView
  openConclusion?: () => void
}

export default function ClinicalComparison({
  comparison,
  canEdit,
  openSource,
  view = 'comparison',
  openConclusion,
}: ClinicalComparisonProps) {
  const { t } = useTranslation()
  const { records, runs, model, language, pending, busy } = comparison
  const run = localizedRun(runs.data?.items || [], comparison.selected[view], language)
  const localeMismatch = !!run && analysisLanguage(run) !== language
  const ready = records.data?.readiness
  const reason = comparison.reason ? t(comparison.reason) : ''
  return (
    <div className="patient-comparison-workspace">
      <section className="panel pw-comparison-launch">
        <div className="pw-section-intro">
          <span className="pw-section-icon">
            <Sparkles size={24} />
          </span>
          <div>
            <h2>{t(view === 'forecast' ? 'pw_forecast_title' : 'pw_compare_title')}</h2>
            <p>{t(view === 'forecast' ? 'pw_forecast_hint' : 'pw_compare_hint')}</p>
          </div>
        </div>
        <AiProcessingNotice model={model.data?.model} />
        <div className="pw-readiness">
          {(
            [
              { key: 'has_confirmed_data', label: 'pw_data_ready' },
              { key: 'has_confirmed_conclusion', label: 'pw_conclusion_ready' },
              { key: 'adult_age_known', label: 'pw_age_ready' },
            ] as const
          ).map((item) => (
            <span key={item.key} className={ready?.[item.key] ? 'ready' : ''}>
              {ready?.[item.key] ? <CheckCircle2 size={17} /> : <Circle size={17} />}{' '}
              {t(item.label)}
            </span>
          ))}
        </div>
        {records.error && <Failure error={records.error} retry={() => void records.refetch()} />}
        {model.error && <Failure error={model.error} retry={() => void model.refetch()} />}
        <Space wrap>
          {canEdit && (
            <Button
              type="primary"
              icon={<Sparkles size={16} />}
              loading={busy}
              disabled={!!reason}
              onClick={() => void comparison.launch(view)}
            >
              {t('pw_compare_run')}
            </Button>
          )}
          {canEdit && !ready?.has_confirmed_conclusion && openConclusion && (
            <Button onClick={openConclusion}>{t('pw_goConclusion')}</Button>
          )}
          {canEdit && pending && (
            <Button loading={busy} onClick={() => void comparison.cancel()}>
              {t('cancel')}
            </Button>
          )}
          {canEdit && !pending && model.data && !model.data.model.ready && (
            <Button
              size="small"
              loading={model.isFetching}
              icon={<RefreshCw size={14} />}
              onClick={() => void model.refetch()}
            >
              {t('refreshStatus')}
            </Button>
          )}
        </Space>
        {reason && <p className="pw-action-hint">{reason}</p>}
        <p className="pw-method-note">{t('pw_language_hint')}</p>
      </section>
      <p className="pw-decision-notice">
        <ShieldCheck size={19} />
        {t('pw_compare_notice')}
      </p>
      {runs.isPending ? (
        <Loading />
      ) : runs.error ? (
        <Failure error={runs.error} retry={() => void runs.refetch()} />
      ) : (
        <>
          {!!runs.data?.items.length && (
            <Select
              className="full-width pw-run-selector"
              aria-label={t('pw_comparisonResults')}
              value={run?.id}
              onChange={(id) => comparison.selectRun(view, id)}
              options={localizedHistoryRuns(runs.data.items, language).map((item) => ({
                value: item.id,
                label: `${analysisLanguage(item).toUpperCase()} · v${item.case_version} · ${time(item.created_at)} · ${t(item.status)}`,
              }))}
            />
          )}
          <ComparisonResult run={run} view={view} openSource={openSource} />
          {canEdit &&
            run &&
            (run.is_stale ||
              localeMismatch ||
              ['partial', 'failed', 'cancelled'].includes(run.status)) &&
            !['queued', 'running'].includes(run.status) && (
              <div className="pw-retry">
                <Button
                  icon={<RefreshCw size={16} />}
                  onClick={() => void comparison.retry(run, view)}
                  loading={busy}
                  disabled={!!reason}
                >
                  {t(
                    localeMismatch
                      ? 'aiRegenerateLanguage'
                      : run.is_stale
                        ? 'aiResultRerun'
                        : 'retry',
                  )}
                </Button>
                {reason && <span>{reason}</span>}
              </div>
            )}
        </>
      )}
    </div>
  )
}
