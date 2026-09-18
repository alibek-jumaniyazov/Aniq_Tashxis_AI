import { useEffect, useId, useRef, useState } from 'react'
import { App, Badge, Button, Popover, Spin } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, Bell, BellRing, Check, CheckCheck, CircleAlert, X } from 'lucide-react'
import { errorText, get, post } from './api/client'
import type { Notification } from './types'
import { displayTime } from './dates'
import './notificationCenter.css'

interface NotificationFeed { items: Notification[]; total: number; unread_count: number }

export default function NotificationCenter({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation()
  const { message } = App.useApp()
  const client = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLElement>(null)
  const titleId = useId()
  const queryKey = ['notifications', userId]
  const feed = useQuery({ queryKey, queryFn: ({ signal }) => get<NotificationFeed>('/notifications', signal), refetchInterval: 4000 })
  const unread = feed.data?.unread_count ?? 0
  const refresh = () => client.invalidateQueries({ queryKey })
  const readAll = useMutation({
    mutationFn: () => post<{ updated: number; unread_count: number }>('/notifications/read-all'),
    onSuccess: async () => { await refresh(); void message.success(t('notificationsMarkedRead')) },
    onError: error => { void message.error(errorText(error)) },
  })
  const readOne = useMutation({
    mutationFn: (item: Notification) => item.read_by?.includes(userId) ? Promise.resolve() : post(`/notifications/${item.id}/read`),
    onSuccess: (_result, item) => { setOpen(false); navigate(`/cases/${item.case_id}`); void refresh() },
    onError: error => { void message.error(errorText(error)) },
  })
  const busy = readAll.isPending || readOne.isPending
  const close = () => { setOpen(false); trigger.current?.focus() }

  useEffect(() => {
    if (!open) return
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() }
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [open])

  const date = (value: string) => displayTime(value, i18n.language)

  return <Popover
    trigger="click" placement="bottomRight" arrow={false} open={open} onOpenChange={setOpen}
    classNames={{ root: 'notification-popover' }} styles={{ body: { padding: 0 } }}
    afterOpenChange={visible => { if (visible) panel.current?.focus({ preventScroll: true }) }}
    content={<section ref={panel} className="notification-center" role="dialog" aria-labelledby={titleId} tabIndex={-1}>
      <header className="notification-center__header">
        <span className="notification-center__symbol"><BellRing size={21}/></span>
        <div><h2 id={titleId}>{t('notifications')}</h2><p aria-live="polite">{feed.isPending ? t('loading') : feed.data ? (unread ? t('notificationsUnreadCount', { count: unread }) : t('notificationsAllRead')) : t('notificationsActivity')}</p></div>
        <button type="button" className="notification-center__close" onClick={close} aria-label={t('notificationsClose')}><X size={19}/></button>
      </header>
      <div className="notification-center__toolbar">
        <span>{t('notificationsRecent')}</span>
        <Button type="text" className="notification-center__read-all" icon={<CheckCheck size={17}/>} onClick={() => readAll.mutate()} loading={readAll.isPending} disabled={!unread || busy || !feed.data} title={t('notificationsMarkAllHint')}>{t('notificationsMarkAll')}</Button>
      </div>
      <div className="notification-center__scroll" aria-busy={feed.isPending || busy}>
        {feed.error && <div className="notification-center__error" role="alert"><CircleAlert size={19}/><div><strong>{t('notificationsLoadError')}</strong><p>{errorText(feed.error)}</p><Button size="small" loading={feed.isFetching} onClick={() => void feed.refetch()}>{t('retry')}</Button></div></div>}
        {feed.isPending ? <div className="notification-center__empty" role="status"><Spin/><p>{t('loading')}</p></div> : feed.data?.items.length ? <ul className="notification-center__items">
          {feed.data.items.map(item => {
            const isUnread = !item.read_by?.includes(userId)
            const reading = readOne.isPending && readOne.variables?.id === item.id
            return <li key={item.id}><button type="button" className={`notification-center__item${isUnread ? ' is-unread' : ''}`} disabled={busy} onClick={() => readOne.mutate(item)}>
              <span className={`notification-center__status ${item.status === 'failed' || item.status === 'partial' ? 'needs-attention' : ''}`} aria-hidden="true">{reading ? <Spin size="small"/> : item.status === 'failed' || item.status === 'partial' ? <CircleAlert size={18}/> : <Check size={18}/>}</span>
              <span className="notification-center__copy"><strong>{item.case_alias || `${t('patient')} · ${item.case_id.slice(0, 8)}`}</strong><span>{t(item.status)} <span className="notification-center__version">· {t('version')} {item.case_version}</span></span><time dateTime={item.created_at}>{date(item.created_at)}</time></span>
              <span className="notification-center__item-end">{isUnread && <span className="notification-center__unread" role="img" aria-label={t('notificationsUnread')}/>}<ArrowUpRight size={16} aria-hidden="true"/></span>
            </button></li>
          })}
        </ul> : !feed.error && <div className="notification-center__empty"><span><Bell size={28} strokeWidth={1.5}/></span><strong>{t('noNotifications')}</strong><p>{t('notificationsEmptyHint')}</p></div>}
      </div>
      <footer className="notification-center__footer">{feed.data && feed.data.total > feed.data.items.length ? t('notificationsLatestCount', { count: feed.data.items.length, total: feed.data.total }) : t('notificationsOpenHint')}</footer>
    </section>}
  ><button ref={trigger} type="button" className="icon-button notification-trigger" aria-label={unread ? t('notificationsBellCount', { count: unread }) : t('notifications')} aria-haspopup="dialog" aria-expanded={open}><Badge count={unread} size="small" overflowCount={99}><Bell size={20}/></Badge></button></Popover>
}
