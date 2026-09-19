import { Button, Drawer, Tag } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CloudDownload, FileText, Sparkles } from 'lucide-react'
import AiProcessingNotice from '../AiProcessingNotice'
import { api, get } from '../api/client'
import type { Case, Source } from '../types'
import { Failure, Loading, time, type useAction } from '../ui'

interface PatientSourceDrawerProps {
  c: Case
  sourceId: string | null
  canEdit: boolean
  busy: boolean
  act: ReturnType<typeof useAction>['act']
  onClose: () => void
  onExtracted: () => void
  onAddFact: (sourceId: string) => void
}

export default function PatientSourceDrawer({
  c,
  sourceId,
  canEdit,
  busy,
  act,
  onClose,
  onExtracted,
  onAddFact,
}: PatientSourceDrawerProps) {
  const { t } = useTranslation()
  const source = useQuery({
    queryKey: ['source', sourceId],
    queryFn: ({ signal }) => get<Source>(`/sources/${sourceId}`, signal),
    enabled: !!sourceId,
  })
  return (
    <Drawer
      zIndex={1200}
      title={
        <span>
          <FileText size={18} /> {t('source')}
        </span>
      }
      open={!!sourceId}
      onClose={() => onClose()}
      width="min(590px, 100vw)"
    >
      {source.isPending ? (
        <Loading />
      ) : source.error ? (
        <Failure error={source.error} retry={() => void source.refetch()} />
      ) : (
        source.data && (
          <div className="source-view">
            <span className="eyebrow">
              {t('evidence')} / v{source.data.case_version}
            </span>
            <h2>
              {(source.data.type === 'manual' && source.data.name === 'Manual entry'
                ? t('manualSourceName')
                : source.data.name) || t('addNote')}
            </h2>
            <p className="muted">{time(source.data.created_at)}</p>
            {source.data.limitations?.map((l) => (
              <Tag key={l}>
                {l.startsWith('OCR_UNAVAILABLE_PAGE_')
                  ? t('sourceOcrUnavailable', { page: l.slice('OCR_UNAVAILABLE_PAGE_'.length) })
                  : t(l)}
              </Tag>
            ))}
            <div className="source-paper">
              <span>{t('sourceText')}</span>
              <pre>{source.data.text}</pre>
            </div>
            {['pdf', 'docx', 'txt'].includes(source.data.type) && (
              <Button
                href={`/api/v1/documents/${source.data.id}/content`}
                target="_blank"
                icon={<CloudDownload size={16} />}
              >
                {t('download')}
              </Button>
            )}
            {canEdit && ['pdf', 'docx', 'txt'].includes(source.data.type) && (
              <>
                <Button
                  className="margin-top"
                  block
                  icon={<Sparkles size={15} />}
                  loading={busy}
                  onClick={() =>
                    void act(async () => {
                      await api.post(
                        `/documents/${source.data.id}/extract`,
                        { expected_version: c.version },
                        { timeout: 180000 },
                      )
                      onClose()
                      onExtracted()
                    })
                  }
                >
                  {t('extractWithAI')}
                </Button>
                <p className="muted">{t('extractHint')}</p>
                <AiProcessingNotice />
              </>
            )}
            {canEdit && (
              <Button
                className="margin-top"
                block
                onClick={() => {
                  onClose()
                  onAddFact(source.data.id)
                }}
              >
                {t('addFact')}
              </Button>
            )}
          </div>
        )
      )}
    </Drawer>
  )
}
