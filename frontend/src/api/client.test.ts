import { describe, expect, it } from 'vitest'
import { AxiosError } from 'axios'
import { errorText } from './client'
describe('API errors', () => {
  it('does not describe network failure as a clinical result', () => {
    expect(errorText(new AxiosError('offline', 'ERR_NETWORK'))).toContain('Нет связи')
  })
  it('preserves structured server error code', () => {
    const err = new AxiosError('conflict')
    Object.assign(err, { response: { data: { error: { code: 'CASE_VERSION_CONFLICT', message: 'Refresh case' } } } })
    expect(errorText(err)).toContain('CASE_VERSION_CONFLICT')
  })
})
