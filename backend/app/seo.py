"""Public metadata is generated from configured URLs, never a request Host or patient data."""
import json
import re
from html import escape
from ipaddress import ip_address
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, PlainTextResponse, Response
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from .config import ROOT

LANGUAGES = ('ru', 'uz', 'en')
PRIVATE_ROBOTS = 'noindex, nofollow, nosnippet, noarchive'
PUBLIC_ROBOTS = 'index, follow, max-image-preview:large'
CONTENT_PATH = ROOT / 'frontend' / 'src' / 'seoContent.json'
if not CONTENT_PATH.is_file():
    CONTENT_PATH = ROOT / 'frontend' / 'dist' / 'seo-content.json'
CONTENT = json.loads(CONTENT_PATH.read_text(encoding='utf-8'))


class SeoSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / '.env', extra='ignore')
    site_url: str = ''
    seo_indexing_enabled: bool = False

    @field_validator('site_url')
    @classmethod
    def validate_site_url(cls, value: str) -> str:
        value = value.strip().rstrip('/')
        if not value:
            return ''
        parsed = urlsplit(value)
        if (parsed.scheme not in {'http', 'https'} or not parsed.hostname or parsed.username or parsed.password
                or parsed.query or parsed.fragment or parsed.path or any(char in value for char in '<>"\r\n\t ')):
            raise ValueError('SITE_URL must be an absolute HTTP(S) origin without credentials, path, query or fragment.')
        try:
            parsed.port
        except ValueError as error:
            raise ValueError('SITE_URL contains an invalid port.') from error
        return value

    @property
    def indexable(self) -> bool:
        parsed = urlsplit(self.site_url)
        host = parsed.hostname or ''
        if not self.seo_indexing_enabled or parsed.scheme != 'https' or not host or host in {'localhost', 'testserver'} or host.endswith(('.localhost', '.local', '.test', '.invalid', '.example')):
            return False
        try:
            return ip_address(host).is_global
        except ValueError:
            return '.' in host


seo_settings = SeoSettings()
router = APIRouter()


def language_for(request: Request) -> str:
    value = request.query_params.get('lang', 'ru')
    return value if value in LANGUAGES else 'ru'


def public_url(language: str) -> str:
    return f'{seo_settings.site_url}/' + (f'?lang={language}' if language != 'ru' else '')


def structured_data(language: str) -> dict:
    origin = seo_settings.site_url
    return {'@context': 'https://schema.org', '@graph': [
        {'@type': 'Organization', '@id': f'{origin}/#organization', 'name': 'AniqTashxis.ai', 'url': f'{origin}/',
         'logo': f'{origin}/brand/aniqtashxis-mark.svg', 'sameAs': ['https://t.me/avilab_uz_support']},
        {'@type': 'WebSite', '@id': f'{origin}/#website', 'url': f'{origin}/', 'name': 'AniqTashxis.ai',
         'inLanguage': list(LANGUAGES), 'publisher': {'@id': f'{origin}/#organization'}},
        {'@type': 'SoftwareApplication', 'name': 'AniqTashxis.ai', 'applicationCategory': 'HealthApplication',
         'operatingSystem': 'Web', 'url': public_url(language), 'description': CONTENT[language]['description'],
         'inLanguage': language, 'publisher': {'@id': f'{origin}/#organization'}}]}


def json_script(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')


def page_metadata(request: Request) -> str:
    language = language_for(request)
    copy = CONTENT[language]
    public = request.url.path == '/'
    segment = request.url.path.strip('/').split('/')[0]
    title = copy['title'] if public else f"{copy['routes'].get(segment, copy['routes']['workspace'])} · AniqTashxis.ai"
    description = copy['description'] if public else copy['private']
    robots = PUBLIC_ROBOTS if public and seo_settings.indexable else PRIVATE_ROBOTS
    lines = [f'<title>{escape(title)}</title>', f'<meta name="description" content="{escape(description, quote=True)}">',
             f'<meta name="robots" content="{robots}">', '<meta name="theme-color" content="#087f83">',
             '<link rel="icon" type="image/svg+xml" href="/brand/aniqtashxis-mark.svg">',
             '<script id="seo-config" type="application/json">' + json_script({'origin': seo_settings.site_url, 'indexing': seo_settings.indexable}) + '</script>']
    if public:
        for name, value in {'og:type': 'website', 'og:site_name': 'AniqTashxis.ai', 'og:title': title, 'og:description': description,
                            'og:locale': {'ru': 'ru_RU', 'uz': 'uz_UZ', 'en': 'en_US'}[language]}.items():
            lines.append(f'<meta property="{name}" content="{escape(value, quote=True)}">')
        lines.extend(['<meta name="twitter:card" content="summary_large_image">',
                      f'<meta name="twitter:title" content="{escape(title, quote=True)}">',
                      f'<meta name="twitter:description" content="{escape(description, quote=True)}">'])
        if seo_settings.site_url:
            url = escape(public_url(language), quote=True)
            image = escape(f'{seo_settings.site_url}/brand/aniqtashxis-social.png', quote=True)
            lines.extend([f'<link rel="canonical" href="{url}">', f'<meta property="og:url" content="{url}">',
                          f'<meta property="og:image" content="{image}">', '<meta property="og:image:width" content="1200">',
                          '<meta property="og:image:height" content="630">', '<meta property="og:image:alt" content="AniqTashxis.ai">',
                          f'<meta name="twitter:image" content="{image}">', '<meta name="twitter:image:alt" content="AniqTashxis.ai">'])
            for code in (*LANGUAGES, 'x-default'):
                href = escape(public_url('ru' if code == 'x-default' else code), quote=True)
                lines.append(f'<link rel="alternate" hreflang="{code}" href="{href}">')
            lines.append('<script id="seo-structured-data" type="application/ld+json">' + json_script(structured_data(language)) + '</script>')
    return '\n'.join(lines)


def fallback_content(request: Request) -> str:
    language = language_for(request)
    copy = CONTENT[language]
    if request.url.path != '/':
        return f'<noscript><p>{escape(copy["private"])}</p><p>{escape(copy["enableScript"])}</p></noscript>'
    features = ''.join(f'<li>{escape(value)}</li>' for value in copy['features'])
    languages = ' · '.join(f'<a lang="{code}" href="/{"?lang=" + code if code != "ru" else ""}">{label}</a>'
                           for code, label in [('ru', 'Русский'), ('uz', 'O‘zbekcha'), ('en', 'English')])
    return (f'<main class="public-fallback"><header><img src="/brand/aniqtashxis-mark.svg" width="64" height="64" alt="">'
            f'<strong>AniqTashxis.ai</strong><nav aria-label="Language">{languages}</nav></header>'
            f'<h1>{escape(copy["heading"])}</h1><p>{escape(copy["intro"])}</p><ul>{features}</ul>'
            f'<p>{escape(copy["limitation"])}</p><h2>{escape(copy["pricing"])}</h2><p>{escape(copy["plans"])}</p>'
            f'<p><a href="/login">{escape(copy["open"])}</a> · '
            f'<a href="https://t.me/avilab_uz_support" rel="noopener noreferrer">{escape(copy["support"])}</a></p></main>')


def render_frontend(index_path: Path, request: Request) -> HTMLResponse:
    html = index_path.read_text(encoding='utf-8')
    html = re.sub(r'<!-- SEO:START -->.*?<!-- SEO:END -->', lambda _: '<!-- SEO:START -->\n' + page_metadata(request) + '\n<!-- SEO:END -->', html, flags=re.S)
    html = re.sub(r'<html\s+lang="[^"]*"', f'<html lang="{language_for(request)}"', html, count=1)
    html = re.sub(r'<!-- FALLBACK:START -->.*?<!-- FALLBACK:END -->', lambda _: '<!-- FALLBACK:START -->' + fallback_content(request) + '<!-- FALLBACK:END -->', html, flags=re.S)
    headers = {'Cache-Control': 'public, max-age=300' if request.url.path == '/' else 'no-store'}
    response = HTMLResponse(html, headers=headers)
    apply_indexing_headers(request, response)
    return response


def apply_indexing_headers(request: Request, response: Response) -> None:
    path = request.url.path
    public_asset = path.startswith(('/assets/', '/brand/')) or path in {'/mark.svg', '/robots.txt', '/sitemap.xml', '/site.webmanifest', '/seo-content.json'}
    if not seo_settings.indexable or (path != '/' and not public_asset) or response.status_code >= 400:
        response.headers['X-Robots-Tag'] = PRIVATE_ROBOTS
    if path.startswith(('/api/', '/docs', '/redoc', '/openapi.json')):
        response.headers['Cache-Control'] = 'no-store'


@router.get('/robots.txt', include_in_schema=False)
def robots() -> PlainTextResponse:
    if not seo_settings.indexable:
        return PlainTextResponse('User-agent: *\nDisallow: /\n', headers={'Cache-Control': 'public, max-age=300'})
    # Private HTML remains crawlable so crawlers can see its noindex header; auth protects data.
    return PlainTextResponse(f'User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: {seo_settings.site_url}/sitemap.xml\n',
                             headers={'Cache-Control': 'public, max-age=300'})


@router.get('/sitemap.xml', include_in_schema=False)
def sitemap() -> Response:
    entries = []
    if seo_settings.indexable:
        alternatives = ''.join(f'<xhtml:link rel="alternate" hreflang="{code}" href="{escape(public_url("ru" if code == "x-default" else code), quote=True)}"/>'
                               for code in (*LANGUAGES, 'x-default'))
        entries = [f'<url><loc>{escape(public_url(language))}</loc>{alternatives}</url>' for language in LANGUAGES]
    body = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' + ''.join(entries) + '</urlset>'
    return Response(body, media_type='application/xml', headers={'Cache-Control': 'public, max-age=300'})
