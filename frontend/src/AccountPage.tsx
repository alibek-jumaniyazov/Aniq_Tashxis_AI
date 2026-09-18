import LocalizedForm from './LocalizedForm'
import { useTranslation } from 'react-i18next'
import { t } from 'i18next'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Alert, Button, Form, Input, Modal, Progress, Select, Space, Switch, Table, Tag } from 'antd'
import { ArrowUpRight, Building2, CalendarDays, CreditCard, Plus, ShieldCheck, Users } from 'lucide-react'
import { get, patch, post } from './api/client'
import { Failure, Loading, time, useAction } from './ui'
import type { User } from './types'
import WorkflowGuide from './WorkflowGuide'
import { formatMoney as money, localizedPlanName } from './commerceTypes'
import './commerceAdmin.css'
import './commerceLocale.css'

interface Member { id: string; name: string; email: string; role: string; active: boolean; version: number; is_clinic_owner: boolean }
interface Subscription { status: string; active: boolean; plan_id: string | null; plan_name: string | null; doctor_limit: number | null; price_uzs: number | null; starts_at: string | null; expires_at: string | null; internal_demo?: boolean }
interface Account { managed: boolean; is_clinic_owner: boolean; clinic: { id: string; name: string; phone: string; status: string; version: number; owner_id: string | null } | null; subscription: Subscription | null; usage: { doctors: number; team_members: number }; requests: { id: string; plan_id?: string; plan_name: string; status: string; price_uzs: number; created_at: string; review_note: string | null; reviewed_at: string | null; is_demo?: boolean }[] }
interface Team { items: Member[]; doctor_limit: number | null; doctors_used: number }
interface MemberValues { name: string; email?: string; password?: string; role: string; active?: boolean }

const roleOptions = () => [
  { value: 'doctor', label: t('commerceDoctor') }, { value: 'radiologist', label: t('commerceRadiologist') },
  { value: 'expert', label: t('commerceClinicalExpert') }, { value: 'quality', label: t('commerceQualityControl') },
  { value: 'sender', label: t('commerceReportSender') }, { value: 'admin', label: t('commerceAdministrator') },
  { value: 'analyst', label: t('commerceAnalyst') },
]
const labels = (): Record<string, string> => ({ pending: t('commerceUnderReview'), approved: t('commerceApproved'), rejected: t('commerceRejected'), active: t('commerceActive'), expired: t('commerceExpired'), suspended: t('commerceSuspended'), inactive: t('commerceInactive'), none: t('commerceNoSubscription'), trial: t('commerceTrial'), pending_payment: t('commerceAwaitingPayment') })
const statusColor = (status: string) => ({ active: 'green', approved: 'green', pending: 'gold', rejected: 'red', expired: 'orange', suspended: 'red' } as Record<string, string>)[status]

export default function AccountPage({ user, embedded = false }: { user: User; embedded?: boolean }) {
  const { t } = useTranslation()
  const Heading = embedded ? 'h2' : 'h1'
  const account = useQuery({ queryKey: ['billing-account', user.id], queryFn: ({ signal }) => get<Account>('/billing/account', signal), refetchInterval: query => query.state.data?.requests.some(request => request.status === 'pending') ? 5000 : false })
  const owner = account.data?.is_clinic_owner ?? Boolean((user as User & { is_clinic_owner?: boolean }).is_clinic_owner)
  const team = useQuery({ queryKey: ['billing-team', user.id], queryFn: ({ signal }) => get<Team>('/billing/team', signal), enabled: owner })
  const [member, setMember] = useState<Member | 'new' | null>(null)
  const [form] = Form.useForm<MemberValues>()
  const { act, busy } = useAction()

  if (account.isPending) return <Loading/>
  if (account.isError) return <Failure error={account.error} retry={() => void account.refetch()}/>
  const data = account.data
  if (!data.clinic || !data.subscription) return <div className="commerce-admin"><div className="commerce-heading"><div><span className="commerce-eyebrow">{t('commerceAccountSettingsEyebrow')}</span><Heading>{t('commerceSubscriptionTeam')}</Heading></div></div><WorkflowGuide topic="account"/><section className="commerce-card"><h2>{t('commerceUnmanagedAccount')}</h2><p className="commerce-fineprint">{t('commerceUnmanagedHelp')}</p><a className="commerce-support margin-top" href="https://t.me/avilab_uz_support" target="_blank" rel="noopener noreferrer">@avilab_uz_support <ArrowUpRight size={15}/></a></section></div>
  const subscription = data.subscription
  const doctorLimit = subscription.doctor_limit
  const atCapacity = doctorLimit != null && data.usage.doctors >= doctorLimit
  const canAdd = owner && subscription.active && data.clinic.status === 'active'
  const editable = member && member !== 'new' ? member : null
  const openMember = (item: Member | 'new') => {
    form.resetFields()
    form.setFieldsValue(item === 'new' ? { role: 'doctor', active: true } : { name: item.name, role: item.role, active: item.active })
    setMember(item)
  }
  const saveMember = async (values: MemberValues) => {
    const body = { name: values.name.trim(), role: values.role, password: values.password || undefined, ...(editable ? { active: values.active } : { email: values.email?.trim() }) }
    const saved = await act(() => editable
      ? patch(`/billing/team/${editable.id}`, { ...body, expected_version: editable.version })
      : post('/billing/team', body))
    if (saved) { setMember(null); form.resetFields() }
  }

  return <div className="commerce-admin">
    <div className="commerce-heading"><div><span className="commerce-eyebrow">{t('commerceClinicAccountEyebrow')}</span><Heading>{t('commerceSubscriptionTeam')}</Heading><p>{data.clinic.name} {t('commerceAccountIntro')}</p></div><a className="commerce-support" href="https://t.me/avilab_uz_support" target="_blank" rel="noopener noreferrer">{t('commerceHelp')} <ArrowUpRight size={15}/></a></div>
    <WorkflowGuide topic="account"/>
    {subscription.internal_demo && <Alert className="commerce-notice" type="info" showIcon message={t('commerceDemoAccount')} description={t('commerceDemoAccountHint')}/>}
    {!subscription.active && <Alert className="commerce-notice" type="warning" showIcon message={t('commerceSubscriptionRequired')} description={t('commerceSubscriptionRequiredHint')}/>}
    {data.clinic.status === 'suspended' && <Alert className="commerce-notice" type="error" showIcon message={t('commerceClinicSuspended')} description={t('commerceContactSupportStatus')}/>}
    <div className="commerce-account-grid">
      <section className="commerce-subscription-card">
        <div className="commerce-card-title"><span><CreditCard size={18}/> {t('commerceCurrentSubscription')}</span><Tag color={statusColor(subscription.status)}>{labels()[subscription.status] || subscription.status}</Tag></div>
        <h2>{localizedPlanName(subscription.plan_name, subscription.plan_id, undefined, subscription.internal_demo) || t('commercePlanNotSelected')}</h2>
        <div className="commerce-price">{money(subscription.price_uzs)}<small> {t('commercePerMonth')}</small></div>
        <dl className="commerce-details"><div><dt><Users size={15}/> {t('commerceDoctorSeats')}</dt><dd>{doctorLimit ?? t('commerceCustom')}</dd></div><div><dt><CalendarDays size={15}/> {t('commerceActivatedDate')}</dt><dd>{time(subscription.starts_at)}</dd></div><div><dt><CalendarDays size={15}/> {t('commerceExpiryDate')}</dt><dd>{time(subscription.expires_at)}</dd></div></dl>
        {owner && <Link to={`/checkout${subscription.plan_id ? `?plan=${encodeURIComponent(subscription.plan_id)}` : ''}`} className="commerce-primary-link">{subscription.active ? t('commerceRenewSubscription') : t('commerceChoosePlanReceipt')}<ArrowUpRight size={16}/></Link>}
        <p className="commerce-fineprint">{t('commerceManualPaymentHint')}</p>
        {subscription.active && !subscription.internal_demo && <p className="commerce-fineprint">{t('commerceSwitchPlanSupportHint')}</p>}
      </section>
      <section className="commerce-card commerce-capacity">
        <div className="commerce-card-title"><span><Building2 size={18}/> {t('commerceTeamCapacity')}</span><ShieldCheck size={18}/></div>
        <div className="commerce-seat-number">{data.usage.doctors}<span> / {doctorLimit ?? '—'}</span></div>
        <p>{t('commerceActiveSeatRoles')}</p>
        <Progress percent={doctorLimit ? Math.min(100, Math.round(data.usage.doctors / doctorLimit * 100)) : 0} showInfo={false} strokeColor="#087f83"/>
        <div className="commerce-capacity-footer"><strong>{t('commerceTeamCount', { count: data.usage.team_members })}</strong><span>{doctorLimit == null ? t('commercePlanDefinesLimit') : t('commerceAvailableSeats', { count: Math.max(0, doctorLimit - data.usage.doctors) })}</span></div>
        <p className="commerce-fineprint">{t('commerceNonSeatRolesHint')}</p>
        {atCapacity && <Alert type="info" showIcon message={t('commerceAtCapacityHint')}/>}
      </section>
    </div>
    {owner ? <section className="commerce-card">
      <div className="commerce-section-heading"><div><h2>{t('commerceManageTeam')}</h2><p>{t('commercePersonalLoginHint')}</p></div><Button type="primary" icon={<Plus size={16}/>} onClick={() => openMember('new')} disabled={!canAdd} aria-describedby={!canAdd ? 'team-activation-hint' : undefined}>{t('commerceAddMember')}</Button></div>
      {!canAdd && <p id="team-activation-hint" className="commerce-fineprint">{t('commerceTeamActivationHint')}</p>}
      {team.isPending ? <Loading/> : team.isError ? <Failure error={team.error} retry={() => void team.refetch()}/> : <Table<Member> rowKey="id" dataSource={team.data.items} pagination={{ pageSize: 8, hideOnSinglePage: true }} scroll={{ x: 720 }} columns={[
        { title: t('commerceMember'), key: 'name', render: (_, item) => <div className="commerce-person"><strong>{item.name}</strong><span>{item.email}</span></div> },
        { title: t('commerceRole'), key: 'role', render: (_, item) => <>{item.role === 'owner' ? t('commerceClinicOwner') : roleOptions().find(role => role.value === item.role)?.label || item.role}{item.is_clinic_owner && <Tag>{t('commerceClinicOwner')}</Tag>}</> },
        { title: t('commerceStatus'), key: 'active', render: (_, item) => <Tag color={item.active ? 'green' : 'default'}>{item.active ? t('commerceActive') : t('commerceInactive')}</Tag> },
        { title: '', key: 'action', render: (_, item) => item.is_clinic_owner || item.id === user.id ? <span className="commerce-fineprint" title={t('commerceOwnerProtectedHint')}>{t('commerceProtectedAccount')}</span> : <Button onClick={() => openMember(item)}>{t('commerceManage')}</Button> },
      ]}/>}
    </section> : <Alert className="commerce-notice" type="info" showIcon message={t('commerceOwnerManagesTeam')}/>}
    <section className="commerce-card">
      <div className="commerce-section-heading"><div><h2>{t('commerceSubscriptionRequests')}</h2><p>{t('commerceReceiptHistoryHint')}</p></div></div>
      <Table<Account['requests'][number]> rowKey="id" dataSource={data.requests} pagination={{ pageSize: 5, hideOnSinglePage: true }} scroll={{ x: 720 }} locale={{ emptyText: t('commerceNoRequests') }} columns={[
        { title: t('commercePlan'), key: 'plan', render: (_, item) => <div className="commerce-person"><strong>{localizedPlanName(item.plan_name, item.plan_id)}</strong><span>{money(item.price_uzs)}{item.is_demo ? t('commerceDemoRequestSuffix') : ''}</span></div> },
        { title: t('commerceSubmitted'), dataIndex: 'created_at', render: value => time(value) },
        { title: t('commerceStatus'), dataIndex: 'status', render: value => <Tag color={statusColor(value)}>{labels()[value] || value}</Tag> },
        { title: t('commerceReviewNote'), key: 'note', render: (_, item) => <div className="commerce-person"><span>{item.review_note || (item.status === 'pending' ? t('commerceAwaitingReview') : '—')}</span>{item.reviewed_at && <small>{time(item.reviewed_at)}</small>}</div> },
      ]}/>
    </section>
    <Modal title={editable ? t('commerceManageMember') : t('commerceNewMember')} open={member !== null} onCancel={() => { if (!busy) { setMember(null); form.resetFields() } }} footer={null} destroyOnHidden maskClosable={!busy}>
      <LocalizedForm form={form} layout="vertical" onFinish={values => void saveMember(values)} requiredMark="optional" disabled={busy}>
        <Form.Item name="name" label={t('commerceFullName')} rules={[{ required: true, whitespace: true, min: 2, max: 120, message: t('commerceNameLength') }]}><Input autoComplete="name"/></Form.Item>
        {!editable && <Form.Item name="email" label={t('commerceLoginEmail')} rules={[{ required: true, type: 'email', message: t('commerceValidEmail') }]}><Input type="email" autoComplete="off"/></Form.Item>}
        <Form.Item name="role" label={t('commerceWorkingRole')} rules={[{ required: true }]} extra={t('commerceSeatRoleHint')}><Select options={roleOptions()}/></Form.Item>
        <Form.Item name="password" label={editable ? t('commerceNewPasswordOptional') : t('commerceInitialPassword')} rules={[{ required: !editable, min: 12, max: 128, message: t('commercePasswordLength') }]} extra={editable ? t('commerceKeepPasswordHint') : t('commerceSharePasswordHint')}><Input.Password autoComplete="new-password"/></Form.Item>
        {editable && <Form.Item name="active" label={t('commerceAccountActive')} valuePropName="checked"><Switch/></Form.Item>}
        <Space><Button htmlType="submit" type="primary" loading={busy}>{t('commerceSave')}</Button><Button disabled={busy} onClick={() => setMember(null)}>{t('commerceCancel')}</Button></Space>
      </LocalizedForm>
    </Modal>
  </div>
}
