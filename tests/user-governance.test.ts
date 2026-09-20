import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter, familyModerationInput } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

// Unit-only persistence fixture: exercise the actual DB helper's fresh actor
// lookup without connecting to a live database or mocking authorization.
const persistence = vi.hoisted(() => ({ rows: [] as unknown[][], select: vi.fn(), update: vi.fn(), insert: vi.fn() }));
vi.mock("../server/_core/env", () => ({ ENV: { databaseUrl: "unit-test-no-connection" } }));
vi.mock("../server/_core/mysql-config", () => ({ mysqlConnectionOptions: () => ({}) }));
vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: () => ({
    select: () => {
      persistence.select();
      const result = Promise.resolve(persistence.rows.shift() ?? []);
      const chain = { from: () => chain, where: () => chain, limit: () => result, orderBy: () => result };
      return chain;
    },
    update: persistence.update,
    insert: persistence.insert,
  }),
}));

beforeEach(() => { vi.clearAllMocks(); persistence.rows = []; });

function adminContext(): TrpcContext {
  return {
    user: {
      id: 9001,
      openId: "demo-admin-governance",
      email: "admin@example.com",
      phone: null,
      name: "مشرف تجريبي",
      loginMethod: "demo",
      role: "admin",
      appRole: "admin",
      userStatus: "active",
      moderationReason: null,
      suspendedUntil: null,
      moderatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("admin family governance", () => {
  it("allows the family directory only after reloading an active appRole admin", async () => {
    const family = { id: 12, appRole: "family", userStatus: "active" };
    persistence.rows = [[{ ...adminContext().user, role: "user" }], [family]];
    const result = await appRouter.createCaller(adminContext()).admin.users.listFamilies();
    expect(result).toEqual([family]);
    expect(persistence.select).toHaveBeenCalledTimes(2);
  });

  it("fails closed when the persisted administrator cannot be loaded", async () => {
    await expect(appRouter.createCaller(adminContext()).admin.users.listFamilies()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(persistence.select).toHaveBeenCalledTimes(1);
  });

  it.each(["blocked", "suspended_temp", "suspended_permanent"])("rejects stale admin context when persisted account is %s", async (userStatus) => {
    persistence.rows = [[{ ...adminContext().user, userStatus }]];
    await expect(appRouter.createCaller(adminContext()).admin.users.listFamilies()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(persistence.select).toHaveBeenCalledTimes(1);
  });

  it("rejects persisted legacy admin when appRole has been downgraded", async () => {
    persistence.rows = [[{ ...adminContext().user, appRole: "family", role: "admin" }]];
    await expect(appRouter.createCaller(adminContext()).admin.users.listFamilies()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(persistence.select).toHaveBeenCalledTimes(1);
  });

  it.each(["", "   ", "ab"])("input validation rejects a missing or short reason (%s)", (reason) => {
    expect(() => familyModerationInput.parse({ userId: 12, status: "blocked", reason })).toThrow("سبب الإجراء مطلوب");
  });

  it.each([undefined, null, new Date(0).toISOString()])("input validation requires a future custom suspension date (%s)", (suspendedUntil) => {
    expect(() => familyModerationInput.parse({ userId: 12, status: "suspended_temp", reason: "مخالفة موثقة", suspendedUntil })).toThrow("تاريخ مستقبلي");
  });

  it("input validation accepts a future temporary suspension with a reason", () => {
    const input = { userId: 12, status: "suspended_temp", reason: "مخالفة موثقة", suspendedUntil: new Date(Date.now() + 86400000).toISOString() };
    expect(familyModerationInput.parse(input)).toEqual(input);
  });

  it.each(["blocked", "suspended_temp", "active"] as const)("sensitive %s moderation remains denied without implemented MFA/session proof", async (status) => {
    await expect(appRouter.createCaller(adminContext()).admin.users.moderateFamily({
      userId: 12, status, reason: "مخالفة موثقة", suspendedUntil: new Date(Date.now() + 86400000).toISOString(),
    })).rejects.toThrow(/MFA/);
    expect(persistence.select).not.toHaveBeenCalled();
    expect(persistence.update).not.toHaveBeenCalled();
    expect(persistence.insert).not.toHaveBeenCalled();
  });
});
