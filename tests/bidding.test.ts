import { describe, expect, it } from "vitest";
import { canSelectCarOffer, validateCarOfferInput } from "../shared/bidding";

describe("car bidding rules", () => {
  it("rejects zero, negative, fractional, or missing offer values", () => {
    expect(validateCarOfferInput({ offeredPrice: 0, etaMinutes: 10 })).toBe(false);
    expect(validateCarOfferInput({ offeredPrice: -5, etaMinutes: 10 })).toBe(false);
    expect(validateCarOfferInput({ offeredPrice: 50.5, etaMinutes: 10 })).toBe(false);
    expect(validateCarOfferInput({ offeredPrice: 50, etaMinutes: 0 })).toBe(false);
  });

  it("accepts positive integer price and ETA", () => {
    expect(validateCarOfferInput({ offeredPrice: 75, etaMinutes: 12 })).toBe(true);
  });

  it("allows selection only while ride is requested and offer is pending", () => {
    expect(canSelectCarOffer({ rideStatus: "requested", offerStatus: "pending" })).toBe(true);
    expect(canSelectCarOffer({ rideStatus: "accepted", offerStatus: "pending" })).toBe(false);
    expect(canSelectCarOffer({ rideStatus: "requested", offerStatus: "selected" })).toBe(false);
  });
});
