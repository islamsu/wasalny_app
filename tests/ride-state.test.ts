import { describe, expect, it } from "vitest";

import { nextRideStatus, rankCandidates, type DriverCandidate } from "../shared/ride";

describe("Wasalny ride domain", () => {
  it("ranks eligible drivers by distance, then rating, then daily fairness", () => {
    const candidates: DriverCandidate[] = [
      { id: "far", displayName: "بعيد", vehicleType: "car", rating: 5, ridesCompletedToday: 1, distanceKm: 2.2, isOnline: true, isVerified: true },
      { id: "near", displayName: "قريب", vehicleType: "car", rating: 4.7, ridesCompletedToday: 6, distanceKm: 0.8, isOnline: true, isVerified: true },
      { id: "offline", displayName: "غير متاح", vehicleType: "car", rating: 5, ridesCompletedToday: 0, distanceKm: 0.2, isOnline: false, isVerified: true },
    ];

    expect(rankCandidates(candidates, "car").map((candidate) => candidate.id)).toEqual(["near", "far"]);
  });

  it("moves a ride through request, matching, accepted, active, and completed", () => {
    let status = nextRideStatus("draft", "submit");
    status = nextRideStatus(status, "submit");
    status = nextRideStatus(status, "driverAccepted");
    status = nextRideStatus(status, "start");
    status = nextRideStatus(status, "finish");

    expect(status).toBe("completed");
  });

  it("always permits cancellation", () => {
    expect(nextRideStatus("matching", "cancel")).toBe("cancelled");
  });
});
