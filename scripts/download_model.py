"""Authenticated first-time setup only. Normal inference is offline."""

import hashlib
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
try:
    from huggingface_hub import HfApi, snapshot_download
except ImportError:
    sys.exit("Install the AI runtime first: pip install -r backend/requirements-ai.txt")
model_id = "google/medgemma-1.5-4b-it"
destination = root / "models" / "medgemma-1.5-4b-it"
try:
    revision = HfApi().model_info(model_id).sha
    snapshot_download(model_id, revision=revision, local_dir=destination)
except Exception as exc:  # noqa: BLE001 -- never expose credentials embedded in provider exceptions
    sys.exit(
        f"Model download incomplete ({type(exc).__name__}). Accept the model access terms and authenticate locally. No token was printed."
    )
manifest = {"model_id": model_id, "revision": revision, "files": {}}
for path in destination.glob("*.safetensors"):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    manifest["files"][path.name] = digest.hexdigest()
(destination / "aniq-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
env = root / ".env"
lines = env.read_text(encoding="utf-8").splitlines() if env.exists() else []
lines = [
    line
    for line in lines
    if not line.startswith(("MODEL_PATH=", "MODEL_REVISION=", "AI_BACKEND=", "MODEL_QUANTIZATION="))
]
lines += [
    "MODEL_PATH=" + destination.as_posix(),
    "MODEL_REVISION=" + revision,
    "AI_BACKEND=transformers",
    "MODEL_QUANTIZATION=4bit",
]
env.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(
    "Model files verified. Restart the backend and run a local inference smoke test. Clinical validation is still required."
)
