import axios from 'axios'
import i18n from 'i18next'

let csrf = ''
export const setCsrf = (value: string) => {
  csrf = value
}
export const api = axios.create({ baseURL: '/api/v1', withCredentials: true, timeout: 25000 })
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.startsWith('/auth/'))
      window.dispatchEvent(new Event('aniq:session-expired'))
    return Promise.reject(error)
  },
)
api.interceptors.request.use((config) => {
  config.headers['X-Request-ID'] = crypto.randomUUID()
  if (config.method && !['get', 'head', 'options'].includes(config.method)) {
    if (csrf) config.headers['X-CSRF-Token'] = csrf
    if (!config.headers['Idempotency-Key']) config.headers['Idempotency-Key'] = crypto.randomUUID()
  }
  return config
})
export function errorText(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data?.error
    if (payload) {
      const text = i18n.exists(payload.code)
        ? i18n.t(payload.code)
        : `${i18n.t('requestFailed')} (${payload.code})`
      const fields = payload.details?.fields as
        { field: string; message: string; type?: string }[] | undefined
      return fields?.length
        ? `${text} ${fields
            .map((field) => {
              const name =
                field.field
                  .split('.')
                  .filter((part) => !/^(body|query|path|\d+)$/.test(part))
                  .at(-1) || ''
              const label = i18n.exists(`field_${name}`) ? i18n.t(`field_${name}`) : i18n.t('value')
              return `${label}: ${validationText(field)}`
            })
            .join('; ')}`
        : text
    }
    return error.code === 'ERR_NETWORK'
      ? i18n.t('networkError')
      : error.code === 'ECONNABORTED'
        ? i18n.t('requestTimeout')
        : i18n.t(
            error.response?.status && error.response.status >= 500
              ? 'serverError'
              : 'requestFailed',
          )
  }
  return error instanceof Error &&
    !/^Request failed|^Network Error|^timeout of /i.test(error.message)
    ? error.message
    : i18n.t('requestFailed')
}
function validationText(field: { message: string; type?: string }): string {
  const type = field.type || ''
  const key = (
    {
      missing: 'validationRequired',
      string_too_short: 'validationShort',
      string_too_long: 'validationLong',
      greater_than_equal: 'validationMin',
      less_than_equal: 'validationMax',
      int_parsing: 'validationInteger',
      int_type: 'validationInteger',
      float_parsing: 'validationNumber',
      float_type: 'validationNumber',
      bool_parsing: 'validationBool',
      bool_type: 'validationBool',
    } as Record<string, string>
  )[type]
  // Only the numeric constraint is read from the server; user input is never echoed in an error.
  const value = field.message.match(/(?:at least|at most|equal to)\s+(\d+(?:\.\d+)?)/i)?.[1]
  if (key)
    return i18n.t(
      key.includes('Short') || key.includes('Long') || key.includes('Min') || key.includes('Max')
        ? value
          ? key
          : 'invalidValue'
        : key,
      { value },
    )
  if (type.startsWith('datetime') || type.startsWith('date_')) return i18n.t('validationDate')
  if (/email address/i.test(field.message)) return i18n.t('invalidEmail')
  return i18n.t('invalidValue')
}
export async function get<T>(url: string, signal?: AbortSignal): Promise<T> {
  return (await api.get<T>(url, { signal })).data
}
export async function post<T>(url: string, body: unknown = {}): Promise<T> {
  return (await api.post<T>(url, body)).data
}
export async function patch<T>(url: string, body: unknown): Promise<T> {
  return (await api.patch<T>(url, body)).data
}
