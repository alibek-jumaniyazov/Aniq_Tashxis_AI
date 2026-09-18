import i18next from 'i18next'

export interface BillingPlan {
  id: string
  name: string
  description: string
  price_uzs: number | null
  doctor_limit: number | null
  period_months: number
  active: boolean
  sort_order: number
  version: number
  is_custom: boolean
}

export interface PaymentMethod {
  id: string
  name: string
  card_number: string
  recipient: string
  instructions: string
  is_demo: boolean
  active: boolean
  version: number
}

export interface PaymentRequest {
  id: string
  tenant_id: string
  clinic_name: string
  plan_id: string
  plan_name: string
  price_uzs: number
  doctor_limit: number
  payment_method_id: string
  payment_method_name: string
  status: string
  payment_reference?: string | null
  receipt_name: string
  receipt_url: string
  created_at: string
  reviewed_at: string | null
  review_note: string | null
  version: number
  is_demo: boolean
}

export interface BillingAccount {
  managed: boolean
  can_use_workspace: boolean
  is_clinic_owner: boolean
  clinic: { id: string; name: string; phone?: string; owner_name?: string; active?: boolean } | null
  subscription: {
    status: string
    plan_id: string | null
    plan_name: string | null
    doctor_limit: number
    price_uzs: number | null
    starts_at: string | null
    expires_at: string | null
    active: boolean
    internal_demo: boolean
  } | null
  usage: { doctors: number; team_members: number }
  requests: PaymentRequest[]
}

export interface PlanCatalog { items: BillingPlan[]; support_telegram: string; demo_mode: boolean }
export const SUPPORT_URL = 'https://t.me/avilab_uz_support'
export function formatUzs(value: number, language = i18next.language) {
  return new Intl.NumberFormat(language?.startsWith('uz') ? 'uz-UZ' : language?.startsWith('en') ? 'en-US' : 'ru-RU').format(value)
}

export function formatMoney(value: number | null | undefined, language = i18next.language) {
  return value == null ? i18next.t('commerceCustomQuote', { lng: language }) : `${formatUzs(value, language)} ${i18next.t('commerceCurrency', { lng: language })}`
}

const defaultPlans: Record<string, { name: string; description: string; nameKey: string; descriptionKey: string }> = {
  solo: { name: 'Doctor', description: 'Bir shifokor uchun shaxsiy ish maydoni.', nameKey: 'commercePlanDoctor', descriptionKey: 'commercePlanDoctorDescription' },
  clinic10: { name: 'Clinic 10', description: '10 shifokorgacha klinika jamoasi uchun.', nameKey: 'commercePlanClinic10', descriptionKey: 'commercePlanClinic10Description' },
  clinic25: { name: 'Clinic 25', description: '25 shifokorgacha klinika jamoasi uchun.', nameKey: 'commercePlanClinic25', descriptionKey: 'commercePlanClinic25Description' },
  custom: { name: 'Individual', description: 'Katta klinikalar uchun individual shartlar.', nameKey: 'commercePlanCustom', descriptionKey: 'commercePlanCustomDescription' },
}

/** Translate only shipped defaults; administrator-authored catalog text remains intact. */
export function localizedPlan(plan: Pick<BillingPlan, 'id' | 'name' | 'description'>, language = i18next.language) {
  const defaults = defaultPlans[plan.id]
  return {
    name: defaults && plan.name === defaults.name ? i18next.t(defaults.nameKey, { lng: language }) : plan.name,
    description: defaults && plan.description === defaults.description ? i18next.t(defaults.descriptionKey, { lng: language }) : plan.description,
  }
}

export function localizedPlanName(name: string | null | undefined, id?: string | null, language = i18next.language, internalDemo = false) {
  if (internalDemo && name === 'Ichki namoyish') return i18next.t('commerceInternalDemo', { lng: language })
  if (!name) return ''
  return id ? localizedPlan({ id, name, description: '' }, language).name : name
}

const defaultPaymentInstructions = 'Tanlangan tarif summasini o‘tkazing va to‘lov chekini yuklang. Obuna tekshiruvdan keyin faollashadi.'
export function localizedPaymentInstructions(instructions: string, language = i18next.language) {
  return instructions === defaultPaymentInstructions ? i18next.t('commerceDefaultPaymentInstructions', { lng: language }) : instructions
}
