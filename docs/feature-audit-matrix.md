# Wasalny Feature Audit Matrix

**Audit stage:** Initial static and deterministic verification before implementing new functionality.  
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
| Family | Role selection and route entry | Partially working | Arabic role picker routes to family, driver, or admin screens and stores a local role. | Role selection is not the source of truth for authorization; connect UI role to server session and enforce role server-side. | Static review, protected-procedure tests, login/logout test. |
| Family | Account/login/logout | Partially working | OAuth/session infrastructure exists, while the visible role login is a local role picker with phone input and no complete OTP/password flow. | Separate presentation role selection from authenticated identity; validate server session persistence and unauthorized access. | Auth integration tests and restart/logout/login checks. |
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
| Driver | Registration and documents | Partially working | Driver screen uses document picker and shows local submission state. | Documents and submission state are component-local; no complete upload/storage/profile update path is wired from the screen. | Upload success/failure and restart tests. |
| Driver | Car and tuk-tuk profiles | Partially working | Vehicle selection and backend profile creation helper exist. | Driver screen does not use tRPC for profile persistence, verification, or profile retrieval. | Per-vehicle profile API tests. |
| Driver | Verification and subscription eligibility | Partially working | Schema and local eligibility state represent account/subscription gates. | Screen derives state from local context rather than persistent driver profile; no complete driver/admin synchronization is verified. | Backend eligibility and UI reload tests. |
| Driver | Online/offline and availability | Partially working | Online toggle exists locally. | No driver profile update procedure or server-side online-location heartbeat is exposed. | Permission, heartbeat, and eligibility tests. |
| Driver | Nearby requests, accept/reject, bidding | Not working | No complete driver request inbox, accept/reject, offer, or bid procedures were found. | Add request query, offer schema/API, state transitions, locking, notifications, and driver UI. | Multi-driver lifecycle tests. |
| Driver | Start/complete/history/earnings | Partially working | Ride status schema supports several states and history query is family-scoped. | Driver-scoped reads and mutations, earnings/subscription reporting, and legal transitions are incomplete. | Driver authorization and lifecycle tests. |
| Admin | Dashboard and settings | Partially working | KPI/navigation/settings/audit UI exists and settings persist. | Several dashboard sections remain static or fixture-driven; complete CRUD coverage for every advertised admin area is not verified. | Admin route/API tests and persistence checks. |
| Admin | Family governance | Working | Family directory, moderation reasons, custom temporary duration, complaint history, status filters, notes, and audit updates are implemented. | Needs regression validation against full auth/session behavior and notification delivery on real devices. | Governance tests and admin integration tests. |
| Admin | Driver governance | Partially working | UI states and subscription review are present. | Complete persistent driver list, document review, freeze/suspend actions, and audit coverage require broader verification. | Admin-driver integration tests. |
| Admin | Complaint management | Partially working | Search, status filters, linked ride details, status editing, notes, and audit update API exist. | Search currently operates within the selected family detail rather than a global complaint index; notification to the family on status change is not implemented. | Complaint API/UI tests. |
| Backend | Authentication and authorization | Partially working | Protected tRPC procedures and session context exist. | Several procedures accept client-provided IDs without resource ownership checks; local role state can diverge from server identity. | IDOR/security tests for every procedure. |
| Backend | Ride authorization | Not working | `updateRideStatus` updates by ride ID without enforcing family/driver ownership or role. | Add server-side caller role/resource checks and legal state-transition validation. | Unauthorized mutation and race tests. |
| Backend | Nearby-driver calculation | Partially working | Query filters online/active/approved profiles using latitude/longitude lower bounds. | Missing upper bounds, radius calculation, vehicle/availability constraints, and stale-location handling. | Geospatial boundary and stale-location tests. |
| Backend | Notifications | Partially working | Push token registration and several push sends exist. | Full event matrix is not implemented; duplicate prevention, delivery result handling, and all lifecycle events require tests. | Notification payload and deduplication tests. |
| Database | Relationships and referential integrity | Partially working | Core tables exist for users, drivers, rides, complaints, violations, tokens, settings, and audit. | Tables use integer references without declared foreign keys or uniqueness constraints for several domain relationships. | Schema inspection and consistency tests. |
| Android/RTL | Arabic RTL and typography | Working | Cairo font, RTL root direction, Arabic labels, and responsive styling are implemented. | Physical Android screen sizes, keyboard, navigation, notifications, and background behavior remain unverified. | Android device matrix. |
| Maps | Real map tiles/geocoding | Cannot be verified | Native map path exists and mock-map fallback is used. | Google Maps credential/provider validation previously failed; real tiles require valid provider configuration and billing. | Physical Android/provider validation. |
| Regression | Complete Family → Driver → Trip → Rating → Admin flow | Not working | Deterministic tests cover only selected helpers and governance/settings fixtures. | Current automated coverage does not execute the full UI/API/multi-user lifecycle. | New contract/integration/E2E test suite. |

## Highest-priority root causes

1. **Authorization is incomplete at resource level.** Several APIs accept ride or user identifiers without proving that the caller owns or is allowed to mutate the referenced record.
2. **The driver experience is primarily local UI.** Driver documents, online status, profile state, and request handling are not consistently wired to persistent backend procedures.
3. **Trip lifecycle and bidding are incomplete.** The schema has a basic ride status, but no offers, bid locking, selection, driver assignment protocol, or race-safe transition model.
4. **Family nearby-driver UI uses mock data.** The backend query is not a correct radius query and the frontend does not rely on it for the displayed driver set.
5. **Automated coverage is narrower than the product surface.** Existing tests are deterministic helper tests rather than complete multi-role API and device workflow tests.

## Audit decision

The application should not yet be classified as production-ready. The next implementation order is to harden authorization and ride state transitions, wire the driver experience to persistent data, correct location/availability behavior, then add favorite drivers and car bidding before full regression testing.
