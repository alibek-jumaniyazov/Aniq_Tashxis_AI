import { useRef, useState } from 'react'
import { Alert, Button, Checkbox, Input, Modal, Select } from 'antd'
import { FileText, Save, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api, post } from './api/client'
import type { Case, Source } from './types'
import { Failure, time, useAction } from './ui'

export type ReportDraft = {
  radiologist_report: string
  report_source_id: string | null
  report_quote: string
}
export type ImagingReport = ReportDraft & {
  id: string
  author_name: string
  created_at: string
  case_version: number
}

export default function RadiologyReportEditor({
  c,
  studyId,
  canEdit,
  report,
  onChange,
  reports,
  loading,
  error,
  retry,
}: {
  c: Case
  studyId: string
  canEdit: boolean
  report: ReportDraft
  onChange: (value: ReportDraft) => void
  reports: ImagingReport[]
  loading: boolean
  error: unknown
  retry: () => void
}) {
  const { t } = useTranslation()
  const { act, busy } = useAction()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [consent, setConsent] = useState(false)
  const [progress, setProgress] = useState(0)
  const [emptySource, setEmptySource] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const sources = c.documents.filter((source) => source.type !== 'manual')
  const selectedSource = sources.find((source) => source.id === report.report_source_id)
  const selectSource = (source?: Source) => {
    const text = source?.text?.trim().slice(0, 12000) || ''
    setEmptySource(!!source && !text)
    onChange({
      radiologist_report: text || report.radiologist_report,
      report_source_id: text && source ? source.id : null,
      report_quote: text,
    })
  }
  const upload = (file: File) =>
    void act(async () => {
      if (!consent) return
      if (!/\.(pdf|docx|txt)$/i.test(file.name)) throw new Error(t('rwDocumentFormats'))
      const body = new FormData()
      body.append('file', file)
      body.append('expected_version', String(c.version))
      body.append('identity_confirmed', 'true')
      body.append('category', 'instrumental')
      setProgress(0)
      const response = await api.post<Source>(`/cases/${c.id}/documents`, body, {
        timeout: 180000,
        onUploadProgress: (event) => {
          if (event.total) setProgress(Math.round((event.loaded / event.total) * 100))
        },
      })
      selectSource(response.data)
      setUploadOpen(false)
      setConsent(false)
    })
  return (
    <aside className="rw-report-editor" aria-label={t('rwReportTitle')}>
      <div className="rw-report-heading">
        <FileText size={20} />
        <div>
          <span>{t('rwReportEyebrow')}</span>
          <h3>{t('rwReportTitle')}</h3>
        </div>
      </div>
      <p className="rw-report-help">{t('rwReportHelp')}</p>
      {error ? (
        <Failure error={error} retry={retry} />
      ) : (
        <>
          <label className="rw-field-label" htmlFor="radiology-source">
            {t('rwReportSource')}
          </label>
          <Select
            id="radiology-source"
            className="full-width"
            allowClear
            disabled={!canEdit || busy || loading}
            value={report.report_source_id || undefined}
            placeholder={t('rwManualReport')}
            options={sources.map((source) => ({ value: source.id, label: source.name }))}
            onChange={(id) => selectSource(sources.find((source) => source.id === id))}
          />
          {canEdit && (
            <Button
              block
              icon={<Upload size={15} />}
              disabled={busy}
              className="rw-upload-report"
              onClick={() => setUploadOpen(true)}
            >
              {t('rwUploadReport')}
            </Button>
          )}
          {emptySource && <Alert showIcon type="warning" message={t('rwNoDocumentText')} />}
          <label className="rw-field-label" htmlFor="radiology-report">
            {t('rwReportText')}
          </label>
          <Input.TextArea
            id="radiology-report"
            disabled={!canEdit || busy || loading}
            value={report.radiologist_report}
            rows={9}
            maxLength={12000}
            showCount
            placeholder={t('rwReportPlaceholder')}
            onChange={(event) => onChange({ ...report, radiologist_report: event.target.value })}
          />
          {report.report_source_id && (
            <details className="rw-source-quote">
              <summary>{t('rwSourceQuote')}</summary>
              <p>{report.report_quote}</p>
              {selectedSource && ['pdf', 'docx', 'txt'].includes(selectedSource.type) && (
                <Button
                  size="small"
                  href={`/api/v1/documents/${report.report_source_id}/content`}
                  target="_blank"
                >
                  {t('download')}
                </Button>
              )}
            </details>
          )}
          <p className="rw-report-help">{t('rwReportDraftHint')}</p>
          {canEdit && (
            <Button
              block
              icon={<Save size={15} />}
              loading={busy}
              disabled={!report.radiologist_report.trim() || loading}
              onClick={() =>
                void act(async () => {
                  const saved = await post<ImagingReport>(`/imaging-studies/${studyId}/reports`, {
                    expected_version: c.version,
                    radiologist_report: report.radiologist_report,
                    report_source_id: report.report_source_id,
                    report_quote: report.report_quote,
                  })
                  onChange({
                    radiologist_report: saved.radiologist_report,
                    report_source_id: saved.report_source_id,
                    report_quote: saved.report_quote,
                  })
                })
              }
            >
              {t('rwSaveReport')}
            </Button>
          )}
        </>
      )}
      {!!reports.length && (
        <details className="rw-report-history">
          <summary>{t('rwReportHistory', { count: reports.length })}</summary>
          {reports.map((item) => (
            <article key={item.id}>
              <strong>{item.author_name}</strong>
              <small>
                {time(item.created_at)} · v{item.case_version}
              </small>
              <p>{item.radiologist_report}</p>
              {canEdit && (
                <Button
                  size="small"
                  disabled={busy}
                  onClick={() => {
                    setEmptySource(false)
                    onChange({
                      radiologist_report: item.radiologist_report,
                      report_source_id: item.report_source_id,
                      report_quote: item.report_quote,
                    })
                  }}
                >
                  {t('rwUseReport')}
                </Button>
              )}
            </article>
          ))}
        </details>
      )}
      <Modal
        title={t('rwUploadReport')}
        open={uploadOpen}
        footer={null}
        closable={!busy}
        maskClosable={!busy}
        onCancel={() => {
          if (!busy) {
            setUploadOpen(false)
            setConsent(false)
          }
        }}
      >
        <p className="rw-upload-help">{t('rwDocumentFormats')}</p>
        <Checkbox
          checked={consent}
          disabled={busy}
          onChange={(event) => setConsent(event.target.checked)}
        >
          {t('identityConsent')}
        </Checkbox>
        <input
          ref={input}
          hidden
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) upload(file)
            event.target.value = ''
          }}
        />
        <Button
          block
          type="primary"
          className="margin-top"
          disabled={!consent}
          loading={busy}
          onClick={() => input.current?.click()}
        >
          {busy ? `${t('loading')} ${progress}%` : t('upload')}
        </Button>
      </Modal>
    </aside>
  )
}
