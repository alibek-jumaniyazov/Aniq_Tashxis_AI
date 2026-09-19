# Working on AniqTashxis AI

The first requirement for a change is to preserve working clinical and account workflows. Formatting, architecture and naming support that requirement; they do not replace verification.

## Setup and verification

Use Python 3.12 and Node.js 22. Install the pinned dependencies with `scripts/setup.ps1`, then run the full check from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify.ps1
```

This runs backend tests, Python lint/format checks, the saved OpenAPI contract check, frontend formatting/lint, frontend unit tests, production build and isolated Playwright tests. Playwright uses ports 8001/5174 and its own database. Tests explicitly disable paid AI inference and do not use the running application's patient database on port 8000.

The same checks are defined in `.github/workflows/ci.yml`. A configured workflow is not evidence of a successful remote CI run; report actual results when reviewing a change.

## Style

- Python: Ruff, four spaces, 100-column formatting, Python 3.12 syntax target.
- TypeScript/TSX/CSS: Prettier, two spaces, single quotes, no semicolons, 100-column formatting.
- TypeScript remains strict with unused locals/parameters checked. ESLint enforces React hook rules.
- UTF-8 and LF line endings are defined in `.editorconfig` and `.gitattributes`.
- Long source quotations, translations and prompts may exceed the formatting width. Preserve their content and interpolation variables.

Apply the configured formatters instead of manually reflowing code:

```powershell
.\.venv\Scripts\python.exe -m ruff format --config backend/pyproject.toml backend scripts
cd frontend
npm.cmd run format
```

Formatter references: [Ruff](https://docs.astral.sh/ruff/formatter/) and [Prettier](https://prettier.io/docs/configuration). Project versions are recorded in dependency lockfiles.

## Module boundaries

- Keep API handlers focused on the authentication, authorization, validation and transaction boundary. Never move a permission check outside the protected operation to simplify a handler.
- Keep schema definitions, prompts, grounding validation and AI transport separate. A provider response is not a persisted clinical result until validation passes.
- Split UI by workflow and component responsibility. Put shared request state and action guards in a hook; keep unrelated form state inside its component.
- Shared types belong beside their domain. Avoid duplicate interfaces, broad `any`, speculative abstractions and hidden fallbacks.
- Keep existing public imports stable during extraction. Explicit compatibility exports are intentional; they should not conceal a second implementation.

## Contracts and data

Verify the saved REST contract without writing:

```powershell
.\.venv\Scripts\python.exe scripts/export_openapi.py --check
```

For an intentional API change, export and regenerate together:

```powershell
.\.venv\Scripts\python.exe scripts/export_openapi.py
cd frontend
npm.cmd run api:types
```

Review path/method, schemas, error codes, role permissions, tenant boundaries, version conflicts and idempotency. Do not manually edit `frontend/src/api/generated.ts`.

Never put API keys, session tokens or patient records into code, public screenshots, commits or logs. Keep `.env`, runtime databases, uploaded files and model weights outside source control. Generated builds, test reports and TypeScript caches are ignored; user-created Word/PowerPoint artifacts are separate from application code.

Database reset is an explicit demo-management operation, not part of cleanup, formatting or verification. For schema changes, add a migration and test existing data. Never silently reseed the active application to make a test pass.

## Review evidence

A refactor should explain the responsibility moved, why the boundary helps maintenance, and how behavior was verified. Run relevant tests during implementation and the complete check before delivery. Check the affected page and its RU/UZ/EN workflow. Semantic/AST comparison can support test results for a formatting pass.

Preserve original source quotations, result language and actual AI provenance. Keep clinical limitations visible. Do not claim clinical accuracy, real payment settlement or live DMED connectivity from engineering tests or synthetic fixtures.
