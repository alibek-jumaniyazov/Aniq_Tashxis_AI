import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Form, Input, InputNumber, Modal, Switch, Tag } from 'antd'
import { Plus, Settings2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { get, patch, post } from '../api/client'
import { localizedPlan, formatMoney as money } from '../commerceTypes'
import LocalizedForm from '../LocalizedForm'
import { Failure, Loading, useAction } from '../ui'

import type { Page, Plan } from './types'

function PlanEditor({ plan, onClose }: { plan: Plan | 'new'; onClose: () => void }) {
  const { t } = useTranslation()
  const editing = plan === 'new' ? null : plan
  const [form] = Form.useForm<Plan>()
  const custom = Form.useWatch('is_custom', form)
  const { act, busy } = useAction()
  const save = async (values: Plan) => {
    const body = {
      ...(editing ? {} : { id: values.id }),
      name: values.name.trim(),
      description: values.description || '',
      active: values.active,
      is_custom: values.is_custom,
      sort_order: values.sort_order,
      price_uzs: values.is_custom ? null : values.price_uzs,
      doctor_limit: values.is_custom ? null : values.doctor_limit,
    }
    const saved = await act(() =>
      editing
        ? patch(`/developer/plans/${editing.id}`, { ...body, expected_version: editing.version })
        : post('/developer/plans', body),
    )
    if (saved) onClose()
  }
  return (
    <Modal
      title={editing ? t('commerceEditPlan') : t('commerceNewPlan')}
      open
      onCancel={() => {
        if (!busy) onClose()
      }}
      footer={null}
      width={600}
    >
      <LocalizedForm
        disabled={busy}
        form={form}
        initialValues={editing || { active: true, is_custom: false, sort_order: 10 }}
        layout="vertical"
        onFinish={(values) => void save(values)}
      >
        <div className="commerce-form-grid">
          {!editing && (
            <Form.Item
              name="id"
              label={t('commercePlanIdentifier')}
              rules={[
                {
                  required: true,
                  pattern: /^[a-z0-9_-]{2,40}$/,
                  message: t('commercePlanIdentifierValidation'),
                },
              ]}
            >
              <Input placeholder="clinic50" />
            </Form.Item>
          )}
          <Form.Item
            name="name"
            label={t('commercePlanName')}
            rules={[{ required: true, whitespace: true, min: 2, max: 100 }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            className="commerce-form-full"
            name="description"
            label={t('commerceShortDescription')}
            extra={t('commerceOriginalCatalogHint')}
            rules={[{ max: 1000 }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="is_custom" label={t('commerceCustomPlan')} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="active" label={t('commerceVisibleToCustomers')} valuePropName="checked">
            <Switch />
          </Form.Item>
          {!custom && (
            <>
              <Form.Item
                name="price_uzs"
                label={t('commerceMonthlyPrice')}
                rules={[{ required: true }]}
              >
                <InputNumber min={1} max={1000000000} precision={0} />
              </Form.Item>
              <Form.Item
                name="doctor_limit"
                label={t('commerceDoctorSeats')}
                rules={[{ required: true }]}
              >
                <InputNumber min={1} max={10000} precision={0} />
              </Form.Item>
            </>
          )}
          <Form.Item
            name="sort_order"
            label={t('commerceDisplayOrder')}
            rules={[{ required: true }]}
          >
            <InputNumber min={0} max={1000} precision={0} />
          </Form.Item>
        </div>
        <Alert
          className="commerce-notice"
          type="info"
          showIcon
          message={t('commercePlanChangesHint')}
        />
        <Button type="primary" htmlType="submit" loading={busy}>
          {t('commerceSavePlan')}
        </Button>
      </LocalizedForm>
    </Modal>
  )
}

export function PlansPanel() {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['developer-plans'],
    queryFn: ({ signal }) => get<Page<Plan>>('/developer/plans', signal),
  })
  const [selected, setSelected] = useState<Plan | 'new' | null>(null)
  return (
    <>
      <div className="commerce-section-heading">
        <div>
          <h2>{t('commercePlanCatalog')}</h2>
          <p>{t('commercePlanCatalogHint')}</p>
        </div>
        <Button type="primary" icon={<Plus size={15} />} onClick={() => setSelected('new')}>
          {t('commerceAddPlan')}
        </Button>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <Failure error={query.error} retry={() => void query.refetch()} />
      ) : (
        <div className="commerce-plan-cards">
          {query.data.items.map((plan) => (
            <article key={plan.id} className="commerce-plan-card">
              <div className="commerce-card-title">
                <span>
                  {plan.is_custom
                    ? t('commerceCustomUpper')
                    : t('commerceMonthlySubscriptionUpper')}
                </span>
                <Tag color={plan.active ? 'green' : 'default'}>
                  {plan.active ? t('commerceActive') : t('commerceHidden')}
                </Tag>
              </div>
              <h3>{localizedPlan(plan).name}</h3>
              <p>{localizedPlan(plan).description}</p>
              <div className="commerce-price">{money(plan.price_uzs)}</div>
              <div className="commerce-plan-footer">
                <span>
                  {plan.doctor_limit
                    ? t('commerceSeatCount', { count: plan.doctor_limit })
                    : t('commerceTelegramAgreement')}
                </span>
                <Button icon={<Settings2 size={14} />} onClick={() => setSelected(plan)}>
                  {t('commerceEdit')}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      {selected && (
        <PlanEditor
          key={selected === 'new' ? 'new' : selected.id}
          plan={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
