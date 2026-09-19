import { useRef, useState } from 'react'
import { App, Alert, Button, Empty, Spin, Tag } from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, Files, ShieldCheck } from 'lucide-react'
import { errorText } from './api/client'
import i18n from 'i18next'
import { displayTime } from './dates'

export function useAction() {
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const { message } = App.useApp()
  const client = useQueryClient()
  const { t } = useTranslation()
  async function act<T>(action: () => Promise<T>, notify = true) {
    if (pending.current) return undefined
    pending.current = true
    setBusy(true)
    try {
      const result = await action()
      if (notify) void message.success(t('saved'))
      await client.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'auth' })
      return result
    } catch (error) {
      void message.error(errorText(error))
      return undefined
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return { act, busy }
}
export function Loading() {
  return (
    <div className="loading">
      <Spin size="large" />
    </div>
  )
}
export function Failure({ error, retry }: { error: unknown; retry?: () => void }) {
  const { t } = useTranslation()
  return (
    <Alert
      type="error"
      showIcon
      message={errorText(error)}
      action={retry && <Button onClick={retry}>{t('retry')}</Button>}
    />
  )
}
export function Blank({ title, hint }: { title?: string; hint?: string }) {
  const { t } = useTranslation()
  return (
    <div className="blank">
      <Empty
        image={<Files size={42} strokeWidth={1.25} />}
        description={
          <>
            <strong>{title || t('noData')}</strong>
            <p>{hint || t('noDataHint')}</p>
          </>
        }
      />
    </div>
  )
}
export function StateTag({ status }: { status: string }) {
  const { t } = useTranslation()
  const color =
    (
      {
        succeeded: 'teal',
        confirmed: 'teal',
        accepted: 'teal',
        approved: 'teal',
        sent: 'teal',
        partial: 'amber',
        queued: 'violet',
        running: 'violet',
        new: 'amber',
        failed: 'red',
        rejected: 'red',
        closed: 'gray',
        not_started: 'gray',
        under_review: 'violet',
        awaiting_explanation: 'amber',
      } as Record<string, string>
    )[status] || 'gray'
  return (
    <span className={`state-tag ${color}`}>
      <i />
      {t(status)}
    </span>
  )
}
export function SectionTitle({
  title,
  subtitle,
  extra,
}: {
  title: string
  subtitle?: string
  extra?: React.ReactNode
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {extra}
    </div>
  )
}
export function DemoLabel() {
  const { t } = useTranslation()
  return (
    <Tag bordered={false} className="demo-tag">
      <ShieldCheck size={12} />
      {t('demoShort')}
    </Tag>
  )
}
export function SourceButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <button className="source-link" onClick={onClick}>
      {t('openSource')}
      <ArrowUpRight size={14} />
    </button>
  )
}
export function time(value?: string | null) {
  return displayTime(value, i18n.language)
}
