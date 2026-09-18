import LocalizedForm from './LocalizedForm'
import { useTranslation } from 'react-i18next'
import { t } from 'i18next'
import StableTabs from './StableTabs'
import { useDeferredValue, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Drawer, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tag } from 'antd'
import { ArrowUpRight, Building2, Check, CreditCard, FileCheck2, Plus, Search, Settings2, ShieldCheck, Users, X } from 'lucide-react'
import { get, patch, post } from './api/client'
import { Failure, Loading, time, useAction } from './ui'
import type { User } from './types'
import WorkflowGuide from './WorkflowGuide'
import { formatMoney as money, localizedPlan, localizedPlanName, localizedPaymentInstructions } from './commerceTypes'
import './commerceAdmin.css'
import './commerceLocale.css'

interface Page<T> { items: T[]; total: number; page?: number; page_size?: number }
interface Subscription { status: string; active: boolean; plan_id: string | null; plan_name: string | null; doctor_limit: number | null; price_uzs: number | null; starts_at: string | null; expires_at: string | null; internal_demo?: boolean }
interface Clinic { id: string; name: string; phone: string; status: string; version: number; owner_id: string | null; subscription: Subscription; usage: { doctors: number; team_members: number } }
interface Member { id: string; tenant_id: string; clinic_name?: string; name: string; email: string; role: string; active: boolean; version: number; is_clinic_owner: boolean }
interface Request { id: string; tenant_id: string; clinic_name: string; plan_id: string; plan_name: string; price_uzs: number; doctor_limit: number; payment_method_name: string; payment_recipient?: string; payment_card_last4?: string; payment_reference?: string; status: string; receipt_name: string; receipt_url: string; created_at: string; reviewed_at: string | null; review_note: string | null; version: number; is_demo: boolean }
interface Account { clinic: Omit<Clinic, 'subscription' | 'usage'>; subscription: Subscription; usage: Clinic['usage']; requests: Request[] }
interface Plan { id: string; name: string; description: string; price_uzs: number | null; doctor_limit: number | null; period_months: number; active: boolean; sort_order: number; version: number; is_custom: boolean }
interface PaymentMethod { id: string; name: string; card_number: string; recipient: string; instructions: string; active: boolean; is_demo: boolean; version: number }
interface Overview { clinics_total: number; active_subscriptions: number; pending_requests: number; doctors_total: number; approved_revenue_uzs: number; expiring_soon: number }
interface MemberValues { name: string; email?: string; password?: string; role: string; active?: boolean }

const roles = () => [{ value: 'doctor', label: t('commerceDoctor') }, { value: 'radiologist', label: t('commerceRadiologist') }, { value: 'expert', label: t('commerceClinicalExpert') }, { value: 'quality', label: t('commerceQualityControl') }, { value: 'sender', label: t('commerceReportSender') }, { value: 'admin', label: t('commerceAdministrator') }, { value: 'analyst', label: t('commerceAnalyst') }]
const labels = (): Record<string, string> => ({ active: t('commerceActive'), pending: t('commerceUnderReview'), approved: t('commerceApproved'), rejected: t('commerceRejected'), expired: t('commerceExpired'), suspended: t('commerceSuspended'), inactive: t('commerceInactive'), none: t('commerceNoSubscription'), trial: t('commerceTrial'), pending_payment: t('commerceAwaitingPayment') })
const statusTag = (value: string) => <Tag color={['approved', 'active'].includes(value) ? 'green' : ['rejected', 'suspended'].includes(value) ? 'red' : value === 'pending' ? 'gold' : 'default'}>{labels()[value] || value}</Tag>
const roleName = (value: string) => roles().find(role => role.value === value)?.label || ({ owner: t('commerceClinicOwner'), developer: t('commercePlatformManager') } as Record<string, string>)[value] || value

class ReceiptError extends Error {
  constructor(readonly key: string, readonly status?: number) { super(key) }
}

function ReceiptPreview({ request }: { request: Request }) {
  const { t } = useTranslation()
  const [objectUrl, setObjectUrl] = useState('')
  const receipt = useQuery({ queryKey: ['developer-receipt', request.id], queryFn: async ({ signal }) => {
    const url = new URL(request.receipt_url, window.location.origin)
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/v1/')) throw new ReceiptError('commerceReceiptUrlInvalid')
    const response = await fetch(url, { signal, credentials: 'same-origin' })
    if (!response.ok) throw new ReceiptError('commerceReceiptLoadError', response.status)
    const blob = await response.blob()
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(blob.type.split(';')[0])) throw new ReceiptError('commerceReceiptTypeInvalid')
    return blob
  }, staleTime: 60000 })
  useEffect(() => {
    if (!receipt.data) return
    const url = URL.createObjectURL(receipt.data)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [receipt.data])
  if (receipt.isPending) return <Loading/>
  if (receipt.isError) return <Failure error={receipt.error instanceof ReceiptError ? new Error(t(receipt.error.key, { status: receipt.error.status })) : receipt.error} retry={() => void receipt.refetch()}/>
  return <div className="commerce-receipt"><div className="commerce-receipt-head"><span>{request.receipt_name}</span>{objectUrl && <a href={objectUrl} download={request.receipt_name}>{t('commerceDownloadReceipt')}</a>}</div>{objectUrl && (receipt.data.type.startsWith('image/') ? <img src={objectUrl} alt={t('commerceReceiptImageAlt', { clinic: request.clinic_name })}/> : <iframe src={objectUrl} title={t('commerceReceiptPdfTitle')} sandbox="allow-same-origin"/>)}</div>
}

function RequestReview({ request, onClose }: { request: Request; onClose: () => void }) {
  const { t } = useTranslation()
  const [form] = Form.useForm<{ note: string }>()
  const { act, busy } = useAction()
  const review = async (decision: 'approved' | 'rejected') => {
    const note = (form.getFieldValue('note') || '').trim()
    if (note.length < 5) { form.setFields([{ name: 'note', errors: [decision === 'rejected' ? t('commerceRejectionReasonLength') : t('commerceReviewNoteLength')] }]); return }
    const saved = await act(() => post(`/developer/subscription-requests/${request.id}/review`, { expected_version: request.version, decision, note }))
    if (saved) onClose()
  }
  return <Modal title={t('commerceReviewPaymentRequest')} open onCancel={() => { if (!busy) onClose() }} footer={null} width={760} maskClosable={!busy}>
    <div className="commerce-admin">
      <div className="commerce-review-summary"><div><span>{t('commerceClinic')}</span><strong>{request.clinic_name}</strong></div><div><span>{t('commercePlanDoctors')}</span><strong>{localizedPlanName(request.plan_name, request.plan_id)} · {t('commerceDoctorsCount', { count: request.doctor_limit })}</strong></div><div><span>{t('commerceAmountToVerify')}</span><strong>{money(request.price_uzs)}</strong></div><div><span>{t('commercePaymentMethod')}</span><strong>{request.payment_method_name}</strong></div><div><span>{t('commerceSubmitted')}</span><strong>{time(request.created_at)}</strong></div><div><span>{t('commerceStatus')}</span><strong>{statusTag(request.status)}{request.is_demo && <Tag>{t('commerceDemoReceipt')}</Tag>}</strong></div></div>
      <ReceiptPreview request={request}/>
      <div className="commerce-review-summary"><div><span>{t('commerceRequestRecipient')}</span><strong>{request.payment_recipient || '—'} {request.payment_card_last4 ? `· •••• ${request.payment_card_last4}` : ''}</strong></div><div><span>{t('commercePaymentReference')}</span><strong>{request.payment_reference || t('commerceNotProvided')}</strong></div></div>
      {request.status === 'pending' ? <><Alert type="info" showIcon message={t('commerceVerifyFunds')} description={t('commerceVerifyFundsHint')}/><LocalizedForm disabled={busy} form={form} layout="vertical" className="margin-top"><Form.Item name="note" label={t('commerceReviewNote')} rules={[{ max: 1000, message: t('commerceReviewNoteMax') }]}><Input.TextArea rows={3} maxLength={1000} placeholder={t('commerceReviewNotePlaceholder')}/></Form.Item></LocalizedForm><div className="commerce-review-actions"><Button danger icon={<X size={15}/>} loading={busy} onClick={() => void review('rejected')}>{t('commerceRejectWithReason')}</Button><Button type="primary" icon={<Check size={15}/>} loading={busy} onClick={() => void review('approved')}>{t('commerceApproveActivate')}</Button></div></> : <Alert type={request.status === 'approved' ? 'success' : 'warning'} showIcon message={`${labels()[request.status] || request.status} · ${time(request.reviewed_at)}`} description={request.review_note || t('commerceNoReviewNote')}/>}
    </div>
  </Modal>
}

function RequestsPanel() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const q = useDeferredValue(search)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('pending')
  const [selected, setSelected] = useState<Request | null>(null)
  const query = useQuery({ queryKey: ['developer-requests', q, page, status], queryFn: ({ signal }) => get<Page<Request>>(`/developer/subscription-requests?page=${page}&page_size=10&q=${encodeURIComponent(q)}${status ? `&status=${status}` : ''}`, signal), refetchInterval: status === 'pending' ? 10000 : false })
  return <section className="commerce-card"><div className="commerce-section-heading"><div><h2>{t('commerceReviewPayments')}</h2><p>{t('commerceReviewWorkflow')}</p></div></div><div className="commerce-toolbar"><Input allowClear value={search} prefix={<Search size={15}/>} placeholder={t('commerceSearchClinicPlan')} aria-label={t('commerceSearchRequests')} onChange={event => { setSearch(event.target.value); setPage(1) }}/><Select aria-label={t('commerceRequestStatus')} value={status} onChange={value => { setStatus(value); setPage(1) }} options={[{ value: 'pending', label: t('commerceAwaitingReview') }, { value: 'approved', label: t('commerceApproved') }, { value: 'rejected', label: t('commerceRejected') }, { value: '', label: t('commerceAllRequests') }]}/></div>
    {query.isPending ? <Loading/> : query.isError ? <Failure error={query.error} retry={() => void query.refetch()}/> : <Table<Request> rowKey="id" dataSource={query.data.items} scroll={{ x: 830 }} pagination={{ current: page, pageSize: 10, total: query.data.total, onChange: setPage, showSizeChanger: false, hideOnSinglePage: true }} locale={{ emptyText: t('commerceNoRequestsStatus') }} columns={[
      { title: t('commerceClinic'), key: 'clinic', render: (_, item) => <div className="commerce-person"><strong>{item.clinic_name}</strong><span>{time(item.created_at)}</span>{item.is_demo && <Tag>{t('commerceDemo')}</Tag>}</div> },
      { title: t('commercePlan'), key: 'plan', render: (_, item) => <div className="commerce-person"><strong>{localizedPlanName(item.plan_name, item.plan_id)}</strong><span>{t('commerceDoctorsCount', { count: item.doctor_limit })} · {t('commerceOneMonth')}</span></div> },
      { title: t('commercePayment'), key: 'payment', render: (_, item) => <div className="commerce-person"><strong>{money(item.price_uzs)}</strong><span>{item.payment_method_name}</span></div> },
      { title: t('commerceStatus'), dataIndex: 'status', render: statusTag }, { title: '', key: 'action', render: (_, item) => <Button type={item.status === 'pending' ? 'primary' : 'default'} onClick={() => setSelected(item)} icon={<FileCheck2 size={15}/>}>{item.status === 'pending' ? t('commerceReview') : t('commerceView')}</Button> },
    ]}/>}{selected && <RequestReview key={selected.id} request={selected} onClose={() => setSelected(null)}/>}
  </section>
}

function MemberEditor({ member, clinicId, onClose }: { member: Member | 'new'; clinicId?: string; onClose: () => void }) {
  const { t } = useTranslation()
  const editing = member === 'new' ? null : member
  const [form] = Form.useForm<MemberValues>()
  const { act, busy } = useAction()
  const save = async (values: MemberValues) => {
    if (!editing && !clinicId) return
    const body = { name: values.name.trim(), role: values.role, password: values.password || undefined, ...(editing ? { active: values.active } : { email: values.email?.trim() }) }
    const saved = await act(() => editing ? patch(`/developer/users/${editing.id}`, { ...body, expected_version: editing.version }) : post(`/developer/clinics/${clinicId}/users`, body))
    if (saved) onClose()
  }
  return <Modal title={editing ? t('commerceManageMember') : t('commerceAddClinicMember')} open onCancel={() => { if (!busy) onClose() }} footer={null} maskClosable={!busy}>
    <LocalizedForm disabled={busy} form={form} initialValues={editing ? { name: editing.name, role: editing.role, active: editing.active } : { role: 'doctor', active: true }} layout="vertical" onFinish={values => void save(values)}>
      <Form.Item name="name" label={t('commerceFullName')} rules={[{ required: true, whitespace: true, min: 2, max: 120, message: t('commerceNameLength') }]}><Input/></Form.Item>
      {!editing && <Form.Item name="email" label={t('commerceLoginEmailShort')} rules={[{ required: true, type: 'email', message: t('commerceValidEmail') }]}><Input type="email" autoComplete="off"/></Form.Item>}
      {editing && <p className="commerce-fineprint">{editing.email} · {editing.clinic_name}</p>}
      <Form.Item name="role" label={t('commerceWorkingRole')} rules={[{ required: true }]}><Select options={roles()}/></Form.Item>
      <Form.Item name="password" label={editing ? t('commerceNewPasswordOptional') : t('commerceInitialPassword')} extra={t('commercePasswordNotShown')} rules={[{ required: !editing, min: 12, max: 128, message: t('commercePasswordLength') }]}><Input.Password autoComplete="new-password"/></Form.Item>
      {editing && <Form.Item name="active" label={t('commerceAccountActive')} valuePropName="checked"><Switch/></Form.Item>}
      <Space><Button type="primary" htmlType="submit" loading={busy}>{t('commerceSave')}</Button><Button onClick={onClose} disabled={busy}>{t('commerceCancel')}</Button></Space>
    </LocalizedForm>
  </Modal>
}

function UsersPanel({ clinicId, currentUserId, canAdd = true }: { clinicId?: string; currentUserId: string; canAdd?: boolean }) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const q = useDeferredValue(search)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Member | 'new' | null>(null)
  const query = useQuery({ queryKey: ['developer-users', clinicId, q, page], queryFn: ({ signal }) => get<Page<Member>>(`/developer/users?page=${page}&page_size=10&q=${encodeURIComponent(q)}${clinicId ? `&tenant_id=${encodeURIComponent(clinicId)}` : ''}`, signal) })
  return <section className="commerce-card"><div className="commerce-section-heading"><div><h2>{clinicId ? t('commerceClinicTeam') : t('commerceAllUsers')}</h2><p>{t('commerceUserManagementHint')}</p></div>{clinicId && <Button type="primary" icon={<Plus size={15}/>} disabled={!canAdd} aria-describedby={!canAdd ? `developer-team-hint-${clinicId}` : undefined} onClick={() => setSelected('new')}>{t('commerceAddMember')}</Button>}</div>{clinicId && !canAdd && <p id={`developer-team-hint-${clinicId}`} className="commerce-fineprint">{t('commerceActivateBeforeAdd')}</p>}<div className="commerce-toolbar"><Input allowClear value={search} prefix={<Search size={15}/>} placeholder={t('commerceSearchNameEmail')} aria-label={t('commerceSearchStaff')} onChange={event => { setSearch(event.target.value); setPage(1) }}/></div>
    {query.isPending ? <Loading/> : query.isError ? <Failure error={query.error} retry={() => void query.refetch()}/> : <Table<Member> rowKey="id" dataSource={query.data.items} scroll={{ x: clinicId ? 650 : 830 }} pagination={{ current: page, pageSize: 10, total: query.data.total, onChange: setPage, showSizeChanger: false, hideOnSinglePage: true }} columns={[
      { title: t('commerceMember'), key: 'name', render: (_, item) => <div className="commerce-person"><strong>{item.name}</strong><span>{item.email}</span>{!clinicId && <small>{item.clinic_name}</small>}</div> },
      { title: t('commerceRole'), key: 'role', render: (_, item) => <>{roleName(item.role)}{item.is_clinic_owner && <Tag>{t('commerceClinicOwner')}</Tag>}</> },
      { title: t('commerceStatus'), key: 'active', render: (_, item) => <Tag color={item.active ? 'green' : 'default'}>{item.active ? t('commerceActive') : t('commerceInactive')}</Tag> },
      { title: '', key: 'edit', render: (_, item) => item.is_clinic_owner || item.role === 'developer' || item.id === currentUserId ? <span className="commerce-fineprint" title={t('commerceAdminProtectedHint')}>{t('commerceProtectedAccount')}</span> : <Button icon={<Settings2 size={14}/>} onClick={() => setSelected(item)}>{t('commerceManage')}</Button> },
    ]}/>}{selected && <MemberEditor key={selected === 'new' ? 'new' : selected.id} member={selected} clinicId={clinicId} onClose={() => setSelected(null)}/>}
  </section>
}

function ClinicDrawer({ id, currentUserId, onClose }: { id: string; currentUserId: string; onClose: () => void }) {
  const { t } = useTranslation()
  const query = useQuery({ queryKey: ['developer-clinic', id], queryFn: ({ signal }) => get<Account>(`/developer/clinics/${id}`, signal) })
  const [editing, setEditing] = useState(false)
  const [form] = Form.useForm<{ name: string; phone: string; status: string }>()
  const [request, setRequest] = useState<Request | null>(null)
  const { act, busy } = useAction()
  const save = async (values: { name: string; phone: string; status: string }) => {
    if (!query.data) return
    const saved = await act(() => patch(`/developer/clinics/${id}`, { ...values, phone: values.phone?.trim() || undefined, expected_version: query.data.clinic.version }))
    if (saved) setEditing(false)
  }
  return <Drawer title={t('commerceManageClinic')} open onClose={() => { if (!busy) onClose() }} width={860} rootClassName="commerce-drawer"><div className="commerce-admin">
    {query.isPending ? <Loading/> : query.isError ? <Failure error={query.error} retry={() => void query.refetch()}/> : <>
      <div className="commerce-drawer-heading"><div><h2>{query.data.clinic.name}</h2><p>{query.data.clinic.phone || t('commerceNoPhone')}</p></div>{statusTag(query.data.clinic.status)}</div>
      <section className="commerce-card"><div className="commerce-section-heading"><h2>{t('commerceClinicSubscription')}</h2><Button onClick={() => { form.setFieldsValue({ name: query.data.clinic.name, phone: query.data.clinic.phone, status: query.data.clinic.status }); setEditing(true) }}>{t('commerceEditClinic')}</Button></div>
        <dl className="commerce-details"><div><dt>{t('commerceCurrentPlan')}</dt><dd>{localizedPlanName(query.data.subscription.plan_name, query.data.subscription.plan_id, undefined, query.data.subscription.internal_demo) || t('commercePlanUnset')}</dd></div><div><dt>{t('commerceSubscriptionStatus')}</dt><dd>{statusTag(query.data.subscription.status)}</dd></div><div><dt>{t('commerceExpiryDate')}</dt><dd>{time(query.data.subscription.expires_at)}</dd></div><div><dt>{t('commerceActiveDoctorsLimit')}</dt><dd>{query.data.usage.doctors} / {query.data.subscription.doctor_limit ?? '—'}</dd></div><div><dt>{t('commerceTeamMembers')}</dt><dd>{query.data.usage.team_members}</dd></div></dl>
        {query.data.subscription.internal_demo && <Tag>{t('commerceInternalDemo')}</Tag>}<p className="commerce-fineprint">{t('commerceSubscriptionUpdateHint')}</p>
      </section>
      <UsersPanel clinicId={id} currentUserId={currentUserId} canAdd={query.data.subscription.active}/>
      <section className="commerce-card"><div className="commerce-section-heading"><h2>{t('commercePaymentHistory')}</h2></div><Table<Request> rowKey="id" dataSource={query.data.requests} pagination={{ pageSize: 5, hideOnSinglePage: true }} scroll={{ x: 500 }} columns={[
        { title: t('commercePlan'), key: 'plan', render: (_, item) => <div className="commerce-person"><strong>{localizedPlanName(item.plan_name, item.plan_id)}</strong><span>{money(item.price_uzs)} · {time(item.created_at)}</span></div> }, { title: t('commerceStatus'), dataIndex: 'status', render: statusTag }, { title: '', key: 'view', render: (_, item) => <Button onClick={() => setRequest(item)}>{t('commerceViewReceipt')}</Button> },
      ]}/></section>
    </>}
    <Modal title={t('commerceClinicSettings')} open={editing} onCancel={() => { if (!busy) setEditing(false) }} footer={null}><LocalizedForm disabled={busy} form={form} layout="vertical" onFinish={values => void save(values)}><Form.Item name="name" label={t('commerceClinicName')} rules={[{ required: true, whitespace: true, min: 2, max: 160 }]}><Input/></Form.Item><Form.Item name="phone" label={t('commercePhone')} rules={[{ max: 40 }]}><Input/></Form.Item><Form.Item name="status" label={t('commerceClinicStatus')} rules={[{ required: true }]} extra={t('commerceSuspendedStaffHint')}><Select options={[{ value: 'active', label: t('commerceActive') }, { value: 'suspended', label: t('commerceTemporarilySuspended') }]}/></Form.Item><Button type="primary" htmlType="submit" loading={busy}>{t('commerceSave')}</Button></LocalizedForm></Modal>
    {request && <RequestReview key={request.id} request={request} onClose={() => setRequest(null)}/>}
  </div></Drawer>
}

function ClinicCreate({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const plans = useQuery({ queryKey: ['developer-plans'], queryFn: ({ signal }) => get<Page<Plan>>('/developer/plans', signal) })
  const { act, busy } = useAction()
  const save = async (values: { name: string; phone: string; owner_name: string; owner_email: string; owner_password: string; plan_id: string }) => {
    const saved = await act(() => post('/developer/clinics', values))
    if (saved) onClose()
  }
  return <Modal title={t('commerceNewClinicAccount')} open onCancel={() => { if (!busy) onClose() }} footer={null} width={600}>
    <Alert type="info" showIcon message={t('commerceClinicCreationHint')}/>
    {plans.isError ? <Failure error={plans.error} retry={() => void plans.refetch()}/> : <LocalizedForm disabled={busy} layout="vertical" className="margin-top" onFinish={values => void save(values)}><div className="commerce-form-grid"><Form.Item name="name" label={t('commerceClinicName')} rules={[{ required: true, whitespace: true, min: 2, max: 160 }]}><Input/></Form.Item><Form.Item name="phone" label={t('commercePhone')} rules={[{ required: true, min: 7, max: 40 }]}><Input placeholder="+998"/></Form.Item><Form.Item name="owner_name" label={t('commerceClinicOwner')} rules={[{ required: true, whitespace: true, min: 2, max: 120 }]}><Input/></Form.Item><Form.Item name="owner_email" label={t('commerceOwnerLoginEmail')} rules={[{ required: true, type: 'email' }]}><Input type="email" autoComplete="off"/></Form.Item><Form.Item className="commerce-form-full" name="owner_password" label={t('commerceInitialPassword')} rules={[{ required: true, min: 12, max: 128 }]}><Input.Password autoComplete="new-password"/></Form.Item><Form.Item className="commerce-form-full" name="plan_id" label={t('commerceIntendedPlan')} rules={[{ required: true }]}><Select loading={plans.isPending} options={plans.data?.items.filter(plan => plan.active && !plan.is_custom).map(plan => ({ value: plan.id, label: `${localizedPlan(plan).name} · ${money(plan.price_uzs)}` }))}/></Form.Item></div><Button type="primary" htmlType="submit" loading={busy}>{t('commerceCreateClinic')}</Button></LocalizedForm>}
  </Modal>
}

function ClinicsPanel({ currentUserId }: { currentUserId: string }) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const q = useDeferredValue(search)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const [create, setCreate] = useState(false)
  const query = useQuery({ queryKey: ['developer-clinics', q, page], queryFn: ({ signal }) => get<Page<Clinic>>(`/developer/clinics?page=${page}&page_size=10&q=${encodeURIComponent(q)}`, signal) })
  return <section className="commerce-card"><div className="commerce-section-heading"><div><h2>{t('commerceClinics')}</h2><p>{t('commerceClinicsOverviewHint')}</p></div><Button type="primary" icon={<Plus size={15}/>} onClick={() => setCreate(true)}>{t('commerceAddClinic')}</Button></div><div className="commerce-toolbar"><Input value={search} allowClear prefix={<Search size={15}/>} placeholder={t('commerceClinicSearchPlaceholder')} aria-label={t('commerceSearchClinics')} onChange={event => { setSearch(event.target.value); setPage(1) }}/></div>
    {query.isPending ? <Loading/> : query.isError ? <Failure error={query.error} retry={() => void query.refetch()}/> : <Table<Clinic> rowKey="id" dataSource={query.data.items} scroll={{ x: 850 }} pagination={{ current: page, pageSize: 10, total: query.data.total, onChange: setPage, showSizeChanger: false, hideOnSinglePage: true }} columns={[
      { title: t('commerceClinic'), key: 'name', render: (_, item) => <div className="commerce-identity"><span><Building2 size={18}/></span><div className="commerce-person"><strong>{item.name}</strong><span>{item.phone || t('commerceNoPhone')}</span></div></div> },
      { title: t('commerceSubscription'), key: 'subscription', render: (_, item) => <div className="commerce-person"><strong>{localizedPlanName(item.subscription.plan_name, item.subscription.plan_id, undefined, item.subscription.internal_demo) || t('commerceNoPlan')}</strong><span>{time(item.subscription.expires_at)}</span>{statusTag(item.subscription.status)}</div> },
      { title: t('commerceDoctors'), key: 'usage', render: (_, item) => `${item.usage.doctors} / ${item.subscription.doctor_limit ?? '—'}` },
      { title: t('commerceAccount'), dataIndex: 'status', render: statusTag }, { title: '', key: 'action', render: (_, item) => <Button onClick={() => setSelected(item.id)} icon={<ArrowUpRight size={15}/>}>{t('commerceManage')}</Button> },
    ]}/>}{selected && <ClinicDrawer key={selected} id={selected} currentUserId={currentUserId} onClose={() => setSelected(null)}/>}{create && <ClinicCreate onClose={() => setCreate(false)}/>}
  </section>
}

function PlanEditor({ plan, onClose }: { plan: Plan | 'new'; onClose: () => void }) {
  const { t } = useTranslation()
  const editing = plan === 'new' ? null : plan
  const [form] = Form.useForm<Plan>()
  const custom = Form.useWatch('is_custom', form)
  const { act, busy } = useAction()
  const save = async (values: Plan) => {
    const body = { ...(editing ? {} : { id: values.id }), name: values.name.trim(), description: values.description || '', active: values.active, is_custom: values.is_custom, sort_order: values.sort_order, price_uzs: values.is_custom ? null : values.price_uzs, doctor_limit: values.is_custom ? null : values.doctor_limit }
    const saved = await act(() => editing ? patch(`/developer/plans/${editing.id}`, { ...body, expected_version: editing.version }) : post('/developer/plans', body))
    if (saved) onClose()
  }
  return <Modal title={editing ? t('commerceEditPlan') : t('commerceNewPlan')} open onCancel={() => { if (!busy) onClose() }} footer={null} width={600}>
    <LocalizedForm disabled={busy} form={form} initialValues={editing || { active: true, is_custom: false, sort_order: 10 }} layout="vertical" onFinish={values => void save(values)}>
      <div className="commerce-form-grid">{!editing && <Form.Item name="id" label={t('commercePlanIdentifier')} rules={[{ required: true, pattern: /^[a-z0-9_-]{2,40}$/, message: t('commercePlanIdentifierValidation') }]}><Input placeholder="clinic50"/></Form.Item>}<Form.Item name="name" label={t('commercePlanName')} rules={[{ required: true, whitespace: true, min: 2, max: 100 }]}><Input/></Form.Item><Form.Item className="commerce-form-full" name="description" label={t('commerceShortDescription')} extra={t('commerceOriginalCatalogHint')} rules={[{ max: 1000 }]}><Input.TextArea rows={3}/></Form.Item><Form.Item name="is_custom" label={t('commerceCustomPlan')} valuePropName="checked"><Switch/></Form.Item><Form.Item name="active" label={t('commerceVisibleToCustomers')} valuePropName="checked"><Switch/></Form.Item>{!custom && <><Form.Item name="price_uzs" label={t('commerceMonthlyPrice')} rules={[{ required: true }]}><InputNumber min={1} max={1000000000} precision={0}/></Form.Item><Form.Item name="doctor_limit" label={t('commerceDoctorSeats')} rules={[{ required: true }]}><InputNumber min={1} max={10000} precision={0}/></Form.Item></>}<Form.Item name="sort_order" label={t('commerceDisplayOrder')} rules={[{ required: true }]}><InputNumber min={0} max={1000} precision={0}/></Form.Item></div><Alert className="commerce-notice" type="info" showIcon message={t('commercePlanChangesHint')}/><Button type="primary" htmlType="submit" loading={busy}>{t('commerceSavePlan')}</Button>
    </LocalizedForm>
  </Modal>
}

function PlansPanel() {
  const { t } = useTranslation()
  const query = useQuery({ queryKey: ['developer-plans'], queryFn: ({ signal }) => get<Page<Plan>>('/developer/plans', signal) })
  const [selected, setSelected] = useState<Plan | 'new' | null>(null)
  return <><div className="commerce-section-heading"><div><h2>{t('commercePlanCatalog')}</h2><p>{t('commercePlanCatalogHint')}</p></div><Button type="primary" icon={<Plus size={15}/>} onClick={() => setSelected('new')}>{t('commerceAddPlan')}</Button></div>{query.isPending ? <Loading/> : query.isError ? <Failure error={query.error} retry={() => void query.refetch()}/> : <div className="commerce-plan-cards">{query.data.items.map(plan => <article key={plan.id} className="commerce-plan-card"><div className="commerce-card-title"><span>{plan.is_custom ? t('commerceCustomUpper') : t('commerceMonthlySubscriptionUpper')}</span><Tag color={plan.active ? 'green' : 'default'}>{plan.active ? t('commerceActive') : t('commerceHidden')}</Tag></div><h3>{localizedPlan(plan).name}</h3><p>{localizedPlan(plan).description}</p><div className="commerce-price">{money(plan.price_uzs)}</div><div className="commerce-plan-footer"><span>{plan.doctor_limit ? t('commerceSeatCount', { count: plan.doctor_limit }) : t('commerceTelegramAgreement')}</span><Button icon={<Settings2 size={14}/>} onClick={() => setSelected(plan)}>{t('commerceEdit')}</Button></div></article>)}</div>}{selected && <PlanEditor key={selected === 'new' ? 'new' : selected.id} plan={selected} onClose={() => setSelected(null)}/>}</>
}

function PaymentEditor({ method, onClose }: { method: PaymentMethod | 'new'; onClose: () => void }) {
  const { t } = useTranslation()
  const editing = method === 'new' ? null : method
  const { act, busy } = useAction()
  const save = async (values: PaymentMethod) => {
    const body = { name: values.name.trim(), recipient: values.recipient.trim(), card_number: values.card_number.replace(/\s/g, ''), instructions: values.instructions || '', active: values.active, is_demo: values.is_demo }
    const saved = await act(() => editing ? patch(`/developer/payment-methods/${editing.id}`, { ...body, expected_version: editing.version }) : post('/developer/payment-methods', body))
    if (saved) onClose()
  }
  return <Modal title={editing ? t('commerceEditPaymentDetails') : t('commerceAddPaymentMethod')} open onCancel={() => { if (!busy) onClose() }} footer={null} width={560}><LocalizedForm disabled={busy} layout="vertical" initialValues={editing || { active: true, is_demo: false, instructions: '' }} onFinish={values => void save(values)}><Form.Item name="name" label={t('commercePaymentMethod')} rules={[{ required: true, whitespace: true, min: 2, max: 80 }]}><Input placeholder="Humo"/></Form.Item><Form.Item name="card_number" label={t('commercePublicCardNumber')} rules={[{ required: true, pattern: /^(?:\d\s*){16}$/, message: t('commerceCardNumberValidation') }]}><Input inputMode="numeric" autoComplete="off" placeholder="9860 0000 0000 0000"/></Form.Item><Form.Item name="recipient" label={t('commerceCardholder')} rules={[{ required: true, whitespace: true, min: 2, max: 160 }]}><Input/></Form.Item><Form.Item name="instructions" label={t('commercePaymentInstructions')} rules={[{ max: 1000 }]}><Input.TextArea rows={3}/></Form.Item><Space size={35}><Form.Item name="active" label={t('commerceActive')} valuePropName="checked"><Switch/></Form.Item><Form.Item name="is_demo" label={t('commerceDemoDetails')} valuePropName="checked"><Switch/></Form.Item></Space><Alert className="commerce-notice" type="info" showIcon message={t('commercePublicPaymentDetailsHint')}/><Button type="primary" htmlType="submit" loading={busy}>{t('commerceSavePaymentDetails')}</Button></LocalizedForm></Modal>
}

function PaymentsPanel() {
  const { t } = useTranslation()
  const query = useQuery({ queryKey: ['developer-payment-methods'], queryFn: ({ signal }) => get<Page<PaymentMethod>>('/developer/payment-methods', signal) })
  const [selected, setSelected] = useState<PaymentMethod | 'new' | null>(null)
  return <><div className="commerce-section-heading"><div><h2>{t('commercePaymentDetails')}</h2><p>{t('commercePaymentDetailsHint')}</p></div><Button type="primary" icon={<Plus size={15}/>} onClick={() => setSelected('new')}>{t('commerceAddPaymentType')}</Button></div>{query.isPending ? <Loading/> : query.isError ? <Failure error={query.error} retry={() => void query.refetch()}/> : <div className="commerce-plan-cards">{query.data.items.map(method => <article className="commerce-plan-card" key={method.id}><div className="commerce-card-title"><span><CreditCard size={18}/>{method.name}</span><Tag color={method.active ? 'green' : 'default'}>{method.active ? t('commerceActive') : t('commerceHidden')}</Tag></div><div className="commerce-payment-number">{method.card_number.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim()}</div><h3>{method.recipient}</h3><p>{localizedPaymentInstructions(method.instructions) || t('commerceNoPaymentInstructions')}</p><div className="commerce-plan-footer"><span>{method.is_demo ? t('commerceDemoDetails') : t('commerceLivePaymentDetails')}</span><Button icon={<Settings2 size={14}/>} onClick={() => setSelected(method)}>{t('commerceEdit')}</Button></div></article>)}</div>}{selected && <PaymentEditor key={selected === 'new' ? 'new' : selected.id} method={selected} onClose={() => setSelected(null)}/>}</>
}

export default function DeveloperPage({ user }: { user: User }) {
  const { t } = useTranslation()
  const overview = useQuery({ queryKey: ['developer-overview'], queryFn: ({ signal }) => get<Overview>('/developer/overview', signal), refetchInterval: 15000 })
  return <div className="commerce-admin"><div className="commerce-heading"><div><span className="commerce-eyebrow">{t('commercePlatformManagement')}</span><h1>{t('commerceDeveloperWorkspace')}</h1><p>{user.name}{t('commerceDeveloperIntro')}</p></div><span className="commerce-support"><ShieldCheck size={17}/> {t('commercePlatformAdmin')}</span></div>
    <WorkflowGuide topic="developer"/>
    {overview.isPending ? <Loading/> : overview.isError ? <div className="commerce-notice"><Failure error={overview.error} retry={() => void overview.refetch()}/></div> : <><div className="commerce-metrics"><div className="commerce-metric"><Building2 size={20}/><span>{t('commerceClinics')}</span><strong>{overview.data.clinics_total}</strong><small>{t('commerceActiveSubscriptionsCount', { count: overview.data.active_subscriptions })}</small></div><div className="commerce-metric"><FileCheck2 size={20}/><span>{t('commerceAwaitingReview')}</span><strong>{overview.data.pending_requests}</strong><small>{t('commercePaymentRequests')}</small></div><div className="commerce-metric"><Users size={20}/><span>{t('commerceActiveDoctors')}</span><strong>{overview.data.doctors_total}</strong><small>{t('commerceAcrossClinics')}</small></div><div className="commerce-metric"><CreditCard size={20}/><span>{t('commerceApprovedPayments')}</span><strong style={{ fontSize: 23 }}>{money(overview.data.approved_revenue_uzs)}</strong><small>{t('commerceExpiringSubscriptionsCount', { count: overview.data.expiring_soon })}</small></div></div></>}
    <StableTabs className="commerce-tabs" defaultActiveKey="requests" items={[{ key: 'requests', label: t('commercePaymentRequests'), children: <RequestsPanel/> }, { key: 'clinics', label: t('commerceClinics'), children: <ClinicsPanel currentUserId={user.id}/> }, { key: 'users', label: t('commerceUsers'), children: <UsersPanel currentUserId={user.id}/> }, { key: 'plans', label: t('commercePlans'), children: <PlansPanel/> }, { key: 'payments', label: t('commercePaymentMethods'), children: <PaymentsPanel/> }]}/>
  </div>
}
