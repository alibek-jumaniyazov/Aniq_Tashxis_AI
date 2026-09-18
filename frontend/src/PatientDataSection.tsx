import { useId, useRef, useState } from 'react'
import { Alert, Button, Checkbox, Form, Input, Modal, Progress, Space, Tag } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Activity, ArrowUpRight, CheckCheck, ClipboardCheck, FileText, FlaskConical, Link2, MessageCircle, Pencil, Plus, ScanLine, Upload } from 'lucide-react'
import { api, get, patch, post } from './api/client'
import type { Case, Fact, User } from './types'
import { Blank, Failure, Loading, SectionTitle, time, useAction } from './ui'
import LocalizedForm from './LocalizedForm'
import './patientWorkspace.css'

export type ClinicalCategory = 'subjective' | 'objective' | 'laboratory' | 'instrumental' | 'doctor_conclusion'
export interface ClinicalEntry {
  id: string; category: ClinicalCategory; text: string; diagnosis: string; treatment: string; confirmed: boolean
  source_id: string | null; source_mode: string; case_version: number; created_at: string; author_name: string
}
export interface ClinicalEntriesResponse {
  items: ClinicalEntry[]; case_version: number
  readiness: { comparison_ready: boolean; has_confirmed_data: boolean; has_confirmed_conclusion: boolean; adult_age_known: boolean }
}
export interface PatientDataSectionProps {
  c: Case; user: User; category: ClinicalCategory; openSource: (id: string) => void
  openImaging?: () => void; importDmed?: () => void
}
const icons = { subjective: MessageCircle, objective: Activity, laboratory: FlaskConical, instrumental: ScanLine, doctor_conclusion: ClipboardCheck }

function factCategory(fact: Fact): ClinicalCategory | null {
  if (/^(symptom|allerg|history|smoking|medication|risk)/.test(fact.key)) return 'subjective'
  if (/^(vital|exam|physical|observation)/.test(fact.key)) return 'objective'
  if (/^(lab|test)/.test(fact.key)) return 'laboratory'
  if (/^(imaging|radiology|instrumental|ecg)/.test(fact.key)) return 'instrumental'
  return null
}

export default function PatientDataSection({ c, user, category, openSource, openImaging, importDmed }: PatientDataSectionProps) {
  const { t } = useTranslation()
  const { act, busy } = useAction()
  const [form] = Form.useForm()
  const formName = `clinical-entry-${useId()}`
  const [editor, setEditor] = useState<{ entry?: ClinicalEntry; version: number; category: ClinicalCategory } | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [consent, setConsent] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadedCategory, setUploadedCategory] = useState<ClinicalCategory | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const canEdit = user.role === 'doctor' || (user.role === 'radiologist' && category === 'instrumental')
  const conclusion = category === 'doctor_conclusion'
  const Icon = icons[category]
  const records = useQuery({ queryKey: ['clinical-entries', c.id, c.version], queryFn: ({ signal }) => get<ClinicalEntriesResponse>(`/cases/${c.id}/clinical-entries`, signal) })
  const entries = (records.data?.items || []).filter(entry => entry.category === category).sort((a, b) => b.created_at.localeCompare(a.created_at))
  const existingFacts = c.facts.filter(fact => factCategory(fact) === category)
  const changed = !!editor && (editor.version !== c.version || editor.category !== category)
  const confirmed = Form.useWatch('confirmed', form)

  const edit = (entry?: ClinicalEntry) => {
    form.resetFields()
    form.setFieldsValue({ text: entry?.text || '', diagnosis: entry?.diagnosis || '', treatment: entry?.treatment || '', confirmed: entry?.confirmed || false })
    setEditor({ entry, version: c.version, category })
  }
  const upload = (file: File) => {
    if (!consent || busy) return
    void act(async () => {
      setProgress(0)
      const body = new FormData()
      body.append('file', file)
      body.append('expected_version', String(c.version))
      body.append('identity_confirmed', 'true')
      body.append('category', category)
      await api.post(`/cases/${c.id}/documents`, body, { timeout: 180000, onUploadProgress: event => { if (event.total) setProgress(Math.round(event.loaded / event.total * 100)) } })
      setUploadOpen(false)
      setConsent(false)
      setUploadedCategory(category)
    })
  }

  return <div className={`patient-data-section patient-data-section--${category}`}>
    <section className="pw-section-intro">
      <span className="pw-section-icon"><Icon size={25}/></span>
      <div><h2>{t(`pw_${category}`)}</h2><p>{t(`pw_${category}_hint`)}</p></div>
    </section>
    {canEdit ? <div className="pw-input-methods">
      <button type="button" onClick={() => edit()} disabled={busy}><Pencil size={22}/><strong>{t('pw_manual')}</strong><p>{t('pw_manual_hint')}</p><ArrowUpRight size={16}/></button>
      <button type="button" onClick={() => { setConsent(false); setProgress(0); setUploadOpen(true) }} disabled={busy}><Upload size={22}/><strong>{t('pw_document')}</strong><p>{t('pw_document_hint')}</p><ArrowUpRight size={16}/></button>
      <button type="button" onClick={importDmed} disabled={busy || !importDmed || user.role !== 'doctor'}><Link2 size={22}/><strong>{t('pw_dmed')} <Tag>{t('demoShort')}</Tag></strong><p>{t('pw_dmed_hint')}</p><ArrowUpRight size={16}/></button>
    </div> : <Alert type="info" showIcon message={t('pw_readonly')}/>}
    {canEdit && <p className="pw-method-note"><Link2 size={14}/>{t('pw_dmed_notice')}</p>}
    {category === 'instrumental' && openImaging && <section className="pw-imaging-launch"><ScanLine size={30}/><div><h3>{t('pw_openImaging')}</h3><p>{t('pw_imaging_hint')}</p></div><Button type="primary" onClick={openImaging} icon={<ArrowUpRight size={16}/>}>{t('observe')}</Button></section>}
    {uploadedCategory === category && <Alert className="margin-bottom" type="info" showIcon closable onClose={() => setUploadedCategory(null)} message={t('pw_upload_draft')}/>}
    <section className="panel pw-records">
      <SectionTitle title={t('pw_entries')} subtitle={t('pw_entries_hint')} extra={canEdit && <Button onClick={() => edit()} icon={<Plus size={15}/>} disabled={busy}>{t('pw_add')}</Button>}/>
      {records.isPending ? <Loading/> : records.error ? <Failure error={records.error} retry={() => void records.refetch()}/> : entries.length ? <div className="pw-entry-list">{entries.map(entry => <article key={entry.id} className={`pw-entry ${entry.confirmed ? 'pw-entry--confirmed' : ''}`}>
        <div className="pw-entry-heading"><Tag color={entry.confirmed ? 'cyan' : 'gold'}>{entry.confirmed ? <CheckCheck size={12}/> : <Pencil size={12}/>} {t(entry.confirmed ? 'pw_confirmed' : 'pw_draft')}</Tag><span>{t(entry.source_mode === 'manual' ? 'pw_source_manual' : entry.source_mode === 'dmed_demo' ? 'pw_source_dmed_demo' : entry.source_mode === 'dmed' ? 'pw_source_dmed' : 'pw_source_document')}</span><small>v{entry.case_version} · {time(entry.created_at)}</small></div>
        {entry.diagnosis && <div className="pw-record-field"><span>{t('pw_diagnosis')}</span><h3>{entry.diagnosis}</h3></div>}
        <div className="pw-record-field">{conclusion && <span>{t('pw_reasoning')}</span>}<div className="pw-record-text">{entry.text || t('pw_empty_extraction')}</div></div>
        {entry.treatment && <div className="pw-record-field"><span>{t('pw_treatment')}</span><div className="pw-record-text">{entry.treatment}</div></div>}
        <footer><small>{entry.author_name}</small><Space wrap>{entry.source_id && <Button type="link" size="small" icon={<FileText size={14}/>} onClick={() => openSource(entry.source_id!)}>{t('openSource')}</Button>}{canEdit && <Button size="small" disabled={busy} onClick={() => edit(entry)} icon={entry.confirmed ? <Pencil size={14}/> : <ClipboardCheck size={14}/>}>{t(entry.confirmed ? 'pw_edit' : 'pw_confirm_action')}</Button>}</Space></footer>
      </article>)}</div> : <Blank title={t('pw_empty')} hint={t('pw_empty_hint')}/>}
      {!!existingFacts.length && <details className="pw-legacy-records" open><summary>{t('facts')} · {existingFacts.length}</summary>{existingFacts.map(fact => <article key={fact.id}><div><strong>{fact.label}</strong><Tag color={fact.confirmed ? 'cyan' : 'gold'}>{t(fact.confirmed ? 'pw_confirmed' : 'pw_draft')}</Tag></div><p>{fact.value ?? '—'} {fact.unit} · {t(fact.assertion)}</p><small>{time(fact.event_time)} · v{fact.case_version}</small>{fact.source_id && <Button size="small" type="link" onClick={() => openSource(fact.source_id)}>{t('openSource')}</Button>}</article>)}</details>}
      {conclusion && !entries.length && (c.diagnosis || !!c.clinical_conclusions?.length) && <details className="pw-legacy-records" open><summary>{t('clinicalConclusions')}</summary>{c.diagnosis && <article><Tag>{t('provisional')}</Tag><p>{c.diagnosis}</p></article>}{c.clinical_conclusions?.map(item => <article key={item.id}><div><strong>{item.diagnosis}</strong><Tag>{t(item.status === 'confirmed' ? 'clinicianConfirmed' : 'provisional')}</Tag></div><p>{item.rationale}</p><small>{item.author_name} · {time(item.created_at)}</small></article>)}</details>}
    </section>
    <Modal title={t(editor?.entry ? 'pw_edit' : 'pw_add')} open={!!editor} onCancel={() => { if (!busy) setEditor(null) }} footer={null} width={720} maskClosable={!busy} closable={!busy} keyboard={!busy}>
      <p className="pw-editor-help">{t(`pw_${category}_hint`)}</p>
      {changed && <Alert className="margin-bottom" type="warning" showIcon message={t('pw_changed')}/>}
      {editor?.entry?.source_id && <Button className="margin-bottom" type="link" onClick={() => openSource(editor.entry!.source_id!)} icon={<FileText size={15}/>}>{t('pw_linked_source')}</Button>}
      <LocalizedForm name={formName} form={form} className="pw-entry-form" layout="vertical" disabled={busy} onValuesChange={changes => {
        if (editor?.entry?.confirmed && ['text', 'diagnosis', 'treatment'].some(key => key in changes)) form.setFieldValue('confirmed', false)
      }} onFinish={values => {
        if (!editor || changed) return
        void act(async () => {
          const body = { expected_version: editor.version, text: (values.text || '').trim(), diagnosis: (values.diagnosis || '').trim(), treatment: (values.treatment || '').trim(), confirmed: !!values.confirmed }
          if (editor.entry) await patch(`/cases/${c.id}/clinical-entries/${editor.entry.id}`, body)
          else await post(`/cases/${c.id}/clinical-entries`, { ...body, category: editor.category })
          setEditor(null)
        })
      }}>
        {conclusion && <Form.Item name="diagnosis" label={t('pw_diagnosis')} extra={t('pw_diagnosis_help')}><Input.TextArea aria-label={t('pw_diagnosis')} rows={2} maxLength={6000}/></Form.Item>}
        <Form.Item name="text" label={t(conclusion ? 'pw_reasoning' : 'pw_entryText')} rules={[{ required: true, whitespace: true }]}><Input.TextArea aria-label={t(conclusion ? 'pw_reasoning' : 'pw_entryText')} rows={conclusion ? 5 : 8} maxLength={20000} showCount placeholder={t(`pw_${category}_example`)}/></Form.Item>
        {conclusion && <Form.Item name="treatment" label={t('pw_treatment')} extra={t('pw_treatment_help')}><Input.TextArea aria-label={t('pw_treatment')} rows={4} maxLength={6000} showCount/></Form.Item>}
        <Form.Item name="confirmed" valuePropName="checked"><Checkbox>{t('pw_confirm')}</Checkbox></Form.Item>
        {editor?.entry && <p className="pw-editor-help">{t('pw_revision')}</p>}
        <Button type="primary" htmlType="submit" block loading={busy} disabled={changed}>{t(confirmed ? 'pw_saveConfirmed' : 'pw_saveDraft')}</Button>
      </LocalizedForm>
    </Modal>
    <Modal title={t('pw_upload_title', { category: t(`pw_${category}`) })} open={uploadOpen} onCancel={() => { if (!busy) setUploadOpen(false) }} footer={null} maskClosable={!busy} closable={!busy} keyboard={!busy}>
      <div className="pw-upload-zone"><Upload size={38}/><p>{t('pw_upload_hint')}</p><input type="file" ref={input} hidden accept=".pdf,.docx,.txt" onChange={event => { const file = event.target.files?.[0]; if (file) upload(file); event.target.value = '' }}/><Button type="primary" onClick={() => input.current?.click()} loading={busy} disabled={!consent}>{t('pw_upload_file')}</Button>{busy && <><Progress percent={progress}/><p role="status">{t(progress === 100 ? 'uploadProcessing' : 'uploadInProgress')}</p></>}</div>
      <Checkbox checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)}>{t('identityConsent')}</Checkbox>
    </Modal>
  </div>
}
