import LocalizedForm from './LocalizedForm'
import './patientDetails.css'
import StableTabs from './StableTabs'
import PatientWorkspaceTabs, { type PatientWorkspaceTab } from './PatientWorkspaceTabs'
import { useRef, useState } from 'react'
import { Alert, App, Button, Checkbox, Drawer, Form, Input, InputNumber, Modal, Progress, Select, Space, Switch, Tag, Timeline } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Activity, ArrowLeft, ArrowUpRight, Check, CheckCheck, ChevronRight, CircleHelp, Clock3, CloudDownload, FileText, Link2, LoaderCircle, ScanLine, Pencil, Play, Plus, ShieldCheck, Sparkles, Stethoscope, Upload } from 'lucide-react'
import NoteEditor from './NoteEditor'
import WorkflowGuide from './WorkflowGuide'
import AiAnalysisPanel from './AiAnalysisPanel'
import ClinicalWorkspace from './ClinicalWorkspace'
import DecisionReport from './DecisionReport'
import RadiologyWorkspace from './RadiologyWorkspace'
import RiskWorkspace from './RiskWorkspace'
import { localDateInput } from './dates'
import { api, get, patch, post } from './api/client'
import type { Case, ClinicalAlert, Fact, Source, User } from './types'
import { Blank, DemoLabel, Failure, Loading, SectionTitle, SourceButton, StateTag, time, useAction } from './ui'

function dateValue(value?: string) { return value ? new Date(value).toISOString() : null }
const factTypes: Record<string, string> = { 'symptom.complaint': 'factSymptom', 'vital.spo2': 'factSpo2', 'vital.pulse': 'factPulse', 'vital.systolic_pressure': 'factPressure', 'allergy.substance': 'factAllergy', 'medication.substance': 'factMedication', 'lab.potassium': 'factPotassium', 'lab.total_cholesterol': 'factCholesterol', 'imaging.side': 'factSide', 'smoking.status': 'factSmoking' }
const keys = Object.keys(factTypes)

type HistoryEntry = Partial<Fact> & { id: string; kind: string; category?: string; text?: string; diagnosis?: string; treatment?: string; radiologist_report?: string; after?: { summary: string; diagnosis: string } }

function HistoryEntryContent({ item }: { item: HistoryEntry }) {
  const { t } = useTranslation()
  const title = item.kind === 'clinical_entry' ? t(`pw_${item.category}`) : item.kind === 'imaging_report' ? t('imaging_report') : item.label || t(item.kind === 'case_revision' ? 'editPatient' : item.kind === 'clinical_conclusion' ? 'clinicalDiagnosis' : item.text ? 'addNote' : 'facts')
  return <div className="patient-history-entry"><strong>v{item.case_version} · {title}</strong>
    {item.after ? <p>{[item.after.summary, item.after.diagnosis].filter(Boolean).join(' · ') || '—'}</p> : <>
      {item.diagnosis && <p><b>{item.diagnosis}</b></p>}
      {(item.text || item.radiologist_report) && <p>{item.text || item.radiologist_report}</p>}
      {item.treatment && <p>{t('pw_treatment')}: {item.treatment}</p>}
      {item.kind === 'fact' && <p>{item.value ?? '—'} {item.unit || ''}</p>}
    </>}
    <small>{time(item.created_at)} · {['fact', 'clinical_entry'].includes(item.kind) ? t(item.confirmed ? 'confirmed' : 'unconfirmed') : t('saved')}</small>
  </div>
}

export default function CasePage({ user }: { user: User }) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [tab, setTab] = useState('evidence')
  const [workspaceTab, setWorkspaceTab] = useState<PatientWorkspaceTab>(user.role === 'radiologist' ? 'patient-data' : 'overview')
  const [toolsOpen, setToolsOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm] = Form.useForm()
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [factModal, setFactModal] = useState(false)
  const [editing, setEditing] = useState<Fact | null>(null)
  const [noteModal, setNoteModal] = useState(false)
  const [uploadModal, setUploadModal] = useState(false)
  const [dmedModal, setDmedModal] = useState(false)
  const [incidentModal, setIncidentModal] = useState(false)
  const [reviewing, setReviewing] = useState<ClinicalAlert | null>(null)
  const [mode, setMode] = useState('current')
  const [cutoff, setCutoff] = useState(() => { const date = new Date(); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) })
  const [includeAI, setIncludeAI] = useState(true)
  const [selectedRun, setSelectedRun] = useState<string | null>(null)
  const [factForm] = Form.useForm()
  const [reviewForm] = Form.useForm()
  const [incidentForm] = Form.useForm()
  const { act, busy } = useAction()
  const query = useQuery({ queryKey: ['case', id], queryFn: ({ signal }) => get<Case>(`/cases/${id}`, signal), refetchInterval: q => q.state.data?.analyses.some(r => ['running', 'queued'].includes(r.status)) ? 1500 : false })
  const clinicalEntries = useQuery({ queryKey: ['clinical-entries', id, query.data?.version], queryFn: ({ signal }) => get<{ items: { confirmed: boolean }[] }>(`/cases/${id}/clinical-entries`, signal), enabled: !!query.data })
  const source = useQuery({ queryKey: ['source', sourceId], queryFn: ({ signal }) => get<Source>(`/sources/${sourceId}`, signal), enabled: !!sourceId })
  const history = useQuery({ queryKey: ['history', id], queryFn: ({ signal }) => get<{ items: HistoryEntry[] }>(`/cases/${id}/versions`, signal), enabled: toolsOpen && tab === 'history' })
  if (query.isPending) return <Loading/>
  if (query.error || !query.data) return <Failure error={query.error} retry={() => void query.refetch()}/>
  const c = query.data
  const canEdit = user.role === 'doctor'
  const ruleText = (alert: ClinicalAlert, part: 'Title' | 'Description') => {
    const key = alert.demo_only && ({ 'DOC-SIDE-01': 'ruleSideAlert', 'DEMO-ALLERGY-01': 'ruleAllergyAlert' } as Record<string, string>)[alert.rule_id]
    return key ? t(`${key}${part}`) : part === 'Title' ? alert.title : alert.description
  }
  const confirmed = c.facts.filter(f => f.confirmed).length + (clinicalEntries.data?.items.filter(entry => entry.confirmed).length || 0)
  const recordCount = c.facts.length + (clinicalEntries.data?.items.length || 0)
  const documentRuns = c.analyses.filter(r => !['clinical_assessment', 'radiology', 'clinical_comparison'].includes(r.review_focus || ''))
  const latest = documentRuns.find(r => r.id === selectedRun) || documentRuns[0]
  const invalidCutoff = mode === 'decision_time' && (!cutoff || Number.isNaN(new Date(cutoff).getTime()))
  const activeRun = c.analyses.find(r => ['running', 'queued'].includes(r.status))
  const openSource = (source: string) => setSourceId(source)
  const run = () => void act(async () => { await post(`/cases/${id}/analyses`, { expected_version: c.version, mode, decision_time: mode === 'decision_time' ? dateValue(cutoff) : null, include_ai: includeAI }); setSelectedRun(null); setTab('analysis') }, false)
  const confirmAll = () => void act(async () => {
    const ids = c.facts.filter(f => !f.confirmed).map(f => f.id)
    let version = c.version
    try {
      for (let index = 0; index < ids.length; index += 100) {
        const result = await post<{ version: number }>(`/cases/${id}/facts/confirm`, { expected_version: version, fact_ids: ids.slice(index, index + 100) })
        version = result.version
      }
    } finally { await query.refetch() }
  })
  const editFact = (fact?: Fact) => {
    setEditing(fact || null)
    factForm.resetFields()
    factForm.setFieldsValue(fact ? { key: fact.key, label: fact.label, value: fact.value, unit: fact.unit, assertion: fact.assertion, provenance: fact.provenance, confirmed: fact.confirmed, order_status: fact.order_status, source_id: c.documents.find(d => d.id === fact.source_id)?.type === 'manual' ? null : fact.source_id, span: fact.span, event_time: localDateInput(fact.event_time), available_time: localDateInput(fact.available_time) } : { assertion: 'present', provenance: 'manual', confirmed: false, order_status: 'not_applicable' })
    setFactModal(true)
  }
  const factCards = <div className="fact-list">{c.facts.length ? c.facts.map(f => <div className="fact-row" key={f.id}><div className={`fact-indicator ${f.confirmed ? 'verified' : ''}`}>{f.confirmed ? <Check size={15}/> : <CircleHelp size={15}/>}</div><div className="fact-body"><div className="fact-head"><strong>{f.label}</strong><span className="fact-value">{f.value ?? '—'} <small>{f.unit}</small></span></div><div className="fact-meta"><span>{t(f.assertion)}</span><span>{t(f.provenance)}</span><span>{time(f.event_time)}</span><span>v{f.case_version}</span></div><SourceButton onClick={() => openSource(f.source_id)}/></div><div className="fact-actions">{!f.confirmed && canEdit && <Button size="small" disabled={busy} onClick={() => void act(() => post(`/cases/${id}/facts/confirm`, { expected_version: c.version, fact_ids: [f.id] }))}>{t('confirm')}</Button>}{canEdit && <Button type="text" size="small" aria-label={t('factEdit')} icon={<Pencil size={14}/>} onClick={() => editFact(f)}/>}</div></div>) : <Blank/>}</div>
  const inputCards = <div className="input-methods">{[{ key: 'manual', icon: Pencil, hint: 'manualHint', action: () => editFact() }, { key: 'documents', icon: Upload, hint: 'documentsHint', action: () => setUploadModal(true) }, { key: 'dmed', icon: Link2, hint: 'dmedHint', action: () => setDmedModal(true) }].map(({ key, icon: Icon, hint, action }) => <button key={key} onClick={action} disabled={!canEdit}><div className="input-icon"><Icon size={20}/></div><strong>{t(key)}</strong><p>{t(hint)}</p><ArrowUpRight size={16}/></button>)}</div>
  const displayedAlerts = toolsOpen && tab === 'analysis' ? c.alerts.filter(a => latest?.result.alert_ids?.includes(a.id)) : c.alerts
  const alerts = displayedAlerts.length ? <div className="alerts-list">{displayedAlerts.map(alert => <div className={`clinical-alert ${alert.severity === 'potential_serious_risk' ? 'serious' : 'clarification'}`} key={alert.id}><div className="alert-heading"><span className="alert-severity"><Activity size={15}/>{t(alert.severity === 'potential_serious_risk' ? 'serious' : 'clarify')}</span><StateTag status={alert.status}/></div><h3>{ruleText(alert, 'Title')}</h3><p>{ruleText(alert, 'Description')}</p><div className="alert-evidence"><span>{t('rule')}: {alert.rule_id}</span><span>v{alert.case_version}</span><Tag>{t('demoRule')}</Tag></div>{!!alert.reviews?.length && <details className="alert-review-history"><summary>{t('reviewedBy')} · {alert.reviews.length}</summary>{alert.reviews.map(review => <article className="note-card" key={review.id}><div><StateTag status={review.status}/><small>{time(review.created_at)}</small></div><p>{review.comment}</p><small>{review.reviewer_name}</small></article>)}</details>}<div className="alert-bottom"><Space wrap>{alert.source_ids.map((ref, i) => <button className="source-link" key={ref} onClick={() => openSource(ref)}><FileText size={14}/>{t('source')} {i + 1}<ArrowUpRight size={13}/></button>)}</Space>{canEdit && alert.status !== 'closed' && <Button size="small" onClick={() => { reviewForm.resetFields(); setReviewing(alert) }}>{t('reviewedBy')}<ChevronRight size={14}/></Button>}</div></div>)}</div> : <div className="quiet-result"><ShieldCheck size={34} strokeWidth={1.3}/><h3>{latest ? t('noAlerts') : t('not_started')}</h3><p>{t('noAlertsHint')}</p></div>
  const overviewContent = <><WorkflowGuide topic="facts"/>{!canEdit && <p className="workspace-action-note">{t('readOnlyCaseHint')}</p>}<div className="section-spacer">{inputCards}</div><section className="panel"><SectionTitle title={t('facts')} extra={canEdit && <Space wrap>{c.facts.some(f => !f.confirmed) && <Button size="small" title={t('bulkConfirmHelp')} disabled={busy} onClick={confirmAll}>{t('confirmAll')}</Button>}<Button type="text" icon={<Plus size={15}/>} onClick={() => editFact()}>{t('addFact')}</Button></Space>}/>{factCards}</section><section className="panel margin-top"><SectionTitle title={t('alerts')} extra={<span className="count-tag">{c.alerts.length}</span>}/>{alerts}</section></>
  const legacyTabs = [
    { key: 'evidence', label: t('evidence'), children: <section className="panel"><SectionTitle title={t('sources')} subtitle={t('sourceSummaryHint')} extra={canEdit && <Button icon={<Upload size={15}/>} onClick={() => setUploadModal(true)}>{t('upload')}</Button>}/>{c.documents.length ? <div className="document-grid">{c.documents.map(doc => <button key={doc.id} onClick={() => openSource(doc.id)}><span className="document-icon"><FileText size={24} strokeWidth={1.5}/></span><strong>{doc.type === 'manual' && doc.name === 'Manual entry' ? t('manualSourceName') : doc.name}</strong><small>{['manual', 'note', 'dmed_demo', 'dmed'].includes(doc.type) ? t(`sourceType_${doc.type}`) : doc.type.toUpperCase()} · {time(doc.created_at)}</small><ArrowUpRight size={16}/></button>)}</div> : <Blank/>}</section> },
    { key: 'analysis', label: t('analysis'), children: <><WorkflowGuide topic="decision"/><section className="panel analysis-controls"><SectionTitle title={t('analysis')} subtitle={t('scopeText')}/><div className="time-lens"><Clock3 size={18}/><Select disabled={!canEdit} aria-label={t('mode')} value={mode} onChange={setMode} options={['current', 'decision_time'].map(v => ({ value: v, label: t(v) }))}/>{mode === 'decision_time' && <Input type="datetime-local" aria-label={t('cutoff')} value={cutoff} onChange={e => setCutoff(e.target.value)}/>}<span className="version-pill">v{c.version}</span></div><div className="analysis-actions"><span><Switch disabled={!canEdit} checked={includeAI} onChange={setIncludeAI} size="small"/> {t('includeAI')}</span>{canEdit && <Button type="primary" icon={<Play size={15}/>} onClick={run} loading={busy || !!activeRun} disabled={invalidCutoff} title={invalidCutoff ? t('analysisCutoffHint') : undefined}>{t('run')}</Button>}</div>{invalidCutoff && <p className="workspace-action-note">{t('analysisCutoffHint')}</p>}{activeRun && <p className="workspace-action-note">{t('analysisActiveHint')}</p>}<div className="inline-note"><CircleHelp size={15}/>{t('noClinicalRules')}</div></section>{documentRuns.length > 1 && <Select className="margin-top" style={{ width: '100%' }} aria-label={t('analyses')} value={latest?.id} onChange={setSelectedRun} options={documentRuns.map(r => ({ value: r.id, label: `v${r.case_version} · ${t(r.mode)} · ${time(r.created_at)} · ${t(r.status)}` }))}/>}<AiAnalysisPanel run={latest} kind="decision" openSource={openSource} busy={busy} onRetry={canEdit && latest && !activeRun && (latest.is_stale || ['failed', 'cancelled'].includes(latest.status) || (latest.status === 'partial' && latest.include_ai)) ? () => latest.is_stale ? run() : void act(async () => { const next = await post<{ run_id: string }>(`/analyses/${latest.id}/retry`, { expected_version: c.version }); setSelectedRun(next.run_id) }, false) : undefined} retryDisabledReason={invalidCutoff ? t('analysisCutoffHint') : undefined} onCancel={canEdit && latest && ['queued', 'running'].includes(latest.status) ? () => void act(() => post(`/analyses/${latest.id}/cancel`), false) : undefined}/> {latest && <section className="panel margin-top"><SectionTitle title={t('coverage')} extra={<StateTag status={latest.status}/>}/>{latest.is_stale && <Alert type="warning" showIcon message={t('stale')} description={t('staleHint')}/>}<div className="run-meta"><span>v{latest.case_version}</span><span>{t(latest.mode)}</span><span>{time(latest.created_at)}</span></div>{['running', 'queued'].includes(latest.status) ? <div className="job-progress"><LoaderCircle size={24} className="spin"/><span>{t(latest.stage === 'medgemma' ? 'model' : latest.status)}</span></div> : <><div className="coverage-grid">{latest.result.coverage?.completed.map(check => <div className="coverage-item" key={check}><CheckCheck size={17}/><span>{t(check)}</span><small>{t('completed')}</small></div>)}{latest.result.coverage?.not_evaluable.map((check, index) => <div className="coverage-item skipped" key={index}><CircleHelp size={17}/><span>{t(check.check_id)}<small>{t(check.reason_code)}</small></span><Tag>{t('unavailable')}</Tag></div>)}</div>{latest.error_code && <Alert type="error" message={t(latest.error_code)}/>}</>}</section>}{latest && <DecisionReport run={latest} openSource={openSource}/>}<section className="panel margin-top"><SectionTitle title={t('alerts')}/>{alerts}</section></> },
    { key: 'clinical', label: t('clinicalReview'), children: <ClinicalWorkspace c={c} user={user} openSource={openSource} openFacts={() => { setToolsOpen(false); setWorkspaceTab('overview') }}/> },
    { key: 'notes', label: t('notes'), children: <section className="panel"><SectionTitle title={t('addNote')} extra={canEdit && <Button icon={<Plus size={15}/>} onClick={() => setNoteModal(true)}>{t('addNote')}</Button>}/>{c.notes.length ? c.notes.map(note => <article className="note-card" key={note.id}><div><Tag>{t(note.note_type === 'history' ? 'noteHistory' : note.note_type)}</Tag><small>{time(note.created_at)} · v{note.case_version}</small></div><p>{note.text}</p><span>{t(note.provenance)} · {t('eventTime')}: {time(note.event_time)}</span></article>) : <Blank/>}</section> },
    { key: 'imaging', label: t('imaging'), children: <RadiologyWorkspace c={c} user={user}/> },
    { key: 'forecast', label: t('pn_legacyRisk'), children: <RiskWorkspace c={c} canEdit={canEdit}/> },
    { key: 'history', label: t('history'), children: <section className="panel"><SectionTitle title={t('history')} subtitle={t('versionHistory')}/><div className="history-content">{history.isPending ? <Loading/> : history.error ? <Failure error={history.error} retry={() => void history.refetch()}/> : <Timeline items={history.data?.items.map(item => ({ color: '#087f83', children: <HistoryEntryContent item={item}/> }))}/>}</div></section> },
  ]
  return <><button className="back-link" onClick={() => navigate('/cases')}><ArrowLeft size={15}/>{t('back')}</button><div className="case-heading"><div className="case-id"><div className="case-avatar"><Stethoscope size={26}/></div><div><div className="case-title-line"><h1>{c.full_name || c.alias}</h1><DemoLabel/></div>{c.full_name && <p className="patient-code">{t('patientCode')}: <strong>{c.alias}</strong></p>}<p>{c.age == null ? t('patientAgeUnknown') : t('clinicalYears', { count: c.age })} <span>·</span> {t(c.sex || 'unknown')} <span>·</span> {t('version')} {c.version}</p>{c.patient_phone && <p className="patient-phone">{t('patientPhone')}: <a href={`tel:${c.patient_phone.replace(/[^+0-9]/g, '')}`}>{c.patient_phone}</a></p>}</div></div><Space wrap>{canEdit && <Button icon={<Pencil size={16}/>} onClick={() => { editForm.resetFields(); editForm.setFieldsValue({ full_name: c.full_name || '', age: c.age, sex: c.sex || 'unknown', patient_phone: c.patient_phone || '', summary: c.summary || '' }); setEditOpen(true) }}>{t('editPatient')}</Button>}<Button icon={<ScanLine size={16}/>} onClick={() => navigate(`/cases/${c.id}/imaging`)}>{t('pn_openImaging')}</Button></Space></div><div className="case-workspace"><aside className="case-context"><section className="panel context-panel"><span className="eyebrow">{t('patientContext')}</span><h3>{t('doctorComments')}</h3><p>{c.summary || '—'}</p><div className="context-divider"/><small>{t('diagnosis')}</small><strong>{c.diagnosis || '—'}</strong><div className="context-divider"/><div className="completeness"><span>{t('confirmed')}</span><strong>{confirmed}/{recordCount}</strong></div><Progress percent={recordCount ? confirmed / recordCount * 100 : 0} showInfo={false} strokeColor="#087f83" trailColor="#edf3f3"/><div className="context-stat"><FileText size={15}/>{c.documents.length} {t('sourceCount')}</div><div className="context-stat"><Clock3 size={15}/>{time(c.updated_at)}</div></section><div className="context-tip"><ShieldCheck size={20}/><p>{t('clinicalNote')}</p></div>{canEdit && <Button block onClick={() => setIncidentModal(true)}>{t('createIncident')}<ArrowUpRight size={15}/></Button>}</aside><section className="case-content"><PatientWorkspaceTabs c={c} user={user} overview={overviewContent} activeTab={workspaceTab} onChange={setWorkspaceTab} openSource={openSource} importDmed={() => setDmedModal(true)} openTools={() => setToolsOpen(true)}/></section></div>
  <Drawer className="patient-tool-drawer" title={t('pn_tools')} open={toolsOpen} onClose={() => setToolsOpen(false)} width="min(1180px, 100vw)"><p className="muted">{t('pn_toolsHint')}</p><StableTabs activeKey={tab} onChange={setTab} items={legacyTabs}/></Drawer>
  <Drawer zIndex={1200} title={<span><FileText size={18}/> {t('source')}</span>} open={!!sourceId} onClose={() => setSourceId(null)} width="min(590px, 100vw)">{source.isPending ? <Loading/> : source.error ? <Failure error={source.error} retry={() => void source.refetch()}/> : source.data && <div className="source-view"><span className="eyebrow">{t('evidence')} / v{source.data.case_version}</span><h2>{(source.data.type === 'manual' && source.data.name === 'Manual entry' ? t('manualSourceName') : source.data.name) || t('addNote')}</h2><p className="muted">{time(source.data.created_at)}</p>{source.data.limitations?.map(l => <Tag key={l}>{l.startsWith('OCR_UNAVAILABLE_PAGE_') ? t('sourceOcrUnavailable', { page: l.slice('OCR_UNAVAILABLE_PAGE_'.length) }) : t(l)}</Tag>)}<div className="source-paper"><span>{t('sourceText')}</span><pre>{source.data.text}</pre></div>{['pdf', 'docx', 'txt'].includes(source.data.type) && <Button href={`/api/v1/documents/${source.data.id}/content`} target="_blank" icon={<CloudDownload size={16}/>}>{t('download')}</Button>}{canEdit && ['pdf', 'docx', 'txt'].includes(source.data.type) && <><Button className="margin-top" block icon={<Sparkles size={15}/>} loading={busy} onClick={() => void act(async () => { await api.post(`/documents/${source.data.id}/extract`, { expected_version: c.version }, { timeout: 180000 }); setSourceId(null); setToolsOpen(false); setWorkspaceTab('overview') })}>{t('extractWithAI')}</Button><p className="muted">{t('extractHint')}</p></>}{canEdit && <Button className="margin-top" block onClick={() => { setSourceId(null); editFact(); factForm.setFieldsValue({ source_id: source.data.id, provenance: 'document' }) }}>{t('addFact')}</Button>}</div>}</Drawer>
  <Modal title={t(editing ? 'factEdit' : 'addFact')} open={factModal} onCancel={() => setFactModal(false)} footer={null} width={620}><LocalizedForm form={factForm} layout="vertical" onFinish={values => void act(async () => { await patch(`/cases/${id}/facts`, { expected_version: c.version, supersedes: editing ? [editing.id] : [], facts: [{ ...values, value: values.value ?? null, unit: values.unit || null, event_time: dateValue(values.event_time), available_time: dateValue(values.available_time), source_id: values.source_id || null, span: values.source_id ? (/^(excerpt:|page:)/.test(values.span || '') ? values.span : `excerpt:${values.span}`) : null }] }); setFactModal(false) })}><Form.Item name="source_id" hidden><Input/></Form.Item><Form.Item noStyle dependencies={['source_id']}>{({ getFieldValue }) => getFieldValue('source_id') ? <Form.Item name="span" label={t('factQuoteLabel')} extra={t('factQuoteHelp')} rules={[{ required: true }]}><Input.TextArea rows={2} placeholder={t('factQuotePlaceholder')} maxLength={980}/></Form.Item> : null}</Form.Item><Form.Item name="key" extra={t('fieldFactTypeHelp')} label={t('key')} rules={[{ required: true }]}><Select showSearch optionFilterProp="searchText" options={keys.map(v => ({ value: v, searchText: `${v} ${t(factTypes[v])}`, label: <span>{t(factTypes[v])} <small className="muted">{v}</small></span> }))} onChange={v => { if (!factForm.getFieldValue('label')) factForm.setFieldValue('label', t(factTypes[v])) }}/></Form.Item><Form.Item name="label" extra={t('fieldFactLabelHelp')} label={t('label')} rules={[{ required: true }]}><Input maxLength={200}/></Form.Item><div className="form-grid"><Form.Item name="value" extra={t('fieldFactValueHelp')} label={t('value')}><Input/></Form.Item><Form.Item name="unit" extra={t('fieldFactUnitHelp')} label={t('unit')}><Input/></Form.Item></div><div className="form-grid"><Form.Item name="assertion" extra={t('fieldAssertionHelp')} label={t('assertion')}><Select options={['present', 'absent', 'unknown', 'not_documented'].map(v => ({ value: v, label: t(v) }))}/></Form.Item><Form.Item name="provenance" extra={t('fieldProvenanceHelp')} label={t('provenance')}><Select options={['manual', 'paper', 'patient_reported', 'document', 'dmed_demo'].map(v => ({ value: v, label: t(v) }))}/></Form.Item></div><div className="form-grid"><Form.Item name="event_time" extra={t('fieldEventHelp')} label={t('eventTime')}><Input type="datetime-local"/></Form.Item><Form.Item name="available_time" extra={t('fieldAvailableHelp')} label={t('availableTime')}><Input type="datetime-local"/></Form.Item></div><p className="muted">{t('dateFormatHint')}</p><Form.Item name="order_status" extra={t('fieldOrderHelp')} label={t('orderStatus')}><Select options={['not_applicable', 'active', 'cancelled'].map(v => ({ value: v, label: t(v) }))}/></Form.Item><Form.Item name="confirmed" valuePropName="checked"><Checkbox>{t('confirmFact')}</Checkbox></Form.Item><Button type="primary" htmlType="submit" block loading={busy}>{t('save')}</Button></LocalizedForm></Modal>
  <Modal title={t('editPatient')} open={editOpen} onCancel={() => { if (!busy) setEditOpen(false) }} maskClosable={!busy} closable={!busy} keyboard={!busy} footer={null}>
    <div className="patient-edit-code"><span>{t('patientCode')}</span><strong>{c.alias}</strong><small>{t('patientCodeAutoHelp')}</small></div>
    <LocalizedForm form={editForm} layout="vertical" disabled={busy} onFinish={values => void act(async () => {
      const fullName = (values.full_name || '').trim()
      await patch(`/cases/${c.id}`, { ...(c.full_name || fullName ? { full_name: fullName } : {}), age: values.age ?? null, sex: values.sex || 'unknown', patient_phone: (values.patient_phone || '').trim(), summary: (values.summary || '').trim(), expected_version: c.version })
      setEditOpen(false)
    })}>
      <Form.Item name="full_name" label={t('patientFullName')} extra={!c.full_name ? t('patientLegacyNameHelp') : undefined} rules={[{ required: !!c.full_name, whitespace: true, max: 200, message: t('patientNameRequired') }]}><Input autoComplete="name" placeholder={t('patientNamePlaceholder')} maxLength={200}/></Form.Item>
      <div className="form-grid">
        <Form.Item name="age" extra={t('patientAgeHelp')} label={t('age')}><InputNumber min={0} max={120} precision={0} style={{ width: '100%' }}/></Form.Item>
        <Form.Item name="sex" label={t('sex')}><Select options={['male', 'female', 'unknown'].map(value => ({ value, label: t(value) }))}/></Form.Item>
      </div>
      <Form.Item name="patient_phone" label={t('patientPhone')} extra={t('patientPhoneHelp')}><Input type="tel" autoComplete="tel" placeholder={t('patientPhonePlaceholder')} maxLength={50}/></Form.Item>
      <Form.Item name="summary" label={t('doctorComments')}><Input.TextArea rows={4} placeholder={t('patientCommentsPlaceholder')} maxLength={6000}/></Form.Item>
      <Button block type="primary" htmlType="submit" loading={busy}>{t('save')}</Button>
    </LocalizedForm>
  </Modal>
  <NoteEditor caseId={c.id} version={c.version} open={noteModal} onClose={() => setNoteModal(false)} onSaved={() => { setNoteModal(false); setTab('notes'); setToolsOpen(true) }}/>
  <Modal title={t('reviewedBy')} open={!!reviewing} onCancel={() => setReviewing(null)} footer={null}><p>{reviewing && ruleText(reviewing, 'Title')}</p><LocalizedForm form={reviewForm} layout="vertical" onFinish={values => void act(async () => { await post(`/alerts/${reviewing?.id}/reviews`, values); setReviewing(null) })}><Form.Item name="status" label={t('status')} rules={[{ required: true }]}><Select options={({ new: ['seen', 'accepted', 'rejected', 'information_requested'], seen: ['accepted', 'rejected', 'information_requested'], accepted: ['closed', 'information_requested'], rejected: ['closed'], information_requested: ['accepted', 'rejected', 'closed'] } as Record<string, string[]>)[reviewing?.status || 'new']?.map(v => ({ value: v, label: t(v) }))}/></Form.Item><Form.Item name="comment" extra={t('fieldReviewHelp')} label={t('comment')} rules={[{ required: true, min: 3 }]}><Input.TextArea rows={4} maxLength={3000}/></Form.Item><Button type="primary" htmlType="submit" loading={busy} block>{t('review')}</Button></LocalizedForm></Modal>
  <Modal title={t('createIncident')} open={incidentModal} onCancel={() => setIncidentModal(false)} footer={null}><LocalizedForm form={incidentForm} layout="vertical" onFinish={values => void act(async () => { await post('/incidents', { case_id: c.id, reason: values.reason }); setIncidentModal(false); navigate('/expert') })}><Form.Item name="reason" extra={t('fieldIncidentHelp')} label={t('reason')} rules={[{ required: true, min: 3 }]}><Input.TextArea rows={4} maxLength={2000}/></Form.Item><Button type="primary" htmlType="submit" loading={busy}>{t('createIncident')}</Button></LocalizedForm></Modal>
  <UploadModal c={c} open={uploadModal} onClose={() => { setUploadModal(false); setTab('evidence'); setToolsOpen(true) }}/><DmedModal c={c} open={dmedModal} onClose={() => setDmedModal(false)}/>
  </>
}

function UploadModal({ c, open, onClose, imaging = false }: { c: Case; open: boolean; onClose: () => void; imaging?: boolean }) {
  const { t } = useTranslation()
  const { act, busy } = useAction()
  const { message } = App.useApp()
  const [consent, setConsent] = useState(false)
  const [progress, setProgress] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const upload = (file: File) => void act(async () => {
    if (!consent) { void message.warning(t('completeInput')); return }
    setProgress(0)
    const body = new FormData()
    body.append('file', file)
    body.append('expected_version', String(c.version))
    body.append(imaging ? 'deidentified_confirmed' : 'identity_confirmed', 'true')
    await api.post(`/cases/${c.id}/${imaging ? 'imaging-studies' : 'documents'}`, body, { timeout: 180000, onUploadProgress: e => { if (e.total) setProgress(Math.round(e.loaded / e.total * 100)) } })
    onClose(); setConsent(false); setProgress(0)
  })
  return <Modal title={t(imaging ? 'uploadCT' : 'documents')} open={open} onCancel={() => { if (!busy) onClose() }} maskClosable={!busy} closable={!busy} footer={null}><div className="upload-zone"><Upload size={40} strokeWidth={1.25}/><h3>{t(imaging ? 'uploadCT' : 'upload')}</h3><p>{imaging ? t('dicomUploadLimits') : t('uploadHint')}</p><input ref={input} type="file" hidden accept={imaging ? '.zip' : '.pdf,.docx,.txt'} onChange={e => { if (e.target.files?.[0]) upload(e.target.files[0]); e.target.value = '' }}/><Button type="primary" onClick={() => input.current?.click()} disabled={!consent} loading={busy}>{t('upload')}</Button>{busy && <><Progress percent={progress} size="small"/><p role="status">{t(progress === 100 ? 'uploadProcessing' : 'uploadInProgress')}</p></>}</div><p className="workspace-field-note">{t('uploadConsentHelp')}</p><Checkbox disabled={busy} checked={consent} onChange={e => setConsent(e.target.checked)}>{t(imaging ? 'ctConsent' : 'identityConsent')}</Checkbox></Modal>
}

function DmedModal({ c, open, onClose }: { c: Case; open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const { act, busy } = useAction()
  const connections = useQuery({ queryKey: ['dmed-connections'], queryFn: ({ signal }) => get<{ items: { id: string; active: boolean }[] }>('/integrations/dmed/connections', signal), enabled: open })
  const connection = connections.data?.items.find(item => item.active)?.id
  const [scenario, setScenario] = useState('success')
  return <Modal title={t('dmed')} open={open} onCancel={() => { if (!busy) onClose() }} closable={!busy} maskClosable={!busy} keyboard={!busy} footer={null}><Alert showIcon type="info" message={t('dmedNotice')} description={t('pn_dmedPreview')}/>{connections.error && <Failure error={connections.error} retry={() => void connections.refetch()}/>}<div className="dmed-connection"><div className="dmed-logo">DMED<span>{t('demoAdapter')}</span></div><StateTag status={connection ? 'active' : 'unavailable'}/></div>{connection ? <><Select style={{ width: '100%' }} value={scenario} onChange={setScenario} options={['success', 'denied', 'disconnected', 'updated', 'identity_mismatch'].map(v => ({ value: v, label: t(v === 'updated' ? 'updatedScenario' : v) }))}/><Space className="margin-top"><Button type="primary" loading={busy} onClick={() => void act(async () => { await post(`/cases/${c.id}/imports`, { expected_version: c.version, connection_id: connection, scenario, external_id: 'DEMO-001' }); onClose() })}>{t('import')}</Button><Button onClick={() => void act(async () => { await api.delete(`/integrations/dmed/${connection}`) })}>{t('revoke')}</Button></Space></> : <Button block type="primary" loading={busy} onClick={() => void act(async () => { await post('/integrations/dmed/connect') })}>{t('connect')}</Button>}</Modal>
}
