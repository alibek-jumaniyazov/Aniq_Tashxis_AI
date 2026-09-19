import { Tag } from 'antd'
import { t } from 'i18next'

export const roles = () => [
  { value: 'doctor', label: t('commerceDoctor') },
  { value: 'radiologist', label: t('commerceRadiologist') },
  { value: 'expert', label: t('commerceClinicalExpert') },
  { value: 'quality', label: t('commerceQualityControl') },
  { value: 'sender', label: t('commerceReportSender') },
  { value: 'admin', label: t('commerceAdministrator') },
  { value: 'analyst', label: t('commerceAnalyst') },
]
export const labels = (): Record<string, string> => ({
  active: t('commerceActive'),
  pending: t('commerceUnderReview'),
  approved: t('commerceApproved'),
  rejected: t('commerceRejected'),
  expired: t('commerceExpired'),
  suspended: t('commerceSuspended'),
  inactive: t('commerceInactive'),
  none: t('commerceNoSubscription'),
  trial: t('commerceTrial'),
  pending_payment: t('commerceAwaitingPayment'),
})
export const statusTag = (value: string) => (
  <Tag
    color={
      ['approved', 'active'].includes(value)
        ? 'green'
        : ['rejected', 'suspended'].includes(value)
          ? 'red'
          : value === 'pending'
            ? 'gold'
            : 'default'
    }
  >
    {labels()[value] || value}
  </Tag>
)
export const roleName = (value: string) =>
  roles().find((role) => role.value === value)?.label ||
  (
    { owner: t('commerceClinicOwner'), developer: t('commercePlatformManager') } as Record<
      string,
      string
    >
  )[value] ||
  value
