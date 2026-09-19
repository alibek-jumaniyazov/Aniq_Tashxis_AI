export const supportedLanguages = ['ru', 'uz', 'en'] as const
export type LanguageCode = (typeof supportedLanguages)[number]
export function normalizeLanguage(value: string | null | undefined): LanguageCode {
  const code = value?.trim().toLowerCase().replaceAll('_', '-').split('-')[0]
  return supportedLanguages.includes(code as LanguageCode) ? (code as LanguageCode) : 'ru'
}
