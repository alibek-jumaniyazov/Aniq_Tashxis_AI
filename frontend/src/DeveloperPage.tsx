import { useQuery } from '@tanstack/react-query'
import { Building2, CreditCard, FileCheck2, ShieldCheck, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { get } from './api/client'
import './commerceAdmin.css'
import './commerceLocale.css'
import { formatMoney as money } from './commerceTypes'
import StableTabs from './StableTabs'
import type { User } from './types'
import { Failure, Loading } from './ui'
import WorkflowGuide from './WorkflowGuide'

import type { Overview } from './developer/types'

import { RequestsPanel } from './developer/RequestsPanel'

import { UsersPanel } from './developer/UsersPanel'

import { ClinicsPanel } from './developer/ClinicsPanel'

import { PlansPanel } from './developer/PlansPanel'

import { PaymentsPanel } from './developer/PaymentsPanel'

export default function DeveloperPage({ user }: { user: User }) {
  const { t } = useTranslation()
  const overview = useQuery({
    queryKey: ['developer-overview'],
    queryFn: ({ signal }) => get<Overview>('/developer/overview', signal),
    refetchInterval: 15000,
  })
  return (
    <div className="commerce-admin">
      <div className="commerce-heading">
        <div>
          <span className="commerce-eyebrow">{t('commercePlatformManagement')}</span>
          <h1>{t('commerceDeveloperWorkspace')}</h1>
          <p>
            {user.name}
            {t('commerceDeveloperIntro')}
          </p>
        </div>
        <span className="commerce-support">
          <ShieldCheck size={17} /> {t('commercePlatformAdmin')}
        </span>
      </div>
      <WorkflowGuide topic="developer" />
      {overview.isPending ? (
        <Loading />
      ) : overview.isError ? (
        <div className="commerce-notice">
          <Failure error={overview.error} retry={() => void overview.refetch()} />
        </div>
      ) : (
        <>
          <div className="commerce-metrics">
            <div className="commerce-metric">
              <Building2 size={20} />
              <span>{t('commerceClinics')}</span>
              <strong>{overview.data.clinics_total}</strong>
              <small>
                {t('commerceActiveSubscriptionsCount', {
                  count: overview.data.active_subscriptions,
                })}
              </small>
            </div>
            <div className="commerce-metric">
              <FileCheck2 size={20} />
              <span>{t('commerceAwaitingReview')}</span>
              <strong>{overview.data.pending_requests}</strong>
              <small>{t('commercePaymentRequests')}</small>
            </div>
            <div className="commerce-metric">
              <Users size={20} />
              <span>{t('commerceActiveDoctors')}</span>
              <strong>{overview.data.doctors_total}</strong>
              <small>{t('commerceAcrossClinics')}</small>
            </div>
            <div className="commerce-metric">
              <CreditCard size={20} />
              <span>{t('commerceApprovedPayments')}</span>
              <strong style={{ fontSize: 23 }}>{money(overview.data.approved_revenue_uzs)}</strong>
              <small>
                {t('commerceExpiringSubscriptionsCount', { count: overview.data.expiring_soon })}
              </small>
            </div>
          </div>
        </>
      )}
      <StableTabs
        className="commerce-tabs"
        defaultActiveKey="requests"
        items={[
          { key: 'requests', label: t('commercePaymentRequests'), children: <RequestsPanel /> },
          {
            key: 'clinics',
            label: t('commerceClinics'),
            children: <ClinicsPanel currentUserId={user.id} />,
          },
          {
            key: 'users',
            label: t('commerceUsers'),
            children: <UsersPanel currentUserId={user.id} />,
          },
          { key: 'plans', label: t('commercePlans'), children: <PlansPanel /> },
          { key: 'payments', label: t('commercePaymentMethods'), children: <PaymentsPanel /> },
        ]}
      />
    </div>
  )
}
