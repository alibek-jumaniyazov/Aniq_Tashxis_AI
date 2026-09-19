# Refreshed seed UI checks

These checks target an activated `realistic-workspace-v2` seed. Start them only after the root task has completed activation and confirmed that the model is idle.

```powershell
npm.cmd run test:seed
```

They cover 12 login identities, current seeded workspace counts, owner/developer/tenant boundaries, prepared payment receipts, DICOM phantom viewing, five patient-data sections, RU/UZ/EN saved comparisons and outlooks, original source quotations, and the paired TB cases.

The request guard permits only GET/HEAD/OPTIONS plus the login POST. Any attempted inference, clinical mutation, notification update, payment review or other write is blocked and fails the test. Login/session creation and access audit remain expected server-side effects of reading. No mock interception replaces the actual seeded data.

`SEED_BASE_URL` can select another local deployment. `SEED_DEMO_PASSWORD` can supply a locally changed common demo password without committing it; do not put secrets in test output. Default newly seeded password is `AniqDemo!2026`.

Collect/parse checks without starting a browser:

```powershell
npx.cmd playwright test --config playwright.seed.config.ts --list
```
