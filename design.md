# Wasalny Mobile Interface Design

## Product direction

Wasalny is an Android-first, Arabic-only community transportation service for Egyptian families and verified Toktok and private-car drivers. The interface is designed for portrait orientation, one-handed use, older users, high readability, and fast completion of a ride request. The visual language follows Material Design 3 principles with an approachable green-and-white identity, generous touch targets, rounded surfaces, and clear feedback.

## Screen list

| Screen | Primary content and functionality |
|---|---|
| Home | Wasalny mark, location status, compact map-style location card, current pickup area, and three large actions: اطلب توك توك, اطلب سيارة, أسرع وسيلة. Includes safety shortcut and recent ride summary. |
| Ride request | Pickup location detected automatically, destination selection, draggable pickup pin affordance, ride type confirmation, cash payment note, and اطلب الآن CTA. |
| Matching | Live matching status, 15-second driver assignment concept, nearby driver progress, cancel action, and safety reminder. |
| Driver arriving / active ride | Driver identity, verified badge, vehicle type and plate, ETA, distance, trip PIN, live location placeholder map, call/share/SOS actions, and trip status. |
| Ride completed | Fare summary, driver rating, review entry, save driver, report driver, and share trip. |
| Favorite drivers | Saved trusted drivers, verified badges, last-used information, and nearby-first preference explanation. |
| Ride history | Past rides with date, vehicle type, fare, status, and detail navigation. |
| Safety center | Emergency contacts, SOS explanation, trip sharing, trip PIN explanation, reporting and blocking controls. |
| Profile and settings | Family profile, saved home address, emergency contact, notifications, dark mode, and help. |
| Driver onboarding | Driver type selection, phone and OTP flow, identity and vehicle document upload checklist, personal photo, and pending admin approval state. |
| Driver dashboard | Online/offline switch, incoming ride request card, current ride, daily earnings, monthly earnings, subscription status, ratings, and settings. |
| Driver subscription | Free-period countdown, renewal date, payment methods, payment instructions, and admin approval status. |

## Key user flows

### Family requests the fastest ride

1. User opens Home and location is shown as detected.
2. User taps أسرع وسيلة.
3. User selects or confirms the destination.
4. User reviews cash payment and pickup details.
5. User taps اطلب الآن.
6. Matching screen communicates that Wasalny is contacting the nearest eligible driver.
7. When accepted, the active ride screen shows driver, vehicle, ETA, trip PIN, and safety actions.
8. After completion, the user rates, reviews, saves, reports, or shares the trip.

### Family requests a specific vehicle type

1. User taps اطلب توك توك or اطلب سيارة.
2. Ride request opens with the selected vehicle type highlighted.
3. User confirms pickup and destination.
4. User submits the cash ride request.
5. The matching state progresses through nearest-driver assignment.

### Driver onboarding

1. Driver selects توك توك or سيارة.
2. Driver enters phone number and verifies OTP.
3. Driver completes the required document checklist.
4. Driver submits the application.
5. Dashboard remains inactive while admin review is pending.
6. Approved driver sees verified status and can toggle online.

## Color choices

| Token | Light | Dark | Usage |
|---|---|---|---|
| Wasalny green | #137A5A | #45C28A | Primary CTAs, verified states, active status |
| Deep green | #0B4F3A | #8BE0B5 | Logo, strong headings, pressed states |
| Warm white | #F8FBF8 | #10201A | Main background |
| Surface | #FFFFFF | #173026 | Cards and elevated controls |
| Ink | #12211B | #F3FAF5 | Primary Arabic text |
| Muted | #63736C | #A5B8AE | Secondary labels and helper text |
| Border | #D9E7DF | #2B4B3D | Dividers and input outlines |
| Warning | #B76E00 | #F5B84B | Pending verification and subscription reminders |
| Error | #B42318 | #FF8C82 | SOS, errors, report states |

## Interaction and accessibility rules

All primary actions use large rounded buttons with a minimum comfortable touch area. Arabic copy is short, direct, and Egyptian-friendly. Content is right-aligned by default, while maps and status indicators remain visually balanced. Press states use a subtle scale/opacity response and success or error actions provide haptic feedback on native Android. Dark mode preserves contrast and keeps green reserved for actions and confirmation states.
