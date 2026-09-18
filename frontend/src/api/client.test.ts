// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { AxiosError } from 'axios'
import i18n from '../i18n'
import { errorText } from './client'
describe('API errors', () => {
  it('does not describe network failure as a clinical result', () => {
    expect(errorText(new AxiosError('offline', 'ERR_NETWORK'))).toContain('Нет связи')
  })
  it('preserves structured server error code', () => {
    const err = new AxiosError('conflict')
    Object.assign(err, { response: { data: { error: { code: 'UNRECOGNIZED_CONFLICT', message: 'Refresh case' } } } })
    expect(errorText(err)).toBe(`${i18n.t('requestFailed')} (UNRECOGNIZED_CONFLICT)`)
  })
})
