import { Alert } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { get } from './api/client'
import type { Status } from './types'
import { processingHintKey, processingLabelKey } from './aiProvider'

/** Authenticated workspaces only: the active provider is read from server status. */
export default function AiProcessingNotice({ model }: { model?: Status['model'] }) {
  const { t } = useTranslation()
  const status = useQuery({
    queryKey: ['status'],
    queryFn: ({ signal }) => get<Status>('/system/status', signal),
    enabled: !model,
    staleTime: 10000,
  })
  const actual = model || status.data?.model
  return (
    <Alert
      className="margin-top margin-bottom"
      type="info"
      showIcon
      data-testid="ai-processing-notice"
      message={t(processingLabelKey(actual))}
      description={t(processingHintKey(actual))}
    />
  )
}
