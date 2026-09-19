import LocalizedForm from './LocalizedForm'
import axios from 'axios'
import { useEffect, useState } from 'react'
import { Avatar, Button, Drawer, Form, Input, Select } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Activity,
  ArrowRight,
  ChevronDown,
  ClipboardCheck,
  FileBarChart2,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from 'lucide-react'
import { motion } from 'motion/react'
import { get, post, setCsrf } from './api/client'
import { processingHintKey, processingLabelKey } from './aiProvider'
import type { Auth, Role, Status, User } from './types'
import { Failure, Loading, useAction } from './ui'
import Dashboard from './Dashboard'
import CasePage from './CasePage'
import ImagingPage from './ImagingPage'
import { ExpertPage, ReportsPage } from './Governance'
import LandingPage from './LandingPage'
import CheckoutPage from './CheckoutPage'
import DeveloperPage from './DeveloperPage'
import SettingsHub from './SettingsHub'
import NotificationCenter from './NotificationCenter'
import { Language } from './Language'

export function Logo({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="brand">
      <img src="/brand/aniqtashxis-mark.svg" width={36} height={36} alt="" />
      <div>
        Aniq<span>Tashxis</span>
        <small>{t(compact ? 'brandCompact' : 'brandWorkspace')}</small>
      </div>
      <b>ai</b>
    </div>
  )
}
function roleHome(role: Role) {
  return role === 'developer'
    ? '/developer'
    : role === 'owner'
      ? '/settings/clinic'
      : role === 'admin'
        ? '/settings/system'
        : ['quality', 'sender', 'analyst'].includes(role)
          ? '/reports'
          : role === 'expert'
            ? '/expert'
            : '/cases'
}
function loginDestination(search: string, role: Role) {
  const next = new URLSearchParams(search).get('next')
  return role !== 'developer' && (next === '/checkout' || next?.startsWith('/checkout?'))
    ? next
    : roleHome(role)
}
function LoginPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const client = useQueryClient()
  const { act, busy } = useAction()
  const publicInfo = useQuery({
    queryKey: ['public-plans'],
    queryFn: ({ signal }) => get<{ demo_mode: boolean }>('/billing/plans', signal),
  })
  const roles: Role[] = [
    'doctor',
    'radiologist',
    'expert',
    'quality',
    'sender',
    'admin',
    'analyst',
    'developer',
  ]
  const submit = async (values: { email: string; password: string }) => {
    await act(async () => {
      const auth = await post<Auth>('/auth/login', values)
      setCsrf(auth.csrf_token)
      client.setQueryData(['auth'], auth)
      navigate(loginDestination(location.search, auth.user.role), { replace: true })
    }, false)
  }
  return (
    <div className="login-page">
      <section className="login-story">
        <Logo compact />
        <div className="login-copy">
          <span className="eyebrow light">
            <i />
            {t('evidenceFirst')}
          </span>
          <h1>{t('sourceSummary')}</h1>
          <p>{t('sourceSummaryHint')}</p>
          <div className="clinical-orbit">
            <div className="orbit-center">
              <Activity size={54} strokeWidth={1.25} />
            </div>
            <div className="orbit-label orbit-one">
              <FilesIcon />
              {t('source')}
            </div>
            <div className="orbit-label orbit-two">
              <ShieldCheck size={18} />
              {t('confirmed')}
            </div>
            <div className="orbit-label orbit-three">
              <Stethoscope size={18} />
              {t('doctor')}
            </div>
          </div>
        </div>
        <div className="login-foot">
          <LockKeyhole size={15} />
          {t('localHint')}
        </div>
      </section>
      <section className="login-form">
        <div className="login-language">
          <Button type="text" onClick={() => navigate('/')}>
            AniqTashxis.ai
          </Button>
          <Language />
        </div>
        <div className="login-form-inner">
          <span className="eyebrow">ANIQTASHXIS / M0</span>
          <h2>{t('signIn')}</h2>
          <p>{t('loginSubtitle')}</p>
          <LocalizedForm
            form={form}
            layout="vertical"
            onFinish={(values) => void submit(values)}
            initialValues={{ email: '', password: '' }}
          >
            <Form.Item label={t('email')} name="email" rules={[{ required: true }]}>
              <Input autoComplete="username" />
            </Form.Item>
            <Form.Item label={t('password')} name="password" rules={[{ required: true }]}>
              <Input.Password autoComplete="current-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={busy}>
              {t('signIn')}
              <ArrowRight size={17} />
            </Button>
          </LocalizedForm>
          {publicInfo.data?.demo_mode && (
            <div className="demo-login">
              <span>{t('demoAccounts')}</span>
              <Select
                aria-label={t('demoAccounts')}
                placeholder={t('demoAccounts')}
                options={roles.map((r) => ({
                  value: r,
                  label: t(r === 'expert' ? 'expertRole' : r),
                }))}
                onChange={(role) =>
                  form.setFieldsValue({ email: `${role}@demo.aniq`, password: 'AniqDemo!2026' })
                }
              />
              <small>{t('demoShort')} · AniqDemo!2026</small>
              <Button
                size="small"
                onClick={() =>
                  form.setFieldsValue({ email: 'doctor@demo.aniq', password: 'AniqDemo!2026' })
                }
              >
                {t('doctor')}
              </Button>
            </div>
          )}
          <p className="legal-line">
            <ShieldCheck size={14} />
            {t('clinicalNote')}
          </p>
        </div>
      </section>
    </div>
  )
}
function FilesIcon() {
  return <ClipboardCheck size={18} />
}
function Shell({
  user,
  clinicName,
  internalDemo,
  workspaceAvailable,
}: {
  user: User
  clinicName?: string
  internalDemo?: boolean
  workspaceAvailable: boolean
}) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const client = useQueryClient()
  const modelStatus = useQuery({
    queryKey: ['status'],
    queryFn: ({ signal }) => get<Status>('/system/status', signal),
    staleTime: 10000,
    refetchInterval: 30000,
  })
  const [mobile, setMobile] = useState(false)
  const { act } = useAction()
  const canCases = ['doctor', 'radiologist', 'expert', 'quality', 'sender'].includes(user.role)
  const home = roleHome(user.role)
  const initials = user.name
    .replace(/^Д-р\s+/u, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
  const canExpert = ['doctor', 'expert', 'quality', 'sender'].includes(user.role)
  const canReports = ['quality', 'expert', 'sender', 'analyst'].includes(user.role)
  const links = [
    { path: '/cases', label: 'cases', icon: LayoutDashboard, visible: canCases },
    {
      path: '/expert',
      label: 'expert',
      icon: ClipboardCheck,
      visible: ['doctor', 'expert', 'quality', 'sender'].includes(user.role),
    },
    {
      path: '/reports',
      label: 'reports',
      icon: FileBarChart2,
      visible: ['quality', 'expert', 'sender', 'analyst'].includes(user.role),
    },
    {
      path: '/developer',
      label: 'developerConsole',
      icon: Settings2,
      visible: user.role === 'developer',
    },
    { path: '/settings', label: 'settingsHubTitle', icon: Settings2, visible: true },
  ].filter((l) => l.visible)
  const title =
    location.pathname === '/account'
      ? 'settingsHubTitle'
      : links.find((l) => location.pathname.startsWith(l.path))?.label || 'workspace'
  const logout = () =>
    void act(async () => {
      await post('/auth/logout')
      setCsrf('')
      client.clear()
      client.setQueryData(['auth'], null)
      navigate('/login')
    }, false)
  const nav = (
    <>
      <Logo />
      <button
        className="organization"
        onClick={() => {
          navigate(user.role === 'developer' ? '/developer' : '/settings/clinic')
          setMobile(false)
        }}
        aria-label={t('billingAccount')}
      >
        <div className="org-icon">
          <Stethoscope size={19} />
        </div>
        <div>
          <strong>
            {user.role === 'developer' ? t('platformName') : clinicName || 'AniqTashxis'}
          </strong>
          <small>
            {internalDemo
              ? t('demo')
              : t(user.role === 'developer' ? 'developer' : 'billingAccount')}
          </small>
        </div>
        <ChevronDown size={14} />
      </button>
      <div className="nav-label">{t('workspaceNav')}</div>
      {user.role === 'doctor' && (
        <Button
          className="patient-create-shortcut"
          type="primary"
          icon={<Plus size={18} />}
          onClick={() => {
            navigate('/cases?new=1')
            setMobile(false)
          }}
        >
          {t('pn_newPatient')}
        </Button>
      )}
      <nav>
        {links.map(({ path, label, icon: Icon }) => (
          <NavLink key={path} to={path} onClick={() => setMobile(false)}>
            <Icon size={19} />
            <span>{t(label)}</span>
            {path === '/cases' && <span className="nav-dot" />}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="local-card">
          <span>
            <span className="live-dot" />
            {t(processingLabelKey(modelStatus.data?.model))}
          </span>
          <p>{t(processingHintKey(modelStatus.data?.model, true))}</p>
          <LockKeyhole size={24} strokeWidth={1.3} />
        </div>
        <div className="sidebar-user-controls">
          <button
            className="user-profile"
            onClick={() => {
              navigate('/settings/profile')
              setMobile(false)
            }}
            title={t('settingsProfile')}
          >
            <Avatar style={{ background: '#d8e8e6', color: '#286d6e' }}>{initials}</Avatar>
            <div>
              <strong>{user.name}</strong>
              <small>{t(user.role === 'expert' ? 'expertRole' : user.role)}</small>
            </div>
          </button>
          <Button
            type="text"
            aria-label={t('logout')}
            title={t('logout')}
            icon={<LogOut size={17} />}
            onClick={logout}
          />
        </div>
      </div>
    </>
  )
  return (
    <div className="app-shell">
      <aside className="sidebar">{nav}</aside>
      <Drawer
        placement="left"
        width={260}
        open={mobile}
        onClose={() => setMobile(false)}
        styles={{ body: { padding: 0 } }}
      >
        <div className="mobile-nav">{nav}</div>
      </Drawer>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumbs">
            <Button
              aria-label={t('openMenu')}
              className="mobile-menu"
              type="text"
              icon={<Menu size={20} />}
              onClick={() => setMobile(true)}
            />
            <span>{t('workspace')}</span>
            <span>/</span>
            <strong>{t(title)}</strong>
          </div>
          <div className="topbar-right">
            <span className="local-pill">
              <ShieldCheck size={14} />
              {t(processingLabelKey(modelStatus.data?.model))}
            </span>
            <Language />
            {canCases && workspaceAvailable && <NotificationCenter userId={user.id} />}
          </div>
        </header>
        <motion.main
          className={`page${location.pathname.endsWith('/imaging') ? ' imaging-page' : ''}`}
          key={location.pathname}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          <Routes>
            <Route
              path="/cases"
              element={canCases ? <Dashboard user={user} /> : <Navigate to={home} replace />}
            />
            <Route
              path="/cases/:id"
              element={canCases ? <CasePage user={user} /> : <Navigate to={home} replace />}
            />
            <Route
              path="/cases/:id/imaging"
              element={canCases ? <ImagingPage user={user} /> : <Navigate to={home} replace />}
            />
            <Route
              path="/expert"
              element={canExpert ? <ExpertPage user={user} /> : <Navigate to={home} replace />}
            />
            <Route
              path="/reports"
              element={canReports ? <ReportsPage user={user} /> : <Navigate to={home} replace />}
            />
            <Route
              path="/account"
              element={
                <Navigate
                  to={user.role === 'developer' ? '/developer' : '/settings/clinic'}
                  replace
                />
              }
            />
            <Route
              path="/developer"
              element={
                user.role === 'developer' ? (
                  <DeveloperPage user={user} />
                ) : (
                  <Navigate to={home} replace />
                )
              }
            />
            <Route
              path="/settings/*"
              element={<SettingsHub user={user} workspaceAvailable={workspaceAvailable} />}
            />
            <Route path="*" element={<Navigate to={home} replace />} />
          </Routes>
        </motion.main>
        <footer className="app-footer">
          <span>
            <Sparkles size={13} />
            AniqTashxis.ai
          </span>
          <span>{t('clinicalNote')}</span>
          <span>M0 · 2026</span>
        </footer>
      </div>
    </div>
  )
}
function AuthenticatedWorkspace({ user }: { user: User }) {
  const location = useLocation()
  const account = useQuery({
    queryKey: ['billing-account', user.id],
    queryFn: ({ signal }) =>
      get<{
        managed: boolean
        can_use_workspace: boolean
        clinic: { name: string } | null
        subscription: { internal_demo?: boolean } | null
      }>('/billing/account', signal),
    enabled: user.role !== 'developer',
    refetchInterval: 30000,
  })
  if (user.role !== 'developer') {
    if (account.isPending) return <Loading />
    if (account.error) return <Failure error={account.error} retry={() => void account.refetch()} />
    if (
      !account.data?.can_use_workspace &&
      location.pathname !== '/account' &&
      location.pathname !== '/settings' &&
      !location.pathname.startsWith('/settings/')
    )
      return <Navigate to="/settings/clinic" replace />
  }
  return (
    <Shell
      user={user}
      clinicName={account.data?.clinic?.name}
      internalDemo={account.data?.subscription?.internal_demo}
      workspaceAvailable={user.role === 'developer' || !!account.data?.can_use_workspace}
    />
  )
}
export default function App() {
  const client = useQueryClient()
  const location = useLocation()
  useEffect(() => {
    const expire = () => {
      setCsrf('')
      client.clear()
      client.setQueryData(['auth'], null)
    }
    window.addEventListener('aniq:session-expired', expire)
    return () => window.removeEventListener('aniq:session-expired', expire)
  }, [client])
  const auth = useQuery({
    queryKey: ['auth'],
    queryFn: ({ signal }) => get<Auth>('/auth/me', signal),
    staleTime: Infinity,
  })
  useEffect(() => {
    if (auth.data) setCsrf(auth.data.csrf_token)
  }, [auth.data])
  const authenticated = (result: Auth) => {
    setCsrf(result.csrf_token)
    client.setQueryData(['auth'], result)
  }
  if (location.pathname === '/') return <LandingPage user={auth.data?.user || null} />
  if (auth.isPending) return <Loading />
  if (auth.error && (!axios.isAxiosError(auth.error) || auth.error.response?.status !== 401))
    return <Failure error={auth.error} retry={() => void auth.refetch()} />
  if (location.pathname === '/checkout')
    return <CheckoutPage user={auth.data?.user || null} onAuthenticated={authenticated} />
  if (location.pathname === '/login')
    return auth.data ? (
      <Navigate to={loginDestination(location.search, auth.data.user.role)} replace />
    ) : (
      <LoginPage />
    )
  if (!auth.data) return <Navigate to="/login" replace />
  return <AuthenticatedWorkspace user={auth.data.user} />
}
