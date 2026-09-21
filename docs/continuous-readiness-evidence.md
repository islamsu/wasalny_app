# Continuous readiness checkpoint

Production readiness remains **48/100 — NO-GO**. Source implementation and
mock-based tests are not evidence of real Firebase authentication or device readiness.

## Executed evidence

- TypeScript: PASS.
- Lint: PASS with one unused-variable warning in the history screen.
- Complete non-secret suite: **247 passed, 0 failed, 3 skipped** across 25 files.
- Separately opted-in staging business concurrency harness: **1 passed, 0 failed**.
  It uses real distinct MySQL connections and production business transaction code.
  It covers same-key ride creation, cached replay, changed-payload rejection,
  competing assignment of one driver, bid/selection lock inversion, and changed-role
  replay rejection. It does not prove authenticated HTTP concurrency, Firebase
  identity, session refresh locking, or an observed deadlock retry count.
- The harness requires empty/quiescent staging, an exclusive test mutex, exact
  target/verified TLS and no configured Firebase provider. Its temporary
  business-only fixtures are removed with exact-owner cleanup. All 17 application
  tables were asserted empty afterward. No auth identities/sessions were created.
- Backend build: PASS.
- Compiled backend HTTP smoke: **7/7 passed** (health, unauthenticated self/ride
  rejection, disabled legacy OAuth, missing-configuration 503, oversized auth
  request rejection, and unapproved-origin rejection). Local test-only HTTP
  allowance was process-scoped and the process was stopped afterward.
- Expo web export: PASS, 15 static routes. This is not APK/AAB or device evidence.
- Integrated read-only security review and correction review completed.
  No remaining blocker to the guarded business harness was identified.

## Staging schema

Target: `wasalny_staging` on the approved Aiven host/port, CA-verified TLS.
Migration 0011 is additive; migrations 0000–0010 were not rewritten.

- 17 application tables, 166 columns.
- 17 primary keys, 13 unique non-primary indexes, 7 foreign keys.
- 44 total physical indexes, including primary keys.
- 12 migration journal entries; all 12 SQL SHA256 hashes match; zero schema/hash
  mismatches.
- 0011 SQL SHA256:
  `815629ee3e8deb2bfa395c60dc39b03be0234f3732882a60610ea4f32c298c71`.

## Implemented, not yet proven with real Firebase identities

Firebase Admin verification with revocation checking and explicit project matching;
Wasalny issuer/subject mapping; closed-by-default new-user provisioning; audited
legacy prelinking tool; 10-minute maximum access JWTs; current database role/status
checks; server sessions; hashed opaque refresh tokens; transactional rotation and
replay revocation; current/all-session logout; sanitized outage handling.

Web Google and Phone/reCAPTCHA sign-in exchange actual Firebase ID tokens when
configured. Browser tokens are memory-only (page reload requires sign-in), while
native session storage uses SecureStore with persistence-failure handling.
Legacy Manus login exchange/callback paths are disabled; fields and user IDs remain.

Driver uploads and submission await server persistence. Document validity uses
supplied dates; subscriptions require explicit current intervals. Ride mutations
use durable idempotency and bounded lock-error retries; clients recover and display
server ride state rather than simulated progression.

## External blockers and deliberately unavailable operations

- Required staging Firebase project/client configuration, service-account secret,
  session signing key and `google-services.json` have not been supplied.
- Actual staging HTTPS origin, API URL and trusted-proxy topology must be verified
  before browser/provider acceptance testing. No guessed origin/hop count is safe.
- Real Firebase login, wrong-project/revoked/disabled-user exercises, MySQL session
  refresh concurrency, authenticated API ride E2E and cross-account IDOR remain
  **NOT EXECUTED**.
- SHA-1/SHA-256, native Firebase sign-in and real Android authentication:
  **DEFERRED — DEVICE/SIGNING VERIFICATION**, not PASS. No Expo account connection,
  fingerprint invention or production signing credential creation.
- Native Firebase SDK login remains explicitly unavailable; native file/GPS,
  background location, push delivery, APK/AAB and physical-device checks are not
  verified.
- First-admin bootstrap is architecture only; no admin was created/promoted.
  Sensitive admin writes remain fail-closed pending real MFA/recent-auth proof and
  transactional hardening of those writers.
- Per-process auth rate limiting requires a shared/edge enforcement layer before
  multi-replica use. Notification delivery is not an exactly-once transactional
  outbox. These remain production limitations.
- CI definition is non-secret, Node 22/pnpm 9.12, with no database migrations or
  deployment step. A remote workflow result must be reported separately from
  local validation.

## Safe continuation

Supply `FIREBASE_PROJECT_ID` and client-safe web values, `google-services.json`,
and server-only `FIREBASE_SERVICE_ACCOUNT_JSON` / `WASALNY_SESSION_SIGNING_KEY`
through the secret store. Never place service-account JSON or signing material
in chat, attachments, client bundles or Git. Preserve the existing explicit MySQL
connection and verified CA configuration.

Then continue legitimate staging identity/session/API evidence automatically;
Android signing is not a prerequisite for web/backend staging verification.