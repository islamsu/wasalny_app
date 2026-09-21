import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureDriverProfile, upsertUser, updateRideStatus, assertDriverEligibility, updateAdminSetting, createDriverDocument } from "../server/db";
import { REQUIRED_DRIVER_DOCUMENTS } from "../server/_core/authorization";

const state = vi.hoisted(() => ({
  rows: [] as unknown[][],
  insertValues: vi.fn(), duplicateUpdate: vi.fn(), update: vi.fn(), storagePut: vi.fn(),
}));
vi.mock("../server/_core/env", () => ({ ENV: { databaseUrl: "unit-test-not-a-real-connection", ownerOpenId: "owner-id" } }));
vi.mock("../server/_core/mysql-config", () => ({ mysqlConnectionOptions: () => ({}) }));
vi.mock("../server/storage", () => ({ storagePut: state.storagePut }));
vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: () => ({
    transaction<T>(work: (tx: unknown) => Promise<T>) { return work(this); },
    select: () => {
      const rows = state.rows.shift() ?? [];
      const result = Promise.resolve(rows);
      const chain = {
        from: () => chain, where: () => chain, for: () => chain,
        limit: () => result, orderBy: () => result, then: result.then.bind(result),
      };
      return chain;
    },
    insert: () => ({
      values: (values: unknown) => {
        state.insertValues(values);
        return { onDuplicateKeyUpdate: state.duplicateUpdate };
      },
    }),
    update: state.update,
  }),
}));

beforeEach(() => { vi.clearAllMocks(); state.rows = []; state.update.mockReturnValue({ set: () => ({ where: async () => undefined }) }); });

describe("Gate 1 database business authorization (no database connection)", () => {
  it.each(["admin", "driver"] as const)("upsert ignores client %s role and status on insert and duplicate update", async (appRole) => {
    await upsertUser({ openId: "owner-id", role: "admin", appRole, userStatus: "active", name: "Owner" });
    expect(state.insertValues).toHaveBeenCalledWith(expect.objectContaining({ openId: "owner-id", role: "user", appRole: "family" }));
    expect(state.duplicateUpdate).toHaveBeenCalledWith({ set: { lastSignedIn: expect.any(Date), name: "Owner" } });
    expect(state.insertValues.mock.calls[0][0]).not.toHaveProperty("userStatus");
  });
  it("ordinary existing identity login preserves stored roles/status", async () => {
    await upsertUser({ openId: "existing", role: "admin", appRole: "admin", userStatus: "active" });
    expect(state.duplicateUpdate).toHaveBeenCalledWith({ set: { lastSignedIn: expect.any(Date) } });
  });
  it("family onboarding explicitly inserts pending and never updates user role", async () => {
    state.rows = [[{ id: 7, appRole: "family", userStatus: "active" }], [{ userId: 7, verificationStatus: "pending" }]];
    await expect(ensureDriverProfile(7)).resolves.toMatchObject({ verificationStatus: "pending" });
    expect(state.insertValues).toHaveBeenCalledWith({ userId: 7, vehicleType: "car", verificationStatus: "pending", verifiedAt: null, verifiedBy: null });
    expect(state.update).not.toHaveBeenCalled();
  });
  it("blocked family cannot create profile", async () => {
    state.rows = [[{ id: 7, appRole: "family", userStatus: "blocked" }]];
    await expect(ensureDriverProfile(7)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.insertValues).not.toHaveBeenCalled();
  });
  it.each(["rejected", "approved", "revoked"])("repeated onboarding cannot reset %s verification", async (verificationStatus) => {
    state.rows = [[{ id: 7, appRole: "family", userStatus: "active" }], [{ userId: 7, verificationStatus }]];
    await expect(ensureDriverProfile(7)).resolves.toMatchObject({ verificationStatus });
    expect(state.duplicateUpdate).toHaveBeenCalledWith({ set: { userId: 7 } });
    expect(state.update).not.toHaveBeenCalled();
  });
  it("unknown upload document types are rejected before onboarding or object storage", async () => {
    await expect(createDriverDocument({ userId: 7, documentType: "unrecognized", fileName: "file.pdf", mimeType: "application/pdf", dataBase64: "dGVzdA==" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.insertValues).not.toHaveBeenCalled();
    expect(state.storagePut).not.toHaveBeenCalled();
  });
  it.each(["family", "driver"])("legitimate %s upload ensures a pending profile and pending document without granting a role", async (appRole) => {
    const actor = { id: 7, appRole, userStatus: "active" };
    state.rows = [[actor], [actor], [{ userId: 7, verificationStatus: "pending" }], [actor], [{ userId: 7 }], [{ userId: 7, documentType: "payment", status: "pending" }]];
    state.storagePut.mockResolvedValue({ key: "drivers/7/payment/unit/file.pdf", url: "/unit" });
    await expect(createDriverDocument({ userId: 7, documentType: "payment", fileName: "file.pdf", mimeType: "application/pdf", dataBase64: "dGVzdA==" })).resolves.toMatchObject({ status: "pending" });
    expect(state.insertValues).toHaveBeenNthCalledWith(1, { userId: 7, vehicleType: "car", verificationStatus: "pending", verifiedAt: null, verifiedBy: null });
    expect(state.insertValues).toHaveBeenNthCalledWith(2, expect.objectContaining({ documentType: "payment", status: "pending", reviewedBy: null }));
    expect(state.duplicateUpdate).toHaveBeenCalledWith({ set: { userId: 7 } });
    expect(state.update).toHaveBeenCalledTimes(1);
  });
  it("spoofed actorRole admin cannot complete family's own ride", async () => {
    const actor = { id: 7, appRole: "family", role: "admin", userStatus: "active" };
    state.rows = [[actor], [actor], [{ id: 1, familyUserId: 7, driverUserId: 9, status: "active" }]];
    await expect(updateRideStatus({ id: 1, status: "completed", actorUserId: 7, actorRole: "admin", idempotencyKey: "test-key-001" } as never)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.update).not.toHaveBeenCalled();
  });
  it("spoofed role cannot cancel another family's ride", async () => {
    const actor = { id: 7, appRole: "family", userStatus: "active" };
    state.rows = [[actor], [actor], [{ id: 1, familyUserId: 8, status: "requested" }]];
    await expect(updateRideStatus({ id: 1, status: "cancelled", actorUserId: 7, actorRole: "admin", idempotencyKey: "test-key-002" } as never)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.update).not.toHaveBeenCalled();
  });
  it("db helper reloads approved driver and required documents", async () => {
    state.rows = [
      [{ id: 7, appRole: "driver", userStatus: "active" }],
      [{ verificationStatus: "approved", accountStatus: "active", subscriptionStatus: "approved", subscriptionStartsAt: new Date("2020-01-01"), subscriptionEndsAt: new Date("2099-01-01") }],
      REQUIRED_DRIVER_DOCUMENTS.map((documentType) => ({ documentType, status: "approved", expiresAt: new Date("2099-01-01") })),
    ];
    await expect(assertDriverEligibility(7)).resolves.toBeUndefined();
    expect(state.rows).toHaveLength(0);
  });
  it("db helper rejects stale driver eligibility after user is blocked", async () => {
    state.rows = [
      [{ id: 7, appRole: "driver", userStatus: "blocked" }],
      [{ verificationStatus: "approved", accountStatus: "active", subscriptionStatus: "approved" }],
      REQUIRED_DRIVER_DOCUMENTS.map((documentType) => ({ documentType, status: "approved" })),
    ];
    await expect(assertDriverEligibility(7)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("direct admin mutation helper also enforces deferred MFA boundary", async () => {
    state.rows = [[{ id: 7, appRole: "admin", userStatus: "active" }]];
    await expect(updateAdminSetting({ updatedBy: 7, settingKey: "x", settingValue: "y", category: "permissions" })).rejects.toThrow(/MFA/);
    expect(state.update).not.toHaveBeenCalled();
    expect(state.insertValues).not.toHaveBeenCalled();
  });
});