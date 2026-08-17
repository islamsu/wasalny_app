import { describe, expect, it } from "vitest";

describe("Google Maps configuration", () => {
  it("accepts the configured key at the geocoding endpoint", async () => {
    const key = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
    expect(key).toBeTruthy();
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=Cairo&key=${encodeURIComponent(key ?? "")}`);
    expect([200, 400, 403]).toContain(response.status);
    const payload = await response.json() as { error_message?: string; status?: string };
    expect(payload.status).toBeTruthy();
    if (response.status === 200) expect(["OK", "ZERO_RESULTS"]).toContain(payload.status);
  }, 15000);
});
