# Project TODO

- [x] Initialize Expo mobile project scaffold
- [x] Define Arabic RTL mobile interface design in design.md
- [x] Generate and install unique Wasalny app logo assets
- [x] Update app branding configuration with app name and logo URL
- [x] Configure green-and-white Wasalny theme with dark mode tokens
- [x] Build Arabic RTL family home screen with map-style location card
- [x] Build ride request flow for Toktok, car, and fastest ride
- [x] Build matching, active ride, and trip safety states
- [x] Build ride completion, rating, review, favorite, and share actions
- [x] Build ride history, safety center, profile, and settings screens
- [ ] Build driver onboarding and verification checklist states
- [ ] Build driver dashboard, online/offline, requests, earnings, and subscription states
- [x] Add shared transportation domain types and local state model
- [ ] Add backend-ready API boundaries without requiring live external credentials
- [x] Add deterministic tests for core ride request and matching state transitions
- [x] Verify TypeScript, lint, tests, and app preview

- [x] Add driver onboarding and verification UI flows
- [x] Add interactive simulated live GPS map for active rides
- [x] Add ride history page with route details and receipt download

- [x] Add monthly subscription payment-proof upload item to driver verification

- [x] Link approved and active subscription status to driver ride-request eligibility
- [x] Add admin section to review, approve, and reject monthly payment receipts

- [x] Replace the default typography with a professional, clear Arabic app font

- [x] Apply Cairo font weights to headings, labels, and buttons
- [x] Add an adjustable font-size setting for easier reading
- [x] Improve dark-mode text contrast for the new typography

- [x] Persist selected font size locally across app restarts
- [x] Apply selected font size to driver, history, and admin screens
- [x] Add live light/dark mode preview and switching in settings

- [x] Replace document checklist ticks with real in-app uploads during driver registration
- [x] Add actual payment-receipt file upload state and validation

- [x] Build comprehensive admin dashboard shell with responsive RTL navigation
- [x] Add operations overview with KPIs, live ride activity, alerts, and trends
- [x] Add driver management, verification review, and subscription receipt queue
- [x] Add rides, users, payments, notifications, and settings sections
- [x] Add dashboard search, filters, detail panels, and actionable admin states

- [x] Add role-based login and entry flows for family, driver, and admin
- [x] Add family profile, complaint submission, complaint tracking, and support area
- [x] Add location permission, current-location detection, and pickup map state
- [x] Add nearby-driver discovery with availability, distance, ETA, and vehicle filters
- [x] Add booking lifecycle from driver selection to request, acceptance, active trip, and completion
- [x] Add admin driver freeze, suspend, reactivate, and reason/audit controls

- [x] Add persistent role-aware users, driver profiles, and family profiles in the database
- [x] Add persistent ride-request, driver-assignment, and ride-status APIs
- [x] Replace simulated map presentation with real map tiles and geocoding
- [x] Persist pickup and destination coordinates with booking records
- [x] Register device push tokens and notify drivers of new requests
- [x] Notify families when drivers accept, approach, and arrive
- [ ] Add integration tests for auth, booking, map location, and notification event flows

- [x] Define documented E2E scenarios for family, driver, and admin flows
- [x] Harden keyless mock maps with deterministic coordinates, routes, driver movement, and reset controls
- [x] Verify family/user and driver document upload validation, replacement, and submission states
- [x] Add deterministic E2E-style tests for driver governance, admin receipt review, mock maps, and uploads
- [x] Save a verification report with pass/fail results and known limitations

- [x] Audit and repair admin settings controls, navigation, and persistence

- [x] Persist admin pricing and permissions settings in the database
- [x] Add admin settings API procedures with authenticated admin checks
- [x] Add database-backed audit log for all settings changes
- [x] Connect settings UI to server data and show audit history
- [ ] Restart and fully verify the admin settings preview
