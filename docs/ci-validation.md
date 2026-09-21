# CI validation

The GitHub Actions workflow in `.github/workflows/ci.yml` is intentionally
non-secret and runs from the repository root. It installs the pnpm 9 lockfile
exactly, then runs:

- `pnpm check` (TypeScript, without emitting files)
- `pnpm lint`
- `pnpm test` (the complete Vitest suite, including unit and
  authorization/security tests)
- `pnpm build` (the backend bundle)

The workflow has read-only repository permissions and does not use staging or
production credentials. It does not run migrations, connect to a database,
start the application, make live API calls, or deploy anything. No test
environment or secret variables are required.

Remote CI execution is blocked: the connected GitHub authorization includes repo
access but not the workflow permission, and its offered reauthorization scopes do
not include workflow. GitHub rejected the workflow tree write; application code
was committed separately. Creating this workflow locally does not constitute a
passing CI run.

The repository owner can open GitHub → `islamsu/wasalny_app` → **Add file → Create
new file**, enter `.github/workflows/ci.yml`, copy the prepared local file's
contents, and commit to `main`. Check **Actions → CI** afterward. No tokens,
staging secrets or migrations belong in this workflow.

## Test scope and skips

All tests that can run without external services run in CI. A passing run is
evidence for this deterministic local suite only; it is not evidence of a
live staging, database, OAuth, maps, or production deployment check.

Three tests are intentionally skipped unless their live/integration prerequisites
are supplied:

- `tests/auth.logout.test.ts` has a skipped integration block because it
  requires a running authenticated server/session.
- `tests/google-maps-key.validation.test.ts` is skipped when
  `GOOGLE_MAPS_ANDROID_API_KEY` is absent. CI does not provide that credential.
- `tests/business-locks.staging.test.ts` requires explicit opt-in and an empty,
  quiescent, verified-TLS `wasalny_staging` database. It is never enabled in CI.
  Its separate execution is database-only evidence, not Firebase-authenticated E2E.

The remaining Google Maps secret checks use synthetic values and do not contact
Google. The database configuration tests validate configuration behavior with
an intentionally unused URL; they do not connect to a database. These skips
are expected and must not be described as live validation.