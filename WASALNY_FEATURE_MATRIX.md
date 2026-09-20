# Wasalny Feature Matrix

## Latest evidence — 20 September 2026

**Current decision: NO-GO — 48/100.** The dedicated non-production `wasalny_staging` database was verified and migrated; production was not touched. This changes database setup from blocked to verified, but does not verify any product workflow.

### Staging database evidence

| Capability | Latest result |
| --- | --- |
| Connection security | PASS — shared `server/_core/mysql-config.ts` compensates for `mysql2` ignoring `ssl-mode`; verified MySQL 8.4.8 with `TLS_AES_256_GCM_SHA384`. Optional `WASALNY_DATABASE_CA_PATH` supports an uploaded public CA. |
| Migration review | PASS — all nine migrations reviewed against schema/snapshots; generation reported no schema changes. |
| Migration execution | PASS — exact command `COREPACK_ENABLE_PROJECT_SPEC=0 pnpm db:push`; nine `__drizzle_migrations` records present. |
| Live schema | PASS — 13 app tables, all zero rows; all 123 app columns match types, nullability, defaults, auto-increment, and on-update timestamps after normalizing equivalent `boolean`/`tinyint(1)` and `(now())`/`now()`/`CURRENT_TIMESTAMP` forms. No actual schema mismatch. |
| Keys, constraints, journals | PASS — primary keys and eight unique constraints match snapshots; SHA-256 hashes of all nine live migration journal entries match checked-in SQL; no foreign keys. |
| Domain/table mapping | VERIFIED — vehicle/location in `driverProfiles`; requests/trips in `rides`; bids in `rideOffers`; favorites in `favoriteDrivers`; reviews in `rideRatings`; notifications in `notificationEvents`/`pushTokens`. |
| Final local validation | PASS — five MySQL configuration tests, `pnpm check`, `pnpm lint`, and `pnpm build`; isolated `env -u WASALNY_DATABASE_URL COREPACK_ENABLE_PROJECT_SPEC=0 pnpm test` passed 26 tests with 2 skipped. Intentional isolation means this was not staging E2E. |
| Auth and workflows | **BLOCKED — NOT RUN** — no auth settings, `JWT_SECRET`, client OAuth settings, or test accounts; no actual OAuth authentication and no login, IDOR, ride, bidding, dispatch, concurrency, idempotency, or device result. |

The current application stack is **Expo React Native, not Flutter**; Flutter-specific validation is not applicable.

**Legend:** “Verified” means established from source/constraints only; it does not mean a real device, database, provider or multi-user runtime was exercised.

| Feature | UI | Backend | Database | Tested | Working | Production Ready |
| ------- | -- | ------- | -------- | ------ | ------- | ---------------- |
| Sign-in/session | Yes | Yes | Users | Skipped logout test; no live test | Cannot verify | No |
| Family profile | Partial | Provider-derived | Users | No | Cannot verify | No |
| Driver profile | Yes | Yes | Driver profiles | No API/DB test | Partial | No |
| Car/tuk-tuk request choice | Yes | Yes | Rides | Helper/UI evidence | Partial | No |
| Family ride creation | Yes | Yes | Rides | No integration test | Partial | No |
| Nearby drivers | Mocked view | Partial | Driver profiles | Helper/mocks only | No | No |
| Driver request dispatch | Yes | Yes | Rides | No multi-user test | No | No |
| Car bidding | Yes | Yes | Ride offers | Helper tests | Partial | No |
| Tuk-tuk dispatch | UI/model only | No equivalent offer flow | Rides | No | No | No |
| Offer selection | Yes | Yes | Rides/offers | Helper tests only | Partial | No |
| Ride lifecycle | Yes | Yes | Rides | Helper tests only | Partial | No |
| Family cancellation | UI/API route path | Partial | Rides | No integration test | Cannot verify | No |
| Driver arrival/start/complete | UI/API route path | Partial | Rides | No integration test | Cannot verify | No |
| Ratings | Yes | Yes | Ride ratings | Summary helper test | Partial | No |
| Favorite drivers | Yes | Yes | Favorites | No end-to-end test | Partial | No |
| Driver documents | Yes | Yes | Documents/object storage | No storage auth regression | Partial | No |
| Push notifications | Yes | Yes | Push tokens/events | No physical delivery test | Cannot verify | No |
| Complaints/moderation | Yes | Yes | Complaints/violations/audit | Governance fixture tests | Partial | No |
| Admin settings/audit | Yes | Yes | Settings/audit logs | Fixture tests | Partial | No |
| Maps/geocoding/routes | Native/mock | No verified route API | N/A | Map key test exists but no provider run | Cannot verify | No |
| Offline/recovery | No proven flow | No outbox/idempotency | N/A | No | No | No |
| Arabic RTL/accessibility | Yes | N/A | N/A | No device/a11y run | Partial | No |
| Android release | Config only | N/A | N/A | No build evidence from this audit | Cannot verify | No |


## Phase 2 status update

| Feature | New status | Notes |
| --- | --- | --- |
| Nearby drivers | Partially working | Server now applies fixed 5 km Haversine radius, freshness and eligibility; client reads this API. Not device verified. |
| Driver request dispatch | Partially working | Server derives requests from persisted driver location and active-trip state. Foreground GPS is sent on going online. |
| Car bidding | Partially working | Server validates location/eligibility and assigns selected offer inside a transaction. Concurrency not run against a real database. |
| Authentication privacy | Partially working | Audited client auth/OAuth logs removed and user-facing errors sanitized. End-to-end auth unverified. |
| Offline/background location | Missing | No background service, durable outbox or reconnect test was implemented. |

## Phase 3 executed evidence

| Feature | Source/build result | Real infrastructure result |
| --- | --- | --- |
| Backend process and health | PASS — compiled server started and health endpoint responded | Staging deployment not tested |
| Type safety | PASS — `pnpm check` | N/A |
| Lint | PASS — zero findings | N/A |
| Automated tests | PASS — 21; 2 skipped | Helper/router tests only, not live E2E |
| Expo SDK compatibility | PASS — Doctor 18/18 | Device runtime not tested |
| Android JS/Hermes bundle | PASS | Native APK/AAB and device blocked |
| MySQL schema/migrations | Source present | BLOCKED — no staging MySQL |
| Authentication | Source present | BLOCKED — no provider/accounts |
| Storage | Source present | BLOCKED — no Forge endpoint/key |
| Maps | Expo config wiring test passed | BLOCKED — no restricted key/build/device |
| Push | Source present | BLOCKED — no project tokens/devices |
| Family → driver ride lifecycle | Local/helper logic present | BLOCKED; local simulated stages remain |
| Bid concurrency | Transaction code present | CONCURRENCY NOT VERIFIED |
| IDOR/document access | Source guards present | BLOCKED — authenticated identities unavailable |
