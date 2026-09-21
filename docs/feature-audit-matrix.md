# Wasalny Feature Audit Matrix

**Audit stage:** Living implementation matrix; refreshed after each validated product group.
**Scope:** Family, car driver, tuk-tuk driver, admin, trip lifecycle, backend, database, GPS, notifications, authentication, Android/RTL, and planned favorite-driver and bidding work.

## Classification key

| Status | Meaning |
|---|---|
| Working | Verified by implementation and deterministic tests, with no known end-to-end gap in the inspected path. |
| Partially working | A visible or local flow exists, but persistence, authorization, real-time behavior, or a related workflow is incomplete. |
| Not working | The requested capability has no complete implementation or has a confirmed root-cause defect. |
| Cannot be verified | Requires device/provider/account/database conditions unavailable to deterministic inspection. |

## Initial matrix

| Area | Feature | Status | Current behavior | Root cause / required fix | Testing method |
|---|---|---:|---|---|---|
| Family | Role-aware route entry | Working | Firebase establishes identity, the backend returns one authoritative application role, and the tab layout exposes only Family routes to Family accounts. Direct Driver/Admin tab navigation redirects to the authorized Family home. | Real multi-account browser acceptance remains separate from deterministic routing and API authorization evidence. | Role-routing, protected-procedure, and router regression tests; rebuilt web preview. |
| Family | Account/login/logout | Partially working | Genuine Google sign-in and ordinary-family session issuance were completed once. Client session rotation and logout behavior have deterministic coverage. | Real refresh/logout/re-login acceptance still needs a controlled browser session. Phone verification is intentionally deferred because Firebase SMS requires linked billing. | Real Google evidence plus auth integration and client-session tests. |
| Family | GPS detection and reverse geocoding | Partially working | Foreground location permission and location acquisition are implemented. | Provider permissions, disabled GPS, accuracy, offline behavior, and Android device behavior require physical-device validation; map tiles may be unavailable. | Android permission matrix and mocked error tests. |
| Family | Nearby drivers | Partially working | Family screen renders deterministic mock drivers and backend has a nearby-driver query. | UI uses mock data; backend geographic query uses incomplete bounding conditions and does not calculate a true distance/radius. | Unit tests for distance/radius and API integration tests. |
| Family | Create ride request | Partially working | Ride creation calls the backend and rejects moderated families. | No complete driver-facing request, offer, selection, or concurrency flow is exposed; related ride ownership and status authorization require hardening. | Multi-user API lifecycle tests. |
| Family | Car request | Partially working | Vehicle type can be sent as `car`. | No persistent offer/bid model or comparison/selection workflow exists. | Bid lifecycle tests after implementation. |
| Family | Tuk-tuk request | Partially working | Vehicle type can be sent as `toktok`. | No complete driver request-receipt and acceptance lifecycle exists. | Driver/family lifecycle tests after implementation. |
| Family | Trip status and active trip | Partially working | Ride status mutation exists and UI includes local progression states. | Status mutation does not verify caller ownership or legal state transitions; active tracking is not fully server-backed. | State-machine and authorization tests. |
| Family | Ride history | Partially working | `rides.mine` is user-scoped and the history screen uses it. | Screen falls back to hardcoded rows and static KPI values when data is absent; receipt download is local UI state. | Empty/loading/error/restart tests. |
| Family | Cancellation | Partially working | `cancelled` is an accepted status value. | No policy, ownership, race, notification, or cancellation UI contract is fully verified. | Authorized cancellation and race tests. |
| Family | Rating/review | Not working | No persistent rating/review entity or complete API was found. | Add rating schema, protected mutation, uniqueness, and driver aggregate display. | Family-to-driver rating lifecycle test. |
| Family | Favorite drivers | Not working | No persistent favorite relationship or complete UI/API flow was found. | Add favorite table, ownership constraints, add/remove/list/request procedures, and UI. | Persistence and logout/login tests. |
| Driver | Registration and documents | Partially working | Driver document selection, validated uploads, profile retrieval, and submission use protected server procedures and persistent storage metadata. | Real approved-driver onboarding, review, reload, and device upload acceptance remain unexecuted. | Storage authorization, onboarding idempotence, and real-device upload tests. |
| Driver | Car and tuk-tuk profiles | Partially working | Vehicle choice and profile creation are persisted through protected procedures. | A legitimate Driver identity and Admin approval are still needed for real acceptance. | Per-vehicle profile API and controlled staging tests. |
| Driver | Verification and subscription eligibility | Partially working | The screen reads persistent profile, document, subscription, and account status; server eligibility gates availability and dispatch. | Complete Admin approval and commercial-policy acceptance are not yet executed with real identities. | Eligibility, authorization, and controlled staging tests. |
| Driver | Online/offline and availability | Partially working | Availability updates use server procedures with current location and persistent profile state. | Background heartbeat and physical-device permission/reconnect behavior remain unverified. | Dispatch-location tests and Android device matrix. |
| Driver | Nearby requests and bidding | Partially working | Eligible online drivers can query location-filtered requests and submit server-validated, idempotent offers. Family offer comparison and controlled multi-driver acceptance remain incomplete. | Complete the Family comparison/selection UI and execute real multi-identity staging acceptance. | Bidding, dispatch, concurrency, and multi-driver lifecycle tests. |
| Driver | Start/complete/history/earnings | Partially working | Ride status schema supports several states and history query is family-scoped. | Driver-scoped reads and mutations, earnings/subscription reporting, and legal transitions are incomplete. | Driver authorization and lifecycle tests. |
| Admin | Dashboard and settings | Partially working | KPI/navigation/settings/audit UI exists and settings persist. | Several dashboard sections remain static or fixture-driven; complete CRUD coverage for every advertised admin area is not verified. | Admin route/API tests and persistence checks. |
| Admin | Family governance | Working | Family directory, moderation reasons, custom temporary duration, complaint history, status filters, notes, and audit updates are implemented. | Needs regression validation against full auth/session behavior and notification delivery on real devices. | Governance tests and admin integration tests. |
| Admin | Driver governance | Partially working | UI states and subscription review are present. | Complete persistent driver list, document review, freeze/suspend actions, and audit coverage require broader verification. | Admin-driver integration tests. |
| Admin | Complaint management | Partially working | Search, status filters, linked ride details, status editing, notes, and audit update API exist. | Search currently operates within the selected family detail rather than a global complaint index; notification to the family on status change is not implemented. | Complaint API/UI tests. |
| Backend | Authentication and authorization | Partially working | Firebase identity, Wasalny sessions, current server role/status checks, protected procedures, and fail-closed client route isolation are implemented. | Real two-account IDOR and Admin/Driver acceptance remain unexecuted. | Auth, role-routing, authorization, outage, and controlled staging tests. |
| Backend | Ride authorization | Partially working | Ride mutations enforce actor role/ownership, legal transitions, idempotency, and transactional assignment constraints. | Real authenticated multi-user HTTP acceptance and refresh/replay interaction remain unexecuted. | Ride-state, authorization, idempotency, concurrency, and real staging tests. |
| Backend | Nearby-driver calculation | Partially working | Dispatch applies coordinate validation, bounded distance, driver eligibility, busy exclusion, and location freshness. | Real moving-device and multi-driver dispatch acceptance remain unexecuted. | Dispatch boundary/freshness tests and controlled staging flow. |
| Backend | Notifications | Partially working | Push token registration and several push sends exist. | Full event matrix is not implemented; duplicate prevention, delivery result handling, and all lifecycle events require tests. | Notification payload and deduplication tests. |
| Database | Relationships and referential integrity | Partially working | Core tables exist for users, drivers, rides, complaints, violations, tokens, settings, and audit. | Tables use integer references without declared foreign keys or uniqueness constraints for several domain relationships. | Schema inspection and consistency tests. |
| Android/RTL | Arabic RTL and typography | Working | Cairo font, RTL root direction, Arabic labels, and responsive styling are implemented. | Physical Android screen sizes, keyboard, navigation, notifications, and background behavior remain unverified. | Android device matrix. |
| Maps | Real map tiles/geocoding | Cannot be verified | Native map path exists and mock-map fallback is used. | Google Maps credential/provider validation previously failed; real tiles require valid provider configuration and billing. | Physical Android/provider validation. |
| Regression | Complete Family → Driver → Trip → Rating → Admin flow | Not working | Deterministic tests cover only selected helpers and governance/settings fixtures. | Current automated coverage does not execute the full UI/API/multi-user lifecycle. | New contract/integration/E2E test suite. |

## Highest-priority root causes

1. **The Admin experience still mixes real procedures with fixture-driven dashboard content.** Static KPIs, rides, driver cards, and local moderation actions must not imply authoritative operations.
2. **Family offer comparison and real multi-role acceptance are incomplete.** Server bidding and assignment controls exist, but the full Family selection experience and controlled identity flow need completion.
3. **Commercial configuration is not yet a complete versioned monetization engine.** Current settings/subscription support does not prove Commission, Hybrid, Promotion expiry, or immutable completed-ride snapshots.
4. **Maps and device behavior remain separate evidence gaps.** Web/server checks cannot prove Android GPS, background behavior, push delivery, or native authentication.
5. **Localization and accessibility remain incomplete.** Arabic is dominant, user-facing strings are scattered, and several controls need semantic labels and resilient keyboard/small-screen behavior.

## Audit decision

The application should not yet be classified as production-ready. The next implementation order is to remove fixture-driven Admin behavior, complete authoritative commercial configuration and snapshots, finish Family offer selection, then execute controlled multi-role staging acceptance. Android/device evidence remains explicitly deferred.
