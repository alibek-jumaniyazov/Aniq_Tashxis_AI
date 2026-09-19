import { localDateInput } from '../dates'
import type { Case, Fact } from '../types'

export interface FactFormValues {
  key: string
  label: string
  value?: string | number | null
  unit?: string | null
  assertion: string
  provenance: string
  confirmed: boolean
  order_status: string
  source_id?: string | null
  span?: string
  event_time?: string
  available_time?: string
}

export interface PatientFormValues {
  full_name?: string
  age?: number | null
  sex?: string
  patient_phone?: string
  summary?: string
}

export function dateValue(value?: string) {
  return value ? new Date(value).toISOString() : null
}

export function factFormValues(c: Case, fact?: Fact) {
  if (!fact)
    return {
      assertion: 'present',
      provenance: 'manual',
      confirmed: false,
      order_status: 'not_applicable',
    }
  return {
    key: fact.key,
    label: fact.label,
    value: fact.value,
    unit: fact.unit,
    assertion: fact.assertion,
    provenance: fact.provenance,
    confirmed: fact.confirmed,
    order_status: fact.order_status,
    source_id:
      c.documents.find((document) => document.id === fact.source_id)?.type === 'manual'
        ? null
        : fact.source_id,
    span: fact.span,
    event_time: localDateInput(fact.event_time),
    available_time: localDateInput(fact.available_time),
  }
}

export function factUpdate(
  c: Pick<Case, 'version'>,
  editing: Pick<Fact, 'id'> | null,
  values: FactFormValues,
) {
  return {
    expected_version: c.version,
    supersedes: editing ? [editing.id] : [],
    facts: [
      {
        ...values,
        value: values.value ?? null,
        unit: values.unit || null,
        event_time: dateValue(values.event_time),
        available_time: dateValue(values.available_time),
        source_id: values.source_id || null,
        span: values.source_id
          ? /^(excerpt:|page:)/.test(values.span || '')
            ? values.span
            : `excerpt:${values.span}`
          : null,
      },
    ],
  }
}

export function patientUpdate(c: Pick<Case, 'full_name' | 'version'>, values: PatientFormValues) {
  const fullName = (values.full_name || '').trim()
  return {
    ...(c.full_name || fullName ? { full_name: fullName } : {}),
    age: values.age ?? null,
    sex: values.sex || 'unknown',
    patient_phone: (values.patient_phone || '').trim(),
    summary: (values.summary || '').trim(),
    expected_version: c.version,
  }
}
