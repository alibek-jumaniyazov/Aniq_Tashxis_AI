import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { workflowRu, workflowUz, workflowEn } from './workflowTranslations'
import { notificationRu, notificationUz, notificationEn } from './notificationTranslations'
import { workspaceRu, workspaceUz, workspaceEn } from './workspaceTranslations'
import { aiAnalysisRu, aiAnalysisUz, aiAnalysisEn } from './aiAnalysisTranslations'
import { workflowPolishRu, workflowPolishUz, workflowPolishEn } from './workflowPolishTranslations'
import { baseRu, baseUz } from './baseTranslations'
import { interfaceRu, interfaceUz, interfaceEn } from './interfaceTranslations'
import { clinicalLocaleRu, clinicalLocaleUz, clinicalLocaleEn } from './clinicalLocaleTranslations'
import { commerceRu, commerceUz, commerceEn } from './commerceTranslations'
import { landingRu, landingUz, landingEn } from './landingTranslations'
import { errorRu, errorUz, errorEn } from './errorTranslations'
import { baseEn } from './baseEnglish'
import { patientRu, patientUz, patientEn } from './patientTranslations'
import { patientNavRu, patientNavUz, patientNavEn } from './patientNavigationTranslations'
import {
  patientWorkspaceRu,
  patientWorkspaceUz,
  patientWorkspaceEn,
} from './patientWorkspaceTranslations'
import { settingsRu, settingsUz, settingsEn } from './settingsTranslations'
import { analysisLocaleRu, analysisLocaleUz, analysisLocaleEn } from './analysisLocaleTranslations'
import { aiProviderRu, aiProviderUz, aiProviderEn } from './aiProviderTranslations'

import { supportedLanguages, normalizeLanguage, type LanguageCode } from './localeCodes'
export { supportedLanguages, normalizeLanguage, type LanguageCode } from './localeCodes'

export const translations = {
  ru: {
    ...workflowRu,
    ...notificationRu,
    ...workspaceRu,
    ...aiAnalysisRu,
    ...workflowPolishRu,
    ...baseRu,
    ...interfaceRu,
    ...clinicalLocaleRu,
    ...commerceRu,
    ...landingRu,
    ...errorRu,
    ...patientRu,
    ...patientNavRu,
    ...patientWorkspaceRu,
    ...settingsRu,
    ...analysisLocaleRu,
    ...aiProviderRu,
  },
  uz: {
    ...workflowUz,
    ...notificationUz,
    ...workspaceUz,
    ...aiAnalysisUz,
    ...workflowPolishUz,
    ...baseUz,
    ...interfaceUz,
    ...clinicalLocaleUz,
    ...commerceUz,
    ...landingUz,
    ...errorUz,
    ...patientUz,
    ...patientNavUz,
    ...patientWorkspaceUz,
    ...settingsUz,
    ...analysisLocaleUz,
    ...aiProviderUz,
  },
  en: {
    ...workflowEn,
    ...notificationEn,
    ...workspaceEn,
    ...aiAnalysisEn,
    ...workflowPolishEn,
    ...baseEn,
    ...interfaceEn,
    ...clinicalLocaleEn,
    ...commerceEn,
    ...landingEn,
    ...errorEn,
    ...patientEn,
    ...patientNavEn,
    ...patientWorkspaceEn,
    ...settingsEn,
    ...analysisLocaleEn,
    ...aiProviderEn,
  },
}
function storedLanguage() {
  const requested = new URLSearchParams(window.location.search).get('lang')
  if (window.location.pathname === '/' && supportedLanguages.includes(requested as LanguageCode))
    return requested as LanguageCode
  try {
    return normalizeLanguage(localStorage.getItem('aniq-language'))
  } catch {
    return 'ru'
  }
}
function applyLanguage(value: string) {
  const language = normalizeLanguage(value)
  document.documentElement.lang = language
  if (window.location.pathname === '/') {
    const url = new URL(window.location.href)
    if (language === 'ru') url.searchParams.delete('lang')
    else url.searchParams.set('lang', language)
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  }
  try {
    localStorage.setItem('aniq-language', language)
  } catch {
    /* Storage may be unavailable in private mode. */
  }
}
i18n.on('languageChanged', applyLanguage)
void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(
    supportedLanguages.map((language) => [language, { translation: translations[language] }]),
  ),
  lng: storedLanguage(),
  supportedLngs: [...supportedLanguages],
  load: 'languageOnly',
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
  returnEmptyString: false,
})
export default i18n
