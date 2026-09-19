import { useRef, useState } from 'react'
import { Alert, App, Button, Checkbox, Modal, Progress, Select, Space } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Upload } from 'lucide-react'
import { api, get, post } from '../api/client'
import type { Case } from '../types'
import { Failure, StateTag, useAction } from '../ui'

export function UploadModal({
  c,
  open,
  onClose,
  imaging = false,
}: {
  c: Case
  open: boolean
  onClose: () => void
  imaging?: boolean
}) {
  const { t } = useTranslation()
  const { act, busy } = useAction()
  const { message } = App.useApp()
  const [consent, setConsent] = useState(false)
  const [progress, setProgress] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const upload = (file: File) =>
    void act(async () => {
      if (!consent) {
        void message.warning(t('completeInput'))
        return
      }
      setProgress(0)
      const body = new FormData()
      body.append('file', file)
      body.append('expected_version', String(c.version))
      body.append(imaging ? 'deidentified_confirmed' : 'identity_confirmed', 'true')
      await api.post(`/cases/${c.id}/${imaging ? 'imaging-studies' : 'documents'}`, body, {
        timeout: 180000,
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100))
        },
      })
      onClose()
      setConsent(false)
      setProgress(0)
    })
  return (
    <Modal
      title={t(imaging ? 'uploadCT' : 'documents')}
      open={open}
      onCancel={() => {
        if (!busy) onClose()
      }}
      maskClosable={!busy}
      closable={!busy}
      footer={null}
    >
      <div className="upload-zone">
        <Upload size={40} strokeWidth={1.25} />
        <h3>{t(imaging ? 'uploadCT' : 'upload')}</h3>
        <p>{imaging ? t('dicomUploadLimits') : t('uploadHint')}</p>
        <input
          ref={input}
          type="file"
          hidden
          accept={imaging ? '.zip' : '.pdf,.docx,.txt'}
          onChange={(e) => {
            if (e.target.files?.[0]) upload(e.target.files[0])
            e.target.value = ''
          }}
        />
        <Button
          type="primary"
          onClick={() => input.current?.click()}
          disabled={!consent}
          loading={busy}
        >
          {t('upload')}
        </Button>
        {busy && (
          <>
            <Progress percent={progress} size="small" />
            <p role="status">{t(progress === 100 ? 'uploadProcessing' : 'uploadInProgress')}</p>
          </>
        )}
      </div>
      <p className="workspace-field-note">{t('uploadConsentHelp')}</p>
      <Checkbox disabled={busy} checked={consent} onChange={(e) => setConsent(e.target.checked)}>
        {t(imaging ? 'ctConsent' : 'identityConsent')}
      </Checkbox>
    </Modal>
  )
}

export function DmedModal({ c, open, onClose }: { c: Case; open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const { act, busy } = useAction()
  const connections = useQuery({
    queryKey: ['dmed-connections'],
    queryFn: ({ signal }) =>
      get<{ items: { id: string; active: boolean }[] }>('/integrations/dmed/connections', signal),
    enabled: open,
  })
  const connection = connections.data?.items.find((item) => item.active)?.id
  const [scenario, setScenario] = useState('success')
  return (
    <Modal
      title={t('dmed')}
      open={open}
      onCancel={() => {
        if (!busy) onClose()
      }}
      closable={!busy}
      maskClosable={!busy}
      keyboard={!busy}
      footer={null}
    >
      <Alert showIcon type="info" message={t('dmedNotice')} description={t('pn_dmedPreview')} />
      {connections.error && (
        <Failure error={connections.error} retry={() => void connections.refetch()} />
      )}
      <div className="dmed-connection">
        <div className="dmed-logo">
          DMED<span>{t('demoAdapter')}</span>
        </div>
        <StateTag status={connection ? 'active' : 'unavailable'} />
      </div>
      {connection ? (
        <>
          <Select
            style={{ width: '100%' }}
            value={scenario}
            onChange={setScenario}
            options={['success', 'denied', 'disconnected', 'updated', 'identity_mismatch'].map(
              (v) => ({ value: v, label: t(v === 'updated' ? 'updatedScenario' : v) }),
            )}
          />
          <Space className="margin-top">
            <Button
              type="primary"
              loading={busy}
              onClick={() =>
                void act(async () => {
                  await post(`/cases/${c.id}/imports`, {
                    expected_version: c.version,
                    connection_id: connection,
                    scenario,
                    external_id: 'DEMO-001',
                  })
                  onClose()
                })
              }
            >
              {t('import')}
            </Button>
            <Button
              onClick={() =>
                void act(async () => {
                  await api.delete(`/integrations/dmed/${connection}`)
                })
              }
            >
              {t('revoke')}
            </Button>
          </Space>
        </>
      ) : (
        <Button
          block
          type="primary"
          loading={busy}
          onClick={() =>
            void act(async () => {
              await post('/integrations/dmed/connect')
            })
          }
        >
          {t('connect')}
        </Button>
      )}
    </Modal>
  )
}
