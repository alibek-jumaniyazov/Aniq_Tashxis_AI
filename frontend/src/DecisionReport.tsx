import { Alert, Tag } from 'antd'
import { useTranslation } from 'react-i18next'
import type { Run } from './types'
import { SectionTitle, SourceButton, time } from './ui'

export default function DecisionReport({ run, openSource }: { run: Run; openSource: (id: string) => void }) {
  const { t } = useTranslation()
  const report = run.result.decision_review
  if (!report) return null
  return <section className="panel margin-top"><SectionTitle title={t('decisionEvidence')} subtitle={t('decisionScope')}/><div className="run-meta"><Tag>v{run.case_version}</Tag><span>{t(report.mode)}</span>{report.decision_time && <strong>{time(report.decision_time)}</strong>}<span>{t('evaluatedFacts')}: {report.evaluated_facts}</span><span>{t('excludedFacts')}: {report.excluded_facts}</span></div>{report.checks.map(check => <article className="decision-check" key={check.code}><div><h3>{t(check.code)}</h3><Tag color={check.status === 'attention' ? 'orange' : check.status === 'checked' ? 'cyan' : undefined}>{t(check.status)}</Tag></div><p>{t(`${check.code}Hint`)}</p>{check.evidence.map((e, index) => <div className="decision-evidence" key={`${e.fact_id}-${index}`}><span>{e.label}: <strong>{e.value ?? '—'} {e.unit}</strong></span><SourceButton onClick={() => openSource(e.source_id)}/></div>)}</article>)}<Alert type="info" showIcon message={t('decisionNotDiagnosis')}/></section>
}
