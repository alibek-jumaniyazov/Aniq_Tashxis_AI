import json
import platform
import sys
import urllib.error
import urllib.request
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "backend"))
from app.ai import model_status  # noqa: E402

report = {
    "python": platform.python_version(),
    "platform": platform.platform(),
    "model": model_status(),
}
if "--check-download" in sys.argv:
    try:
        request = urllib.request.Request(
            "https://huggingface.co/google/medgemma-1.5-4b-it/resolve/main/config.json",
            method="HEAD",
        )
        with urllib.request.urlopen(request, timeout=20) as response:
            report["anonymous_model_access_http"] = response.status
    except urllib.error.HTTPError as error:
        report["anonymous_model_access_http"] = error.code
    except (OSError, TimeoutError) as error:
        report["model_access_error"] = type(error).__name__
print(json.dumps(report, indent=2))
