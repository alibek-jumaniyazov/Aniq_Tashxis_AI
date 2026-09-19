// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import i18n, { normalizeLanguage } from './i18n'
import { errorText } from './api/client'
import { displayDate, displayTime } from './dates'
import { localizedPlan, localizedPaymentInstructions } from './commerceTypes'

afterEach(async () => {
  await i18n.changeLanguage('ru')
})

describe('language behavior', () => {
  it('normalizes supported language codes and safely rejects unsupported saved values', () => {
    expect(normalizeLanguage('en-US')).toBe('en')
    expect(normalizeLanguage('UZ-latn')).toBe('uz')
    expect(normalizeLanguage('de')).toBe('ru')
    expect(normalizeLanguage(null)).toBe('ru')
  })
  it.each(['ru', 'uz', 'en'])(
    'persists %s and updates document language and public language URL',
    async (language) => {
      await i18n.changeLanguage(language)
      expect(localStorage.getItem('aniq-language')).toBe(language)
      expect(document.documentElement.lang).toBe(language)
      expect(new URLSearchParams(window.location.search).get('lang')).toBe(
        language === 'ru' ? null : language,
      )
    },
  )
  it('formats all three languages in the Tashkent timezone without missing Uzbek month names', () => {
    const date = new Date('2026-09-18T23:30:00Z')
    expect(displayTime(date.toISOString(), 'en')).toContain('19 Sept')
    expect(displayTime(date.toISOString(), 'ru')).toContain('19 сент.')
    expect(displayTime(date.toISOString(), 'uz')).toBe('19-sen · 04:30')
    expect(displayDate(date, 'uz')).toBe('19-sentabr')
    expect(displayTime('not-a-date', 'en')).toBe('—')
  })
  it('localizes known catalog defaults while preserving custom clinic text', async () => {
    await i18n.changeLanguage('en')
    expect(
      localizedPlan({
        id: 'solo',
        name: 'Doctor',
        description: 'Bir shifokor uchun shaxsiy ish maydoni.',
      }).description,
    ).not.toContain('shifokor')
    const custom = {
      id: 'solo',
      name: 'Special clinic plan',
      description: 'Contract wording entered by an administrator.',
    }
    expect(localizedPlan(custom)).toEqual({ name: custom.name, description: custom.description })
    expect(localizedPaymentInstructions('Custom bank instructions')).toBe(
      'Custom bank instructions',
    )
  })
  it.each(['ru', 'uz', 'en'])(
    'translates API field validation and preserves constraints in %s',
    async (language) => {
      await i18n.changeLanguage(language)
      const result = errorText({
        isAxiosError: true,
        response: {
          status: 422,
          data: {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Please check input',
              details: {
                fields: [
                  {
                    field: 'body.age',
                    type: 'greater_than_equal',
                    message: 'Input should be greater than or equal to 18',
                  },
                  {
                    field: 'body.email',
                    type: 'value_error',
                    message: 'value is not a valid email address',
                  },
                ],
              },
            },
          },
        },
      })
      expect(result).toContain(i18n.t('field_age'))
      expect(result).toContain(i18n.t('validationMin', { value: '18' }))
      expect(result).toContain(i18n.t('invalidEmail'))
      expect(result).not.toContain('body.age')
      expect(result).not.toContain('Input should')
    },
  )
  it('uses a localized fallback for unknown server errors and keeps the diagnostic code', async () => {
    await i18n.changeLanguage('uz')
    const result = errorText({
      isAxiosError: true,
      response: {
        status: 500,
        data: {
          error: {
            code: 'UNRECOGNIZED_SERVER_ERROR',
            message: 'Untranslated internal server details',
          },
        },
      },
    })
    expect(result).toContain(i18n.t('requestFailed'))
    expect(result).toContain('UNRECOGNIZED_SERVER_ERROR')
    expect(result).not.toContain('Untranslated internal')
  })
})
