export type OfferStatus = "pending" | "selected" | "rejected" | "withdrawn";

export function validateCarOfferInput(input: { offeredPrice: number; etaMinutes: number }) {
  return Number.isInteger(input.offeredPrice) && input.offeredPrice > 0 && Number.isInteger(input.etaMinutes) && input.etaMinutes > 0;
}

export function canSelectCarOffer(input: { rideStatus: "requested" | "accepted" | "arriving" | "active" | "completed" | "cancelled"; offerStatus: OfferStatus }) {
  return input.rideStatus === "requested" && input.offerStatus === "pending";
}
