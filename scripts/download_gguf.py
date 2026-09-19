"""Resume verified public model/runtime downloads. Never receives patient data or tokens."""

import hashlib
import json
import os
import threading
import time
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
MODEL_REVISION = "3855f948626b7ae42bccd082757f15078c53e758"
MODEL_FILE = "medgemma-1.5-4b-it-Q4_K_M.gguf"
MODEL_SHA = "b31becdf4f39561800505514cce67681604fe449d04dd35c8c92fd7848c6d7bd"
RUNTIME_VERSION = "b11026"
RUNTIME_SHA = "ceb83d677cedbc7ec427f157adbc93da82d8fdc336d8b105152568a3be98bb18"
CHUNK = 2 * 1024 * 1024


def digest(path):
    value = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(8 * 1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def download(url, target, expected, workers=24):
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and digest(target) == expected:
        print(target.name, "verified", flush=True)
        return
    part, state = (
        target.with_suffix(target.suffix + ".part"),
        target.with_suffix(target.suffix + ".progress.json"),
    )
    response = requests.get(url, headers={"Range": "bytes=0-0"}, stream=True, timeout=45)
    response.raise_for_status()
    if response.status_code != 206:
        raise RuntimeError("Server does not support bounded range downloads")
    total = int(response.headers["Content-Range"].split("/")[-1])
    resolved = response.url
    response.close()
    count = (total + CHUNK - 1) // CHUNK
    done = set()
    if state.exists() and part.exists():
        try:
            previous = json.loads(state.read_text())
        except ValueError:
            previous = {"sha256": "", "total": 0}
        if previous["sha256"] == expected and previous["total"] == total:
            done = set(previous["completed"])
    if not part.exists():
        with part.open("wb") as output:
            output.truncate(total)
    initial = len(done)
    started = last_output = time.monotonic()
    thread_state = threading.local()

    def transfer(index):
        if not hasattr(thread_state, "client"):
            thread_state.client = requests.Session()
        first, last = index * CHUNK, min(total, (index + 1) * CHUNK) - 1
        for attempt in range(5):
            try:
                endpoint = resolved if attempt == 0 and time.monotonic() - started < 1200 else url
                with thread_state.client.get(
                    endpoint,
                    headers={"Range": f"bytes={first}-{last}"},
                    stream=True,
                    timeout=(20, 60),
                ) as result:
                    if (
                        result.status_code != 206
                        or result.headers.get("Content-Range") != f"bytes {first}-{last}/{total}"
                    ):
                        raise RuntimeError("Range response mismatch")
                    received = 0
                    with part.open("r+b") as output:
                        output.seek(first)
                        for data in result.iter_content(256 * 1024):
                            received += len(data)
                            if received > last - first + 1:
                                raise RuntimeError("Range response exceeds expected length")
                            output.write(data)
                    if received != last - first + 1:
                        raise RuntimeError("Range response incomplete")
                return index
            except (requests.RequestException, RuntimeError, OSError):
                if attempt == 4:
                    raise RuntimeError(
                        f"Download interrupted at chunk {index}; run again to resume"
                    ) from None
                time.sleep(min(2**attempt, 8))

    pool = ThreadPoolExecutor(max_workers=workers)
    try:
        for future in as_completed(
            [pool.submit(transfer, i) for i in range(count) if i not in done]
        ):
            done.add(future.result())
            temporary = state.with_suffix(".tmp")
            temporary.write_text(
                json.dumps({"sha256": expected, "total": total, "completed": sorted(done)})
            )
            temporary.replace(state)
            current = time.monotonic()
            if current - last_output > 10 or len(done) == count:
                rate = (len(done) - initial) * CHUNK / max(current - started, 1) / 1024**2
                print(
                    f"{target.name}: {100 * len(done) / count:.1f}% ({rate:.2f} MiB/s)", flush=True
                )
                last_output = current
    finally:
        pool.shutdown(wait=True, cancel_futures=True)
    if digest(part) != expected:
        raise RuntimeError("SHA-256 verification failed. File was not activated.")
    part.replace(target)
    print(target.name, "SHA-256 verified", flush=True)


def main():
    model_dir = ROOT / "models" / "medgemma-1.5-4b-gguf"
    runtime_dir = ROOT / "runtime" / "llama"
    archive = ROOT / "work" / f"llama-{RUNTIME_VERSION}-vulkan.zip"
    download(
        f"https://github.com/ggml-org/llama.cpp/releases/download/{RUNTIME_VERSION}/llama-{RUNTIME_VERSION}-bin-win-vulkan-x64.zip",
        archive,
        RUNTIME_SHA,
        workers=8,
    )
    runtime_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as bundle:
        for entry in bundle.infolist():
            destination = (runtime_dir / entry.filename).resolve()
            if not destination.is_relative_to(runtime_dir.resolve()):
                raise RuntimeError("Unsafe runtime archive path")
        bundle.extractall(runtime_dir)
    model = model_dir / MODEL_FILE
    download(
        f"https://huggingface.co/unsloth/medgemma-1.5-4b-it-GGUF/resolve/{MODEL_REVISION}/{MODEL_FILE}",
        model,
        MODEL_SHA,
        workers=min(48, max(1, int(os.environ.get("DOWNLOAD_WORKERS", "24")))),
    )
    manifest = {
        "base_model": "google/medgemma-1.5-4b-it",
        "quantized_by": "unsloth",
        "repository": "unsloth/medgemma-1.5-4b-it-GGUF",
        "revision": MODEL_REVISION,
        "quantization": "Q4_K_M",
        "sha256": MODEL_SHA,
        "runtime": RUNTIME_VERSION,
        "runtime_sha256": RUNTIME_SHA,
    }
    (model_dir / "aniq-manifest.json").write_text(json.dumps(manifest, indent=2))
    env = ROOT / ".env"
    lines = env.read_text(encoding="utf-8-sig").splitlines() if env.exists() else []
    keys = (
        "AI_BACKEND=",
        "MODEL_PATH=",
        "MODEL_REVISION=",
        "MODEL_QUANTIZATION=",
        "MAX_INPUT_TOKENS=",
        "MAX_NEW_TOKENS=",
    )
    lines = [line for line in lines if not line.startswith(keys)]
    lines += [
        "AI_BACKEND=llama_cpp",
        "MODEL_PATH=" + model.as_posix(),
        "MODEL_REVISION=" + MODEL_REVISION,
        "MODEL_QUANTIZATION=Q4_K_M",
        "MAX_INPUT_TOKENS=3072",
        "MAX_NEW_TOKENS=768",
    ]
    env.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(
        "Local GGUF model ready. Start scripts/start-model.ps1, then run scripts/check_model.py.",
        flush=True,
    )


if __name__ == "__main__":
    try:
        main()
    except (OSError, requests.RequestException, RuntimeError) as error:
        print(f"Setup incomplete: {type(error).__name__}. Rerun to resume safely.", flush=True)
        raise SystemExit(1) from None
