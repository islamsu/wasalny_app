# Integration Notes

## Official sources

1. Expo Push Service: https://docs.expo.dev/push-notifications/sending-notifications/
   - The client obtains an ExpoPushToken with expo-notifications and sends it to the server.
   - The server sends an HTTPS POST to `https://exp.host/--/api/v2/push/send`.
   - Push tickets confirm Expo accepted the message; receipts should be checked later for delivery errors such as DeviceNotRegistered.

2. Expo Maps: https://docs.expo.dev/versions/latest/sdk/maps/
   - Expo Maps provides Apple Maps on iOS and Google Maps on Android.
   - Android Google Maps requires a Google Cloud project, Maps SDK for Android, an API key, and a development build; Expo Maps is not available in Expo Go.
   - The library is currently alpha and may have breaking changes.

3. Expo Location: https://docs.expo.dev/versions/latest/sdk/location/
   - Foreground permissions are requested before reading the current position.
   - Background location requires additional permissions and platform configuration; current implementation is foreground-first.
   - Geocoding and reverse geocoding are provided by Expo Location APIs.

## Implementation decision

Use the existing Drizzle/MySQL backend and protected tRPC procedures for persistent user, driver, ride, and push-token data. Use Expo Location for foreground current position and geocoding. Keep the current simulated visual map as a web-safe fallback while adding native Expo Maps behind a platform guard; real Google Maps credentials will be required for Android development builds. Send push events through the Expo Push Service from the server and store device tokens per authenticated user.
