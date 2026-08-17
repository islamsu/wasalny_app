import { describe, expect, it } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

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
  it("allows an admin to query the family directory when the database is unavailable", async () => {
    const result = await appRouter.createCaller(adminContext()).admin.users.listFamilies();
    expect(result).toEqual([]);
  });

  it("rejects moderation without a reason before touching persistence", async () => {
    const caller = appRouter.createCaller(adminContext());
    await expect(caller.admin.users.moderateFamily({ userId: 12, status: "blocked", reason: "" })).rejects.toThrow();
  });

  it("rejects an expired custom temporary suspension date", async () => {
    const caller = appRouter.createCaller(adminContext());
    await expect(caller.admin.users.moderateFamily({ userId: 12, status: "suspended_temp", reason: "مخالفة موثقة", suspendedUntil: new Date(Date.now() - 86400000).toISOString() })).rejects.toThrow("تاريخ مستقبلي");
  });
});
