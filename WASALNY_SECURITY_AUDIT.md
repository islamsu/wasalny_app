# Wasalny Security Audit

## Current continuous-execution checkpoint

**NO-GO — 48/100.** The integrated auth/business security review and corrections,
executed tests, and remaining provider/admin/deployment limitations are recorded
in [current evidence](docs/continuous-readiness-evidence.md). Sensitive admin
writes remain fail-closed. Mocked auth tests are not real Firebase or device evidence.
The replacement staging credential now passes project/key validation and real
Firebase Admin read access. Ten configured-backend HTTP rejection/health checks
pass; legitimate end-user authentication and session/IDOR tests remain unexecuted.
Workspace visual launch preserves that boundary: no demo principals or transport
bypass were added, and client exports exclude server credentials. Protected
preview requests remain fail-closed pending verified HTTPS forwarding.
The dated sections below are historical.

## Latest security status — 20 September 2026

**NO-GO — overall readiness remains 48/100.** The new evidence verifies database transport and schema deployment in the user-confirmed dedicated non-production `wasalny_staging` database only. Production was not touched.

### Staging database evidence

- The original `mysql2` configuration ignored `ssl-mode`; shared verified-TLS handling in `server/_core/mysql-config.ts` was added. Optional `WASALNY_DATABASE_CA_PATH` may reference an uploaded public CA. This document records neither an environment-specific host nor a workspace-specific path.
- `mysql2` + Drizzle verified MySQL **8.4.8** using **TLS_AES_256_GCM_SHA384**. Staging was initially empty.
- All nine migrations were reviewed against schema/snapshots, generation reported no schema changes, and `COREPACK_ENABLE_PROJECT_SPEC=0 pnpm db:push` succeeded. All nine `__drizzle_migrations` records exist.
- `INFORMATION_SCHEMA` shows 13 application tables, all with zero rows. All 123 application columns match types, nullability, defaults, auto-increment, and on-update timestamps after normalizing equivalent MySQL `boolean`/`tinyint(1)` and `(now())`/`now()`/`CURRENT_TIMESTAMP` forms. No actual schema mismatch was found.
- Live primary keys and eight unique constraints match snapshots. SHA-256 hashes of all nine live migration journal entries match the checked-in SQL. No foreign keys exist.
- Domain storage was accounted for: vehicle/location in `driverProfiles`; requests/trips in `rides`; bids in `rideOffers`; favorites in `favoriteDrivers`; reviews in `rideRatings`; notifications in `notificationEvents` and `pushTokens`.
- Five focused MySQL configuration tests passed. Final local checks passed: `pnpm check`, `pnpm lint`, and `pnpm build`; `env -u WASALNY_DATABASE_URL COREPACK_ENABLE_PROJECT_SPEC=0 pnpm test` passed 26 tests with 2 skipped. The database was intentionally isolated, so this was not staging end-to-end evidence.

### Security verification not performed

No auth settings, `JWT_SECRET`, client OAuth settings, or controlled accounts were available. No actual OAuth authentication occurred. Login/session, cross-user IDOR, ride authorization, bidding/dispatch, concurrency, idempotency, and device security tests are **BLOCKED — NOT RUN**, not pass/fail results. The client is **Expo React Native, not Flutter**; Flutter-specific security testing is not applicable.

## Method

Static review of all tracked text/source/configuration/migration/test files at the audited main revision. Common secret patterns were scanned in tracked files; deployment values, Git history, object storage contents and live endpoints were not available.

| Finding | Severity | Attack scenario | Affected area | Mitigation | Fixed |
| --- | --- | --- | --- | --- | --- |
| Unauthenticated driver-document storage redirect | P0 | A caller who learns/guesses a `drivers/…` key obtains a signed object URL without proving ownership. | `server/_core/storageProxy.ts`, document storage flow | Authenticate document requests, lookup storage key, allow only owner/admin; reject unsafe keys. | **Yes, source patch in this commit; runtime test required** |
| Sensitive client logging | P1 | Device/debug logs can expose user profile data and OAuth callback details. | `app/oauth/callback.tsx`, `hooks/use-auth.ts` | Remove/redact release logs; ensure crash telemetry scrubs identity/auth context. | No |
| Global driver request disclosure | P1 | Any authenticated driver can enumerate open car requests outside its location/vehicle scope. | `listOpenCarRequests` and driver request route | Enforce current location, distance, vehicle, availability and active-trip policy server-side. | No |
| Weak geo filtering | P1 | Drivers may receive requests far away or unsuitable to their current location. | `listNearbyDrivers` | Geospatial radius query, freshness and vehicle checks. | No |
| Non-transactional bid finalization | P1 | Concurrent actions can leave offer records inconsistent or assign a busy driver. | `selectCarOffer` | Database transaction + conditional locks + idempotency keys. | No |
| Upload content trust | P2 | Crafted base64/MIME document can consume storage or bypass review expectations. | document upload/storage | Verify file signature/decoded size, scan content, retention/deletion and safe preview. | Partially—allowlist/path/base64 shape added |
| No FK/retention control for sensitive data | P2 | Orphaned private records, location history and documents may persist indefinitely. | Drizzle schema | Foreign keys, retention jobs, deletion/export policy. | No |
| Environment commit guard was incomplete | P2 | A developer can accidentally stage `.env` or environment-specific config. | `.gitignore` | Ignore `.env` and `.env.*`; retain only sample template. | **Yes** |

## Secret scan

No common literal credential pattern (Google API, GitHub token, Stripe key, AWS key, PEM key or database URL) was found in the 123 tracked text files. This does not prove secrets were never committed: inspect Git history and rotate any key that has ever been exposed.

## Required release controls

1. Rotate/restrict the Android Maps key and verify package + certificate restrictions.
2. Remove client logs before production and configure privacy-safe error reporting.
3. Run authenticated/unauthenticated storage regression checks for owner, another driver and admin.
4. Add API authorization tests for every ID-bearing mutation/query.
5. Define data retention/deletion for location, documents, trips, notifications and audit records.


## Phase 2 remediation update

| Finding | Updated state |
| --- | --- |
| Unauthenticated driver-document redirect | **FIXED IN SOURCE** from the audit commit; owner/admin guard still requires live authorization regression. |
| Sensitive client auth/OAuth logging | **FIXED FOR THE AUDITED FLOWS** in `362b300`: 52 client `console.*` calls were removed from the OAuth callback and auth hook, and raw authentication errors are no longer rendered. |
| Dispatch data exposure | **PARTIALLY FIXED** in `1ce75e4`: the server only returns nearby requested car rides to an eligible, online, fresh, unassigned car driver. |
| Bid assignment concurrency | **PARTIALLY FIXED**: row locks and a transaction protect the selected ride/driver path. A live concurrent DB test is still required. |

No live security test, production log sink inspection, Git-history credential scan or device authorization test was available in this phase.

## Phase 3 security execution update

- **Database isolation fixed:** Wasalny no longer consumes the generic runtime `DATABASE_URL`; only an explicit external-MySQL `WASALNY_DATABASE_URL` can initialize the MySQL client.
- **Dependency/toolchain validation executed:** blocked Vitest and outdated transitive packages were updated; Expo Doctor passed 18/18 after native dependency alignment.
- **Maps test corrected:** an Android-restricted key is no longer sent from a server-side test to a different Google REST product.
- **Document client validation aligned:** unsupported MIME values are rejected before upload.

### Security tests still blocked

- Family A versus Family B ride access.
- Driver A versus Driver B profile/location mutation.
- Normal user versus admin endpoints.
- Driver document owner/other-driver/admin access.
- Concurrent bid selection against MySQL.
- OAuth/session and logout integration.

No security claim is made for these workflows. No staging identities or provider credentials were supplied.
