import { describe, expect, it } from "vitest";

describe("Google Maps credential configuration", () => {
  it("requires a configured Android key before provider validation", () => {
    const key = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();
    expect(key, "GOOGLE_MAPS_ANDROID_API_KEY must be configured for real Android maps").toBeTruthy();
  });
});
