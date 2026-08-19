import { describe, expect, it } from "vitest";
import { DISPATCH_RADIUS_KM, assertValidCoordinates, distanceKm, isFreshLocation } from "../server/db";

describe("dispatch location policy", () => {
  it("uses a fixed server-side radius and rejects impossible coordinates", () => {
    expect(DISPATCH_RADIUS_KM).toBe(5);
    expect(() => assertValidCoordinates(91, 31)).toThrow();
    expect(() => assertValidCoordinates(30, 181)).toThrow();
    expect(() => assertValidCoordinates(30.0444, 31.2357)).not.toThrow();
  });

  it("calculates geographic distance instead of treating a degree box as a radius", () => {
    expect(distanceKm(30.0444, 31.2357, 30.0444, 31.2357)).toBeCloseTo(0, 5);
    expect(distanceKm(30.0444, 31.2357, 30.0894, 31.2357)).toBeGreaterThan(4.5);
  });

  it("does not accept stale driver locations", () => {
    expect(isFreshLocation(new Date(Date.now() - 14 * 60 * 1000))).toBe(true);
    expect(isFreshLocation(new Date(Date.now() - 16 * 60 * 1000))).toBe(false);
    expect(isFreshLocation(null)).toBe(false);
  });
});
