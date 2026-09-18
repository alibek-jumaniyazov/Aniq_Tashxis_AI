import { useState } from 'react'
import { Alert, Avatar, Button, Form, Input, Switch, Tag } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, NavLink, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, Building2, Check, CircleHelp, Cpu, Globe2, KeyRound, Link2, LockKeyhole, Monitor, Settings2, ShieldCheck, UserRound } from 'lucide-react'
import AccountPage from './AccountPage'
import { SettingsPage } from './Governance'
import LocalizedForm from './LocalizedForm'
import { errorText, get, patch, post, setCsrf } from './api/client'
import { useInterfacePreferences } from './interfacePreferences'
import { Failure, Loading, time } from './ui'
import type { Auth, User } from './types'
import './settingsHub.css'

interface PasswordValues { current_password: string; new_password: string; confirm_password: string }
interface Sessions { active_sessions: number; other_sessions: number; current_expires_at: string }
interface SessionAction { ok: boolean; revoked_sessions: number }

function ProfileSettings({ user }: { user: User }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [form] = Form.useForm<{ name: string }>()
  const [saved, setSaved] = useState(false)
  const save = useMutation({
    mutationFn: (name: string) => patch<Auth>('/auth/profile', { name: name.trim() }),
    onSuccess: auth => {
      setCsrf(auth.csrf_token)
      client.setQueryData(['auth'], auth)
      form.setFieldsValue({ name: auth.user.name })
      setSaved(true)
    },
  })
  const initials = user.name.trim().split(/\s+/u).slice(0, 2).map(part => part[0]).join('')
  return <section className="settings-card">
    <div className="settings-section-heading"><span className="settings-icon"><UserRound size={22}/></span><div><h2>{t('sh_profile')}</h2><p>{t('sh_profileHint')}</p></div></div>
    <div className="settings-identity"><Avatar size={60}>{initials}</Avatar><div><strong>{user.name}</strong><span>{user.email}</span><Tag>{t(user.role === 'expert' ? 'expertRole' : user.role)}</Tag></div></div>
    <LocalizedForm className="settings-form" form={form} layout="vertical" disabled={save.isPending} initialValues={{ name: user.name }} onValuesChange={() => { setSaved(false); save.reset() }} onFinish={values => save.mutate(values.name)}>
      <Form.Item name="name" label={t('sh_name')} extra={t('sh_nameHint')} rules={[{ required: true, whitespace: true, min: 2, max: 180, transform: value => typeof value === 'string' ? value.trim() : value, message: t('sh_nameRequired') }]}>
        <Input autoComplete="name" maxLength={180}/>
      </Form.Item>
      <div className="settings-readonly-grid"><Form.Item label={t('email')} htmlFor="settings-profile-email"><Input id="settings-profile-email" value={user.email} readOnly aria-readonly="true"/></Form.Item><Form.Item label={t('permission')} htmlFor="settings-profile-role"><Input id="settings-profile-role" value={t(user.role === 'expert' ? 'expertRole' : user.role)} readOnly aria-readonly="true"/></Form.Item></div>
      <p className="settings-help">{t('sh_accountAccessHint')}</p>
      {save.isError && <Alert type="error" showIcon message={errorText(save.error)}/>}
      {saved && <Alert type="success" showIcon message={t('saved')}/>}
      <Button type="primary" htmlType="submit" icon={<Check size={16}/>} loading={save.isPending}>{t('sh_saveProfile')}</Button>
    </LocalizedForm>
  </section>
}

function SecuritySettings({ user }: { user: User }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [form] = Form.useForm<PasswordValues>()
  const sessionsKey = ['account-sessions', user.id]
  const sessions = useQuery({ queryKey: sessionsKey, queryFn: ({ signal }) => get<Sessions>('/auth/sessions', signal), refetchInterval: 30000 })
  const password = useMutation({
    mutationFn: ({ current_password, new_password }: PasswordValues) => post<SessionAction>('/auth/password', { current_password, new_password }),
    onSuccess: () => { form.resetFields(); void client.invalidateQueries({ queryKey: sessionsKey }) },
  })
  const revoke = useMutation({
    mutationFn: () => post<SessionAction>('/auth/sessions/revoke-others'),
    onSuccess: () => { void client.invalidateQueries({ queryKey: sessionsKey }) },
  })
  return <div className="settings-stack">
    <section className="settings-card">
      <div className="settings-section-heading"><span className="settings-icon"><KeyRound size={22}/></span><div><h2>{t('sh_changePassword')}</h2><p>{t('sh_passwordHint')}</p></div></div>
      <LocalizedForm className="settings-form" form={form} layout="vertical" disabled={password.isPending || revoke.isPending} onValuesChange={() => password.reset()} onFinish={values => password.mutate(values)}>
        <Form.Item name="current_password" label={t('sh_currentPassword')} rules={[{ required: true }]}><Input.Password autoComplete="current-password" maxLength={200}/></Form.Item>
        <Form.Item name="new_password" label={t('sh_newPassword')} rules={[{ required: true, min: 10, max: 200, message: t('sh_passwordLength') }]}><Input.Password autoComplete="new-password" maxLength={200}/></Form.Item>
        <Form.Item name="confirm_password" label={t('sh_confirmPassword')} dependencies={['new_password']} rules={[{ required: true }, ({ getFieldValue }) => ({ validator: (_, value: string) => !value || getFieldValue('new_password') === value ? Promise.resolve() : Promise.reject(new Error(t('sh_passwordMismatch'))) })]}><Input.Password autoComplete="new-password" maxLength={200}/></Form.Item>
        {password.isError && <Alert type="error" showIcon message={errorText(password.error)}/>}
        {password.isSuccess && <Alert type="success" showIcon message={t('sh_passwordSaved')}/>}
        <Button type="primary" htmlType="submit" icon={<LockKeyhole size={16}/>} loading={password.isPending}>{t('sh_changePassword')}</Button>
      </LocalizedForm>
    </section>
    <section className="settings-card">
      <div className="settings-section-heading"><span className="settings-icon"><Monitor size={22}/></span><div><h2>{t('sh_sessions')}</h2><p>{t('sh_sessionsHint')}</p></div></div>
      {sessions.isPending ? <Loading/> : sessions.isError ? <Failure error={sessions.error} retry={() => void sessions.refetch()}/> : <>
        <dl className="settings-session-stats"><div><dt>{t('sh_currentSession')}</dt><dd><ShieldCheck size={18}/> {t('active')}</dd></div><div><dt>{t('sh_otherSessions')}</dt><dd>{sessions.data.other_sessions}</dd></div><div><dt>{t('sh_sessionExpires')}</dt><dd>{time(sessions.data.current_expires_at)}</dd></div></dl>
        {revoke.isError && <Alert className="margin-bottom" type="error" showIcon message={errorText(revoke.error)}/>}
        {revoke.isSuccess && <Alert className="margin-bottom" type="success" showIcon message={t('sh_sessionsRevoked')}/>}
        <Button onClick={() => revoke.mutate()} loading={revoke.isPending} disabled={!sessions.data.other_sessions || password.isPending}>{t('sh_revokeSessions')}</Button>
      </>}
    </section>
  </div>
}

function InterfaceSettings() {
  const { t, i18n } = useTranslation()
  const { reduceMotion, setReduceMotion } = useInterfacePreferences()
  return <section className="settings-card">
    <div className="settings-section-heading"><span className="settings-icon"><Globe2 size={22}/></span><div><h2>{t('sh_interface')}</h2><p>{t('sh_interfaceHint')}</p></div></div>
    <div className="settings-preference settings-language-preference"><div><strong id="settings-language-label">{t('sh_language')}</strong><p id="settings-language-hint">{t('sh_languageHint')}</p></div><div className="settings-language-options" role="radiogroup" aria-labelledby="settings-language-label" aria-describedby="settings-language-hint">{[{ value: 'ru', label: 'Русский' }, { value: 'uz', label: 'O‘zbekcha' }, { value: 'en', label: 'English' }].map(language => <label key={language.value} className={i18n.resolvedLanguage === language.value ? 'selected' : ''}><input type="radio" name="settings-language" value={language.value} checked={i18n.resolvedLanguage === language.value} onChange={() => { void i18n.changeLanguage(language.value) }}/><span>{language.label}</span></label>)}</div></div>
    <div className="settings-preference"><div><label id="settings-motion-label">{t('sh_reduceMotion')}</label><p id="settings-motion-hint">{t('sh_reduceMotionHint')}</p></div><Switch aria-labelledby="settings-motion-label" aria-describedby="settings-motion-hint" checked={reduceMotion} onChange={setReduceMotion}/></div>
    <p className="settings-autosaved"><Check size={15}/>{t('sh_browserPreference')}</p>
  </section>
}

function HelpSettings() {
  const { t } = useTranslation()
  return <div className="settings-stack"><section className="settings-card settings-support-card"><div className="settings-section-heading"><span className="settings-icon"><CircleHelp size={22}/></span><div><h2>{t('sh_support')}</h2><p>{t('sh_supportHint')}</p></div></div><a className="settings-support-link" href="https://t.me/avilab_uz_support" target="_blank" rel="noopener noreferrer">@avilab_uz_support <ArrowUpRight size={17}/></a></section><section className="settings-card"><div className="settings-section-heading"><span className="settings-icon"><Link2 size={22}/></span><div><h2>{t('sh_dmedTitle')}</h2><Tag>{t('demoShort')}</Tag></div></div><p className="settings-help">{t('sh_dmedHint')}</p></section><section className="settings-card"><h2>{t('sh_dataTitle')}</h2><p className="settings-help">{t('sh_dataHint')}</p><hr/><h2>{t('sh_aiTitle')}</h2><p className="settings-help">{t('sh_aiHint')}</p></section></div>
}

export default function SettingsHub({ user, workspaceAvailable = true }: { user: User; workspaceAvailable?: boolean }) {
  const { t } = useTranslation()
  const params = useParams()
  const section = params['*'] || ''
  const sections = [
    { id: 'profile', icon: UserRound },
    { id: 'security', icon: ShieldCheck },
    { id: 'interface', icon: Globe2 },
    ...(user.role !== 'developer' ? [{ id: 'clinic', icon: Building2 }] : []),
    ...(!['owner', 'developer'].includes(user.role) && workspaceAvailable ? [{ id: 'system', icon: Cpu }] : []),
    { id: 'help', icon: CircleHelp },
  ]
  if (!sections.some(item => item.id === section)) return <Navigate to="/settings/profile" replace/>
  return <div className="settings-hub"><div className="settings-hub-heading"><div><h1>{t('sh_title')}</h1><p>{t('sh_subtitle')}</p></div><span className="settings-heading-icon"><Settings2 size={26}/></span></div><div className="settings-layout"><nav className="settings-navigation" aria-label={t('sh_navigation')}>{sections.map(({ id, icon: Icon }) => <NavLink key={id} to={`/settings/${id}`}><span className="settings-nav-icon"><Icon size={19}/></span><span><strong>{t(`sh_${id}`)}</strong><small>{t(`sh_${id}Hint`)}</small></span></NavLink>)}</nav><div className={`settings-content settings-content-${section}`} key={section}>
    {section === 'profile' && <ProfileSettings user={user}/>}
    {section === 'security' && <SecuritySettings user={user}/>}
    {section === 'interface' && <InterfaceSettings/>}
    {section === 'clinic' && <AccountPage user={user} embedded/>}
    {section === 'system' && <SettingsPage user={user} embedded/>}
    {section === 'help' && <HelpSettings/>}
  </div></div></div>
}
