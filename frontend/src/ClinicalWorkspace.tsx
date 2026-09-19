import LocalizedForm from './LocalizedForm'
import AiProcessingNotice from './AiProcessingNotice'
import { supportsClinicalModel } from './aiProvider'
import { useState } from 'react'
import { Alert, Button, Checkbox, Form, Input, Modal, Select, Space, Tag } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { normalizeLanguage } from './localeCodes'
import { analysisLanguage, localizedHistoryRuns, localizedRun } from './analysisLocale'
import { ClipboardCheck, RefreshCw, Sparkles } from 'lucide-react'
import { get, post } from './api/client'
import type { Case, Readiness, Status, User } from './types'
import { Failure, Loading, SectionTitle, time, useAction } from './ui'
import AiAnalysisPanel from './AiAnalysisPanel'
import WorkflowGuide from './WorkflowGuide'

export default function ClinicalWorkspace({
  c,
  user,
  openSource,
  openFacts,
}: {
  c: Case
  user: User
  openSource: (id: string) => void
  openFacts: () => void
}) {
  const { t, i18n } = useTranslation()
  const language = normalizeLanguage(i18n.resolvedLanguage || i18n.language)
  const { act, busy } = useAction()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string>()
  const [conclusionContext, setConclusionContext] = useState<{
    version: number
    runId: string | null
  }>({ version: c.version, runId: null })
  const [form] = Form.useForm()
  const canEdit = user.role === 'doctor'
  const readiness = useQuery({
    queryKey: ['readiness', c.id, c.version],
    queryFn: ({ signal }) => get<Readiness>(`/cases/${c.id}/readiness`, signal),
  })
  const model = useQuery({
    queryKey: ['status'],
    queryFn: ({ signal }) => get<Status>('/system/status', signal),
    refetchInterval: 10000,
    enabled: canEdit,
  })
  const runs = c.analyses.filter((item) => item.review_focus === 'clinical_assessment')
  const run = localizedRun(runs, selected, language)
  const localeMismatch = !!run && analysisLanguage(run) !== language
  const pending = c.analyses.find((item) => ['queued', 'running'].includes(item.status))
  const confirmed = c.facts.filter((fact) => fact.confirmed)
  const conclusionChanged = conclusionContext.version !== c.version
  const launchReason = !canEdit
    ? t('clinicalOnlyDoctor')
    : pending
      ? t('clinicalPendingHint')
      : readiness.error
        ? t('clinicalReadyFailed')
        : readiness.isPending || !readiness.data
          ? t('clinicalReadyChecking')
          : readiness.data.clinical_population_eligible === false
            ? t('patientAgeForClinicalAI')
            : !readiness.data.clinical_review_ready
              ? t('INSUFFICIENT_CONFIRMED_EVIDENCE')
              : model.isPending
                ? t('clinicalModelChecking')
                : !model.data?.model.ready
                  ? t('clinicalModelUnavailable')
                  : !supportsClinicalModel(model.data.model)
                    ? t('clinicalModelProfile')
                    : ''

  const launch = () =>
    void act(async () => {
      const next = await post<{ run_id: string }>(`/cases/${c.id}/analyses`, {
        expected_version: c.version,
        include_ai: true,
        mode: 'current',
        review_focus: 'clinical_assessment',
        language,
      })
      setSelected(next.run_id)
    }, false)
  const retry = () => {
    if (!run) return
    if (run.is_stale) {
      launch()
      return
    }
    void act(async () => {
      const next = await post<{ run_id: string }>(`/analyses/${run.id}/retry`, {
        expected_version: c.version,
        language,
      })
      setSelected(next.run_id)
    }, false)
  }
  const conclusion = (diagnosis = '', factIds: string[] = [], runId: string | null = null) => {
    form.resetFields()
    form.setFieldsValue({
      diagnosis,
      status: 'provisional',
      fact_ids: factIds,
      clinician_confirmed: false,
    })
    setConclusionContext({ version: c.version, runId })
    setOpen(true)
  }

  return (
    <>
      <WorkflowGuide topic="clinical" />
      <section className="panel clinical-workspace">
        <SectionTitle
          title={t('clinicalReview')}
          subtitle={t('clinicalReviewHint')}
          extra={<Sparkles size={21} />}
        />
        <Alert type="info" showIcon message={t('clinicalReviewNotice')} />
        <AiProcessingNotice model={model.data?.model} />
        {readiness.isPending ? (
          <Loading />
        ) : readiness.error ? (
          <Failure error={readiness.error} retry={() => void readiness.refetch()} />
        ) : (
          readiness.data && (
            <>
              <div className="readiness-grid">
                <div>
                  <strong>
                    {readiness.data.confirmed_facts}/{readiness.data.total_facts}
                  </strong>
                  <span>{t('confirmed')}</span>
                </div>
                <div>
                  <strong>{readiness.data.unconfirmed_facts}</strong>
                  <span>{t('pendingFacts')}</span>
                </div>
                <div>
                  <strong>{readiness.data.potential_conflicts.length}</strong>
                  <span>{t('conflictingEvidence')}</span>
                </div>
              </div>
              {!!readiness.data.unconfirmed_facts && (
                <Alert
                  className="margin-bottom"
                  type="warning"
                  showIcon
                  message={t('draftExcluded')}
                  action={
                    <Button size="small" onClick={openFacts}>
                      {t('inspect')}
                    </Button>
                  }
                />
              )}
              {!!readiness.data.potential_conflicts.length && (
                <Alert
                  className="margin-bottom"
                  type="warning"
                  showIcon
                  message={t('conflictingEvidenceHint')}
                  description={readiness.data.potential_conflicts.map((conflict) => (
                    <div key={conflict.key}>
                      <Tag>{conflict.key}</Tag>
                      {conflict.fact_ids.map((id) => {
                        const fact = c.facts.find((item) => item.id === id)
                        return (
                          fact && (
                            <Button
                              type="link"
                              size="small"
                              key={id}
                              onClick={() => openSource(fact.source_id)}
                            >
                              {fact.value} {fact.unit}
                            </Button>
                          )
                        )
                      })}
                    </div>
                  ))}
                />
              )}
            </>
          )
        )}
        {canEdit && model.error && (
          <Failure error={model.error} retry={() => void model.refetch()} />
        )}
        <Space wrap className="margin-top">
          {canEdit && (
            <Button
              type="primary"
              icon={<Sparkles size={16} />}
              loading={busy}
              disabled={!!launchReason}
              onClick={launch}
            >
              {t('requestClinicalReview')}
            </Button>
          )}
          {canEdit && (
            <Button
              icon={<ClipboardCheck size={16} />}
              disabled={!confirmed.length || busy}
              onClick={() => conclusion()}
            >
              {t('recordConclusion')}
            </Button>
          )}
          <Button onClick={openFacts}>{t('clinicalInspectFacts')}</Button>
          {canEdit && pending && pending.id !== run?.id && (
            <Button
              loading={busy}
              onClick={() => void act(() => post(`/analyses/${pending.id}/cancel`))}
            >
              {t('cancel')}
            </Button>
          )}
        </Space>
        {launchReason && <p className="clinical-action-hint">{launchReason}</p>}
        {canEdit && model.data && !model.data.model.ready && model.data.model.reason && (
          <p className="clinical-action-hint">{t(model.data.model.reason)}</p>
        )}
        {canEdit && model.data && !model.data.model.ready && (
          <Button
            className="margin-top"
            size="small"
            icon={<RefreshCw size={14} />}
            loading={model.isFetching}
            onClick={() => void model.refetch()}
          >
            {t('refreshStatus')}
          </Button>
        )}
        {canEdit && (
          <p className="clinical-action-hint">
            {confirmed.length ? t('clinicalSavedNoAi') : t('clinicalNoConfirmedHint')}
          </p>
        )}
      </section>

      {!!runs.length && (
        <div className="margin-top">
          <Select
            className="full-width"
            aria-label={t('clinicalReviewResults')}
            value={run?.id}
            onChange={setSelected}
            options={localizedHistoryRuns(runs, language).map((item) => ({
              value: item.id,
              label: `${analysisLanguage(item).toUpperCase()} · v${item.case_version} · ${time(item.created_at)} · ${t(item.status)}`,
            }))}
          />
        </div>
      )}
      <AiAnalysisPanel
        run={run}
        kind="clinical"
        openSource={openSource}
        busy={busy}
        onRetry={
          canEdit &&
          run &&
          (run.is_stale ||
            localeMismatch ||
            ['partial', 'failed', 'cancelled'].includes(run.status))
            ? retry
            : undefined
        }
        retryDisabledReason={launchReason || undefined}
        onCancel={
          canEdit && run && ['queued', 'running'].includes(run.status)
            ? () => void act(() => post(`/analyses/${run.id}/cancel`))
            : undefined
        }
        onReviewHypothesis={
          canEdit
            ? (hypothesis, evidence) =>
                conclusion(
                  hypothesis.label,
                  evidence
                    .filter(
                      (item) =>
                        hypothesis.supporting_refs.includes(item.ref) &&
                        confirmed.some((fact) => fact.id === item.fact_id),
                    )
                    .map((item) => item.fact_id),
                  run?.id || null,
                )
            : undefined
        }
      />

      <section className="panel margin-top">
        <SectionTitle title={t('clinicalConclusions')} subtitle={t('clinicalConclusionsHint')} />
        {c.clinical_conclusions?.length ? (
          c.clinical_conclusions.map((item) => (
            <article className="note-card" key={item.id}>
              <div>
                <Tag color={item.status === 'confirmed' ? 'green' : 'gold'}>
                  {t(item.status === 'confirmed' ? 'clinicianConfirmed' : 'provisional')}
                </Tag>
                <small>
                  v{item.case_version} · {time(item.created_at)}
                </small>
              </div>
              <h3>{item.diagnosis}</h3>
              <p>{item.rationale}</p>
              <small>
                {item.author_name} · {t('evaluatedVersion')} {item.evaluated_version}
              </small>
            </article>
          ))
        ) : (
          <div className="clinical-conclusion-empty">
            <h3>{t('noConclusions')}</h3>
            <p>{t('clinicalConclusionsHint')}</p>
            {canEdit && (
              <Button disabled={!confirmed.length || busy} onClick={() => conclusion()}>
                {t('recordConclusion')}
              </Button>
            )}
          </div>
        )}
      </section>
      <Modal
        title={t('recordConclusion')}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={640}
        closable={!busy}
        maskClosable={!busy}
        keyboard={!busy}
      >
        <Alert
          className="clinical-conclusion-help"
          type="info"
          showIcon
          message={t('clinicalConclusions')}
          description={t('clinicalConclusionHelp')}
        />
        {conclusionChanged && (
          <Alert
            className="margin-bottom"
            type="warning"
            showIcon
            message={t('clinicalConclusionChanged')}
          />
        )}
        <LocalizedForm
          form={form}
          layout="vertical"
          onFinish={(values) => {
            if (conclusionChanged) return
            void act(async () => {
              await post(`/cases/${c.id}/clinical-conclusions`, {
                ...values,
                expected_version: conclusionContext.version,
                run_id: conclusionContext.runId,
              })
              setOpen(false)
            })
          }}
        >
          <Form.Item
            name="diagnosis"
            label={t('clinicalDiagnosis')}
            extra={t('clinicalDiagnosisHelp')}
            rules={[{ required: true, min: 3, whitespace: true }]}
          >
            <Input.TextArea
              rows={2}
              maxLength={2000}
              showCount
              placeholder={t('clinicalDiagnosisPlaceholder')}
            />
          </Form.Item>
          <Form.Item
            name="status"
            label={t('status')}
            extra={t('clinicalStatusHelp')}
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: 'provisional', label: t('provisional') },
                { value: 'confirmed', label: t('clinicianConfirmed') },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="fact_ids"
            label={t('supportingEvidence')}
            extra={t('clinicalEvidenceHelp')}
            rules={[{ required: true, type: 'array', min: 1 }]}
          >
            <Select
              mode="multiple"
              optionFilterProp="label"
              placeholder={t('supportingEvidence')}
              options={confirmed.map((fact) => ({
                value: fact.id,
                label: `${fact.label}: ${fact.value} ${fact.unit || ''}`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="rationale"
            label={t('explanation')}
            extra={t('clinicalRationaleHelp')}
            rules={[{ required: true, min: 5, whitespace: true }]}
          >
            <Input.TextArea
              rows={4}
              maxLength={4000}
              showCount
              placeholder={t('clinicalRationalePlaceholder')}
            />
          </Form.Item>
          <Form.Item
            name="clinician_confirmed"
            valuePropName="checked"
            rules={[
              {
                validator: (_, value) =>
                  value ? Promise.resolve() : Promise.reject(new Error(t('clinicianAttestation'))),
              },
            ]}
          >
            <Checkbox>{t('clinicianAttestation')}</Checkbox>
          </Form.Item>
          <Button
            block
            type="primary"
            htmlType="submit"
            loading={busy}
            disabled={conclusionChanged}
          >
            {t('saveDecision')}
          </Button>
        </LocalizedForm>
      </Modal>
    </>
  )
}
