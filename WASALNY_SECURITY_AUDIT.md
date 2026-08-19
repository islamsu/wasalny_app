# Wasalny Security Audit

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
