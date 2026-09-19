"""Disposable document parser. Time-bounded process separation, not an OS sandbox."""

import json
import sys
from .documents import extract
from .security import ApiError

if __name__ == "__main__":
    try:
        result = extract(sys.stdin.buffer.read(20 * 1024 * 1024 + 1), "source" + sys.argv[1])
    except ApiError as error:
        result = {"error": {"status": error.status, "code": error.code, "message": error.message}}
    except Exception:
        result = {
            "error": {
                "status": 422,
                "code": "DOCUMENT_PARSE_FAILED",
                "message": "Document could not be parsed.",
            }
        }
    sys.stdout.buffer.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))
