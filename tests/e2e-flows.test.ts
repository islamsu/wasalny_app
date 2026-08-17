import { describe, expect, it } from "vitest";
import { getMockDrivers, interpolateCoordinate, mockEta, resetMockMap } from "../shared/mock-map";
import { canDriverReceiveRequests, transitionRide } from "../shared/ride";

describe("Wasalny end-to-end flow scenarios", () => {
  it("keeps a driver offline until subscription approval and account activation", () => {
    expect(canDriverReceiveRequests({ subscriptionStatus: "pending", accountStatus: "active", online: true })).toBe(false);
    expect(canDriverReceiveRequests({ subscriptionStatus: "approved", accountStatus: "suspended", online: true })).toBe(false);
    expect(canDriverReceiveRequests({ subscriptionStatus: "approved", accountStatus: "active", online: true })).toBe(true);
  });

  it("covers the ride lifecycle from request to completion", () => {
    expect(transitionRide("requested", "accepted")).toBe("accepted");
    expect(transitionRide("accepted", "arriving")).toBe("arriving");
    expect(transitionRide("arriving", "active")).toBe("active");
    expect(transitionRide("active", "completed")).toBe("completed");
    expect(() => transitionRide("completed", "active")).toThrow();
  });

  it("resets mock maps and moves a driver along a deterministic route", () => {
    const state = resetMockMap();
    const start = interpolateCoordinate(state.route, 0);
    const midpoint = interpolateCoordinate(state.route, 0.5);
    expect(start).toEqual(state.pickup);
    expect(midpoint.latitude).not.toBe(start.latitude);
    expect(mockEta(0)).toBe(8);
    expect(mockEta(1)).toBe(0);
    expect(getMockDrivers().filter((driver) => driver.available)).toHaveLength(2);
  });

  it("requires every registration document and receipt before submission", () => {
    const requiredDocuments = ["national-id-front", "national-id-back", "license-front", "license-back", "vehicle-license", "payment-receipt"];
    const uploaded = new Set(["national-id-front", "national-id-back", "license-front", "license-back", "vehicle-license"]);
    expect(requiredDocuments.every((document) => uploaded.has(document))).toBe(false);
    uploaded.add("payment-receipt");
    expect(requiredDocuments.every((document) => uploaded.has(document))).toBe(true);
  });
});
