# Wasalny Bug Register

| ID | Severity | Area | Problem | Root Cause | File | Recommended Fix | Status |
| -- | -------- | ---- | ------- | ---------- | ---- | --------------- | ------ |
| WAS-001 | P0 | Privacy / storage | Driver document URLs could be requested without authentication when an object key was known. | Storage proxy signed every key without caller or owner check. | `server/_core/storageProxy.ts` | Authenticate `drivers/…` requests and allow only owner/admin; reject traversal-like keys. | **Fixed in this commit; runtime regression required** |
| WAS-002 | P1 | Dispatch | Driver request feed returns every requested car ride. | `listOpenCarRequests` has no driver location, vehicle, radius or active-trip predicate. | `server/db.ts`, `server/routers.ts` | Query current driver location; filter by radius/vehicle/freshness and exclude busy drivers. | Open |
| WAS-003 | P1 | Location | Nearby-driver match is an approximate degree box, not distance/radius logic. | Latitude/longitude range checks use fixed ±0.2 degrees. | `server/db.ts` | Use geospatial/Haversine query, safe radius config and spatial/indexed columns. | Open |
| WAS-004 | P1 | Trip / bidding | Offer selection is not one transaction and drivers can bid while assigned elsewhere. | State is spread across sequential updates without active-trip guard. | `server/db.ts` | Add transaction, lock/conditional updates, expiry and active-trip invariant. | Open |
| WAS-005 | P1 | Auth/privacy | OAuth/auth hooks log callback details and user data on the client. | Debug logging was left in release source. | `app/oauth/callback.tsx`, `hooks/use-auth.ts` | Remove/redact logs and prevent auth/user payload logging. | Open |
| WAS-006 | P1 | Reliability | UI uses local/mocked state for business-visible ride/driver data. | `useWasalnyState` and mock-map fixture are used alongside API data. | `lib/wasalny-state.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/driver.tsx` | Make server state authoritative; add refresh/reconnect and conflict UX. | Open |
| WAS-007 | P1 | Testing / release | No independently verified multi-user API/device lifecycle or CI workflow. | Helper tests do not cover real backend/database/device paths. | `tests/*`, repository root | Add CI, database-backed integration tests and Android build/device runs. | Open |
| WAS-008 | P2 | Upload security | Document upload accepts client-declared MIME and base64; no content inspection/malware scanning. | Metadata is trusted beyond allowlist validation. | `server/routers.ts`, `server/db.ts` | Validate bytes/server-detect type, scan, size-limit decoded data and retention/delete. | Partially reduced in this commit |
| WAS-009 | P2 | Database | Domain relationships lack foreign keys and query indexes. | Schema favours plain integer references. | `drizzle/schema.ts` | Add FK/index migration plan after data audit. | Open |
| WAS-010 | P2 | Product | `fast` vehicle type exists in schema without a documented business/dispatch flow. | Enum expanded beyond defined requirements. | `drizzle/schema.ts` | Decide whether to remove or implement Fast flow. | Requires product decision |
| WAS-011 | P2 | Notifications | Push tickets are not processed and tokens are not pruned after failures. | Send response is returned without receipt lifecycle. | `server/push.ts` | Store tickets, poll receipts, invalidate dead tokens and retry safely. | Open |
| WAS-012 | P2 | Android/maps | Production maps, routes, location permissions and Google key restrictions are unverified. | Managed config and mock fallback; no device/provider evidence. | `app.config.ts`, native map files | Validate physical release build with restricted key and provider billing. | Open |
| WAS-013 | P3 | Environment | Ignore rules did not cover `.env`/non-local `.env.*` files. | Narrow gitignore pattern. | `.gitignore` | Ignore all local env variants and provide a safe template. | **Fixed in this commit** |


## Phase 2 status update

| ID | Updated status | Evidence | Remaining verification |
| -- | -- | -- | -- |
| WAS-001 | FIXED IN SOURCE | Prior document-owner/admin proxy guard remains in place. | Authenticated owner/other-driver/admin live regression. |
| WAS-002 | PARTIALLY FIXED | Driver request feed now uses persisted driver location, 5 km exact distance, vehicle, fresh/online/approved and no-active-trip gates. | Real database/device flow and indexes at scale. |
| WAS-003 | PARTIALLY FIXED | Valid coordinate ranges and 15-minute staleness threshold are enforced; exact distance is applied after candidate filter. | Background updates, spoofing controls and spatial indexing. |
| WAS-004 | PARTIALLY FIXED | Bid selection is transactional with ride/driver locks and rechecks. | Real concurrent database test and explicit idempotency keys. |
| WAS-005 | FIXED FOR AUDITED CLIENT FLOWS | OAuth callback and auth hook no longer log callback/user data; errors are generic. | Full release-log and crash-report configuration review. |
| WAS-006 | PARTIALLY FIXED | Nearby-driver display no longer reads mock-map data; server returns actual nearby profiles. | Ride-stage UI and document/subscription state still have local representations. |
| WAS-007 | UNFIXED | Policy test was added but not run; no CI/device integration evidence. | Run test/build/device matrix. |
| WAS-008 | PARTIALLY FIXED | Upload metadata, path and base64 shape are validated. | Content inspection, malware scanning and retention. |

## Phase 3 execution findings

| ID | Priority | Area | Finding | Phase 3 status | Evidence / next action |
| --- | --- | --- | --- | --- | --- |
| WAS-014 | P1 | Database configuration | Generic `DATABASE_URL` allowed the MySQL client to consume an unrelated PostgreSQL URL. | **FIXED; automated regression observed indirectly** | Wasalny now reads only `WASALNY_DATABASE_URL`; governance test no longer attempts port 3306 on the Replit PostgreSQL host. |
| WAS-015 | P1 | Expo dependencies | SDK 54 had missing/majorly incompatible native packages, including Expo 57 pickers. | **FIXED; Expo Doctor 18/18** | Compatible SDK 54 versions and native peers installed. |
| WAS-016 | P1 | React lifecycle | Root layout returned before later hooks, violating Hook ordering. | **FIXED; lint/typecheck pass** | Loading return moved after all hooks. |
| WAS-017 | P1 | Document upload | Client could send a MIME string rejected by the server enum. | **FIXED; typecheck pass** | Picker now allows/normalizes JPEG, PNG and PDF only. |
| WAS-018 | P1 | Idempotency | Ride creation and ride status changes have no server request key/replay result. | **OPEN** | Add schema-backed idempotency and live retry tests. |
| WAS-019 | P1 | Server authority | Family active-ride UI still simulates driver acceptance/progression and hardcodes trip details. | **OPEN** | Replace local stage with active ride/detail polling and role-limited server transitions. |
| WAS-020 | P1 | Authorization | Family/driver status mutation permissions are broader than the required lifecycle policy. | **OPEN** | Add role-specific transition rules and authenticated API tests. |
