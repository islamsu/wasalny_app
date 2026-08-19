import { describe, expect, it } from "vitest";

const hasGoogleMapsKey = Boolean(process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim());

describe.skipIf(!hasGoogleMapsKey)("Google Maps credential configuration", () => {
  it("passes the configured Android key to Expo", async () => {
    const key = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();
    const { default: config } = await import("../app.config");
    expect(config.android?.config?.googleMaps?.apiKey).toBe(key);
  });
});
