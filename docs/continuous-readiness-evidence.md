# Continuous readiness checkpoint

Production readiness remains **48/100 — NO-GO**. Source implementation and
mock-based tests are not evidence of real Firebase authentication or device readiness.

## Executed evidence

### Live provider configuration checkpoint — 21 September 2026

- Replacement service-account project matches `wasalny-staging`; private-key
  format and session-signing-key format pass validation. The credential differs
  from the exposed uploaded key. The user reports revoking that exposed key;
  revocation was not independently checked.
- Real Firebase Admin read access: PASS. A lookup of a randomly generated,
  nonexistent UID returned the expected user-not-found response, not an
  authorization or configuration failure. No test identity was created.
- Read-only Identity Toolkit configuration requests: PASS. Google and Phone
  sign-in are enabled. The existing Web API key resolves to the staging project
  number, consistent with the project configuration. No key values or provider
  client secrets were printed or saved to source.
- Firebase authorized domains currently include only `localhost` and the two
  default staging Firebase hosting domains. A hosted application origin still
  needs verification/configuration before browser sign-in.
- Provider user inventory: **0 users, no further page**. Verified-TLS staging
  MySQL inventory: **0 users, authIdentities, authSessions, authRefreshTokens,
  driverProfiles, and rides**. These are read-only observations, not fixtures.
- Compiled backend with the verified Firebase configuration: **10/10 HTTP
  checks passed**: health, unauthenticated self/ride denial, legacy OAuth denial,
  malformed provider-token denial, oversized body, rejected origin, malformed
  JSON, unknown auth endpoint, and wrong media type. Database access was removed
  from this isolated process. It used the explicit loopback-only HTTP test
  allowance and was stopped afterward; this is not deployed HTTPS ingress proof.
- Full offline suite rerun: **247 passed, 0 failed, 3 skipped**; TypeScript and
  backend build passed; lint passed with the existing one unused-variable warning.
  Firebase server credentials and the explicit MySQL URL were excluded from
  the offline test process.
- No new runtime defect was found by these checks. No regression fix, provider
  configuration write, user creation, role promotion, or database write was made.

**Evidence boundary:** Admin read access, an enabled provider, and rejection of a
malformed token do not prove a real end-user sign-in. Google requires a
human-controlled sign-in; Phone requires possession verification. No custom-token
minting, manually fabricated provider linking, or authentication bypass was used
to substitute for either.

### Previously executed implementation/schema checks

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

- The server project, service-account secret and session signing key are now
  configured and validated. Android `google-services.json` remains outstanding
  within the deferred device work; it is not a blocker for web/backend checks.
- No real staging provider users currently exist. Legitimate Google/Phone
  sign-in by human-controlled test identities is required before live
  application sessions, refresh/logout, or authenticated IDOR can be exercised.
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
  deployment step. It is prepared locally but NOT pushed: GitHub's connection
  lacks workflow permission and reauthorization does not offer that scope.
  Repository-owner action is needed to add the workflow. Remote CI is NOT RUN.

## Safe continuation

Keep the verified server credentials and explicit verified-TLS MySQL connection
unchanged. Never place service-account JSON, session-signing keys, provider ID
tokens, or refresh tokens in chat, attachments, logs, client bundles or Git.

Prepare/verify the staging browser/API origin and matching client configuration,
then have authorized testers complete genuine Google/Phone sign-in. Do not ask
for their Google passwords or SMS codes in chat. Continue session rotation/replay,
logout/current-role checks and two-user ownership tests from those real sessions.
The full driver ride flow additionally needs the documented controlled
administrator/MFA approval process; do not silently promote users or approve
documents using direct database writes to make that test pass.

Continuous implementation remains authorized, without internal phase approval
pauses. Human provider authentication and controlled administrator approval are
external trust boundaries, not automatic PASS conditions. Android signing is not
a prerequisite for web/backend staging verification.