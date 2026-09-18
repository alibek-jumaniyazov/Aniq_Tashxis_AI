import io
import json
from types import SimpleNamespace

import httpx
import pytest
from PIL import Image

from app import ai, radiology
from app.config import settings
from test_integrity import dicom_zip
from test_radiology_workflow import upload_study
from test_workflows import mutate


def model_response(monkeypatch, output, captured):
    real_client = httpx.Client

    def respond(request):
        captured.append(json.loads(request.content))
        return httpx.Response(200, json={'choices': [{'finish_reason': 'stop', 'message': {'content': json.dumps(output)}}]})

    monkeypatch.setattr(settings, 'ai_backend', 'llama_cpp')
    monkeypatch.setattr(ai, 'model_status', lambda: {'ready': True, 'vision_ready': True})
    monkeypatch.setattr(radiology.httpx, 'Client', lambda **kwargs: real_client(transport=httpx.MockTransport(respond), **kwargs))


def sample_output(count=3):
    return {
        'observations': ['There is a graded geometric pattern in the supplied frames.'],
        'limitations': ['Only the listed frames were supplied; this is not patient anatomy.'],
        'frame_assessments': [{'frame_ref': f'F{i + 1}', 'quality': 'limited', 'observations': ['Visible intensity gradient.'], 'limitations': ['Synthetic image.']} for i in range(count)],
        'report_comparison': None,
    }


def test_sampling_keeps_chosen_frame_and_prioritizes_distinct_series():
    study = SimpleNamespace(data={'series': [{'id': f'S{i}', 'count': 100, 'modality': 'MR', 'window_center': 90, 'window_width': 200} for i in range(7)]})
    body = radiology.ImageAnalysisRequest(expected_version=1, series_id='S4', frame_index=78, analysis_scope='study_sample', center=50, width=350)
    frames = radiology.review_frames(study, body)
    assert len(frames) == 4
    assert [frame['series_id'] for frame in frames] == ['S4', 'S0', 'S1', 'S2']
    assert frames[0]['frame_index'] == 78 and frames[0]['center'] == 50
    assert frames[1]['frame_index'] == 49 and frames[1]['center'] == 90
    assert len({(frame['series_id'], frame['frame_index']) for frame in frames}) == 4


def test_single_series_sampling_spans_slices_without_duplicates():
    study = SimpleNamespace(data={'series': [{'id': 'S1', 'count': 100}]})
    body = radiology.ImageAnalysisRequest(expected_version=1, series_id='S1', frame_index=0, analysis_scope='study_sample')
    frames = radiology.review_frames(study, body)
    assert [frame['frame_index'] for frame in frames] == [0, 99, 50, 25]
    study.data['series'][0]['count'] = 1
    assert len(radiology.review_frames(study, body)) == 1


def test_batch_request_sends_real_images_and_publishes_exact_coverage(client, case, monkeypatch):
    study, body = upload_study(client, case)
    captured = []
    model_response(monkeypatch, sample_output(), captured)
    response = mutate(client, f'/imaging-studies/{study["id"]}/analyses', {**body, 'analysis_scope': 'study_sample', 'language': 'en'})
    assert response.status_code == 202, response.text
    run = client.get('/api/v1/analyses/' + response.json()['run_id']).json()
    assert run['mode'] == 'study_sample'
    result = run['result']
    assert result['language'] == 'en' and result['scope'] == 'sampled_frames_only'
    coverage = result['image_coverage']
    assert coverage['reviewed_frames'] == coverage['total_frames'] == 3
    assert coverage['reviewed_series'] == coverage['total_series'] == 1
    assert coverage['full_study_review'] is False
    assert len(result['image_review']['frame_assessments']) == 3
    assert len(captured) == 1  # One bounded model request, not four serial timeouts.
    content = captured[0]['messages'][1]['content']
    assert len([item for item in content if item['type'] == 'image_url']) == 3
    assert 'Write all prose in English' in captured[0]['messages'][0]['content']
    assert all(frame['image_quality']['input_size'] == [16, 16] for frame in coverage['frames'])
    schema = captured[0]['response_format']['schema']
    assert schema['properties']['frame_assessments']['minItems'] == schema['properties']['frame_assessments']['maxItems'] == 3
    frame_schema = schema['$defs']['FrameAssessment']['properties']
    assert frame_schema['frame_ref']['enum'] == ['F1', 'F2', 'F3']
    assert frame_schema['observations']['maxItems'] == 1
    assert frame_schema['observations']['items']['maxLength'] == 180


@pytest.mark.parametrize('invalid', ['missing_frame', 'unseen_comparison', 'unreadable_finding', 'unreadable_comparison'])
def test_batch_rejects_unsupported_frame_claims(client, case, monkeypatch, invalid):
    study, body = upload_study(client, case)
    output = sample_output()
    output['report_comparison'] = {'status': 'supported_on_reviewed_frames', 'explanation': 'The listed image has a gradient.', 'frame_refs': ['F1'], 'points_to_verify': ['Review every original image.']}
    if invalid == 'missing_frame':
        output['frame_assessments'].pop()
    elif invalid == 'unseen_comparison':
        output['report_comparison']['frame_refs'] = ['F4']
    else:
        output['frame_assessments'][0]['quality'] = 'unreadable'
        if invalid == 'unreadable_comparison':
            output['frame_assessments'][0]['observations'] = []
    model_response(monkeypatch, output, [])
    response = mutate(client, f'/imaging-studies/{study["id"]}/analyses', {**body, 'analysis_scope': 'study_sample', 'radiologist_report': 'Gradient visible.'})
    result = client.get('/api/v1/analyses/' + response.json()['run_id']).json()['result']
    assert result['image_review'] is None
    assert result['limitations'] == ['MODEL_OUTPUT_REJECTED']
    assert result['image_coverage']['reviewed_frames'] == 0


def test_uniform_images_never_produce_fake_normality(client, case, monkeypatch):
    response = client.post(f'/api/v1/cases/{case["id"]}/imaging-studies', headers={'Idempotency-Key': 'uniform-ct'}, data={'expected_version': case['version'], 'deidentified_confirmed': 'true'}, files={'file': ('uniform.zip', dicom_zip())})
    assert response.status_code == 201
    study = response.json()
    captured = []
    model_response(monkeypatch, sample_output(), captured)
    job = mutate(client, f'/imaging-studies/{study["id"]}/analyses', {'expected_version': case['version'] + 1, 'series_id': study['series'][0]['id'], 'frame_index': 0, 'analysis_scope': 'study_sample'})
    result = client.get('/api/v1/analyses/' + job.json()['run_id']).json()['result']
    assert result['image_review'] is None
    assert result['limitations'] == ['IMAGE_NO_VISIBLE_CONTENT']
    assert result['image_coverage']['reviewed_frames'] == 0
    assert not captured


def test_oversized_report_is_rejected_instead_of_silently_cut_off(client, case):
    study, body = upload_study(client, case)
    response = mutate(client, f'/imaging-studies/{study["id"]}/analyses', {**body, 'analysis_scope': 'study_sample', 'radiologist_report': 'x' * 1501})
    assert response.status_code == 422 and response.json()['error']['code'] == 'IMAGE_REPORT_TOO_LONG'
    invalid = mutate(client, f'/imaging-studies/{study["id"]}/analyses', {**body, 'analysis_scope': 'full_study'})
    assert invalid.status_code == 422


def test_model_input_resize_preserves_aspect_and_original_dimensions(monkeypatch):
    image = Image.new('RGB', (2048, 1024))
    image.putpixel((20, 20), (255, 255, 255))
    output = io.BytesIO()
    image.save(output, format='PNG')
    monkeypatch.setattr(radiology, 'render_frame', lambda *args: output.getvalue())
    png, quality = radiology.prepare_ai_frame(None, {'series_id': 's', 'frame_index': 0, 'center': 40, 'width': 400})
    assert Image.open(io.BytesIO(png)).size == (896, 448)
    assert quality == {'original_size': [2048, 1024], 'input_size': [896, 448], 'constant_image': False}
