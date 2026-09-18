import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Form, Input, Modal, Select } from 'antd'
import { useTranslation } from 'react-i18next'
import { api, get, post } from './api/client'
import { useAction } from './ui'

type Values = { text: string; note_type: string; provenance: string; event_time: string }
const empty: Values = { text: '', note_type: 'history', provenance: 'manual', event_time: '' }

export default function NoteEditor({ caseId, version, open, onClose, onSaved }: { caseId: string; version: number; open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const [form] = Form.useForm<Values>()
  const { act, busy } = useAction()
  const [status, setStatus] = useState('')
  const [ready, setReady] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pending = useRef<Promise<unknown>>(Promise.resolve())
  useEffect(() => {
    if (!open) return
    let live = true
    setReady(false)
    void pending.current.catch(() => {}).then(() => get<{ values: Values | null }>(`/cases/${caseId}/drafts/note`)).then(data => {
      if (live) { form.setFieldsValue(data.values || empty); setStatus(data.values?.text ? 'draftRestored' : 'draftPrivate'); setReady(true) }
    }).catch(() => { if (live) setStatus('draftLoadFailed') })
    return () => { live = false; clearTimeout(timer.current) }
  }, [caseId, open, form])
  const saveDraft = (values: Values) => {
    setStatus('draftSaving')
    const request = pending.current.catch(() => {}).then(() => api.put(`/cases/${caseId}/drafts/note`, values))
    pending.current = request
    void request.then(() => setStatus('draftSaved')).catch(() => setStatus('draftFailed'))
    return request
  }
  const close = () => {
    clearTimeout(timer.current)
    if (ready) void saveDraft(form.getFieldsValue()).catch(() => {})
    onClose()
  }
  return <Modal title={t('addNote')} open={open} onCancel={close} footer={null}>
    <Alert className="margin-bottom" type={status.endsWith('Failed') ? 'warning' : 'info'} message={t(status || 'loading')} showIcon/>
    <Form form={form} layout="vertical" initialValues={empty} disabled={!ready || busy} onValuesChange={(_, values: Values) => { clearTimeout(timer.current); setStatus('draftSaving'); timer.current = setTimeout(() => { void saveDraft(values).catch(() => {}) }, 1000) }} onFinish={values => void act(async () => {
      clearTimeout(timer.current)
      await pending.current.catch(() => {})
      await post(`/cases/${caseId}/notes`, { ...values, expected_version: version, event_time: values.event_time ? new Date(values.event_time).toISOString() : null })
      await api.put(`/cases/${caseId}/drafts/note`, empty)
      form.setFieldsValue(empty)
      onSaved()
    })}>
      <Form.Item name="note_type" label={t('noteType')}><Select options={['history', 'decision_rationale', 'alert_response'].map(value => ({ value, label: t(value) }))}/></Form.Item>
      <Form.Item name="text" label={t('noteText')} rules={[{ required: true, min: 3 }]}><Input.TextArea rows={5} maxLength={6000}/></Form.Item>
      <Form.Item name="provenance" label={t('provenance')}><Select options={['manual', 'paper', 'patient_reported'].map(value => ({ value, label: t(value) }))}/></Form.Item>
      <Form.Item name="event_time" label={t('eventTime')}><Input type="datetime-local"/></Form.Item>
      <Button type="primary" htmlType="submit" block loading={busy}>{t('save')}</Button>
    </Form>
  </Modal>
}
