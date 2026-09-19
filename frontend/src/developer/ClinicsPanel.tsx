import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Drawer, Form, Input, Modal, Select, Table, Tag } from 'antd'
import { ArrowUpRight, Building2, Plus, Search } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { get, patch, post } from '../api/client'
import { localizedPlan, localizedPlanName, formatMoney as money } from '../commerceTypes'
import LocalizedForm from '../LocalizedForm'
import { Failure, Loading, time, useAction } from '../ui'

import type { Account, Clinic, Page, Plan, SubscriptionRequest } from './types'

import { statusTag } from './presentation'

import { UsersPanel } from './UsersPanel'
import { RequestReview } from './RequestsPanel'

function ClinicDrawer({
  id,
  currentUserId,
  onClose,
}: {
  id: string
  currentUserId: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['developer-clinic', id],
    queryFn: ({ signal }) => get<Account>(`/developer/clinics/${id}`, signal),
  })
  const [editing, setEditing] = useState(false)
  const [form] = Form.useForm<{ name: string; phone: string; status: string }>()
  const [request, setRequest] = useState<SubscriptionRequest | null>(null)
  const { act, busy } = useAction()
  const save = async (values: { name: string; phone: string; status: string }) => {
    if (!query.data) return
    const saved = await act(() =>
      patch(`/developer/clinics/${id}`, {
        ...values,
        phone: values.phone?.trim() || undefined,
        expected_version: query.data.clinic.version,
      }),
    )
    if (saved) setEditing(false)
  }
  return (
    <Drawer
      title={t('commerceManageClinic')}
      open
      onClose={() => {
        if (!busy) onClose()
      }}
      width={860}
      rootClassName="commerce-drawer"
    >
      <div className="commerce-admin">
        {query.isPending ? (
          <Loading />
        ) : query.isError ? (
          <Failure error={query.error} retry={() => void query.refetch()} />
        ) : (
          <>
            <div className="commerce-drawer-heading">
              <div>
                <h2>{query.data.clinic.name}</h2>
                <p>{query.data.clinic.phone || t('commerceNoPhone')}</p>
              </div>
              {statusTag(query.data.clinic.status)}
            </div>
            <section className="commerce-card">
              <div className="commerce-section-heading">
                <h2>{t('commerceClinicSubscription')}</h2>
                <Button
                  onClick={() => {
                    form.setFieldsValue({
                      name: query.data.clinic.name,
                      phone: query.data.clinic.phone,
                      status: query.data.clinic.status,
                    })
                    setEditing(true)
                  }}
                >
                  {t('commerceEditClinic')}
                </Button>
              </div>
              <dl className="commerce-details">
                <div>
                  <dt>{t('commerceCurrentPlan')}</dt>
                  <dd>
                    {localizedPlanName(
                      query.data.subscription.plan_name,
                      query.data.subscription.plan_id,
                      undefined,
                      query.data.subscription.internal_demo,
                    ) || t('commercePlanUnset')}
                  </dd>
                </div>
                <div>
                  <dt>{t('commerceSubscriptionStatus')}</dt>
                  <dd>{statusTag(query.data.subscription.status)}</dd>
                </div>
                <div>
                  <dt>{t('commerceExpiryDate')}</dt>
                  <dd>{time(query.data.subscription.expires_at)}</dd>
                </div>
                <div>
                  <dt>{t('commerceActiveDoctorsLimit')}</dt>
                  <dd>
                    {query.data.usage.doctors} / {query.data.subscription.doctor_limit ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt>{t('commerceTeamMembers')}</dt>
                  <dd>{query.data.usage.team_members}</dd>
                </div>
              </dl>
              {query.data.subscription.internal_demo && <Tag>{t('commerceInternalDemo')}</Tag>}
              <p className="commerce-fineprint">{t('commerceSubscriptionUpdateHint')}</p>
            </section>
            <UsersPanel
              clinicId={id}
              currentUserId={currentUserId}
              canAdd={query.data.subscription.active}
            />
            <section className="commerce-card">
              <div className="commerce-section-heading">
                <h2>{t('commercePaymentHistory')}</h2>
              </div>
              <Table<SubscriptionRequest>
                rowKey="id"
                dataSource={query.data.requests}
                pagination={{ pageSize: 5, hideOnSinglePage: true }}
                scroll={{ x: 500 }}
                columns={[
                  {
                    title: t('commercePlan'),
                    key: 'plan',
                    render: (_, item) => (
                      <div className="commerce-person">
                        <strong>{localizedPlanName(item.plan_name, item.plan_id)}</strong>
                        <span>
                          {money(item.price_uzs)} · {time(item.created_at)}
                        </span>
                      </div>
                    ),
                  },
                  { title: t('commerceStatus'), dataIndex: 'status', render: statusTag },
                  {
                    title: '',
                    key: 'view',
                    render: (_, item) => (
                      <Button onClick={() => setRequest(item)}>{t('commerceViewReceipt')}</Button>
                    ),
                  },
                ]}
              />
            </section>
          </>
        )}
        <Modal
          title={t('commerceClinicSettings')}
          open={editing}
          onCancel={() => {
            if (!busy) setEditing(false)
          }}
          footer={null}
        >
          <LocalizedForm
            disabled={busy}
            form={form}
            layout="vertical"
            onFinish={(values) => void save(values)}
          >
            <Form.Item
              name="name"
              label={t('commerceClinicName')}
              rules={[{ required: true, whitespace: true, min: 2, max: 160 }]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="phone" label={t('commercePhone')} rules={[{ max: 40 }]}>
              <Input />
            </Form.Item>
            <Form.Item
              name="status"
              label={t('commerceClinicStatus')}
              rules={[{ required: true }]}
              extra={t('commerceSuspendedStaffHint')}
            >
              <Select
                options={[
                  { value: 'active', label: t('commerceActive') },
                  { value: 'suspended', label: t('commerceTemporarilySuspended') },
                ]}
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={busy}>
              {t('commerceSave')}
            </Button>
          </LocalizedForm>
        </Modal>
        {request && (
          <RequestReview key={request.id} request={request} onClose={() => setRequest(null)} />
        )}
      </div>
    </Drawer>
  )
}

function ClinicCreate({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const plans = useQuery({
    queryKey: ['developer-plans'],
    queryFn: ({ signal }) => get<Page<Plan>>('/developer/plans', signal),
  })
  const { act, busy } = useAction()
  const save = async (values: {
    name: string
    phone: string
    owner_name: string
    owner_email: string
    owner_password: string
    plan_id: string
  }) => {
    const saved = await act(() => post('/developer/clinics', values))
    if (saved) onClose()
  }
  return (
    <Modal
      title={t('commerceNewClinicAccount')}
      open
      onCancel={() => {
        if (!busy) onClose()
      }}
      footer={null}
      width={600}
    >
      <Alert type="info" showIcon message={t('commerceClinicCreationHint')} />
      {plans.isError ? (
        <Failure error={plans.error} retry={() => void plans.refetch()} />
      ) : (
        <LocalizedForm
          disabled={busy}
          layout="vertical"
          className="margin-top"
          onFinish={(values) => void save(values)}
        >
          <div className="commerce-form-grid">
            <Form.Item
              name="name"
              label={t('commerceClinicName')}
              rules={[{ required: true, whitespace: true, min: 2, max: 160 }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="phone"
              label={t('commercePhone')}
              rules={[{ required: true, min: 7, max: 40 }]}
            >
              <Input placeholder="+998" />
            </Form.Item>
            <Form.Item
              name="owner_name"
              label={t('commerceClinicOwner')}
              rules={[{ required: true, whitespace: true, min: 2, max: 120 }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="owner_email"
              label={t('commerceOwnerLoginEmail')}
              rules={[{ required: true, type: 'email' }]}
            >
              <Input type="email" autoComplete="off" />
            </Form.Item>
            <Form.Item
              className="commerce-form-full"
              name="owner_password"
              label={t('commerceInitialPassword')}
              rules={[{ required: true, min: 12, max: 128 }]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
            <Form.Item
              className="commerce-form-full"
              name="plan_id"
              label={t('commerceIntendedPlan')}
              rules={[{ required: true }]}
            >
              <Select
                loading={plans.isPending}
                options={plans.data?.items
                  .filter((plan) => plan.active && !plan.is_custom)
                  .map((plan) => ({
                    value: plan.id,
                    label: `${localizedPlan(plan).name} · ${money(plan.price_uzs)}`,
                  }))}
              />
            </Form.Item>
          </div>
          <Button type="primary" htmlType="submit" loading={busy}>
            {t('commerceCreateClinic')}
          </Button>
        </LocalizedForm>
      )}
    </Modal>
  )
}

export function ClinicsPanel({ currentUserId }: { currentUserId: string }) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const q = useDeferredValue(search)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const [create, setCreate] = useState(false)
  const query = useQuery({
    queryKey: ['developer-clinics', q, page],
    queryFn: ({ signal }) =>
      get<Page<Clinic>>(
        `/developer/clinics?page=${page}&page_size=10&q=${encodeURIComponent(q)}`,
        signal,
      ),
  })
  return (
    <section className="commerce-card">
      <div className="commerce-section-heading">
        <div>
          <h2>{t('commerceClinics')}</h2>
          <p>{t('commerceClinicsOverviewHint')}</p>
        </div>
        <Button type="primary" icon={<Plus size={15} />} onClick={() => setCreate(true)}>
          {t('commerceAddClinic')}
        </Button>
      </div>
      <div className="commerce-toolbar">
        <Input
          value={search}
          allowClear
          prefix={<Search size={15} />}
          placeholder={t('commerceClinicSearchPlaceholder')}
          aria-label={t('commerceSearchClinics')}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
        />
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <Failure error={query.error} retry={() => void query.refetch()} />
      ) : (
        <Table<Clinic>
          rowKey="id"
          dataSource={query.data.items}
          scroll={{ x: 850 }}
          pagination={{
            current: page,
            pageSize: 10,
            total: query.data.total,
            onChange: setPage,
            showSizeChanger: false,
            hideOnSinglePage: true,
          }}
          columns={[
            {
              title: t('commerceClinic'),
              key: 'name',
              render: (_, item) => (
                <div className="commerce-identity">
                  <span>
                    <Building2 size={18} />
                  </span>
                  <div className="commerce-person">
                    <strong>{item.name}</strong>
                    <span>{item.phone || t('commerceNoPhone')}</span>
                  </div>
                </div>
              ),
            },
            {
              title: t('commerceSubscription'),
              key: 'subscription',
              render: (_, item) => (
                <div className="commerce-person">
                  <strong>
                    {localizedPlanName(
                      item.subscription.plan_name,
                      item.subscription.plan_id,
                      undefined,
                      item.subscription.internal_demo,
                    ) || t('commerceNoPlan')}
                  </strong>
                  <span>{time(item.subscription.expires_at)}</span>
                  {statusTag(item.subscription.status)}
                </div>
              ),
            },
            {
              title: t('commerceDoctors'),
              key: 'usage',
              render: (_, item) =>
                `${item.usage.doctors} / ${item.subscription.doctor_limit ?? '—'}`,
            },
            { title: t('commerceAccount'), dataIndex: 'status', render: statusTag },
            {
              title: '',
              key: 'action',
              render: (_, item) => (
                <Button onClick={() => setSelected(item.id)} icon={<ArrowUpRight size={15} />}>
                  {t('commerceManage')}
                </Button>
              ),
            },
          ]}
        />
      )}
      {selected && (
        <ClinicDrawer
          key={selected}
          id={selected}
          currentUserId={currentUserId}
          onClose={() => setSelected(null)}
        />
      )}
      {create && <ClinicCreate onClose={() => setCreate(false)} />}
    </section>
  )
}
