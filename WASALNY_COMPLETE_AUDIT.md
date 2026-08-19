# Wasalny Complete Repository Audit

**Audit date:** 19 August 2026 (Asia/Riyadh)  
**Repository revision inspected:** `main` at tree `0d2a9c7829de182b1bda05941df56d62101df903`  
**Decision:** **NOT PRODUCTION READY**

## Scope and evidence

This assessment inspected all 159 entries in the repository tree and all 123 tracked text/source/configuration/migration/test files at the revision above. It is a source-level audit; no production credentials, physical Android device, real map provider, deployed API, database, or push account was available. Therefore, a UI screen or a previously-written report was never treated as proof that a workflow works. Build/test results in older repository documents were not independently rerun.

## Executive summary

Wasalny is an Expo/React Native application with an Express/tRPC API and MySQL/Drizzle persistence layer. It has useful foundations—authenticated tRPC procedures, Arabic-first screens, driver profiles, trip records, offers, favorites, ratings, notifications, moderation and audit tables. It is **not** ready to operate a real transportation marketplace: the client still owns key flow state, matching is not a proper geo/availability workflow, no complete multi-user ride lifecycle has been executed, and several privacy, authorization, and operational controls remain incomplete.

This commit fixes one verified critical privacy exposure: stored driver identity documents are no longer served through the storage proxy to an unauthenticated caller; only the document owner or an administrator can retrieve a `drivers/…` object. It also validates upload metadata/base64 format and adds an environment-file guard.

## Architecture map

`Family / Driver / Admin → Expo Router React Native client → tRPC client → Express + tRPC router → Drizzle ORM → MySQL → Forge object storage / Expo Push / Google Maps native SDK`

| Layer | Evidence | Assessment |
| --- | --- | --- |
| Client | Expo 54, React 19, React Native 0.81, Expo Router 6, TypeScript | Arabic/RTL UI is present; important ride and driver state is partly local. |
| API | Express 4 + tRPC 11 in `server/routers.ts` | Authenticated procedures and role checks exist, but policy is scattered and error mapping is weak. |
| Auth | SDK session verification; HTTP-only cookie flow | Authentication is provider-dependent; session/request security requires runtime verification. |
| Data | MySQL + Drizzle | Core entities exist, but foreign keys, geo indexes, and several domain constraints are absent. |
| Storage | Forge presigned object storage | Driver-document proxy is hardened in this commit; malware/content scanning and retention are still absent. |
| Realtime | Expo Push | Event sends exist; receipt processing, retry, token cleanup and device delivery are unverified. |
| Maps/location | expo-location + react-native-maps | Native map exists; client uses mock map data and real provider configuration is unverified. |

## Verified feature inventory

| Feature | Status | Source evidence | Production assessment |
| --- | --- | --- | --- |
| Sign-in/session lookup/logout | 🟡 Partially implemented | SDK context, auth routes, OAuth callback | No independent login/session test; client callback logs sensitive user data. |
| Family ride creation | 🟡 Partially implemented | `rides.create`, Drizzle ride model | Persistent ride exists, but duplicate/idempotency, address/geocoding and real recovery behavior are not verified. |
| Car vs tuk-tuk selection | 🟡 Partially implemented | `vehicleType` enum and family UI | Distinct values persist, but `fast` is also in schema without a defined business flow. |
| Driver online/location | 🟡 Partially implemented | `profile.availability`, `driverProfiles` | No coordinate bounds/pair validation, background behavior, accuracy, anti-spoofing or device validation. |
| Nearby drivers | 🔴 Implemented but unsafe/incomplete | `listNearbyDrivers` | Uses a ±0.2-degree box, not a radius; missing vehicle filter and client visualizes mocks. |
| Driver request feed | 🔴 Implemented but broken for production | `listOpenCarRequests` | Every authenticated driver receives all open car requests; no location or vehicle-aware dispatch. |
| Bids/offers | 🟡 Partially implemented | `rideOffers`, `createCarOffer`, `selectCarOffer` | Basic selection guard exists, but no expiry, withdrawal route, active-trip exclusion or transaction across offer updates. |
| Ride transitions | 🟡 Partially implemented | `updateRideStatus` | Ownership checks and basic state graph exist; actor-specific transition policy, concurrency/idempotency and recovery are incomplete. |
| Favorites | 🟡 Partially implemented | unique favorite index, CRUD | Add/remove/list work in source; no favorite-driver request/dispatch semantics. |
| Ratings | 🟡 Partially implemented | completed-ride check + unique index | Server-side completion/ownership check exists; no moderation or publication policy. |
| Driver documents | 🟡 Partially implemented | upload/review tables + storage | Access control hardened here; MIME/content scanning, retention, delete and reviewer viewing UX remain missing. |
| Family complaints/moderation | 🟡 Partially implemented | complaint/violation/audit procedures | Role checks exist; notification and global operations workflow are incomplete. |
| Notifications | 🟡 Partially implemented | Expo token storage/sends | Push receipts, invalid token cleanup, retry and device behavior unverified. |
| Admin panel | 🟡 Partially implemented | admin routes/UI | Destructive actions have audit rows, but the app needs end-to-end admin permission tests. |
| Maps/geocoding/navigation | ❓ Cannot be verified | native map component + mock fixture | Provider key, billing, routes and physical device validation unavailable. |
| Offline/recovery | ❌ Missing verification | no durable command/outbox evidence | No proven handling for interrupted booking, offer selection or active trips. |

## Critical findings

1. **P0—driver identity documents were accessible through an unauthenticated storage redirect if their object key was known.** The proxy previously requested a signed URL for every `/manus-storage/*` key without authenticating or authorizing the caller. This commit restricts `drivers/…` objects to the owner or an admin and rejects traversal-like keys.
2. **P1—driver dispatch is not location-based.** `listOpenCarRequests` returns all requested car rides with no driver location, radius, vehicle or active-trip constraint.
3. **P1—client mock/local state diverges from persisted truth.** Family and driver tabs use `useWasalnyState` and mock-map data for important visible state. That does not prove the same ride is reflected on another device.
4. **P1—ride/bid concurrency is insufficiently modelled.** The conditional ride update helps protect a single selection, but offer rejection/selection is not transactional and driver active-trip exclusion is absent.
5. **P1—observability leaks user/authentication data.** OAuth and auth hooks contain extensive client logs of callback details and user objects. Remove/redact them before release.

## Security, privacy and operations

- No committed secret matching common Google, GitHub, Stripe, AWS, PEM or database-URL patterns was found in the 123 tracked text files. This does **not** cover prior Git history or deployment configuration.
- `.gitignore` now ignores `.env` and `.env.*` while retaining `.env.example`; replace any already-exposed credential rather than assuming ignore rules remove history.
- The schema stores sensitive document metadata, location coordinates, phone/email, push tokens, trip histories and audit data. It lacks demonstrated retention/deletion/privacy-consent controls.
- Most domain references are integer fields without foreign keys. Add FK/index strategy before volume grows.
- API errors are mainly generic `Error` instances, making correct HTTP/tRPC error classification and Arabic user messaging inconsistent.

## Quality, performance and Android

- There are 9 Vitest files, but they mainly test helpers/fixtures; `auth.logout.test.ts` is skipped and no full API/database/device flow was run in this audit.
- No GitHub Actions workflow runs are present at inspection time.
- Expo config targets Android min SDK 24 and requests notification permission. Location plugin configuration exists, but release permissions, background location, signing, target/compile SDK and real Google Maps restrictions cannot be verified from this managed Expo repository.
- Nearby-driver filtering uses degree comparisons rather than geospatial distance and lacks supporting indexes, creating incorrect matches and a scaling risk.

## Recommended roadmap

1. **Block release:** execute security regression for protected documents; remove client sensitive logs; rotate any historically exposed secrets; implement a privacy/retention policy.
2. **Make dispatch real:** server-side Haversine/geospatial query with current-location freshness, vehicle type, availability and active-trip exclusion; add radius indexes.
3. **Make rides transactional:** model offers, assignment and lifecycle transitions in database transactions with idempotency keys and actor-specific rules.
4. **Replace UI fixtures:** have both family and driver flows use persisted API data and defined reconnect/reload behavior.
5. **Prove release:** add API integration tests with two identities, emulator/device tests, database migration test, Android debug/release build, push receipt tests and a production configuration checklist.


## Phase 2 remediation update — 19 August 2026

Three focused commits were applied after the initial audit:

1. `1ce75e4` — server-side location-aware dispatch and transactional bid assignment.
2. `362b300` — removal of sensitive client authentication diagnostics.
3. `2bd761b` — replacement of the nearby-driver mock display with a server query and foreground GPS upload before a driver goes online.

### What changed

- Dispatch now uses a **server-owned 5 km radius** and an exact Haversine distance check. The server accepts only valid coordinates, filters to online/active/subscription-approved drivers with a location no older than **15 minutes**, and filters by requested vehicle type.
- A driver's ride feed is derived from their own persisted current location; it returns no work to an offline, stale, ineligible, non-car, or already-busy driver.
- Offer creation validates the same driver eligibility, freshness, active-trip and distance constraints instead of trusting the UI.
- Offer selection now runs in a database transaction, locks the ride and selected driver rows, rechecks eligibility/active trips, conditionally assigns exactly one driver, and closes competing pending offers.
- The family nearby-driver panel now consumes `drivers.nearby` rather than `shared/mock-map`; the driver online action sends foreground GPS coordinates and updates its local visual state only after a successful server response.
- Sensitive `console.*` calls were removed from the OAuth callback and authentication hook; authentication failures now use generic user-safe messages.

### Current limits — still NO-GO

This improves server authority but does **not** prove a production workflow. Background location, Android/device behavior, database transaction behavior under real concurrency, idempotency keys for create/cancel/status actions, automated end-to-end API tests, Maps/push/provider configuration, and Android builds remain unverified. Foreground GPS only is deliberately documented as a limitation; it is not a substitute for a background-location policy.

A focused Vitest file, `tests/dispatch-location.test.ts`, was added for coordinate, distance, and stale-location policy. It was **not executed** in this GitHub-only environment.

## Phase 3 execution update — 19 August 2026

Phase 3 moved from source inspection to commands that could be executed without external credentials.

### Executed successfully

- Dependency installation completed after updating the blocked Vitest dependency and security-sensitive transitive packages.
- `pnpm check` passed.
- `pnpm lint` passed with zero findings.
- `pnpm test` passed **21 tests**; the live-key Maps test and logout integration test remain skipped.
- `pnpm build` produced the server bundle.
- The compiled Express server started and `/api/health` returned an actual successful response.
- Expo Doctor passed **18/18 checks** after correcting SDK 54 dependency mismatches and a missing native peer.
- Expo produced an Android Hermes/asset export.

### Source fixes discovered through execution

- The external MySQL URL now uses `WASALNY_DATABASE_URL`; the application no longer mistakes Replit's PostgreSQL `DATABASE_URL` for MySQL.
- Root React Hooks now execute before the font-loading return.
- Driver document uploads normalize/validate JPEG, PNG and PDF MIME values before invoking the server mutation.
- Google Maps tests now validate Android Expo configuration rather than incorrectly calling the Geocoding REST API with an Android-restricted key.

### Blocked, not verified

No staging secrets were supplied. Therefore MySQL connectivity/migrations, OAuth, storage, Maps rendering, push, controlled accounts, real rides/bids, IDOR, concurrency, native APK/AAB and devices remain **BLOCKED**. The production question is still unanswered.

See `WASALNY_INFRASTRUCTURE_REQUIREMENTS.md` for the full service matrix and exact unblock sequence.
