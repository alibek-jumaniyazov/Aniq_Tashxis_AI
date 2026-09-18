import { beforeAll, describe, expect, it } from 'vitest'
import i18next from 'i18next'
import { commerceEn, commerceRu, commerceUz } from './commerceTranslations'
import { formatMoney, localizedPaymentInstructions, localizedPlan, localizedPlanName } from './commerceTypes'

beforeAll(async () => {
  await i18next.init({ resources: { ru: { translation: commerceRu }, uz: { translation: commerceUz }, en: { translation: commerceEn } }, lng: 'ru', fallbackLng: 'ru', interpolation: { escapeValue: false } })
})

describe('billing localization without changing customer content', () => {
  const defaults = { id: 'clinic10', name: 'Clinic 10', description: '10 shifokorgacha klinika jamoasi uchun.' }

  it.each([['ru', 'Клиника 10'], ['uz', 'Klinika 10'], ['en', 'Clinic 10']])('localizes an unchanged default plan in %s', (language, name) => {
    expect(localizedPlan(defaults, language).name).toBe(name)
    expect(localizedPlan(defaults, language).description).toBe(i18next.t('commercePlanClinic10Description', { lng: language }))
  })

  it('preserves administrator-authored fields independently and never translates unrelated plans', () => {
    expect(localizedPlan({ ...defaults, name: 'Shifo premium' }, 'en')).toEqual({ name: 'Shifo premium', description: commerceEn.commercePlanClinic10Description })
    expect(localizedPlan({ ...defaults, description: 'Individual kelishuv: 12 o‘rin.' }, 'ru')).toEqual({ name: 'Клиника 10', description: 'Individual kelishuv: 12 o‘rin.' })
    expect(localizedPlan({ ...defaults, id: 'custom-clinic' }, 'ru')).toEqual({ name: defaults.name, description: defaults.description })
    expect(localizedPlanName('Clinic 10', undefined, 'ru')).toBe('Clinic 10')
  })

  it('translates shipped payment instructions but keeps custom instructions intact', () => {
    expect(localizedPaymentInstructions(commerceUz.commerceDefaultPaymentInstructions, 'en')).toBe(commerceEn.commerceDefaultPaymentInstructions)
    expect(localizedPaymentInstructions('Call our accountant before paying.', 'uz')).toBe('Call our accountant before paying.')
  })

  it('formats money and doctor counts in the selected language', async () => {
    await i18next.changeLanguage('en')
    expect(formatMoney(1390000)).toBe('1,390,000 UZS')
    expect(i18next.t('commerceDoctorsCount', { count: 1 })).toBe('1 doctor')
    expect(i18next.t('commerceDoctorsCount', { count: 10 })).toBe('10 doctors')
    await i18next.changeLanguage('ru')
    expect(i18next.t('commerceDoctorsCount', { count: 1 })).toBe('1 врач')
    expect(i18next.t('commerceDoctorsCount', { count: 2 })).toBe('2 врача')
    expect(i18next.t('commerceDoctorsCount', { count: 25 })).toBe('25 врачей')
    expect(formatMoney(null)).toBe('Индивидуальный расчёт')
  })
})
