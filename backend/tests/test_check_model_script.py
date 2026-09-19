"""CLI behavior with a fake provider: no key, network, or live database required."""

import json
from pathlib import Path
import runpy
import sys
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app import ai


SCRIPT = Path(__file__).resolve().parents[2] / 'scripts' / 'check_model.py'


@pytest.fixture
def provider(monkeypatch):
    status = Mock(return_value={
        'ready': True, 'provider': 'openai', 'backend': 'openai_api',
        'model_id': 'synthetic-test-model', 'data_processing': 'openai_cloud',
    })
    review = Mock(return_value={'summary': 'Synthetic engineering response.'})
    extraction = Mock(return_value=[SimpleNamespace(model_dump=lambda: {'key': 'vital.pulse', 'value': '70'})])
    monkeypatch.setattr(ai, 'model_status', status)
    monkeypatch.setattr(ai, 'review', review)
    monkeypatch.setattr(ai, 'extract_document', extraction)
    # The script adds backend to sys.path; isolate that process-level edit too.
    monkeypatch.setattr(sys, 'path', list(sys.path))
    return SimpleNamespace(status=status, review=review, extraction=extraction)


def invoke(monkeypatch, *args):
    monkeypatch.setattr(sys, 'argv', [str(SCRIPT), *map(str, args)])
    return runpy.run_path(str(SCRIPT), run_name='__main__')


@pytest.mark.parametrize('language', ['ru', 'uz', 'en'])
def test_smoke_forwards_language_and_reports_actual_provider(monkeypatch, provider, tmp_path, capsys, language):
    output = tmp_path / 'reports' / 'smoke.json'
    invoke(monkeypatch, '--language', language, '--extract', '--output', output)
    snapshot = provider.review.call_args.args[0]
    assert snapshot['language'] == language
    assert snapshot['demo'] is True
    assert snapshot['facts'][0]['source_id'] == 'smoke-source'
    # Extraction preserves source language; its API does not accept a locale.
    provider.extraction.assert_called_once_with([
        {'page': 1, 'text': 'Synthetic engineering record. Pulse: 70 /min. SpO2: 97%.'},
    ])
    report = json.loads(output.read_text(encoding='utf-8'))
    assert report['language'] == language
    assert report['synthetic_only'] is True
    assert report['clinical_validation'] == 'not_performed'
    assert report['model']['provider'] == 'openai'
    printed = capsys.readouterr().out
    assert 'Provider: openai; model: synthetic-test-model;' in printed
    assert 'REAL LOCAL INFERENCE' not in printed


@pytest.mark.parametrize('ready,exit_code', [(True, 0), (False, 1)])
def test_status_only_skips_inference_and_uses_readiness_exit_code(monkeypatch, provider, tmp_path, ready, exit_code):
    provider.status.return_value['ready'] = ready
    output = tmp_path / 'status.json'
    with pytest.raises(SystemExit) as result:
        invoke(monkeypatch, '--status-only', '--output', output)
    assert result.value.code == exit_code
    provider.review.assert_not_called()
    provider.extraction.assert_not_called()
    report = json.loads(output.read_text(encoding='utf-8'))
    assert report['language'] == 'uz'
    assert 'review' not in report
    assert report['model']['ready'] == ready


def test_status_only_rejects_generation_option_before_contacting_provider(monkeypatch, provider):
    with pytest.raises(SystemExit) as result:
        invoke(monkeypatch, '--status-only', '--extract')
    assert result.value.code == 2
    provider.status.assert_not_called()
    provider.review.assert_not_called()


def test_empty_extraction_does_not_report_success(monkeypatch, provider, capsys):
    provider.extraction.return_value = []
    with pytest.raises(SystemExit, match='extraction returned no facts'):
        invoke(monkeypatch, '--extract')
    assert provider.review.call_args.args[0]['language'] == 'uz'
    assert 'REAL INFERENCE PASSED' not in capsys.readouterr().out
