export interface Page<T> {
  items: T[]
  total: number
  page?: number
  page_size?: number
}

export interface Subscription {
  status: string
  active: boolean
  plan_id: string | null
  plan_name: string | null
  doctor_limit: number | null
  price_uzs: number | null
  starts_at: string | null
  expires_at: string | null
  internal_demo?: boolean
}

export interface Clinic {
  id: string
  name: string
  phone: string
  status: string
  version: number
  owner_id: string | null
  subscription: Subscription
  usage: { doctors: number; team_members: number }
}

export interface Member {
  id: string
  tenant_id: string
  clinic_name?: string
  name: string
  email: string
  role: string
  active: boolean
  version: number
  is_clinic_owner: boolean
}

export interface SubscriptionRequest {
  id: string
  tenant_id: string
  clinic_name: string
  plan_id: string
  plan_name: string
  price_uzs: number
  doctor_limit: number
  payment_method_name: string
  payment_recipient?: string
  payment_card_last4?: string
  payment_reference?: string
  status: string
  receipt_name: string
  receipt_url: string
  created_at: string
  reviewed_at: string | null
  review_note: string | null
  version: number
  is_demo: boolean
}

export interface Account {
  clinic: Omit<Clinic, 'subscription' | 'usage'>
  subscription: Subscription
  usage: Clinic['usage']
  requests: SubscriptionRequest[]
}

export interface Plan {
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
  active: boolean
  is_demo: boolean
  version: number
}

export interface Overview {
  clinics_total: number
  active_subscriptions: number
  pending_requests: number
  doctors_total: number
  approved_revenue_uzs: number
  expiring_soon: number
}

export interface MemberValues {
  name: string
  email?: string
  password?: string
  role: string
  active?: boolean
}
