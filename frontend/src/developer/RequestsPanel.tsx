import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Form, Input, Modal, Select, Table, Tag } from 'antd'
import { Check, FileCheck2, Search, X } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { get, post } from '../api/client'
import { localizedPlanName, formatMoney as money } from '../commerceTypes'
import LocalizedForm from '../LocalizedForm'
import { Failure, Loading, time, useAction } from '../ui'

import type { Page, SubscriptionRequest } from './types'

import { labels, statusTag } from './presentation'

import { ReceiptPreview } from './ReceiptPreview'

export function RequestReview({
  request,
  onClose,
}: {
  request: SubscriptionRequest
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [form] = Form.useForm<{ note: string }>()
  const { act, busy } = useAction()
  const review = async (decision: 'approved' | 'rejected') => {
    const note = (form.getFieldValue('note') || '').trim()
    if (note.length < 5) {
      form.setFields([
        {
          name: 'note',
          errors: [
            decision === 'rejected'
              ? t('commerceRejectionReasonLength')
              : t('commerceReviewNoteLength'),
          ],
        },
      ])
      return
    }
    const saved = await act(() =>
      post(`/developer/subscription-requests/${request.id}/review`, {
        expected_version: request.version,
        decision,
        note,
      }),
    )
    if (saved) onClose()
  }
  return (
    <Modal
      title={t('commerceReviewPaymentRequest')}
      open
      onCancel={() => {
        if (!busy) onClose()
      }}
      footer={null}
      width={760}
      maskClosable={!busy}
    >
      <div className="commerce-admin">
        <div className="commerce-review-summary">
          <div>
            <span>{t('commerceClinic')}</span>
            <strong>{request.clinic_name}</strong>
          </div>
          <div>
            <span>{t('commercePlanDoctors')}</span>
            <strong>
              {localizedPlanName(request.plan_name, request.plan_id)} ·{' '}
              {t('commerceDoctorsCount', { count: request.doctor_limit })}
            </strong>
          </div>
          <div>
            <span>{t('commerceAmountToVerify')}</span>
            <strong>{money(request.price_uzs)}</strong>
          </div>
          <div>
            <span>{t('commercePaymentMethod')}</span>
            <strong>{request.payment_method_name}</strong>
          </div>
          <div>
            <span>{t('commerceSubmitted')}</span>
            <strong>{time(request.created_at)}</strong>
          </div>
          <div>
            <span>{t('commerceStatus')}</span>
            <strong>
              {statusTag(request.status)}
              {request.is_demo && <Tag>{t('commerceDemoReceipt')}</Tag>}
            </strong>
          </div>
        </div>
        <ReceiptPreview request={request} />
        <div className="commerce-review-summary">
          <div>
            <span>{t('commerceRequestRecipient')}</span>
            <strong>
              {request.payment_recipient || '—'}{' '}
              {request.payment_card_last4 ? `· •••• ${request.payment_card_last4}` : ''}
            </strong>
          </div>
          <div>
            <span>{t('commercePaymentReference')}</span>
            <strong>{request.payment_reference || t('commerceNotProvided')}</strong>
          </div>
        </div>
        {request.status === 'pending' ? (
          <>
            <Alert
              type="info"
              showIcon
              message={t('commerceVerifyFunds')}
              description={t('commerceVerifyFundsHint')}
            />
            <LocalizedForm disabled={busy} form={form} layout="vertical" className="margin-top">
              <Form.Item
                name="note"
                label={t('commerceReviewNote')}
                rules={[{ max: 1000, message: t('commerceReviewNoteMax') }]}
              >
                <Input.TextArea
                  rows={3}
                  maxLength={1000}
                  placeholder={t('commerceReviewNotePlaceholder')}
                />
              </Form.Item>
            </LocalizedForm>
            <div className="commerce-review-actions">
              <Button
                danger
                icon={<X size={15} />}
                loading={busy}
                onClick={() => void review('rejected')}
              >
                {t('commerceRejectWithReason')}
              </Button>
              <Button
                type="primary"
                icon={<Check size={15} />}
                loading={busy}
                onClick={() => void review('approved')}
              >
                {t('commerceApproveActivate')}
              </Button>
            </div>
          </>
        ) : (
          <Alert
            type={request.status === 'approved' ? 'success' : 'warning'}
            showIcon
            message={`${labels()[request.status] || request.status} · ${time(request.reviewed_at)}`}
            description={request.review_note || t('commerceNoReviewNote')}
          />
        )}
      </div>
    </Modal>
  )
}

export function RequestsPanel() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const q = useDeferredValue(search)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('pending')
  const [selected, setSelected] = useState<SubscriptionRequest | null>(null)
  const query = useQuery({
    queryKey: ['developer-requests', q, page, status],
    queryFn: ({ signal }) =>
      get<Page<SubscriptionRequest>>(
        `/developer/subscription-requests?page=${page}&page_size=10&q=${encodeURIComponent(q)}${status ? `&status=${status}` : ''}`,
        signal,
      ),
    refetchInterval: status === 'pending' ? 10000 : false,
  })
  return (
    <section className="commerce-card">
      <div className="commerce-section-heading">
        <div>
          <h2>{t('commerceReviewPayments')}</h2>
          <p>{t('commerceReviewWorkflow')}</p>
        </div>
      </div>
      <div className="commerce-toolbar">
        <Input
          allowClear
          value={search}
          prefix={<Search size={15} />}
          placeholder={t('commerceSearchClinicPlan')}
          aria-label={t('commerceSearchRequests')}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
        />
        <Select
          aria-label={t('commerceRequestStatus')}
          value={status}
          onChange={(value) => {
            setStatus(value)
            setPage(1)
          }}
          options={[
            { value: 'pending', label: t('commerceAwaitingReview') },
            { value: 'approved', label: t('commerceApproved') },
            { value: 'rejected', label: t('commerceRejected') },
            { value: '', label: t('commerceAllRequests') },
          ]}
        />
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <Failure error={query.error} retry={() => void query.refetch()} />
      ) : (
        <Table<SubscriptionRequest>
          rowKey="id"
          dataSource={query.data.items}
          scroll={{ x: 830 }}
          pagination={{
            current: page,
            pageSize: 10,
            total: query.data.total,
            onChange: setPage,
            showSizeChanger: false,
            hideOnSinglePage: true,
          }}
          locale={{ emptyText: t('commerceNoRequestsStatus') }}
          columns={[
            {
              title: t('commerceClinic'),
              key: 'clinic',
              render: (_, item) => (
                <div className="commerce-person">
                  <strong>{item.clinic_name}</strong>
                  <span>{time(item.created_at)}</span>
                  {item.is_demo && <Tag>{t('commerceDemo')}</Tag>}
                </div>
              ),
            },
            {
              title: t('commercePlan'),
              key: 'plan',
              render: (_, item) => (
                <div className="commerce-person">
                  <strong>{localizedPlanName(item.plan_name, item.plan_id)}</strong>
                  <span>
                    {t('commerceDoctorsCount', { count: item.doctor_limit })} ·{' '}
                    {t('commerceOneMonth')}
                  </span>
                </div>
              ),
            },
            {
              title: t('commercePayment'),
              key: 'payment',
              render: (_, item) => (
                <div className="commerce-person">
                  <strong>{money(item.price_uzs)}</strong>
                  <span>{item.payment_method_name}</span>
                </div>
              ),
            },
            { title: t('commerceStatus'), dataIndex: 'status', render: statusTag },
            {
              title: '',
              key: 'action',
              render: (_, item) => (
                <Button
                  type={item.status === 'pending' ? 'primary' : 'default'}
                  onClick={() => setSelected(item)}
                  icon={<FileCheck2 size={15} />}
                >
                  {item.status === 'pending' ? t('commerceReview') : t('commerceView')}
                </Button>
              ),
            },
          ]}
        />
      )}
      {selected && (
        <RequestReview key={selected.id} request={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  )
}
