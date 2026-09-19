import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Form, Input, Modal, Space, Switch, Tag } from 'antd'
import { CreditCard, Plus, Settings2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { get, patch, post } from '../api/client'
import { localizedPaymentInstructions } from '../commerceTypes'
import LocalizedForm from '../LocalizedForm'
import { Failure, Loading, useAction } from '../ui'

import type { Page, PaymentMethod } from './types'

function PaymentEditor({
  method,
  onClose,
}: {
  method: PaymentMethod | 'new'
  onClose: () => void
}) {
  const { t } = useTranslation()
  const editing = method === 'new' ? null : method
  const { act, busy } = useAction()
  const save = async (values: PaymentMethod) => {
    const body = {
      name: values.name.trim(),
      recipient: values.recipient.trim(),
      card_number: values.card_number.replace(/\s/g, ''),
      instructions: values.instructions || '',
      active: values.active,
      is_demo: values.is_demo,
    }
    const saved = await act(() =>
      editing
        ? patch(`/developer/payment-methods/${editing.id}`, {
            ...body,
            expected_version: editing.version,
          })
        : post('/developer/payment-methods', body),
    )
    if (saved) onClose()
  }
  return (
    <Modal
      title={editing ? t('commerceEditPaymentDetails') : t('commerceAddPaymentMethod')}
      open
      onCancel={() => {
        if (!busy) onClose()
      }}
      footer={null}
      width={560}
    >
      <LocalizedForm
        disabled={busy}
        layout="vertical"
        initialValues={editing || { active: true, is_demo: false, instructions: '' }}
        onFinish={(values) => void save(values)}
      >
        <Form.Item
          name="name"
          label={t('commercePaymentMethod')}
          rules={[{ required: true, whitespace: true, min: 2, max: 80 }]}
        >
          <Input placeholder="Humo" />
        </Form.Item>
        <Form.Item
          name="card_number"
          label={t('commercePublicCardNumber')}
          rules={[
            {
              required: true,
              pattern: /^(?:\d\s*){16}$/,
              message: t('commerceCardNumberValidation'),
            },
          ]}
        >
          <Input inputMode="numeric" autoComplete="off" placeholder="9860 0000 0000 0000" />
        </Form.Item>
        <Form.Item
          name="recipient"
          label={t('commerceCardholder')}
          rules={[{ required: true, whitespace: true, min: 2, max: 160 }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="instructions"
          label={t('commercePaymentInstructions')}
          rules={[{ max: 1000 }]}
        >
          <Input.TextArea rows={3} />
        </Form.Item>
        <Space size={35}>
          <Form.Item name="active" label={t('commerceActive')} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="is_demo" label={t('commerceDemoDetails')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Space>
        <Alert
          className="commerce-notice"
          type="info"
          showIcon
          message={t('commercePublicPaymentDetailsHint')}
        />
        <Button type="primary" htmlType="submit" loading={busy}>
          {t('commerceSavePaymentDetails')}
        </Button>
      </LocalizedForm>
    </Modal>
  )
}

export function PaymentsPanel() {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['developer-payment-methods'],
    queryFn: ({ signal }) => get<Page<PaymentMethod>>('/developer/payment-methods', signal),
  })
  const [selected, setSelected] = useState<PaymentMethod | 'new' | null>(null)
  return (
    <>
      <div className="commerce-section-heading">
        <div>
          <h2>{t('commercePaymentDetails')}</h2>
          <p>{t('commercePaymentDetailsHint')}</p>
        </div>
        <Button type="primary" icon={<Plus size={15} />} onClick={() => setSelected('new')}>
          {t('commerceAddPaymentType')}
        </Button>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <Failure error={query.error} retry={() => void query.refetch()} />
      ) : (
        <div className="commerce-plan-cards">
          {query.data.items.map((method) => (
            <article className="commerce-plan-card" key={method.id}>
              <div className="commerce-card-title">
                <span>
                  <CreditCard size={18} />
                  {method.name}
                </span>
                <Tag color={method.active ? 'green' : 'default'}>
                  {method.active ? t('commerceActive') : t('commerceHidden')}
                </Tag>
              </div>
              <div className="commerce-payment-number">
                {method.card_number
                  .replace(/\s/g, '')
                  .replace(/(.{4})/g, '$1 ')
                  .trim()}
              </div>
              <h3>{method.recipient}</h3>
              <p>
                {localizedPaymentInstructions(method.instructions) ||
                  t('commerceNoPaymentInstructions')}
              </p>
              <div className="commerce-plan-footer">
                <span>
                  {method.is_demo ? t('commerceDemoDetails') : t('commerceLivePaymentDetails')}
                </span>
                <Button icon={<Settings2 size={14} />} onClick={() => setSelected(method)}>
                  {t('commerceEdit')}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      {selected && (
        <PaymentEditor
          key={selected === 'new' ? 'new' : selected.id}
          method={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
