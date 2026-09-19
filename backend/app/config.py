from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, SecretStr, field_validator
from typing import Literal
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")
    database_url: str = f"sqlite:///{(ROOT / 'runtime' / 'aniq.db').as_posix()}"
    storage_root: Path = ROOT / "runtime" / "files"
    demo_mode: bool = True
    seed_profile: Literal["minimal", "realistic"] = "realistic"
    queue_mode: str = "local"
    redis_url: str = "redis://localhost:6379/0"
    ai_provider: Literal["local_medgemma", "openai"] = "local_medgemma"
    ai_backend: Literal["transformers", "llama_cpp", "openai"] = "transformers"
    openai_api_key: SecretStr = Field(default=SecretStr(""), exclude=True, repr=False)
    openai_model: str = Field(default="gpt-5.6-luna", pattern=r"^[a-zA-Z0-9._:-]{1,100}$")
    openai_reasoning_effort: Literal["low", "medium", "high"] = "high"
    openai_max_output_tokens: int = Field(default=8192, ge=2048, le=32768)
    openai_max_input_chars: int = Field(default=200000, ge=1000, le=1000000)
    llama_server_url: str = "http://127.0.0.1:8081"
    model_id: str = "google/medgemma-1.5-4b-it"
    model_path: str = ""
    model_revision: str = "main"
    model_quantization: str = "4bit"
    model_gpu_memory_gb: float = 3
    model_cpu_memory_gb: float = 4
    max_input_tokens: int = 6000
    max_new_tokens: int = 1200
    inference_timeout_seconds: int = 150
    cookie_secure: bool = False
    session_hours: int = 8
    max_document_bytes: int = 20 * 1024 * 1024
    max_dicom_bytes: int = 500 * 1024 * 1024
    allowed_origins: str = "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:8000"

    @field_validator("llama_server_url")
    @classmethod
    def loopback_only(cls, value):
        parsed = urlparse(value)
        if (
            parsed.scheme != "http"
            or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}
            or parsed.username
            or parsed.password
            or parsed.query
            or parsed.path not in {"", "/"}
        ):
            raise ValueError("The model server must use a local loopback HTTP address.")
        return value.rstrip("/")


settings = Settings()
settings.storage_root.mkdir(parents=True, exist_ok=True)
