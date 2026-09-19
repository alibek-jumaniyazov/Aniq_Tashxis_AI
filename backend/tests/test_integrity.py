import io
import json
import zipfile
import numpy as np
import pytest
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import CTImageStorage, ExplicitVRLittleEndian, generate_uid
from app.files import parse_dicom
from app.security import ApiError
from conftest import sign_in
from test_workflows import add, fact, mutate, new_case, run


def dicom_zip(positions=(2, 0, 1), orientation=None):
    study, series = generate_uid(), generate_uid()
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        for index, position in enumerate(positions):
            sop = generate_uid()
            meta = FileMetaDataset()
            meta.MediaStorageSOPClassUID = CTImageStorage
            meta.MediaStorageSOPInstanceUID = sop
            meta.TransferSyntaxUID = ExplicitVRLittleEndian
            ds = FileDataset(None, {}, file_meta=meta, preamble=b"\0" * 128)
            ds.SOPClassUID, ds.SOPInstanceUID = CTImageStorage, sop
            ds.StudyInstanceUID, ds.SeriesInstanceUID = study, series
            ds.Modality, ds.Rows, ds.Columns = "CT", 16, 16
            ds.ImagePositionPatient = [0, 0, position]
            ds.ImageOrientationPatient = orientation or [1, 0, 0, 0, 1, 0]
            ds.PixelSpacing = [1, 1]
            ds.SamplesPerPixel, ds.PhotometricInterpretation = 1, "MONOCHROME2"
            ds.BitsAllocated, ds.BitsStored, ds.HighBit, ds.PixelRepresentation = 16, 16, 15, 1
            ds.RescaleIntercept, ds.RescaleSlope = -1024, 1
            ds.PixelData = np.full((16, 16), 1000 + index * 10, dtype=np.int16).tobytes()
            content = io.BytesIO()
            ds.save_as(content, enforce_file_format=True)
            archive.writestr(f"{index}.dcm", content.getvalue())
    return output.getvalue()


def test_dicom_spatial_order_and_authenticated_frame(client):
    content = dicom_zip()
    groups = parse_dicom(content)
    assert [i["z"] for i in next(iter(groups.values()))] == [0, 1, 2]
    c = new_case(client)
    response = client.post(
        f"/api/v1/cases/{c['id']}/imaging-studies",
        headers={"Idempotency-Key": "ct-test-001"},
        data={"expected_version": 1, "deidentified_confirmed": "true"},
        files={"file": ("synthetic.zip", content, "application/zip")},
    )
    assert response.status_code == 201, response.text
    study = response.json()
    assert study["mask_available"] is False
    path = f"/api/v1/imaging-studies/{study['id']}/series/{study['series'][0]['id']}/frames/0"
    image = client.get(path)
    assert image.status_code == 200 and image.content.startswith(b"\x89PNG")
    assert client.get(path.replace("/frames/0", "/frames/9")).status_code == 404
    sign_in(client, "other")
    assert client.get(path).status_code == 404


@pytest.mark.parametrize("positions", [(0, 0), (0, 1, 9)])
def test_dicom_rejects_bad_slice_geometry(positions):
    with pytest.raises(ApiError, match="Non-uniform"):
        parse_dicom(dicom_zip(positions))


def test_dicom_rejects_invalid_orientation():
    with pytest.raises(ApiError):
        parse_dicom(dicom_zip(orientation=[0, 0, 0, 0, 1, 0]))


def test_retry_deduplicates_alerts_and_notifications(client):
    c = new_case(client)
    add(
        client,
        c,
        [
            fact("allergy.substance", "DEMO-A"),
            fact("medication.substance", "DEMO-A", order_status="active"),
        ],
    )
    first = run(client, c, include_ai=False)
    assert first["status"] == "partial"
    retry = mutate(
        client, "/analyses/" + first["id"] + "/retry", {"expected_version": c["version"]}
    )
    assert retry.status_code == 202, retry.text
    latest = client.get("/api/v1/analyses/" + retry.json()["run_id"]).json()
    assert latest["result"]["alert_ids"] == first["result"]["alert_ids"]
    assert len(client.get("/api/v1/notifications").json()["items"]) == 1


def test_note_draft_is_private_and_does_not_change_case(client):
    c = new_case(client)
    values = {"text": "Unfinished private explanation", "event_time": ""}
    assert mutate(client, f"/cases/{c['id']}/drafts/note", values, method="put").status_code == 200
    assert (
        client.get(f"/api/v1/cases/{c['id']}/drafts/note").json()["values"]["text"]
        == values["text"]
    )
    data = client.get("/api/v1/cases/" + c["id"]).json()
    assert data["version"] == 1 and data["notes"] == []
    sign_in(client, "expert")
    assert client.get(f"/api/v1/cases/{c['id']}/drafts/note").status_code == 403
    assert values["text"] not in json.dumps(client.get("/api/v1/cases/" + c["id"]).json())


def test_future_event_is_excluded_even_when_availability_is_earlier(client):
    c = new_case(client)
    add(
        client,
        c,
        [
            fact("allergy.substance", "DEMO-A"),
            fact(
                "medication.substance",
                "DEMO-A",
                order_status="active",
                event_time="2026-09-19T10:00:00+05:00",
            ),
        ],
    )
    result = run(
        client, c, mode="decision_time", decision_time="2026-09-18T10:00:00+05:00", include_ai=False
    )
    assert result["result"]["alert_ids"] == []


def test_note_context_does_not_leak_into_historical_ai_snapshot(client, monkeypatch):
    from app import ai

    captured = []

    def capture(snapshot, *args):
        captured.append(snapshot)
        raise ai.ModelUnavailable("MODEL_WEIGHTS_MISSING")

    monkeypatch.setattr(ai, "review", capture)
    c = new_case(client)
    note = mutate(
        client,
        f"/cases/{c['id']}/notes",
        {
            "expected_version": 1,
            "text": "Later clinician explanation",
            "event_time": "2020-01-01T00:00:00+00:00",
        },
    ).json()
    c["version"] = note["case_version"]
    run(client, c)
    assert captured[-1]["notes"][0]["text"] == "Later clinician explanation"
    run(client, c, mode="decision_time", decision_time="2020-01-02T00:00:00+00:00")
    assert captured[-1]["notes"] == []


def test_missing_values_never_create_substance_alert(client):
    c = new_case(client)
    add(
        client,
        c,
        [
            fact("allergy.substance", None),
            fact("medication.substance", None, order_status="active"),
        ],
    )
    result = run(client, c, include_ai=False)
    assert result["result"]["alert_ids"] == []
    assert "DEMO-ALLERGY-01" not in result["result"]["coverage"]["completed"]


def test_document_provenance_requires_actual_source(client):
    c = new_case(client)
    result = mutate(
        client,
        f"/cases/{c['id']}/facts",
        {"expected_version": 1, "facts": [fact("vital.pulse", "70", provenance="document")]},
        method="patch",
    )
    assert result.status_code == 422
