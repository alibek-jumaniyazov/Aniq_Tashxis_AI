import { useState } from 'react'
import { Alert, Button, Checkbox, Form, Input, Modal, Select, Space, Tag } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ClipboardCheck, FileText, Sparkles } from 'lucide-react'
import { get, post } from './api/client'
import type { Case, EvidenceRef, Readiness, User } from './types'
import { Blank, Failure, Loading, SectionTitle, StateTag, time, useAction } from './ui'

export default function ClinicalWorkspace({ c, user, openSource, openFacts }: { c: Case; user: User; openSource: (id: string) => void; openFacts: () => void }) {
  const { t } = useTranslation()
  const { act, busy } = useAction()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string>()
  const [form] = Form.useForm()
  const readiness = useQuery({ queryKey: ['readiness', c.id, c.version], queryFn: ({ signal }) => get<Readiness>(`/cases/${c.id}/readiness`, signal) })
  const runs = c.analyses.filter(r => r.review_focus === 'clinical_assessment')
  const run = runs.find(r => r.id === selected) || runs[0]
  const ai = run?.result.ai
  const assessment = ai?.assessment
  const pending = c.analyses.find(r => ['queued', 'running'].includes(r.status))
  const canEdit = user.role === 'doctor'
  const confirmed = c.facts.filter(f => f.confirmed)
  const evidence = ai?.evidence || []
  const sourceButtons = (refs: string[]) => refs.map(ref => {
    const item: EvidenceRef | undefined = evidence.find(e => e.ref === ref)
    return item && <button className="source-link" key={ref} onClick={() => openSource(item.source_id)}><FileText size={14}/>{item.label}: {item.value} {item.unit}</button>
  })
  const conclusion = (diagnosis = '') => {
    form.resetFields()
    form.setFieldsValue({ diagnosis, status: 'provisional', fact_ids: [], clinician_confirmed: false })
    setOpen(true)
  }
  return <>
    <section className="panel clinical-workspace">
      <SectionTitle title={t('clinicalReview')} subtitle={t('clinicalReviewHint')} extra={<Sparkles size={21}/>}/>
      <Alert type="info" showIcon message={t('clinicalReviewNotice')}/>
      {readiness.isPending ? <Loading/> : readiness.error ? <Failure error={readiness.error} retry={() => void readiness.refetch()}/> : readiness.data && <>
        <div className="readiness-grid"><div><strong>{readiness.data.confirmed_facts}/{readiness.data.total_facts}</strong><span>{t('confirmed')}</span></div><div><strong>{readiness.data.unconfirmed_facts}</strong><span>{t('pendingFacts')}</span></div><div><strong>{readiness.data.potential_conflicts.length}</strong><span>{t('conflictingEvidence')}</span></div></div>
        {!!readiness.data.unconfirmed_facts && <Alert className="margin-bottom" type="warning" showIcon message={t('draftExcluded')} action={<Button size="small" onClick={openFacts}>{t('inspect')}</Button>}/>}
        {!!readiness.data.potential_conflicts.length && <Alert className="margin-bottom" type="warning" showIcon message={t('conflictingEvidenceHint')} description={readiness.data.potential_conflicts.map(conflict => <div key={conflict.key}><Tag>{conflict.key}</Tag>{conflict.fact_ids.map(id => { const fact = c.facts.find(f => f.id === id); return fact && <Button type="link" size="small" key={id} onClick={() => openSource(fact.source_id)}>{fact.value} {fact.unit}</Button> })}</div>)}/>}
        {!readiness.data.clinical_review_ready && <p className="muted">{t('INSUFFICIENT_CONFIRMED_EVIDENCE')}</p>}
        <Space wrap className="margin-top">
          {canEdit && <Button type="primary" icon={<Sparkles size={16}/>} loading={busy || !!pending} disabled={!readiness.data.clinical_review_ready} onClick={() => void act(async () => { const next = await post<{ run_id: string }>(`/cases/${c.id}/analyses`, { expected_version: c.version, include_ai: true, mode: 'current', review_focus: 'clinical_assessment' }); setSelected(next.run_id) }, false)}>{t('requestClinicalReview')}</Button>}
          {canEdit && <Button icon={<ClipboardCheck size={16}/>} disabled={!confirmed.length || busy} onClick={() => conclusion()}>{t('recordConclusion')}</Button>}
          {canEdit && pending && <Button onClick={() => void act(() => post(`/analyses/${pending.id}/cancel`))}>{t('cancel')}</Button>}
        </Space>
      </>}
    </section>
    {!!runs.length && <section className="panel margin-top">
      <SectionTitle title={t('clinicalReviewResults')} extra={run && <StateTag status={run.status}/>}/>
      <Select className="full-width" aria-label={t('clinicalReviewResults')} value={run?.id} onChange={setSelected} options={runs.map(r => ({ value: r.id, label: `v${r.case_version} · ${time(r.created_at)} · ${t(r.status)}` }))}/>
      {run?.is_stale && <Alert className="margin-top" type="warning" showIcon message={t('stale')} description={t('staleHint')}/>}
      {run && ['queued', 'running'].includes(run.status) ? <Loading/> : <>
        {ai && <p className="ai-text margin-top">{ai.summary}</p>}
        {run?.result.limitations?.map(code => <Alert key={code} className="margin-top" type="warning" showIcon message={t(code)}/>)}
        {run?.error_code && <Alert className="margin-top" type="error" message={t(run.error_code)}/>}
        {assessment?.status === 'insufficient_data' && <Alert className="margin-top" type="warning" showIcon message={t('insufficientDiagnosticData')}/>}
        {assessment?.differential.map((hypothesis, index) => <article className="hypothesis-card" key={index}>
          <Tag color="gold">{t('unconfirmedHypothesis')}</Tag><h3>{hypothesis.label}</h3>
          <h4>{t('supportingEvidence')}</h4><div className="evidence-links">{sourceButtons(hypothesis.supporting_refs)}</div>
          {!!hypothesis.opposing_refs.length && <><h4>{t('opposingEvidence')}</h4><div className="evidence-links">{sourceButtons(hypothesis.opposing_refs)}</div></>}
          <p><strong>{t('verificationNeeded')}: </strong>{hypothesis.verification_needed}</p>
          {canEdit && <Button disabled={run?.is_stale} onClick={() => { conclusion(hypothesis.label); form.setFieldValue('fact_ids', evidence.filter(e => hypothesis.supporting_refs.includes(e.ref)).map(e => e.fact_id)) }}>{t('reviewHypothesis')}</Button>}
        </article>)}
        {!!assessment?.questions.length && <><h3>{t('clarifyingQuestions')}</h3><ul>{assessment.questions.map((question, i) => <li key={i}>{question}</li>)}</ul></>}
        {!!ai?.limitations.length && <details className="margin-top"><summary>{t('limitations')}</summary><ul>{ai.limitations.map((limit, i) => <li key={i}>{limit}</li>)}</ul></details>}
      </>}
    </section>}
    <section className="panel margin-top"><SectionTitle title={t('clinicalConclusions')} subtitle={t('clinicalConclusionsHint')}/>{c.clinical_conclusions?.length ? c.clinical_conclusions.map(item => <article className="note-card" key={item.id}><div><Tag color={item.status === 'confirmed' ? 'green' : 'gold'}>{t(item.status === 'confirmed' ? 'clinicianConfirmed' : 'provisional')}</Tag><small>v{item.case_version} · {time(item.created_at)}</small></div><h3>{item.diagnosis}</h3><p>{item.rationale}</p><small>{item.author_name} · {t('evaluatedVersion')} {item.evaluated_version}</small></article>) : <Blank title={t('noConclusions')} hint={t('clinicalConclusionsHint')}/>}</section>
    <Modal title={t('recordConclusion')} open={open} onCancel={() => setOpen(false)} footer={null} width={640}>
      <Form form={form} layout="vertical" onFinish={values => void act(async () => { await post(`/cases/${c.id}/clinical-conclusions`, { ...values, expected_version: c.version, run_id: assessment && !run?.is_stale ? run?.id : null }); setOpen(false) })}>
        <Form.Item name="diagnosis" label={t('clinicalDiagnosis')} rules={[{ required: true, min: 3 }]}><Input.TextArea rows={2} maxLength={2000}/></Form.Item>
        <Form.Item name="status" label={t('status')} rules={[{ required: true }]}><Select options={[{ value: 'provisional', label: t('provisional') }, { value: 'confirmed', label: t('clinicianConfirmed') }]}/></Form.Item>
        <Form.Item name="fact_ids" label={t('supportingEvidence')} rules={[{ required: true }]}><Select mode="multiple" options={confirmed.map(f => ({ value: f.id, label: `${f.label}: ${f.value} ${f.unit || ''}` }))}/></Form.Item>
        <Form.Item name="rationale" label={t('explanation')} rules={[{ required: true, min: 5 }]}><Input.TextArea rows={4} maxLength={4000}/></Form.Item>
        <Form.Item name="clinician_confirmed" valuePropName="checked" rules={[{ validator: (_, value) => value ? Promise.resolve() : Promise.reject(new Error(t('clinicianAttestation'))) }]}><Checkbox>{t('clinicianAttestation')}</Checkbox></Form.Item>
        <Button block type="primary" htmlType="submit" loading={busy}>{t('saveDecision')}</Button>
      </Form>
    </Modal>
  </>
}
