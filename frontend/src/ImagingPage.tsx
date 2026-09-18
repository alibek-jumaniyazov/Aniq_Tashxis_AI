import { Button } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { get } from './api/client'
import type { Case, User } from './types'
import RadiologyWorkspace from './RadiologyWorkspace'
import { Failure, Loading } from './ui'
import './patientNavigation.css'

export default function ImagingPage({ user }: { user: User }) {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const query = useQuery({ queryKey: ['case', id], queryFn: ({ signal }) => get<Case>(`/cases/${id}`, signal), refetchInterval: query => query.state.data?.analyses.some(run => ['running', 'queued'].includes(run.status)) ? 1500 : false })
  if (query.isPending) return <Loading/>
  if (query.error || !query.data) return <Failure error={query.error} retry={() => void query.refetch()}/>
  const c = query.data
  return <>
    <div className="imaging-route-heading"><div><Button type="text" icon={<ArrowLeft size={16}/>} onClick={() => navigate(`/cases/${c.id}`)}>{t('pn_backPatient')}</Button><h1>{t('pn_imagingWindow')}</h1><p>{c.full_name || c.alias} · {c.alias}</p></div></div>
    <RadiologyWorkspace c={c} user={user} standalone/>
  </>
}
