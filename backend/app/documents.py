import hashlib
import io
import json
import os
import re
import subprocess
import sys
import zipfile
from pathlib import Path, PurePosixPath
from .security import ApiError


def extract_in_process(data, filename):
    environment = {
        key: value
        for key, value in os.environ.items()
        if key.upper() in {"PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "TESSDATA_PREFIX"}
    }
    environment["PYTHONUTF8"] = "1"
    try:
        result = subprocess.run(
            [sys.executable, "-m", "app.parse_worker", Path(filename).suffix],
            input=data,
            capture_output=True,
            cwd=Path(__file__).resolve().parents[1],
            env=environment,
            timeout=60,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
    except subprocess.TimeoutExpired:
        raise ApiError(422, "DOCUMENT_PARSE_TIMEOUT", "Document parsing exceeded 60 seconds.")
    if result.returncode:
        raise ApiError(422, "DOCUMENT_PARSE_FAILED", "Document parser could not complete.")
    payload = json.loads(result.stdout)
    if "error" in payload:
        error = payload["error"]
        raise ApiError(error["status"], error["code"], error["message"])
    return payload


def safe_zip(data, limit=100 * 1024 * 1024, max_files=2000):
    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
        entries = archive.infolist()
        if len(entries) > max_files or sum(e.file_size for e in entries) > limit:
            raise ApiError(413, "ARCHIVE_TOO_LARGE", "Expanded archive exceeds limits.")
        for entry in entries:
            path = PurePosixPath(entry.filename.replace("\\", "/"))
            if (
                path.is_absolute()
                or ".." in path.parts
                or ":" in entry.filename
                or ((entry.external_attr >> 16) & 0o170000) == 0o120000
            ):
                raise ApiError(422, "UNSAFE_ARCHIVE_PATH", "Archive contains an unsafe entry.")
            if entry.flag_bits & 1:
                raise ApiError(422, "ENCRYPTED_ARCHIVE", "Encrypted archives are unsupported.")
        return archive
    except zipfile.BadZipFile:
        raise ApiError(422, "CORRUPT_FILE", "Archive cannot be read.")


def extract(data, filename):
    name = filename.casefold()
    pages = []
    limitations = []
    if name.endswith(".pdf") and data.startswith(b"%PDF-"):
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise ApiError(422, "ENCRYPTED_FILE", "Password-protected PDF is unsupported.")
        if len(reader.pages) > 30:
            raise ApiError(413, "PAGE_LIMIT", "Maximum 30 pages.")
        for i, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            if not text.strip():
                try:
                    import pypdfium2 as pdfium
                    import pytesseract

                    pdf = pdfium.PdfDocument(data)
                    bitmap = pdf[i].render(scale=2)
                    text = pytesseract.image_to_string(bitmap.to_pil(), lang="rus+eng")
                    pdf.close()
                except Exception:
                    limitations.append("OCR_UNAVAILABLE_PAGE_" + str(i + 1))
            if len(text) > 60000:
                raise ApiError(413, "TEXT_LIMIT", "Page exceeds the safe text budget.")
            pages.append({"page": i + 1, "text": text})
    elif name.endswith(".docx") and data.startswith(b"PK"):
        archive = safe_zip(data)
        if "word/document.xml" not in archive.namelist():
            raise ApiError(415, "FILE_TYPE_MISMATCH", "Not a DOCX document.")
        if any("vbaProject" in n for n in archive.namelist()):
            raise ApiError(415, "MACROS_UNSUPPORTED", "Macros are not supported.")
        from docx import Document

        document = Document(io.BytesIO(data))
        # Preserve stable paragraph/table indices. No claim of Word page fidelity.
        for i, p in enumerate(document.paragraphs):
            if p.text:
                pages.append({"page": len(pages) + 1, "text": p.text, "locator": f"paragraph:{i}"})
        for ti, table in enumerate(document.tables):
            for ri, row in enumerate(table.rows):
                pages.append(
                    {
                        "page": len(pages) + 1,
                        "text": " | ".join(c.text for c in row.cells),
                        "locator": f"table:{ti}:row:{ri}",
                    }
                )
        limitations.append("DOCX_LOGICAL_BLOCK_PREVIEW_NOT_PAGINATED")
        if sum(len(p["text"]) for p in pages) > 90000:
            raise ApiError(413, "TEXT_LIMIT", "Document exceeds the safe text budget.")
    elif name.endswith(".txt"):
        try:
            text = data.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise ApiError(422, "TEXT_ENCODING", "Use UTF-8 text.")
        if "\x00" in text:
            raise ApiError(415, "FILE_TYPE_MISMATCH", "Binary content is not plain text.")
        pages = [
            {"page": i // 3000 + 1, "text": text[i : i + 3000]} for i in range(0, len(text), 3000)
        ]
        if len(pages) > 30:
            raise ApiError(413, "PAGE_LIMIT", "Maximum 30 logical text pages.")
    else:
        raise ApiError(415, "UNSUPPORTED_FILE", "Supported: UTF-8 TXT, PDF, DOCX.")
    if sum(len(p["text"]) for p in pages) > 90000:
        raise ApiError(413, "TEXT_LIMIT", "Document exceeds the safe text budget.")
    return {"pages": pages, "limitations": limitations, "sha256": hashlib.sha256(data).hexdigest()}


def extract_fixture_facts(pages):
    """Conservative structured key=value draft parser; never fabricates clinical text extraction."""
    allowed = {
        "allergy.substance",
        "medication.substance",
        "imaging.side",
        "lab.potassium",
        "vital.spo2",
        "vital.pulse",
        "symptom.complaint",
    }
    drafts = []
    for page in pages:
        for match in re.finditer(r"(?m)^([a-z][a-z0-9_.]+)\s*=\s*([^\n]+)$", page["text"]):
            key, value = match.groups()
            if key in allowed:
                drafts.append(
                    {
                        "key": key,
                        "label": key,
                        "value": value.strip(),
                        "unit": None,
                        "confirmed": False,
                        "assertion": "present",
                        "provenance": "document",
                        "event_time": None,
                        "available_time": None,
                        "span": f"page:{page['page']}:chars:{match.start()}-{match.end()}",
                        "order_status": "not_applicable",
                    }
                )
    return drafts
