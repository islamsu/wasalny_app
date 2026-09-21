import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../server/_core/context";
import { assertOperationalDriver, REQUIRED_DRIVER_DOCUMENTS } from "../server/_core/authorization";
import { appRouter } from "../server/routers";

const mocks = vi.hoisted(() => ({
  listFamilyRides: vi.fn(), listAdminSettings: vi.fn(), ensureDriverProfile: vi.fn(),
  assertDriverEligibility: vi.fn(), updateDriverAvailability: vi.fn(), createDriverDocument: vi.fn(),
  listDriverDocuments: vi.fn(), updateAdminSetting: vi.fn(), updateRideStatus: vi.fn(),
  listNearbyDrivers: vi.fn(), createRide: vi.fn(),
}));
vi.mock("../server/db", () => mocks);
vi.mock("../server/push", () => ({ sendPushToUser: vi.fn(), sendPushToUserOnce: vi.fn() }));

function caller(appRole: "family" | "driver" | "admin" = "family", userStatus: string = "active", legacyRole: "user" | "admin" = "user") {
  return appRouter.createCaller({
    user: { id: 7, appRole, userStatus, role: legacyRole } as TrpcContext["user"],
    req: { headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"],
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.listFamilyRides.mockResolvedValue([]);
  mocks.listAdminSettings.mockResolvedValue([]);
  mocks.ensureDriverProfile.mockResolvedValue({ userId: 7, verificationStatus: "pending" });
  mocks.listDriverDocuments.mockResolvedValue([]);
  mocks.updateDriverAvailability.mockResolvedValue({ isOnline: true });
  mocks.listNearbyDrivers.mockResolvedValue([]);
});

describe("Gate 1 real router/procedure policies (unit-mocked persistence)", () => {
  it("active family can discover nearby drivers", async () => {
    await expect(caller().drivers.nearby({ lat: 30, lng: 31, vehicleType: "car" })).resolves.toEqual([]);
    expect(mocks.listNearbyDrivers).toHaveBeenCalledWith(30, 31, "car");
  });
  it.each(["driver", "admin"] as const)("%s cannot discover family-only nearby driver locations", async (role) => {
    await expect(caller(role).drivers.nearby({ lat: 30, lng: 31 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.listNearbyDrivers).not.toHaveBeenCalled();
  });
  it.each(["blocked", "suspended_temp", "suspended_permanent"])("%s family cannot discover nearby driver locations", async (status) => {
    await expect(caller("family", status).drivers.nearby({ lat: 30, lng: 31 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.listNearbyDrivers).not.toHaveBeenCalled();
  });
  it("family ride creation retains internal nearby-driver dispatch lookup", async () => {
    mocks.createRide.mockResolvedValue({ id: 12, familyUserId: 7 });
    await expect(caller().rides.create({ idempotencyKey: "test-key-001", vehicleType: "car", pickupLabel: "Pickup", destinationLabel: "Destination", pickupLat: 30, pickupLng: 31 })).resolves.toMatchObject({ id: 12 });
    expect(mocks.listNearbyDrivers).toHaveBeenCalledWith(30, 31);
  });
  it("family can list its own rides", async () => {
    await expect(caller().rides.mine()).resolves.toEqual([]);
    expect(mocks.listFamilyRides).toHaveBeenCalledWith(7);
  });
  it.each(["driver", "admin"] as const)("%s cannot act as family", async (role) => {
    await expect(caller(role).rides.mine()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.listFamilyRides).not.toHaveBeenCalled();
  });
  it("legacy admin does not grant admin authority", async () => {
    await expect(caller("family", "active", "admin").admin.settings.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.listAdminSettings).not.toHaveBeenCalled();
  });
  it("appRole admin works with legacy user", async () => {
    await expect(caller("admin").admin.settings.list()).resolves.toEqual([]);
  });
  it.each(["blocked", "suspended_temp", "suspended_permanent", "unknown"])("denies %s before persistence", async (status) => {
    await expect(caller("family", status).rides.mine()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller("admin", status).admin.settings.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller("driver", status).profile.availability({ isOnline: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.listFamilyRides).not.toHaveBeenCalled();
    expect(mocks.listAdminSettings).not.toHaveBeenCalled();
    expect(mocks.assertDriverEligibility).not.toHaveBeenCalled();
  });
  it("active family can apply but only gets pending profile", async () => {
    await expect(caller().profile.ensureDriver({ vehicleType: "car" })).resolves.toMatchObject({ verificationStatus: "pending" });
    expect(mocks.ensureDriverProfile).toHaveBeenCalledWith(7, "car");
  });
  it.each(["admin", "driver"])("rejects client-assigned %s role on onboarding", async (role) => {
    await expect(caller().profile.ensureDriver({ vehicleType: "car", appRole: role, role, verificationStatus: "approved", userId: 999 } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.ensureDriverProfile).not.toHaveBeenCalled();
  });
  it("onboarding family can access its document list", async () => {
    await expect(caller().driverDocuments.listMine()).resolves.toEqual([]);
    expect(mocks.listDriverDocuments).toHaveBeenCalledWith(7);
  });
  it.each(["unknown", "payment_receipt", "LICENSE", "../payment"])("rejects upload type %s before persistence", async (documentType) => {
    await expect(caller().driverDocuments.upload({ documentType, fileName: "file.pdf", mimeType: "application/pdf", dataBase64: "dGVzdA==" } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.createDriverDocument).not.toHaveBeenCalled();
  });
  it.each(["id", "license", "vehicle", "photos", "personal", "payment"] as const)("accepts canonical %s upload type", async (documentType) => {
    mocks.createDriverDocument.mockResolvedValue({ status: "pending" });
    await expect(caller().driverDocuments.upload({ documentType, fileName: "file.pdf", mimeType: "application/pdf", dataBase64: "dGVzdA==", expiresAt: "2030-01-01T00:00:00.000Z" })).resolves.toEqual({ status: "pending" });
    expect(mocks.createDriverDocument).toHaveBeenCalledWith(expect.objectContaining({ userId: 7, documentType }));
  });
  it("family cannot operate even with client driver intent", async () => {
    await expect(caller().profile.availability({ isOnline: true, appRole: "driver" } as never)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.updateDriverAvailability).not.toHaveBeenCalled();
  });
  it.each(["pending", "rejected", "revoked"])("unverified %s driver cannot operate", async (verificationStatus) => {
    mocks.assertDriverEligibility.mockImplementation(async () => assertOperationalDriver({ id: 7, appRole: "driver", userStatus: "active" }, { verificationStatus, accountStatus: "active", subscriptionStatus: "approved" }, []));
    await expect(caller("driver").profile.availability({ isOnline: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.updateDriverAvailability).not.toHaveBeenCalled();
  });
  it("eligible driver passes operational procedure", async () => {
    mocks.assertDriverEligibility.mockImplementation(async () => assertOperationalDriver({ id: 7, appRole: "driver", userStatus: "active" }, { verificationStatus: "approved", accountStatus: "active", subscriptionStatus: "approved", subscriptionStartsAt: new Date("2020-01-01"), subscriptionEndsAt: new Date("2099-01-01") }, REQUIRED_DRIVER_DOCUMENTS.map((documentType) => ({ documentType, status: "approved", expiresAt: new Date("2099-01-01") }))));
    await expect(caller("driver").profile.availability({ isOnline: true })).resolves.toEqual({ isOnline: true });
    expect(mocks.assertDriverEligibility).toHaveBeenCalledWith(7);
    expect(mocks.updateDriverAvailability).toHaveBeenCalledWith({ userId: 7, isOnline: true });
  });
  it("blocks sensitive admin mutation until actual MFA/session implementation", async () => {
    await expect(caller("admin").admin.settings.update({ settingKey: "price", settingValue: "100", category: "pricing" })).rejects.toThrow(/MFA/);
    expect(mocks.updateAdminSetting).not.toHaveBeenCalled();
  });
  it("client actorRole is not forwarded to ride helper", async () => {
    mocks.updateRideStatus.mockResolvedValue({ familyUserId: 7 });
    await caller().rides.status({ id: 2, status: "cancelled", idempotencyKey: "test-key-002", actorRole: "admin", actorUserId: 999 } as never);
    expect(mocks.updateRideStatus).toHaveBeenCalledWith({ id: 2, status: "cancelled", idempotencyKey: "test-key-002", actorUserId: 7 });
  });
});