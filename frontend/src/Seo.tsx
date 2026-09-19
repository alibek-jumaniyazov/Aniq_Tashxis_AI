import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import content from './seoContent.json'

type Language = keyof typeof content
type SeoConfig = { origin: string; indexing: boolean }
const languages: Language[] = ['ru', 'uz', 'en']

function configuration(): SeoConfig {
  try {
    const parsed = JSON.parse(
      document.getElementById('seo-config')?.textContent || '{}',
    ) as Partial<SeoConfig>
    if (!parsed.origin) return { origin: '', indexing: false }
    const url = new URL(parsed.origin)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      return { origin: '', indexing: false }
    return { origin: url.origin, indexing: parsed.indexing === true }
  } catch {
    return { origin: '', indexing: false }
  }
}

function meta(attribute: 'name' | 'property', name: string, value: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, name)
    document.head.append(element)
  }
  element.content = value
}

function clearPublicMetadata() {
  document.head
    .querySelectorAll(
      'link[rel="canonical"], link[hreflang], meta[property^="og:"], meta[name^="twitter:"], #seo-structured-data',
    )
    .forEach((element) => element.remove())
}

function link(rel: string, href: string, language?: string) {
  const element = document.createElement('link')
  element.rel = rel
  element.href = href
  if (language) element.hreflang = language
  document.head.append(element)
}

/** Only fixed route labels reach metadata. Patient names, IDs, queries and records never do. */
export function updateMetadata(
  path: string,
  language: Language,
  config: SeoConfig = configuration(),
) {
  const copy = content[language]
  const publicPage = path === '/'
  const segment = path.split('/')[1] as keyof typeof copy.routes
  const routeLabel = Object.hasOwn(copy.routes, segment)
    ? copy.routes[segment]
    : copy.routes.workspace
  document.documentElement.lang = language
  document.title = publicPage ? copy.title : `${routeLabel} · AniqTashxis.ai`
  meta('name', 'description', publicPage ? copy.description : copy.private)
  meta(
    'name',
    'robots',
    publicPage && config.indexing
      ? 'index, follow, max-image-preview:large'
      : 'noindex, nofollow, nosnippet, noarchive',
  )
  clearPublicMetadata()
  if (!publicPage) return
  const urlFor = (code: Language) => `${config.origin}/${code === 'ru' ? '' : `?lang=${code}`}`
  meta('property', 'og:type', 'website')
  meta('property', 'og:site_name', 'AniqTashxis.ai')
  meta('property', 'og:locale', { ru: 'ru_RU', uz: 'uz_UZ', en: 'en_US' }[language])
  meta('property', 'og:title', copy.title)
  meta('property', 'og:description', copy.description)
  meta('name', 'twitter:card', 'summary_large_image')
  meta('name', 'twitter:title', copy.title)
  meta('name', 'twitter:description', copy.description)
  if (!config.origin) return
  const image = `${config.origin}/brand/aniqtashxis-social.png`
  meta('property', 'og:url', urlFor(language))
  meta('property', 'og:image', image)
  meta('property', 'og:image:width', '1200')
  meta('property', 'og:image:height', '630')
  meta('property', 'og:image:alt', 'AniqTashxis.ai')
  meta('name', 'twitter:image', image)
  meta('name', 'twitter:image:alt', 'AniqTashxis.ai')
  link('canonical', urlFor(language))
  languages.forEach((code) => link('alternate', urlFor(code), code))
  link('alternate', urlFor('ru'), 'x-default')
  const structured = document.createElement('script')
  structured.id = 'seo-structured-data'
  structured.type = 'application/ld+json'
  structured.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${config.origin}/#organization`,
        name: 'AniqTashxis.ai',
        url: `${config.origin}/`,
        logo: `${config.origin}/brand/aniqtashxis-mark.svg`,
        sameAs: ['https://t.me/avilab_uz_support'],
      },
      {
        '@type': 'WebSite',
        '@id': `${config.origin}/#website`,
        name: 'AniqTashxis.ai',
        url: `${config.origin}/`,
        inLanguage: languages,
        publisher: { '@id': `${config.origin}/#organization` },
      },
      {
        '@type': 'SoftwareApplication',
        name: 'AniqTashxis.ai',
        applicationCategory: 'HealthApplication',
        operatingSystem: 'Web',
        url: urlFor(language),
        description: copy.description,
        inLanguage: language,
        publisher: { '@id': `${config.origin}/#organization` },
      },
    ],
  })
  document.head.append(structured)
}

export default function Seo() {
  const { pathname, search } = useLocation()
  const { i18n } = useTranslation()
  const language = (
    languages.includes(i18n.resolvedLanguage as Language) ? i18n.resolvedLanguage : 'ru'
  ) as Language
  useEffect(() => {
    updateMetadata(pathname, language)
  }, [pathname, language, search])
  return null
}
