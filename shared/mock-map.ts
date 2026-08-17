export type MockCoordinate = { latitude: number; longitude: number };
export type MockDriver = { id: string; name: string; vehicle: "car" | "toktok"; position: MockCoordinate; etaMinutes: number; distanceKm: number; available: boolean };

export const MOCK_PICKUP: MockCoordinate = { latitude: 30.0444, longitude: 31.2357 };
export const MOCK_DESTINATION: MockCoordinate = { latitude: 30.0552, longitude: 31.2489 };
export const MOCK_ROUTE: MockCoordinate[] = [
  MOCK_PICKUP,
  { latitude: 30.0472, longitude: 31.2394 },
  { latitude: 30.0518, longitude: 31.2447 },
  MOCK_DESTINATION,
];

export function getMockDrivers(): MockDriver[] {
  return [
    { id: "mock-ahmed", name: "أحمد حسن", vehicle: "car", position: { latitude: 30.0398, longitude: 31.2298 }, etaMinutes: 4, distanceKm: 0.8, available: true },
    { id: "mock-khaled", name: "خالد علي", vehicle: "toktok", position: { latitude: 30.0506, longitude: 31.2284 }, etaMinutes: 6, distanceKm: 1.2, available: true },
    { id: "mock-samir", name: "سمير محمود", vehicle: "car", position: { latitude: 30.0611, longitude: 31.2432 }, etaMinutes: 9, distanceKm: 1.9, available: false },
  ];
}

export function interpolateCoordinate(route: MockCoordinate[], progress: number): MockCoordinate {
  if (!route.length) return MOCK_PICKUP;
  const normalized = Math.max(0, Math.min(1, progress));
  const scaled = normalized * (route.length - 1);
  const index = Math.min(route.length - 2, Math.floor(scaled));
  const fraction = scaled - index;
  const start = route[index] ?? route[0];
  const end = route[index + 1] ?? start;
  return { latitude: start.latitude + (end.latitude - start.latitude) * fraction, longitude: start.longitude + (end.longitude - start.longitude) * fraction };
}

export function mockEta(progress: number): number {
  return Math.max(0, Math.ceil((1 - Math.max(0, Math.min(1, progress))) * 8));
}

export function resetMockMap() {
  return { pickup: MOCK_PICKUP, destination: MOCK_DESTINATION, route: MOCK_ROUTE, drivers: getMockDrivers(), progress: 0, etaMinutes: mockEta(0) };
}
