# Wasalny Feature Matrix

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
