# Patient registration

The New case dialog has five fields: full name, age, sex, patient phone number and doctor comments. Only the full name is required. The same fields are available when editing the patient. Labels and help are available in Russian, Uzbek and English.

## API contract

`POST /api/v1/cases` requires an authenticated doctor, the existing CSRF header and an idempotency key. The minimal JSON body is:

```json
{"full_name": "Synthetic Patient"}
```

Optional fields are `age` (integer 0–120 or null), `sex` (`male`, `female`, `unknown`), `patient_phone` (up to 50 characters), and `summary` (doctor comments, up to 6000 characters). Full names are trimmed and must contain 1–200 characters. An empty age stays unknown; it is not converted to zero.

The server allocates a unique `alias` such as `AT-00000001` in the registration transaction. Concurrent registrations use database sequence reservations; legacy codes are skipped. Repeating the same idempotent request returns the same patient and code. Neither `alias` nor `diagnosis` is accepted in the creation body.

`PATCH /api/v1/cases/{id}` requires `expected_version`. Omitted fields remain unchanged. The code cannot be edited. For legacy records without a full name, the edit form omits an empty name so other fields can still be updated. Supplying a name explicitly requires a nonblank value.

`GET /api/v1/cases?q=...` searches permitted records by name, code and phone, including phone searches without formatting punctuation. Existing context searches remain supported. Search does not expand a user's access to patients.

## Existing data and clinical workflow

The additive migration `20260918_patient` introduces `cases.full_name`, `cases.patient_phone` and the `patient_code_allocations` table. Existing names and phone numbers are initialized as empty strings; legacy codes, clinical data and history are preserved. For databases already managed by Alembic, apply the migration with the normal upgrade to head. Older demo databases created directly with `create_all` need an inspected additive migration and backup rather than replaying the initial schema migration.

Registration does not create confirmed clinical facts. Full name and phone are excluded from clinical AI snapshots. The current diagnostic review still requires a known adult age and sufficient confirmed clinical evidence; allowing registration with an unknown age does not remove those analysis requirements.

Automated checks cover validation, persistence, permissions, concurrent code allocation, idempotency, migration preservation, three UI languages, mobile layout, editing legacy records, and searching by name, phone and code.
