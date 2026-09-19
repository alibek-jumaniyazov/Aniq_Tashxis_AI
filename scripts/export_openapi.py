import argparse
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "backend"))
from app.main import app  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description="Export or verify the public REST contract.")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail if the saved contract differs; never overwrite it.",
    )
    options = parser.parse_args()
    target = root / "docs" / "openapi.json"
    current = app.openapi()
    if options.check:
        if not target.is_file() or json.loads(target.read_text(encoding="utf-8")) != current:
            raise SystemExit(
                "OpenAPI contract is out of date. Run scripts/export_openapi.py and regenerate frontend API types."
            )
        print("OpenAPI contract matches the application.")
        return
    target.write_text(json.dumps(current, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("Exported docs/openapi.json")


if __name__ == "__main__":
    main()
