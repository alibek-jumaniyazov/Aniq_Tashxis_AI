import hashlib
import io
from pathlib import Path
from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import FileResponse, Response
from starlette.concurrency import run_in_threadpool
from sqlalchemy.orm import Session as DBSession
from .config import settings
from .db import Record, User, get_db, uid
from sqlalchemy import select
from . import ai
from .documents import extract_fixture_facts, extract_in_process, safe_zip
from .routes import source_public
from .schemas import ImagingReview, VersionBody
from .security import ApiError, access_case, access_record, audit, bump_case, cached_idempotent, create_record, current_user, idem_key, idempotent, require_role, serialize

router = APIRouter(prefix='/api/v1')


def protected_path(relative):
    root = settings.storage_root.resolve()
    target = (root / relative).resolve()
    if not target.is_relative_to(root):
        raise ApiError(404, 'FILE_NOT_FOUND', 'File not available.')
    return target


async def read_limited(file, limit):
    content = bytearray()
    while chunk := await file.read(1024 * 1024):
        content.extend(chunk)
        if len(content) > limit:
            raise ApiError(413, 'FILE_TOO_LARGE', 'Upload exceeds the configured limit.')
    return bytes(content)


@router.post('/cases/{case_id}/documents', status_code=201)
async def upload_document(case_id: str, expected_version: int = Form(...), identity_confirmed: bool = Form(False), file: UploadFile = File(...), user: User = Depends(current_user), db: DBSession = Depends(get_db), key=Depends(idem_key)):
    require_role(user, 'doctor')
    case = access_case(db, user, case_id)
    if not identity_confirmed:
        raise ApiError(422, 'IDENTITY_CONFIRMATION_REQUIRED', 'Confirm that the document belongs to this case and is authorized for demo use.')
    content = await read_limited(file, settings.max_document_bytes)
    try:
        extracted = await run_in_threadpool(extract_in_process, content, file.filename or '')
    except ApiError:
        raise
    except Exception:
        raise ApiError(422, 'DOCUMENT_PARSE_FAILED', 'Document could not be safely parsed.')
    text = '\n'.join(page['text'] for page in extracted['pages'])
    for line in text.splitlines():
        if line.startswith('case_alias=') and line.partition('=')[2].strip() != case.alias:
            raise ApiError(409, 'PATIENT_IDENTITY_MISMATCH', 'Source identifies a different case.')
    def run():
        bump_case(db, case, expected_version)
        suffix = Path(file.filename or '').suffix.lower()
        relative = f'{user.tenant_id}/{uid()}{suffix}'
        path = protected_path(relative)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        source = create_record(db, user, 'source', {'name': Path(file.filename or 'Document').name, 'type': suffix.lstrip('.'), 'text': text[:90000], **extracted, 'storage_path': relative, 'extraction_method': 'local_parser', 'identity_confirmed_by': user.id}, case)
        for draft in extract_fixture_facts(extracted['pages']):
            create_record(db, user, 'fact', {**draft, 'source_id': source.id}, case)
        audit(db, user, 'document.imported', source.id)
        return source_public(source)
    return idempotent(db, user, f'document:{case_id}', key, {'sha256': extracted['sha256'], 'version': expected_version, 'name': file.filename}, run)


@router.get('/documents/{source_id}')
@router.get('/sources/{source_id}')
def source(source_id: str, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    record = access_record(db, user, source_id, ['source', 'note'])
    audit(db, user, 'source.viewed', record.id)
    db.commit()
    return source_public(record)


@router.get('/documents/{source_id}/content')
def download(source_id: str, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    record = access_record(db, user, source_id, ['source'])
    path = protected_path(record.data.get('storage_path', 'missing'))
    if not path.is_file():
        raise ApiError(404, 'FILE_NOT_FOUND', 'This source is a structured entry, not a file.')
    audit(db, user, 'source.downloaded', record.id)
    db.commit()
    return FileResponse(path, filename=record.data['name'], headers={'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'})


@router.post('/documents/{source_id}/extract')
def extract_with_model(source_id: str, body: VersionBody, user: User = Depends(current_user), db: DBSession = Depends(get_db), key=Depends(idem_key)):
    require_role(user, 'doctor')
    source = access_record(db, user, source_id, ['source'])
    case = access_case(db, user, source.case_id)
    cached = cached_idempotent(db, user, f'document.extract:{source_id}', key, body.model_dump())
    if cached is not None:
        return cached
    if source.data.get('type') not in {'pdf', 'docx', 'txt'} or not source.data.get('pages'):
        raise ApiError(422, 'DOCUMENT_TEXT_REQUIRED', 'This source has no extracted document text.')
    if case.version != body.expected_version:
        raise ApiError(409, 'CASE_VERSION_CONFLICT', 'Reload the current case.')
    pages = source.data['pages']
    db.commit()  # no database write lock while inference is running
    try:
        proposed = ai.extract_document(pages)
    except ai.ModelUnavailable as error:
        raise ApiError(503, str(error), 'Local extraction is unavailable. Original text remains accessible.')
    except (ValueError, KeyError):
        raise ApiError(422, 'MODEL_EXTRACTION_REJECTED', 'Model output is not supported by the original text.')
    def run():
        db.refresh(user)
        if not user.active:
            raise ApiError(403, 'ACCESS_REVOKED', 'Access has been revoked.')
        access_case(db, user, case.id)
        existing = {(r.data['key'], str(r.data.get('value')), r.data.get('assertion')) for r in db.scalars(select(Record).where(Record.case_id == case.id, Record.kind == 'fact')) if r.data.get('source_id') == source_id}
        accepted = []
        for fact in proposed:
            signature = (fact.key, fact.value, fact.assertion)
            if signature in existing:
                continue
            page = next((p for p in pages if p['page'] == fact.page), None)
            if not page or fact.quote not in page['text'] or fact.value.casefold() not in fact.quote.casefold():
                raise ApiError(422, 'MODEL_EXTRACTION_REJECTED', 'A proposed fact has no exact source excerpt.')
            accepted.append((fact, page['text'].index(fact.quote)))
            existing.add(signature)
        ids = []
        if accepted:
            bump_case(db, case, body.expected_version)
            for fact, offset in accepted:
                record = create_record(db, user, 'fact', {'key': fact.key, 'label': fact.label, 'value': fact.value, 'unit': fact.unit, 'assertion': fact.assertion, 'provenance': 'document', 'confirmed': False, 'source_id': source_id, 'span': f'page:{fact.page}:chars:{offset}-{offset + len(fact.quote)}', 'event_time': None, 'available_time': None, 'order_status': 'not_applicable', 'extraction_model': settings.model_id, 'extraction_revision': settings.model_revision, 'extraction_prompt_version': ai.EXTRACTION_PROMPT_VERSION}, case)
                ids.append(record.id)
        audit(db, user, 'document.ai_extracted', source_id)
        return {'fact_ids': ids, 'count': len(ids), 'case_version': case.version, 'confirmation_required': True}
    return idempotent(db, user, f'document.extract:{source_id}', key, body.model_dump(), run)


def parse_dicom(data):
    import numpy as np
    import pydicom
    archive = safe_zip(data, limit=1500 * 1024 * 1024, max_files=1100)
    groups = {}
    for entry in archive.infolist():
        if entry.is_dir():
            continue
        if entry.file_size > 32 * 1024 * 1024:
            raise ApiError(413, 'DICOM_INSTANCE_LIMIT', 'A DICOM instance is too large.')
        try:
            raw = archive.read(entry)
            ds = pydicom.dcmread(io.BytesIO(raw), stop_before_pixels=True)
        except Exception:
            raise ApiError(422, 'INVALID_DICOM', 'Every archive file must be a readable DICOM instance.')
        if str(ds.get('Modality', '')) != 'CT':
            raise ApiError(422, 'UNSUPPORTED_MODALITY', 'M0 viewer accepts CT only.')
        if int(ds.get('NumberOfFrames', 1)) != 1:
            raise ApiError(422, 'UNSUPPORTED_MULTIFRAME', 'Use a single-frame CT series.')
        required = ['SeriesInstanceUID', 'StudyInstanceUID', 'SOPInstanceUID', 'ImagePositionPatient', 'ImageOrientationPatient', 'PixelSpacing', 'Rows', 'Columns']
        if any(k not in ds for k in required):
            raise ApiError(422, 'DICOM_GEOMETRY_MISSING', 'Series geometry is incomplete.')
        if int(ds.Rows) > 4096 or int(ds.Columns) > 4096:
            raise ApiError(413, 'DICOM_DIMENSION_LIMIT', 'Pixel dimensions exceed the safe budget.')
        orientation = np.array(ds.ImageOrientationPatient, dtype=float)
        position = np.array(ds.ImagePositionPatient, dtype=float)
        spacing = np.array(ds.PixelSpacing, dtype=float)
        if orientation.shape != (6,) or position.shape != (3,) or spacing.shape != (2,) or not np.isfinite(np.concatenate([orientation, position, spacing])).all() or np.any(spacing <= 0) or int(ds.Rows) < 1 or int(ds.Columns) < 1:
            raise ApiError(422, 'INVALID_DICOM_GEOMETRY', 'Invalid spatial dimensions.')
        if not np.isclose(np.linalg.norm(orientation[:3]), 1, atol=1e-3) or not np.isclose(np.linalg.norm(orientation[3:]), 1, atol=1e-3) or not np.isclose(np.dot(orientation[:3], orientation[3:]), 0, atol=1e-3):
            raise ApiError(422, 'INVALID_DICOM_GEOMETRY', 'Orientation must be orthonormal.')
        normal = np.cross(orientation[:3], orientation[3:])
        series = str(ds.SeriesInstanceUID)
        groups.setdefault(series, []).append({'raw': raw, 'sop': str(ds.SOPInstanceUID), 'study': str(ds.StudyInstanceUID), 'position': position.tolist(), 'orientation': orientation.tolist(), 'spacing': list(map(float, ds.PixelSpacing)), 'rows': int(ds.Rows), 'columns': int(ds.Columns), 'z': float(np.dot(normal, position))})
    if not groups or sum(map(len, groups.values())) > 1000:
        raise ApiError(422, 'DICOM_INSTANCE_COUNT', 'Expected 1–1000 CT instances.')
    if len({item['study'] for items in groups.values() for item in items}) != 1:
        raise ApiError(422, 'MULTIPLE_CT_STUDIES', 'Upload one study per archive.')
    for instances in groups.values():
        baseline = instances[0]
        if len({item['sop'] for item in instances}) != len(instances):
            raise ApiError(422, 'DUPLICATE_DICOM_INSTANCE', 'Duplicate SOP instances.')
        for item in instances:
            if item['study'] != baseline['study'] or item['rows'] != baseline['rows'] or item['columns'] != baseline['columns'] or not np.allclose(item['orientation'], baseline['orientation'], atol=1e-4) or not np.allclose(item['spacing'], baseline['spacing']):
                raise ApiError(422, 'INCONSISTENT_DICOM_GEOMETRY', 'Inconsistent series geometry.')
        instances.sort(key=lambda item: item['z'])
        if len(instances) > 1:
            gaps = np.diff([item['z'] for item in instances])
            if np.any(gaps <= 0) or not np.allclose(gaps, np.median(gaps), rtol=.1, atol=.2):
                raise ApiError(422, 'NON_UNIFORM_CT_SERIES', 'Non-uniform or duplicated slice positions.')
    return groups


@router.post('/cases/{case_id}/imaging-studies', status_code=201)
async def imaging_upload(case_id: str, expected_version: int = Form(...), deidentified_confirmed: bool = Form(False), file: UploadFile = File(...), user: User = Depends(current_user), db: DBSession = Depends(get_db), key=Depends(idem_key)):
    require_role(user, 'doctor', 'radiologist')
    case = access_case(db, user, case_id)
    if not deidentified_confirmed:
        raise ApiError(422, 'DEIDENTIFICATION_REQUIRED', 'Confirm authorized de-identified or synthetic CT data, including burned-in text.')
    data = await read_limited(file, settings.max_dicom_bytes)
    groups = await run_in_threadpool(parse_dicom, data)
    def run():
        bump_case(db, case, expected_version)
        study = create_record(db, user, 'study', {'name': 'CT · ' + case.alias, 'series': [], 'analysis_status': 'unavailable', 'reason': 'VALIDATED_CT_MODEL_NOT_CONFIGURED', 'mask_available': False, 'deidentified_confirmed_by': user.id}, case)
        series_meta = []
        for series_uid, instances in groups.items():
            series_id = uid()
            for i, item in enumerate(instances):
                relative = f'{user.tenant_id}/{study.id}/{series_id}/{i}.dcm'
                path = protected_path(relative)
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(item['raw'])
            first = instances[0]
            series_meta.append({'id': series_id, 'uid': series_uid, 'count': len(instances), 'orientation': first['orientation'], 'spacing': first['spacing'], 'rows': first['rows'], 'columns': first['columns'], 'positions': [i['position'] for i in instances]})
        study.data = {**study.data, 'series': series_meta}
        audit(db, user, 'imaging.imported', study.id)
        return serialize(study)
    return idempotent(db, user, f'imaging:{case_id}', key, {'hash': hashlib.sha256(data).hexdigest(), 'version': expected_version}, run)


@router.get('/imaging-studies/{study_id}')
def study(study_id: str, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    return serialize(access_record(db, user, study_id, ['study']))


@router.get('/imaging-studies/{study_id}/series/{series_id}/frames/{index}')
def frame(study_id: str, series_id: str, index: int, center: float = Query(40, ge=-2000, le=3000), width: float = Query(400, ge=1, le=8000), user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    import numpy as np
    import pydicom
    from PIL import Image
    record = access_record(db, user, study_id, ['study'])
    series = next((s for s in record.data['series'] if s['id'] == series_id), None)
    if not series or not 0 <= index < series['count']:
        raise ApiError(404, 'FRAME_NOT_FOUND', 'Frame unavailable.')
    path = protected_path(f'{user.tenant_id}/{record.id}/{series_id}/{index}.dcm')
    try:
        ds = pydicom.dcmread(path)
        pixels = ds.pixel_array.astype(float) * float(ds.get('RescaleSlope', 1)) + float(ds.get('RescaleIntercept', 0))
        pixels = (np.clip((pixels - (center - width / 2)) / width, 0, 1) * 255).astype(np.uint8)
        if ds.get('PhotometricInterpretation') == 'MONOCHROME1':
            pixels = 255 - pixels
        result = io.BytesIO()
        Image.fromarray(pixels).save(result, format='PNG')
    except Exception:
        raise ApiError(422, 'DICOM_DECODE_FAILED', 'Pixel decoder unavailable or image corrupt.')
    audit(db, user, 'imaging.frame_viewed', study_id)
    db.commit()
    return Response(result.getvalue(), media_type='image/png', headers={'Cache-Control': 'no-store'})


@router.post('/imaging-findings/{study_id}/reviews')
def imaging_review(study_id: str, body: ImagingReview, user: User = Depends(current_user), db: DBSession = Depends(get_db), key=Depends(idem_key)):
    require_role(user, 'radiologist')
    record = access_record(db, user, study_id, ['study'])
    def run():
        case = access_case(db, user, record.case_id)
        result = create_record(db, user, 'imaging_review', {**body.model_dump(), 'study_id': study_id, 'review_scope': 'clinician_visual_review_no_ai_finding'}, case)
        audit(db, user, 'imaging.reviewed', study_id)
        return serialize(result)
    return idempotent(db, user, f'imaging.review:{study_id}', key, body.model_dump(), run)
