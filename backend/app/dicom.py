"""Pixel image import. Geometry is optional outside CT; never invent millimetres."""

import io
import zipfile
import numpy as np
import pydicom
from PIL import Image
from .documents import safe_zip
from .security import ApiError

IMAGE_MODALITIES = {
    "CT",
    "MR",
    "CR",
    "DX",
    "MG",
    "US",
    "PT",
    "NM",
    "XA",
    "RF",
    "SC",
    "OT",
    "XC",
    "ES",
    "GM",
    "IO",
    "PX",
}


def parse_dicom(data):
    if zipfile.is_zipfile(io.BytesIO(data)):
        archive = safe_zip(data, limit=1500 * 1024 * 1024, max_files=1100)
        entries = [
            (e.filename, e.file_size)
            for e in archive.infolist()
            if not e.is_dir() and e.filename.rsplit("/", 1)[-1].upper() != "DICOMDIR"
        ]
        read = archive.read
    else:
        entries, read = [("image.dcm", len(data))], lambda _: data
    groups, total = {}, 0
    for name, size in entries:
        if size > 128 * 1024 * 1024:
            raise ApiError(413, "DICOM_INSTANCE_LIMIT", "A DICOM instance exceeds 128 MB.")
        raw = read(name)
        try:
            ds = pydicom.dcmread(io.BytesIO(raw))
        except Exception:
            raise ApiError(
                422, "INVALID_DICOM", "Upload a DICOM image or a ZIP of DICOM images."
            ) from None
        modality = str(ds.get("Modality", "")).upper()
        if modality not in IMAGE_MODALITIES:
            raise ApiError(
                422,
                "UNSUPPORTED_MODALITY",
                f"{modality or 'Unknown'} is not a supported pixel image modality. Reports (SR), presentation states and segmentation objects cannot be displayed as original images.",
            )
        required = [
            "SeriesInstanceUID",
            "StudyInstanceUID",
            "SOPInstanceUID",
            "Rows",
            "Columns",
            "PixelData",
        ]
        if any(k not in ds for k in required):
            raise ApiError(
                422, "DICOM_IMAGE_MISSING", "DICOM pixel data or image identifiers are missing."
            )
        frames = int(ds.get("NumberOfFrames", 1))
        total += frames
        rows, columns = int(ds.Rows), int(ds.Columns)
        if frames < 1 or total > 1000:
            raise ApiError(422, "DICOM_INSTANCE_COUNT", "Expected 1–1000 image frames.")
        if (
            not 1 <= rows <= 4096
            or not 1 <= columns <= 4096
            or rows * columns * frames * max(1, int(ds.get("SamplesPerPixel", 1))) * 4
            > 256 * 1024 * 1024
        ):
            raise ApiError(
                413, "DICOM_DIMENSION_LIMIT", "Decoded pixel size exceeds the safe budget."
            )
        photo = str(ds.get("PhotometricInterpretation", ""))
        if photo not in {
            "MONOCHROME1",
            "MONOCHROME2",
            "RGB",
            "YBR_FULL",
            "YBR_FULL_422",
            "PALETTE COLOR",
        }:
            raise ApiError(
                422, "DICOM_COLOR_UNSUPPORTED", "Unsupported photometric interpretation."
            )
        try:
            # Validate the actual decoder at import, rather than accepting a blank viewer.
            pixels = pydicom.pixels.pixel_array(io.BytesIO(raw), index=0)
        except Exception:
            raise ApiError(
                422,
                "DICOM_DECODE_FAILED",
                "This pixel encoding cannot be decoded. Export uncompressed DICOM (Explicit VR Little Endian).",
            ) from None
        spacing = ds.get("PixelSpacing")
        orientation, position = ds.get("ImageOrientationPatient"), ds.get("ImagePositionPatient")
        shared = ds.get("SharedFunctionalGroupsSequence")
        if shared:
            if not spacing and shared[0].get("PixelMeasuresSequence"):
                spacing = shared[0].PixelMeasuresSequence[0].get("PixelSpacing")
        per_frame = ds.get("PerFrameFunctionalGroupsSequence", [])
        frame_spacings = [
            list(map(float, group.PixelMeasuresSequence[0].PixelSpacing))
            for group in per_frame
            if group.get("PixelMeasuresSequence")
            and group.PixelMeasuresSequence[0].get("PixelSpacing")
        ]
        if frame_spacings:
            # A series-level ruler cannot represent differing calibration per frame.
            spacing = (
                frame_spacings[0]
                if len(frame_spacings) == frames
                and all(value == frame_spacings[0] for value in frame_spacings)
                else None
            )
        spacing = list(map(float, spacing)) if spacing is not None else None
        if spacing is not None and (
            len(spacing) != 2 or not np.isfinite(spacing).all() or min(spacing) <= 0
        ):
            raise ApiError(422, "INVALID_DICOM_GEOMETRY", "Invalid pixel spacing.")
        spatial = orientation is not None and position is not None
        if modality == "CT" and frames == 1 and (not spatial or spacing is None):
            raise ApiError(422, "DICOM_GEOMETRY_MISSING", "CT series geometry is incomplete.")
        if spatial:
            orientation, position = (
                np.asarray(orientation, dtype=float),
                np.asarray(position, dtype=float),
            )
            if (
                orientation.shape != (6,)
                or position.shape != (3,)
                or not np.isfinite(np.concatenate([orientation, position])).all()
                or not np.isclose(np.linalg.norm(orientation[:3]), 1, atol=1e-3)
                or not np.isclose(np.linalg.norm(orientation[3:]), 1, atol=1e-3)
                or not np.isclose(np.dot(orientation[:3], orientation[3:]), 0, atol=1e-3)
            ):
                raise ApiError(422, "INVALID_DICOM_GEOMETRY", "Orientation must be orthonormal.")
        color = photo not in {"MONOCHROME1", "MONOCHROME2"}
        values = pixels.astype(float) * float(ds.get("RescaleSlope", 1)) + float(
            ds.get("RescaleIntercept", 0)
        )
        lo, hi = float(np.min(values)), float(np.max(values))

        def first_number(value, fallback):
            try:
                if not isinstance(value, (str, int, float)):
                    value = value[0]
                number = float(value)
                return number if np.isfinite(number) else fallback
            except (TypeError, ValueError, IndexError):
                return fallback

        wc = first_number(ds.get("WindowCenter"), (lo + hi) / 2)
        ww = max(1, first_number(ds.get("WindowWidth"), hi - lo))
        groups.setdefault(str(ds.SeriesInstanceUID), []).append(
            {
                "raw": raw,
                "sop": str(ds.SOPInstanceUID),
                "study": str(ds.StudyInstanceUID),
                "modality": modality,
                "position": position.tolist() if spatial else None,
                "orientation": orientation.tolist() if spatial else None,
                "spacing": spacing,
                "rows": rows,
                "columns": columns,
                "z": float(np.dot(np.cross(orientation[:3], orientation[3:]), position))
                if spatial
                else float(ds.get("InstanceNumber", len(groups))),
                "frames": frames,
                "color": color,
                "window_center": wc,
                "window_width": ww,
                "synthetic_phantom": "SYNTHETIC PHANTOM"
                in str(ds.get("SeriesDescription", "")).upper(),
            }
        )
    if not groups:
        raise ApiError(422, "DICOM_INSTANCE_COUNT", "No image frames found.")
    if len({i["study"] for items in groups.values() for i in items}) != 1:
        raise ApiError(422, "MULTIPLE_CT_STUDIES", "Upload one study per file.")
    for instances in groups.values():
        first = instances[0]
        if len({i["sop"] for i in instances}) != len(instances):
            raise ApiError(422, "DUPLICATE_DICOM_INSTANCE", "Duplicate SOP instances.")
        for item in instances:
            if any(item[k] != first[k] for k in ("rows", "columns", "modality", "color")):
                raise ApiError(
                    422, "INCONSISTENT_DICOM_GEOMETRY", "Inconsistent series dimensions."
                )
            if item["spacing"] != first["spacing"]:
                # A single series calibration must never silently apply to different pixels.
                raise ApiError(
                    422,
                    "INCONSISTENT_DICOM_GEOMETRY",
                    "Pixel spacing varies across instances; export separate series.",
                )
            if (
                first["modality"] == "CT"
                and first["orientation"] is not None
                and (
                    item["orientation"] is None
                    or not np.allclose(item["orientation"], first["orientation"], atol=1e-4)
                )
            ):
                raise ApiError(422, "INCONSISTENT_DICOM_GEOMETRY", "Inconsistent CT orientation.")
        instances.sort(key=lambda i: i["z"])
        if (
            first["modality"] == "CT"
            and len(instances) > 1
            and all(i["frames"] == 1 for i in instances)
        ):
            gaps = np.diff([i["z"] for i in instances])
            if np.any(gaps <= 0) or not np.allclose(gaps, np.median(gaps), rtol=0.1, atol=0.2):
                raise ApiError(
                    422, "NON_UNIFORM_CT_SERIES", "Non-uniform or duplicated slice positions."
                )
    return groups


def render_frame(study, series_id, index, center, width):
    from .files import protected_path

    series = next(s for s in study.data["series"] if s["id"] == series_id)
    locator = (
        series.get("frame_map", [])[index]
        if series.get("frame_map")
        else {"file_index": index, "pixel_frame": 0}
    )
    path = protected_path(f"{study.tenant_id}/{study.id}/{series_id}/{locator['file_index']}.dcm")
    ds = pydicom.dcmread(path, stop_before_pixels=True)
    pixels = pydicom.pixels.pixel_array(path, index=locator["pixel_frame"])
    photo = str(ds.get("PhotometricInterpretation", ""))
    if photo == "PALETTE COLOR":
        pixels = pydicom.pixels.apply_color_lut(pixels, ds)
    if pixels.ndim == 3:
        if pixels.dtype.itemsize > 1:
            pixels = (pixels / max(1, np.iinfo(pixels.dtype).max) * 255).astype(np.uint8)
    else:
        transform = ds
        shared = ds.get("SharedFunctionalGroupsSequence", [])
        per_frame = ds.get("PerFrameFunctionalGroupsSequence", [])
        for group in ([shared[0]] if shared else []) + (
            [per_frame[locator["pixel_frame"]]] if len(per_frame) > locator["pixel_frame"] else []
        ):
            if group.get("PixelValueTransformationSequence"):
                transform = group.PixelValueTransformationSequence[0]
        pixels = pixels.astype(float) * float(transform.get("RescaleSlope", 1)) + float(
            transform.get("RescaleIntercept", 0)
        )
        center = center if center is not None else series.get("window_center", 40)
        width = width if width is not None else series.get("window_width", 400)
        pixels = (np.clip((pixels - (center - width / 2)) / width, 0, 1) * 255).astype(np.uint8)
        if photo == "MONOCHROME1":
            pixels = 255 - pixels
    result = io.BytesIO()
    Image.fromarray(pixels).save(result, format="PNG")
    return result.getvalue()
