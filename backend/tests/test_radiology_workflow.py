import io
import zipfile
import numpy as np
import pydicom
import pytest
import httpx
from PIL import Image
from sqlalchemy import select, update
from app import ai, radiology
from app.config import settings
from app.db import Audit, Job, Record, SessionLocal, now
from app.files import parse_dicom
from conftest import sign_in
from test_integrity import dicom_zip
from test_workflows import mutate


def image_data(modality, *, frames=1, spacing=True, color=False):
    archive = zipfile.ZipFile(io.BytesIO(dicom_zip((0,))))
    ds = pydicom.dcmread(io.BytesIO(archive.read(archive.namelist()[0])))
    ds.Modality = modality
    del ds.ImagePositionPatient
    del ds.ImageOrientationPatient
    if not spacing:
        del ds.PixelSpacing
    ds.NumberOfFrames = frames
    ds.InstanceNumber = 1
    ds.BitsAllocated, ds.BitsStored, ds.HighBit, ds.PixelRepresentation = 8, 8, 7, 0
    ds.RescaleIntercept = 0
    if color:
        ds.SamplesPerPixel, ds.PhotometricInterpretation, ds.PlanarConfiguration = 3, 'RGB', 0
        pixels = np.zeros((frames, 16, 16, 3), dtype=np.uint8)
        pixels[..., 0] = 200
    else:
        pixels = np.stack([np.arange(256, dtype=np.uint8).reshape(16, 16) if f == 0 else np.flipud(np.arange(256, dtype=np.uint8).reshape(16, 16)) for f in range(frames)])
    ds.PixelData = pixels.tobytes()
    out = io.BytesIO()
    ds.save_as(out, enforce_file_format=True)
    return out.getvalue()


@pytest.mark.parametrize('modality', ['MR', 'DX', 'CR', 'MG', 'US', 'PT', 'XA'])
def test_non_ct_images_load_without_fake_ct_geometry(client, case, modality):
    raw = image_data(modality, spacing=False)
    result = client.post(f'/api/v1/cases/{case["id"]}/imaging-studies', headers={'Idempotency-Key': 'modality-image'}, data={'expected_version': case['version'], 'deidentified_confirmed': 'true'}, files={'file': ('image.dcm', raw, 'application/dicom')})
    assert result.status_code == 201, result.text
    study = result.json()
    series = study['series'][0]
    assert series['modality'] == modality and series['spacing'] is None
    response = client.get(f'/api/v1/imaging-studies/{study["id"]}/series/{series["id"]}/frames/0')
    assert response.status_code == 200
    values = np.array(Image.open(io.BytesIO(response.content)))
    assert values.min() == 0 and values.max() == 255


def test_color_multiframe_image_keeps_channels_and_frame_navigation(client, case):
    raw = image_data('US', frames=3, color=True)
    result = client.post(f'/api/v1/cases/{case["id"]}/imaging-studies', headers={'Idempotency-Key': 'ultrasound'}, data={'expected_version': case['version'], 'deidentified_confirmed': 'true'}, files={'file': ('cine.dcm', raw)})
    assert result.status_code == 201, result.text
    study = result.json()
    series = study['series'][0]
    assert series['count'] == 3 and series['color']
    path=f'/api/v1/imaging-studies/{study["id"]}/series/{series["id"]}/frames/'
    pixels=np.array(Image.open(io.BytesIO(client.get(path+'2').content)))
    assert pixels[0,0].tolist() == [200,0,0]
    assert client.get(path+'3').status_code == 404


def test_measurement_uses_pixel_spacing_and_enforces_role_and_bounds(client, case):
    result = client.post(f'/api/v1/cases/{case["id"]}/imaging-studies', headers={'Idempotency-Key': 'measure-ct'}, data={'expected_version': case['version'], 'deidentified_confirmed': 'true'}, files={'file': ('phantom.zip', dicom_zip())})
    study=result.json()
    series=study['series'][0]
    body={'expected_version':case['version']+1,'series_id':series['id'],'frame_index':0,'points':[{'x':1,'y':1},{'x':4,'y':5}]}
    path=f'/imaging-studies/{study["id"]}/measurements'
    assert mutate(client,path,body).status_code == 403
    sign_in(client,'radiologist')
    saved=mutate(client,path,body,key='distance-345')
    assert saved.status_code == 201, saved.text
    assert saved.json()['distance_mm'] == 5
    assert mutate(client,path,body,key='distance-345').json()['id'] == saved.json()['id']
    assert mutate(client,path,{**body,'expected_version':1}).status_code == 409
    assert mutate(client,path,{**body,'points':[{'x':99,'y':0},{'x':1,'y':1}]}).status_code == 422


def test_non_image_dicom_has_actionable_error():
    with pytest.raises(Exception, match='not a supported pixel image'):
        parse_dicom(image_data('SR'))


def upload_study(client, case):
    # Image-review fixtures need actual contrast; uniform files deliberately
    # exercise the empty-image guard in test_radiology_sampling instead.
    archive = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(dicom_zip())) as original, zipfile.ZipFile(archive, 'w') as changed:
        for name in original.namelist():
            ds = pydicom.dcmread(io.BytesIO(original.read(name)))
            ds.PixelData = (np.arange(256, dtype=np.int16).reshape(16, 16) + 900).tobytes()
            output = io.BytesIO()
            ds.save_as(output, enforce_file_format=True)
            changed.writestr(name, output.getvalue())
    response = client.post(f'/api/v1/cases/{case["id"]}/imaging-studies', headers={'Idempotency-Key': 'image-job-study'}, data={'expected_version': case['version'], 'deidentified_confirmed': 'true'}, files={'file': ('phantom.zip', archive.getvalue())})
    assert response.status_code == 201, response.text
    study = response.json()
    return study, {'expected_version': case['version'] + 1, 'series_id': study['series'][0]['id'], 'frame_index': 0}


def test_radiology_cannot_publish_after_concurrent_cancel(client, case, monkeypatch):
    study, body = upload_study(client, case)
    original_access = radiology.access_case

    def cancel_before_publish(db, user, case_id):
        authorized = original_access(db, user, case_id)
        with SessionLocal() as other_db:
            other_db.execute(update(Job).where(Job.case_id == case_id, Job.status == 'running').values(status='cancelled', stage='cancelled', finished_at=now()))
            other_db.commit()
        return authorized

    monkeypatch.setattr(radiology, 'access_case', cancel_before_publish)
    response = mutate(client, f'/imaging-studies/{study["id"]}/analyses', body)
    assert response.status_code == 202, response.text
    job_id = response.json()['run_id']
    detail = client.get('/api/v1/analyses/' + job_id).json()
    assert detail['status'] == 'cancelled' and detail['result'] == {}
    with SessionLocal() as db:
        assert not list(db.scalars(select(Record).where(Record.case_id == case['id'], Record.kind == 'notification')))
        assert not list(db.scalars(select(Audit).where(Audit.resource_id == job_id, Audit.action == 'imaging.analysis_completed')))


def test_malformed_vision_response_is_visible_and_radiologist_can_retry(client, case, monkeypatch):
    study, body = upload_study(client, case)
    real_client = httpx.Client
    monkeypatch.setattr(settings, 'ai_backend', 'llama_cpp')
    monkeypatch.setattr(ai, 'model_status', lambda: {'ready': True, 'vision_ready': True})
    monkeypatch.setattr(radiology.httpx, 'Client', lambda **kw: real_client(transport=httpx.MockTransport(lambda request: httpx.Response(200, json={'choices': []})), **kw))
    sign_in(client, 'radiologist')
    response = mutate(client, f'/imaging-studies/{study["id"]}/analyses', body)
    assert response.status_code == 202, response.text
    job_id = response.json()['run_id']
    detail = client.get('/api/v1/analyses/' + job_id).json()
    assert detail['status'] == 'partial'
    assert detail['result']['image_review'] is None
    assert detail['result']['limitations'] == ['MODEL_OUTPUT_REJECTED']
    retried = mutate(client, f'/analyses/{job_id}/retry', {'expected_version': body['expected_version']})
    assert retried.status_code == 202, retried.text
    assert retried.json()['run_id'] != job_id
    retry_detail = client.get('/api/v1/analyses/' + retried.json()['run_id']).json()
    assert retry_detail['kind'] == 'imaging' and retry_detail['result']['study_id'] == study['id']


def test_radiologist_cannot_retry_a_clinical_text_review(client, case):
    queued = mutate(client, f'/cases/{case["id"]}/analyses', {'expected_version': case['version'], 'include_ai': False})
    assert queued.status_code == 202
    sign_in(client, 'radiologist')
    response = mutate(client, '/analyses/' + queued.json()['run_id'] + '/retry', {'expected_version': case['version']})
    assert response.status_code == 403 and response.json()['error']['code'] == 'ROLE_FORBIDDEN'
