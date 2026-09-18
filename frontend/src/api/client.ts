import axios from 'axios'
import i18n from 'i18next'

let csrf = ''
export const setCsrf = (value: string) => { csrf = value }
export const api = axios.create({ baseURL: '/api/v1', withCredentials: true, timeout: 25000 })
api.interceptors.response.use(response => response, error => {
  if (error.response?.status === 401 && !error.config?.url?.startsWith('/auth/')) window.dispatchEvent(new Event('aniq:session-expired'))
  return Promise.reject(error)
})
api.interceptors.request.use(config => {
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
      const text = i18n.exists(payload.code) ? i18n.t(payload.code) : `${payload.message} (${payload.code})`
      const fields = payload.details?.fields as { field: string; message: string }[] | undefined
      return fields?.length ? `${text} ${fields.map(field => field.field.replace(/^body\./, '') + ': ' + field.message).join('; ')}` : text
    }
    return error.code === 'ERR_NETWORK' ? i18n.t('networkError') : error.code === 'ECONNABORTED' ? i18n.t('requestTimeout') : error.message
  }
  return error instanceof Error ? error.message : 'Request failed'
}
export async function get<T>(url: string, signal?: AbortSignal): Promise<T> { return (await api.get<T>(url, { signal })).data }
export async function post<T>(url: string, body: unknown = {}): Promise<T> { return (await api.post<T>(url, body)).data }
export async function patch<T>(url: string, body: unknown): Promise<T> { return (await api.patch<T>(url, body)).data }
