# Wasalny End-to-End Verification Report

## Scope

This report covers the role-based family, driver, and admin paths; keyless mock-map behavior; and document uploads during driver registration. The scenarios are deterministic and can be repeated without a Google Maps API key or external device location.

## Scenario Matrix

| Area | Scenario | Expected result | Automated status |
|---|---|---|---|
| Driver access | Select driver role and enter the driver experience | Driver route opens and driver context is selected | Covered by role-flow implementation |
| Driver governance | Pending, rejected, expired, frozen, or suspended driver attempts to go online | Driver remains unable to receive requests | Passed in `tests/e2e-flows.test.ts` |
| Driver governance | Approved active driver goes online | Driver is eligible to receive requests | Passed in `tests/e2e-flows.test.ts` |
| Ride lifecycle | Family creates request, driver accepts, arrives, starts, and completes | Status changes follow the allowed lifecycle | Passed in `tests/e2e-flows.test.ts` and `tests/ride-state.test.ts` |
| Admin review | Admin approves or rejects a payment receipt | Subscription state changes and driver eligibility updates | Covered by shared state and admin UI; integration test remains pending |
| Mock maps | Reset map to Cairo fixture, render pickup/destination, show available drivers, move along route | Coordinates, ETA, and available-driver count are deterministic | Passed in `tests/e2e-flows.test.ts` |
| Uploads | Driver uploads five identity/vehicle documents without payment receipt | Submission remains blocked | Passed in `tests/e2e-flows.test.ts` |
| Uploads | Driver adds monthly payment receipt | All required documents are present and submission can proceed | Passed in `tests/e2e-flows.test.ts` |
| Uploads | Replace an uploaded file | Current file state is replaced and the checklist remains accurate | UI behavior implemented; device file-picker validation remains manual |
| Notifications | Family creates request | Nearby eligible drivers receive an Expo push event | Server event path implemented; physical-device delivery remains manual |
| Notifications | Driver accepts or approaches | Family receives status/arrival alert | Server event path implemented; physical-device delivery remains manual |

## Mock Maps

The keyless mock-map fixture uses fixed Cairo coordinates, a four-point route, three drivers with availability states, deterministic distances and ETAs, interpolation for driver movement, and a reset function. The web preview continues to use a visual fallback, while native builds use the platform-specific map component when a real provider key becomes available.

## Upload Review

The driver flow requires the national ID front and back, license front and back, vehicle license, and monthly subscription payment receipt. Every item is represented by a file-selection state, displays the selected filename, and contributes to submission readiness. The payment receipt is treated as a required upload rather than a checkbox.

## Known Limitations

The current validation is a deterministic E2E-style suite rather than a device-run Appium or Detox session. Push notifications require a physical development build and Expo project credentials. Native Google map tiles require a valid provider key and enabled billing; the current keyless mode is intentionally used until that configuration is complete.
