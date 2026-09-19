import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Failure, Loading } from '../ui'

import type { SubscriptionRequest } from './types'

class ReceiptError extends Error {
  constructor(
    readonly key: string,
    readonly status?: number,
  ) {
    super(key)
  }
}

export function ReceiptPreview({ request }: { request: SubscriptionRequest }) {
  const { t } = useTranslation()
  const [objectUrl, setObjectUrl] = useState('')
  const receipt = useQuery({
    queryKey: ['developer-receipt', request.id],
    queryFn: async ({ signal }) => {
      const url = new URL(request.receipt_url, window.location.origin)
      if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/v1/'))
        throw new ReceiptError('commerceReceiptUrlInvalid')
      const response = await fetch(url, { signal, credentials: 'same-origin' })
      if (!response.ok) throw new ReceiptError('commerceReceiptLoadError', response.status)
      const blob = await response.blob()
      if (!['image/jpeg', 'image/png', 'application/pdf'].includes(blob.type.split(';')[0]))
        throw new ReceiptError('commerceReceiptTypeInvalid')
      return blob
    },
    staleTime: 60000,
  })
  useEffect(() => {
    if (!receipt.data) return
    const url = URL.createObjectURL(receipt.data)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [receipt.data])
  if (receipt.isPending) return <Loading />
  if (receipt.isError)
    return (
      <Failure
        error={
          receipt.error instanceof ReceiptError
            ? new Error(t(receipt.error.key, { status: receipt.error.status }))
            : receipt.error
        }
        retry={() => void receipt.refetch()}
      />
    )
  return (
    <div className="commerce-receipt">
      <div className="commerce-receipt-head">
        <span>{request.receipt_name}</span>
        {objectUrl && (
          <a href={objectUrl} download={request.receipt_name}>
            {t('commerceDownloadReceipt')}
          </a>
        )}
      </div>
      {objectUrl &&
        (receipt.data.type.startsWith('image/') ? (
          <img
            src={objectUrl}
            alt={t('commerceReceiptImageAlt', { clinic: request.clinic_name })}
          />
        ) : (
          <iframe
            src={objectUrl}
            title={t('commerceReceiptPdfTitle')}
            sandbox="allow-same-origin"
          />
        ))}
    </div>
  )
}
