import xml.etree.ElementTree as ET

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app import seo
from app.config import ROOT


@pytest.fixture
def seo_client(monkeypatch):
    monkeypatch.setattr(
        seo,
        "seo_settings",
        seo.SeoSettings(
            _env_file=None, site_url="https://clinic.example.org", seo_indexing_enabled=True
        ),
    )
    app = FastAPI()
    app.include_router(seo.router)

    @app.middleware("http")
    async def headers(request, call_next):
        response = await call_next(request)
        seo.apply_indexing_headers(request, response)
        return response

    @app.get("/{path:path}")
    def frontend(path: str, request: Request):
        return seo.render_frontend(ROOT / "frontend" / "index.html", request)

    with TestClient(app) as client:
        yield client


@pytest.mark.parametrize(
    "language, title",
    [("ru", "AI-помощник"), ("uz", "shifokor uchun"), ("en", "Clinical AI Assistant")],
)
def test_public_html_has_localized_server_content_and_trusted_urls(seo_client, language, title):
    response = seo_client.get(
        f"/?lang={language}&patient=SECRET-PATIENT",
        headers={"host": "attacker.invalid", "x-forwarded-host": "attacker.invalid"},
    )
    assert response.status_code == 200
    assert f'<html lang="{language}"' in response.text
    assert title in response.text
    assert "<h1>" in response.text and "MedGemma" not in response.text
    assert {"ru": "внешний провайдер", "uz": "tashqi provayder", "en": "external provider"}[
        language
    ] in response.text
    assert "index, follow, max-image-preview:large" in response.text
    assert "attacker.invalid" not in response.text and "SECRET-PATIENT" not in response.text
    canonical = "https://clinic.example.org/" + (f"?lang={language}" if language != "ru" else "")
    assert f'<link rel="canonical" href="{canonical}">' in response.text
    assert response.text.count("hreflang=") == 4
    assert "application/ld+json" in response.text
    assert "X-Robots-Tag" not in response.headers


@pytest.mark.parametrize(
    "path",
    [
        "/login?next=/cases/SECRET-PATIENT",
        "/checkout?name=SECRET-PATIENT",
        "/cases/SECRET-PATIENT",
        "/cases/SECRET-PATIENT/imaging",
        "/settings/profile",
        "/developer",
        "/expert",
        "/reports",
        "/api/v1/cases",
        "/docs",
        "/openapi.json",
    ],
)
def test_private_routes_cannot_be_indexed_or_leak_patient_context(seo_client, path):
    response = seo_client.get(path)
    assert "noindex" in response.headers["X-Robots-Tag"]
    assert "nosnippet" in response.headers["X-Robots-Tag"]
    assert response.headers["Cache-Control"] == "no-store"
    assert "SECRET-PATIENT" not in response.text
    if path not in {"/docs", "/openapi.json"}:
        assert '<link rel="canonical"' not in response.text
        assert "application/ld+json" not in response.text
        assert 'property="og:' not in response.text


def test_sitemap_contains_only_real_public_language_urls(seo_client):
    response = seo_client.get("/sitemap.xml", headers={"host": "attacker.invalid"})
    assert response.status_code == 200
    root = ET.fromstring(response.text)
    urls = root.findall("{http://www.sitemaps.org/schemas/sitemap/0.9}url")
    locations = [
        item.find("{http://www.sitemaps.org/schemas/sitemap/0.9}loc").text for item in urls
    ]
    assert locations == [
        "https://clinic.example.org/",
        "https://clinic.example.org/?lang=uz",
        "https://clinic.example.org/?lang=en",
    ]
    assert "attacker.invalid" not in response.text
    robots = seo_client.get("/robots.txt").text
    assert "Sitemap: https://clinic.example.org/sitemap.xml" in robots
    assert "Disallow: /api/" in robots


def test_unconfigured_local_site_has_no_invented_canonical_or_sitemap(seo_client, monkeypatch):
    monkeypatch.setattr(
        seo, "seo_settings", seo.SeoSettings(_env_file=None, site_url="", seo_indexing_enabled=True)
    )
    response = seo_client.get("/")
    assert "noindex" in response.headers["X-Robots-Tag"]
    assert 'rel="canonical"' not in response.text
    assert "<loc>" not in seo_client.get("/sitemap.xml").text
    assert seo_client.get("/robots.txt").text == "User-agent: *\nDisallow: /\n"


@pytest.mark.parametrize(
    "origin",
    [
        "https://localhost",
        "https://127.0.0.1",
        "https://192.168.1.3",
        "https://staging.local",
        "https://clinic.test",
        "http://clinic.example.org",
    ],
)
def test_local_and_http_sites_remain_non_indexable(origin):
    assert not seo.SeoSettings(_env_file=None, site_url=origin, seo_indexing_enabled=True).indexable


@pytest.mark.parametrize(
    "origin",
    [
        "javascript:alert(1)",
        "https://name:secret@clinic.example.org",
        "https://clinic.example.org/path",
        "https://clinic.example.org?x=1",
        "https://clinic.example.org#part",
        "https://clinic.example.org\n<script>",
    ],
)
def test_invalid_public_origin_is_rejected(origin):
    with pytest.raises(ValidationError):
        seo.SeoSettings(_env_file=None, site_url=origin)
