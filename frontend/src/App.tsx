import { useEffect, useState } from 'react'
import { Avatar, Badge, Button, Drawer, Form, Input, Popover, Select } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Activity, ArrowRight, Bell, ChevronDown, ClipboardCheck, FileBarChart2, LayoutDashboard, LockKeyhole, LogOut, Menu, Settings2, ShieldCheck, Sparkles, Stethoscope } from 'lucide-react'
import { motion } from 'motion/react'
import { get, post, setCsrf } from './api/client'
import type { Auth, Notification, Role, User } from './types'
import { Loading, time, useAction } from './ui'
import Dashboard from './Dashboard'
import CasePage from './CasePage'
import { ExpertPage, ReportsPage, SettingsPage } from './Governance'

export function Logo({ compact = false }: { compact?: boolean }) { return <div className="brand"><img src="/mark.svg" alt=""/><div>Aniq<span>Tashxis</span><small>{compact ? 'CLINICAL INTELLIGENCE' : 'CLINICAL WORKSPACE'}</small></div><b>ai</b></div> }
export function Language() { const { i18n } = useTranslation(); return <Select aria-label="Language" className="language" size="small" variant="borderless" value={i18n.language} options={[{ value: 'ru', label: 'RU' }, { value: 'uz', label: 'UZ' }]} onChange={value => { void i18n.changeLanguage(value); localStorage.setItem('aniq-language', value); document.documentElement.lang = value }}/ > }
function roleHome(role: Role) { return role === 'admin' ? '/settings' : ['quality', 'sender', 'analyst'].includes(role) ? '/reports' : role === 'expert' ? '/expert' : '/cases' }
function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const client = useQueryClient()
  const { act, busy } = useAction()
  const roles: Role[] = ['doctor', 'radiologist', 'expert', 'quality', 'sender', 'admin', 'analyst']
  const submit = async (values: { email: string; password: string }) => { await act(async () => { const auth = await post<Auth>('/auth/login', values); setCsrf(auth.csrf_token); client.setQueryData(['auth'], auth); navigate(roleHome(auth.user.role), { replace: true }) }, false) }
  return <div className="login-page"><section className="login-story"><Logo compact/><div className="login-copy"><span className="eyebrow light"><i/>EVIDENCE BEFORE ASSUMPTION</span><h1>{t('sourceSummary')}</h1><p>{t('sourceSummaryHint')}</p><div className="clinical-orbit"><div className="orbit-center"><Activity size={54} strokeWidth={1.25}/></div><div className="orbit-label orbit-one"><FilesIcon/>{t('source')}</div><div className="orbit-label orbit-two"><ShieldCheck size={18}/>{t('confirmed')}</div><div className="orbit-label orbit-three"><Stethoscope size={18}/>{t('doctor')}</div></div></div><div className="login-foot"><LockKeyhole size={15}/>{t('localHint')}</div></section><section className="login-form"><div className="login-language"><Language/></div><div className="login-form-inner"><span className="eyebrow">ANIQTASHXIS / M0</span><h2>{t('signIn')}</h2><p>{t('loginSubtitle')}</p><Form form={form} layout="vertical" onFinish={values => void submit(values)} initialValues={{ email: 'doctor@demo.aniq', password: 'AniqDemo!2026' }}><Form.Item label={t('email')} name="email" rules={[{ required: true }]}><Input autoComplete="username"/></Form.Item><Form.Item label={t('password')} name="password" rules={[{ required: true }]}><Input.Password autoComplete="current-password"/></Form.Item><Button type="primary" htmlType="submit" block size="large" loading={busy}>{t('signIn')}<ArrowRight size={17}/></Button></Form><div className="demo-login"><span>{t('demoAccounts')}</span><Select aria-label={t('demoAccounts')} defaultValue="doctor" options={roles.map(r => ({ value: r, label: t(r === 'expert' ? 'expertRole' : r) }))} onChange={role => form.setFieldsValue({ email: `${role}@demo.aniq`, password: 'AniqDemo!2026' })}/><small>{t('demoShort')} · AniqDemo!2026</small></div><p className="legal-line"><ShieldCheck size={14}/>{t('clinicalNote')}</p></div></section></div>
}
function FilesIcon() { return <ClipboardCheck size={18}/> }
function Shell({ user }: { user: User }) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [mobile, setMobile] = useState(false)
  const { act } = useAction()
  const notifications = useQuery({ queryKey: ['notifications', user.id], queryFn: ({ signal }) => get<{ items: Notification[] }>('/notifications', signal), refetchInterval: 4000, enabled: !['admin', 'analyst'].includes(user.role) })
  const canCases = !['admin', 'analyst'].includes(user.role)
  const home = roleHome(user.role)
  const initials = user.name.replace(/^Д-р\s+/u, '').split(/\s+/).slice(0, 2).map(n => n[0]).join('')
  const canExpert = ['doctor', 'expert', 'quality', 'sender'].includes(user.role)
  const canReports = ['quality', 'expert', 'sender', 'analyst'].includes(user.role)
  const links = [
    { path: '/cases', label: 'cases', icon: LayoutDashboard, visible: canCases },
    { path: '/expert', label: 'expert', icon: ClipboardCheck, visible: ['doctor', 'expert', 'quality', 'sender'].includes(user.role) },
    { path: '/reports', label: 'reports', icon: FileBarChart2, visible: ['quality', 'expert', 'sender', 'analyst'].includes(user.role) },
    { path: '/settings', label: 'settings', icon: Settings2, visible: true },
  ].filter(l => l.visible)
  const title = links.find(l => location.pathname.startsWith(l.path))?.label || 'workspace'
  const logout = () => void act(async () => { await post('/auth/logout'); setCsrf(''); client.clear(); client.setQueryData(['auth'], null) }, false)
  const nav = <><Logo/><div className="organization"><div className="org-icon"><Stethoscope size={19}/></div><div><strong>Avilab Clinic</strong><small>{t('demo')}</small></div><ChevronDown size={14}/></div><div className="nav-label">WORKSPACE</div><nav>{links.map(({ path, label, icon: Icon }) => <NavLink key={path} to={path} onClick={() => setMobile(false)}><Icon size={19}/><span>{t(label)}</span>{path === '/cases' && <span className="nav-dot"/>}</NavLink>)}</nav><div className="sidebar-bottom"><div className="local-card"><span><span className="live-dot"/>{t('fullyLocal')}</span><p>{t('localHint')}</p><LockKeyhole size={24} strokeWidth={1.3}/></div><button className="user-profile" onClick={logout} title={t('logout')}><Avatar style={{ background: '#d8e8e6', color: '#286d6e' }}>{initials}</Avatar><div><strong>{user.name}</strong><small>{t(user.role === 'expert' ? 'expertRole' : user.role)}</small></div><LogOut size={16}/></button></div></>
  return <div className="app-shell"><aside className="sidebar">{nav}</aside><Drawer placement="left" width={260} open={mobile} onClose={() => setMobile(false)} styles={{ body: { padding: 0 } }}><div className="mobile-nav">{nav}</div></Drawer><div className="app-main"><header className="topbar"><div className="breadcrumbs"><Button className="mobile-menu" type="text" icon={<Menu size={20}/>} onClick={() => setMobile(true)}/><span>{t('workspace')}</span><span>/</span><strong>{t(title)}</strong></div><div className="topbar-right"><span className="local-pill"><ShieldCheck size={14}/>{t('local')}</span><Language/><Popover trigger="click" placement="bottomRight" content={<div className="notification-list"><h3>{t('notifications')}</h3>{notifications.data?.items.length ? notifications.data.items.map(n => <button key={n.id} onClick={() => { void act(() => post(`/notifications/${n.id}/read`), false); navigate(`/cases/${n.case_id}`) }}><Activity size={16}/><span>{t(n.status)} · v{n.case_version}<small>{time(n.created_at)}</small></span></button>) : <p>{t('noNotifications')}</p>}</div>}><button className="icon-button" aria-label={t('notifications')}><Badge dot={notifications.data?.items.some(n => !n.read_by?.includes(user.id))}><Bell size={19}/></Badge></button></Popover></div></header><motion.main className="page" key={location.pathname} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .18 }}><Routes><Route path="/cases" element={canCases ? <Dashboard user={user}/> : <Navigate to={home} replace/>}/><Route path="/cases/:id" element={canCases ? <CasePage user={user}/> : <Navigate to={home} replace/>}/><Route path="/expert" element={canExpert ? <ExpertPage user={user}/> : <Navigate to={home} replace/>}/><Route path="/reports" element={canReports ? <ReportsPage user={user}/> : <Navigate to={home} replace/>}/><Route path="/settings" element={<SettingsPage user={user}/>}/><Route path="*" element={<Navigate to={home} replace/>}/></Routes></motion.main><footer className="app-footer"><span><Sparkles size={13}/>AniqTashxis.ai</span><span>{t('clinicalNote')}</span><span>M0 · 2026</span></footer></div></div>
}
export default function App() {
  const auth = useQuery({ queryKey: ['auth'], queryFn: ({ signal }) => get<Auth>('/auth/me', signal), staleTime: Infinity })
  useEffect(() => { if (auth.data) setCsrf(auth.data.csrf_token) }, [auth.data])
  if (auth.isPending) return <Loading/>
  if (!auth.data) return <LoginPage/>
  return <Shell user={auth.data.user}/>
}
