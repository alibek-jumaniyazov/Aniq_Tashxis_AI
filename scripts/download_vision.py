"""Install the public, revision-pinned MedGemma vision projector without credentials."""

import json
from download_gguf import ROOT, MODEL_REVISION, download

NAME = "mmproj-F16.gguf"
SHA256 = "f45f0f750587494e8f976d952cb396dfaa3158662120e2f9c224fc11f3882c83"


if __name__ == "__main__":
    target = ROOT / "models" / "medgemma-1.5-4b-gguf" / NAME
    download(
        f"https://huggingface.co/unsloth/medgemma-1.5-4b-it-GGUF/resolve/{MODEL_REVISION}/{NAME}",
        target,
        SHA256,
        workers=8,
    )
    target.with_suffix(".manifest.json").write_text(
        json.dumps(
            {
                "repo": "unsloth/medgemma-1.5-4b-it-GGUF",
                "revision": MODEL_REVISION,
                "file": NAME,
                "sha256": SHA256,
                "size": target.stat().st_size,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print("Vision projector verified. Restart scripts/start-model.ps1 to enable image review.")
