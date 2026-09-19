import { expect, test } from 'vitest'
import { localDateInput } from './dates'
test('editing a date preserves the instant across timezone offsets', () => {
  const input = '2026-09-18T09:15:00+05:00'
  expect(new Date(localDateInput(input)).toISOString()).toBe(new Date(input).toISOString())
  expect(localDateInput(null)).toBe('')
})
