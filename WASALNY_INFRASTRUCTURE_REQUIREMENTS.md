# Wasalny Infrastructure Requirements

**Phase 3 evidence date:** 19 August 2026  
**Source baseline:** `f18c8f30510abf5997f6bce112a78d79461ada81` plus the Phase 3 fixes documented below  
**Environment used:** isolated local validation environment with no Wasalny staging credentials and no physical Android device

This document distinguishes source inspection from commands that were actually executed. It never records secret values.

## Infrastructure status

| Service | Purpose | Required configuration | Current status | Reachable | Verified | Blocker |
| --- | --- | --- | --- | --- | --- | --- |
| Express/tRPC backend | Health, OAuth callbacks, ride/driver/admin API, storage proxy | Node 24, package install, `PORT`; service-specific variables below | Local dependencies installed | Yes, local only | **PASS — local health** | Staging deployment not supplied |
| MySQL + Drizzle | Users, drivers, rides, offers, documents, ratings, notifications, settings, audit | Non-production MySQL URL in `WASALNY_DATABASE_URL`; nine checked-in migrations | Not configured | Not tested | **BLOCKED** | Staging MySQL secret declined/not supplied |
| External OAuth | Family, driver and admin identity/session exchange | `OAUTH_SERVER_URL`, `VITE_APP_ID`, client `EXPO_PUBLIC_*` OAuth values, owner OpenID, JWT secret | Not configured | Not tested | **BLOCKED** | Provider URLs/app registration/test identities not supplied |
| Forge object storage | Presigned upload/download and protected driver documents | `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` | Not configured | Not tested | **BLOCKED** | Staging Forge endpoint/key not supplied |
| Google Maps SDK for Android | Native map, markers, route display and location | Android-restricted `GOOGLE_MAPS_ANDROID_API_KEY`, enabled Maps SDK, billing, package/signing restrictions | Source wiring tested; key absent | Provider not tested | **BLOCKED** | Key, Android build and device unavailable |
| Expo Push | Bid, assignment and ride-status notifications | Expo project ID, real Expo push tokens, two devices | Source present | Provider/device not tested | **BLOCKED** | No Expo project/device tokens or hardware |
| Expo SDK 54 toolchain | Type checking, linting, Metro/Hermes bundle | Compatible native packages and peers | Configured | Local | **PASS — 18/18 Doctor** | None for local toolchain |
| Android JS/Hermes export | Compile Android application JavaScript/assets | Expo SDK 54 dependencies | Configured | Local | **PASS** | This is not an APK/AAB |
| Native Android debug/release | APK/AAB, manifest merge, permissions, R8 and signing | Generated/native Android project, Android SDK/Gradle and signing for release | No `android/` project checked in | Not tested | **BLOCKED** | Managed Expo source only; no native build/signing environment |
| Physical devices | Real GPS, foreground/background state, app restart, network interruption and push | At least two Android devices and staging accounts | Not available | No | **BLOCKED** | Device verification unavailable |

## Required environment variables

### Server and database

- `WASALNY_DATABASE_URL` — non-production MySQL connection string. This name is intentionally separate from Replit's built-in PostgreSQL `DATABASE_URL`.
- `JWT_SECRET` — session-token/cookie signing secret.
- `OAUTH_SERVER_URL` — OAuth server base URL.
- `VITE_APP_ID` — OAuth application identifier used by the server.
- `OWNER_OPEN_ID` — controlled identity promoted to admin.
- `BUILT_IN_FORGE_API_URL` — Forge object-storage API base URL.
- `BUILT_IN_FORGE_API_KEY` — Forge object-storage credential.
- `PORT` — server listener port supplied by the runtime.

### Expo client

- `GOOGLE_MAPS_ANDROID_API_KEY` — restricted Android Maps SDK key.
- `EXPO_PUBLIC_OAUTH_PORTAL_URL`
- `EXPO_PUBLIC_OAUTH_SERVER_URL`
- `EXPO_PUBLIC_APP_ID`
- `EXPO_PUBLIC_OWNER_OPEN_ID`
- `EXPO_PUBLIC_OWNER_NAME`
- `EXPO_PUBLIC_API_BASE_URL`
- Optional callback overrides: `EXPO_WEB_PREVIEW_URL`, `EXPO_PACKAGER_PROXY_URL`

## Database and migrations

- Dialect: MySQL through `drizzle-orm/mysql2`.
- Configuration: `drizzle.config.ts`.
- Schema: `drizzle/schema.ts`.
- Migration history: `drizzle/0000_*.sql` through `drizzle/0008_*.sql` with Drizzle metadata snapshots.
- Migration command declared by the repository: `pnpm db:push`, which runs `drizzle-kit generate && drizzle-kit migrate`.
- Seed data: none found.
- Automated staging-account creation: none found.

**Migration result:** `BLOCKED — WASALNY_DATABASE_URL was not supplied.` No migration command was run against the built-in PostgreSQL database because it is the wrong database engine and the user did not authorize a migration.

## Executed command evidence

| Check | Actual result | Evidence classification |
| --- | --- | --- |
| Dependency install | PASS after updating blocked/vulnerable test transitive packages | Executed locally |
| `pnpm check` | PASS | Executed locally |
| `pnpm lint` | PASS, zero errors/warnings after config rename | Executed locally |
| `pnpm test` | PASS: 21 tests; two infrastructure/auth tests skipped | Executed locally; not live E2E |
| `pnpm build` | PASS; server bundle generated | Executed locally |
| Compiled server `/api/health` | PASS; returned `{ "ok": true, ... }` | Executed local runtime |
| Expo Doctor | PASS: 18/18 checks | Executed locally |
| Android Expo export | PASS; Hermes bundle and assets generated | Executed locally; not native debug/release |
| MySQL connection/migrations | BLOCKED | No staging MySQL secret |
| OAuth login/session | BLOCKED | No provider configuration/accounts |
| Storage upload/access | BLOCKED | No Forge credentials |
| Maps provider/rendering | BLOCKED | No key/build/device |
| Push delivery/tap routing | BLOCKED | No devices/project tokens |
| Concurrent bid acceptance | CONCURRENCY NOT VERIFIED | No staging database/accounts |
| IDOR/document authorization | BLOCKED | No authenticated staging identities |

The tests named `e2e-flows.test.ts` exercise helper/state logic; they are not real backend/database/device end-to-end evidence.

## Controlled accounts

No Family A, Driver A, Driver B or Admin staging account was created. Creating them would require a confirmed non-production OAuth/MySQL environment. No credentials were hardcoded.

## Exact unblock sequence

1. Supply a disposable MySQL staging URL as `WASALNY_DATABASE_URL` and confirm it is not production.
2. Supply staging OAuth/Forge/client environment configuration and create four controlled roles through the real provider.
3. Run checked-in migrations and compare live `INFORMATION_SCHEMA` tables, indexes and constraints with `drizzle/schema.ts`.
4. Execute the family → two drivers → bids → one assignment → arriving → active → completed workflow while querying database state after each action.
5. Run near-simultaneous bid-selection requests and IDOR/document authorization tests with the controlled identities.
6. Produce a native Android development/release build with the restricted Maps key, then test GPS, restart, network interruption and push on two devices.
