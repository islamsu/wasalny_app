# Wasalny Production Readiness

## Current continuous-execution checkpoint

**NO-GO — 48/100 remains unchanged.** See
[current executed evidence](docs/continuous-readiness-evidence.md) for the
Firebase/session implementation, 293 passing offline tests, separate passing
business-only MySQL concurrency harness, and migration 0011 verification.
The existing app is now launchable for workspace visual inspection; see
[workspace preview](docs/workspace-preview.md) for its remaining authentication gates.
Firebase Admin read access and Google/Phone provider configuration are now
verified. One human-controlled Google tester has now reached the app; guarded
read-only staging queries confirm ordinary-family enrollment, identity linking,
and active session/refresh-record issuance without privilege elevation.
Phone, refresh/logout, cross-account IDOR, and authenticated ride acceptance
remain unverified. Staging ingress and the exact Firebase domain are verified.
Android signing
and real-device authentication are **DEFERRED — DEVICE/SIGNING VERIFICATION**.
The dated sections below are historical, not the current implementation inventory.

## Current verdict — 20 September 2026

**NO-GO — 48 / 100.** The score is retained from Phase 3 without an unexplained increase. New evidence verifies only the dedicated staging database, TLS, migrations, and empty live schema; it does not prove an operational transportation workflow. Production was not touched.

### Staging database evidence

- The user confirmed the dedicated non-production database `wasalny_staging`. It was initially empty.
- Because the original `mysql2` configuration ignored `ssl-mode`, verified TLS was centralized in `server/_core/mysql-config.ts`. Optional `WASALNY_DATABASE_CA_PATH` supports an uploaded public CA. No environment-specific host or workspace path appears in this report.
- `mysql2` + Drizzle verified MySQL **8.4.8** and **TLS_AES_256_GCM_SHA384**.
- All nine migrations were reviewed against the schema/snapshots; generation reported no schema changes. `COREPACK_ENABLE_PROJECT_SPEC=0 pnpm db:push` succeeded, and all nine records exist in `__drizzle_migrations`.
- `INFORMATION_SCHEMA` reports 13 application tables, all with zero rows. All 123 application columns match types, nullability, defaults, auto-increment, and on-update timestamps after normalizing equivalent MySQL `boolean`/`tinyint(1)` and `(now())`/`now()`/`CURRENT_TIMESTAMP` forms. No actual schema mismatch was found.
- Primary keys and eight unique constraints match the snapshots. SHA-256 hashes of all nine live migration journal entries match the checked-in SQL. There are no foreign keys.
- The apparent domain naming differences are accounted for: vehicles/locations are embedded in `driverProfiles`; requests/trips use `rides`; bids use `rideOffers`; favorites use `favoriteDrivers`; reviews use `rideRatings`; notifications use `notificationEvents` and `pushTokens`.
- Five focused MySQL configuration tests passed. Final local checks passed: `pnpm check`, `pnpm lint`, and `pnpm build`; `env -u WASALNY_DATABASE_URL COREPACK_ENABLE_PROJECT_SPEC=0 pnpm test` passed 26 tests with 2 skipped. Intentional database isolation means this was not a staging end-to-end run.

### Release evidence still blocked

No auth settings, `JWT_SECRET`, or client OAuth settings were present. No actual OAuth authentication occurred, no accounts were created, and no login, IDOR, ride, bidding, dispatch, concurrency, idempotency, or device test was performed. Each is **BLOCKED — NOT RUN**, not failed or passed. The product is **Expo React Native, not Flutter**, so the requested Flutter path is not applicable.

The older scores and verdicts below are retained as historical audit phases.

## Verdict: NO-GO

**Overall score: 35 / 100**

| Area | Score | Why |
| --- | ---: | --- |
| Architecture | 48 | Coherent Expo/tRPC/Drizzle foundation, but client fixtures and scattered policy prevent a reliable source of truth. |
| Functionality | 32 | Screens and partial procedures exist; a real family→driver→trip lifecycle is not proven. |
| Security | 38 | Document-access P0 is fixed in source, but logs, resource policy, validation and live verification remain. |
| Performance | 42 | Small-codebase baseline, but non-geospatial queries, no pagination strategy and no profiling evidence. |
| UX | 58 | Arabic-first UI and RTL intent are visible; loading/error/offline/device evidence is incomplete. |
| Testing | 20 | Nine Vitest files mainly cover helpers/fixtures; no full integration/device run was independently executed. |
| Backend | 38 | Protected routes and some ownership checks exist; dispatch, state transitions and errors remain incomplete. |
| Database | 38 | Useful entities/unique indexes; missing foreign keys, geo indexes and transactional invariants. |
| Android | 35 | Expo config/minSdk 24 exists; release signing, permissions, Maps and device behavior unverified. |
| DevOps | 18 | No observed CI workflow, release pipeline, environment inventory or operational monitoring. |

## Release blockers

- Complete and test location-aware, vehicle-aware, active-trip-aware dispatch.
- Make offer selection and ride transitions transactional and idempotent.
- Remove sensitive client logging and complete document upload security controls.
- Replace mock/local business state with server-authoritative reconciliation.
- Run API/database integration tests, physical Android debug/release builds, maps and push verification.
- Establish CI, secure environment/secrets management, monitoring, backup/recovery and incident procedures.

## Verification status

This audit did **not** run `pnpm check`, `pnpm test`, Expo/Android builds, database migrations, live provider calls or device flows because no repository runtime/deployment credentials were available in the GitHub-only audit surface. Existing documents may describe prior runs, but that is not independent release evidence.


## Phase 2 score update

**Before:** 35 / 100 — NO-GO  
**After:** **43 / 100 — NO-GO**

The score increases only for implemented source-level safeguards: source-owned geo dispatch, bid-assignment locking/transaction, server-backed nearby-driver display, document/privacy hardening, and client auth-log removal. It does **not** count as runtime proof.

### Fixed or partially fixed

- P0 document object authorization: fixed in source, not live-tested.
- Location-aware dispatch: partially fixed with 5 km exact-distance, vehicle, eligibility, freshness and busy-driver gates.
- Bid selection: partially fixed with transaction/row locking and post-lock eligibility checks.
- Sensitive auth/OAuth client diagnostics: removed from audited flows.
- Nearby-driver mock dependency: removed from the family panel.

### Remaining P0

- None newly verified after the document-access fix. The fixed document control still needs an authorization regression against the deployed storage path.

### Remaining P1

- No real multi-device/database lifecycle proof.
- No background GPS strategy, reconnect handling or anti-spoofing control.
- No idempotency keys for ride creation/cancellation/status mutations.
- Ride-stage UI can still diverge from authoritative server state outside the nearby-driver path.
- No CI, Android build or provider verification.

### Tests / build / device status

- **Added:** `tests/dispatch-location.test.ts`.
- **Passed:** not executed in this environment.
- **Failed:** none observed; no suite was run.
- **Build status:** not executed.
- **Device verification:** **DEVICE VERIFICATION NOT AVAILABLE**.

### Production readiness

**NO-GO.** The system is safer than the 35/100 baseline, but it cannot be considered a real transportation platform until the core family/driver flow is demonstrated end-to-end against the database on at least two identities/devices, including concurrent offer selection and GPS/network failure handling.

## Phase 3 score update

**Before Phase 3:** 43 / 100 — NO-GO  
**After executed local validation:** **48 / 100 — NO-GO**

The increase reflects only executed local evidence: dependency installation, TypeScript, lint, automated tests, server build/runtime health, Expo Doctor and Android JavaScript export. No points were awarded for unexecuted database/provider/device workflows.

### Real infrastructure

- Backend: **PASS locally; staging BLOCKED**
- Database: **BLOCKED — staging MySQL secret not supplied**
- Authentication: **BLOCKED — provider configuration/accounts not supplied**
- Storage: **BLOCKED — Forge configuration not supplied**
- Maps: **BLOCKED — key/native build/device not supplied**
- Push: **BLOCKED — Expo project/device tokens not supplied**

### Core workflow

- Family login: BLOCKED
- Driver login: BLOCKED
- GPS: BLOCKED on device
- Driver online: BLOCKED against staging DB
- Ride creation: BLOCKED against staging DB
- Dispatch: source/helper tests pass; real backend/database BLOCKED
- Bid: BLOCKED
- Bid selection: BLOCKED
- Assignment: BLOCKED
- Trip start: BLOCKED
- Trip completion: BLOCKED

### Executed checks

- `pnpm check`: PASS
- `pnpm lint`: PASS
- `pnpm test`: PASS — 21 tests, 2 skipped
- `pnpm build`: PASS
- Compiled `/api/health`: PASS locally
- Expo Doctor: PASS — 18/18
- Android Expo export: PASS
- Native Android debug/release: BLOCKED
- Physical device verification: DEVICE VERIFICATION NOT AVAILABLE
- Concurrency: CONCURRENCY NOT VERIFIED
- IDOR: BLOCKED

### Remaining P0

- No confirmed non-production MySQL/OAuth/storage environment in which the transportation transaction can run.
- No real family/driver identities and no completed real ride.

### Remaining P1

- Missing server-side idempotency for ride creation and state-changing operations.
- Local simulated active-ride state can diverge from the backend.
- Role-specific ride transition authorization is incomplete.
- No live bid-race/concurrency or IDOR evidence.
- No background GPS/reconnect strategy.
- No native Android debug/release build or two-device validation.

### Remaining P2

- No push receipt polling/invalid-token cleanup.
- No GPS anomaly detection beyond range/freshness validation.
- No seed/test-account automation for an isolated staging environment.
- No CI workflow recording these checks.

### Final Phase 3 decision

**NO-GO.** Local code and toolchain validation is now real, but the defining Phase 3 question remains blocked: two real Wasalny users have not completed a transportation transaction through a real backend and MySQL database.
