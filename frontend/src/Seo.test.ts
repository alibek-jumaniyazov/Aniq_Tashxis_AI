// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { updateMetadata } from './Seo'
import content from './seoContent.json'
import { landingUz, landingRu, landingEn } from './landingTranslations'

const configured = { origin: 'https://clinic.example.org', indexing: true }
afterEach(() => { document.head.innerHTML = ''; document.body.innerHTML = '' })

describe('public discovery and private clinical metadata', () => {
  it('public copy stays provider-neutral and discloses external cloud processing in all languages', () => {
    const translations = { ru: landingRu, uz: landingUz, en: landingEn }
    for (const language of ['ru', 'uz', 'en'] as const) {
      const copy = translations[language]
      expect(JSON.stringify(copy)).not.toMatch(/MedGemma|\b4B\b|локальная модель AI|Lokal AI modeli|Local AI model/i)
      expect(JSON.stringify(content[language])).not.toMatch(/MedGemma|\b4B\b|local-only/i)
      expect(copy.landingProcessingNotice).toMatch({ ru: /внешний провайдер/, uz: /tashqi provayder/, en: /external provider/ }[language])
      expect(content[language].limitation).toMatch({ ru: /внешний провайдер/, uz: /tashqi provayder/, en: /external provider/ }[language])
    }
  })
  it.each(['ru', 'uz', 'en'] as const)('publishes stable %s landing URLs and translated metadata', language => {
    updateMetadata('/', language, configured)
    expect(document.documentElement.lang).toBe(language)
    expect(document.title).toContain('AniqTashxis.ai')
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain('index, follow')
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`https://clinic.example.org/${language === 'ru' ? '' : `?lang=${language}`}`)
    expect(document.querySelectorAll('link[hreflang]')).toHaveLength(4)
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe('https://clinic.example.org/brand/aniqtashxis-social.png')
    expect(JSON.parse(document.querySelector('#seo-structured-data')!.textContent!)['@graph']).toHaveLength(3)
  })
  it.each(['/cases/patient-secret-id', '/cases/patient-secret-id/imaging', '/settings/profile', '/login', '/checkout', '/expert', '/reports', '/developer'])('clears public cards and never publishes private data on %s', path => {
    updateMetadata('/', 'en', configured)
    updateMetadata(path, 'en', configured)
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain('noindex, nofollow, nosnippet')
    expect(document.querySelector('link[rel="canonical"], link[hreflang], meta[property^="og:"], meta[name^="twitter:"], #seo-structured-data')).toBeNull()
    expect(document.head.innerHTML).not.toContain('patient-secret-id')
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Secure clinical workspace')
  })
  it('keeps unconfigured and malformed deployments non-indexable without inventing a domain', () => {
    const config = document.createElement('script')
    config.id = 'seo-config'
    config.type = 'application/json'
    config.textContent = '{"origin":"javascript:alert(1)","indexing":true}'
    document.head.append(config)
    updateMetadata('/', 'uz')
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain('noindex')
    expect(document.querySelector('link[rel="canonical"]')).toBeNull()
    expect(document.querySelector('meta[property="og:url"]')).toBeNull()
  })
})
