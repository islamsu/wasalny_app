import { afterEach, describe, expect, it, vi } from "vitest";

const originalGoogleMapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

afterEach(() => {
  if (originalGoogleMapsKey === undefined) delete process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  else process.env.GOOGLE_MAPS_ANDROID_API_KEY = originalGoogleMapsKey;
  vi.resetModules();
});

describe("Google Maps configuration", () => {
  it("injects the Android Maps SDK key into Expo configuration", async () => {
    process.env.GOOGLE_MAPS_ANDROID_API_KEY = "android-restricted-test-key";
    vi.resetModules();
    const { default: config } = await import("../app.config");
    expect(config.android?.config?.googleMaps?.apiKey).toBe("android-restricted-test-key");
  });
});
