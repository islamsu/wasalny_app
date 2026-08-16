export type VehicleType = "toktok" | "car";
export type RideStatus = "draft" | "requested" | "matching" | "accepted" | "active" | "completed" | "cancelled";

export interface RideRequest {
  id: string;
  passengerId: string;
  pickupLabel: string;
  destinationLabel: string;
  vehicleType: VehicleType | "fastest";
  paymentMethod: "cash";
  status: RideStatus;
  tripPin: string;
  createdAt: string;
}

export interface DriverCandidate {
  id: string;
  displayName: string;
  vehicleType: VehicleType;
  rating: number;
  ridesCompletedToday: number;
  distanceKm: number;
  isOnline: boolean;
  isVerified: boolean;
}

export function rankCandidates(candidates: DriverCandidate[], requestedVehicle: VehicleType | "fastest") {
  return [...candidates]
    .filter((candidate) => candidate.isOnline && candidate.isVerified)
    .filter((candidate) => requestedVehicle === "fastest" || candidate.vehicleType === requestedVehicle)
    .sort((a, b) => a.distanceKm - b.distanceKm || b.rating - a.rating || a.ridesCompletedToday - b.ridesCompletedToday);
}

export function nextRideStatus(status: RideStatus, event: "submit" | "driverAccepted" | "start" | "finish" | "cancel"): RideStatus {
  if (event === "cancel") return "cancelled";
  if (status === "draft" && event === "submit") return "requested";
  if (status === "requested" && event === "submit") return "matching";
  if (status === "matching" && event === "driverAccepted") return "accepted";
  if (status === "accepted" && event === "start") return "active";
  if (status === "active" && event === "finish") return "completed";
  return status;
}
