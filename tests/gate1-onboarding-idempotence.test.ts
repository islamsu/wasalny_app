import { beforeEach, describe, expect, it, vi } from "vitest";
import { driverProfiles } from "../drizzle/schema";
import { ensureDriverProfile } from "../server/db";

// Models the database's unique userId conflict branch only. This is not
// staging concurrency evidence; migration 0010 supplies the real constraint.
const persistence = vi.hoisted(() => ({
  profiles: new Map<number, Record<string, unknown>>(),
  duplicateUpdates: vi.fn(),
}));
vi.mock("../server/_core/env", () => ({ ENV: { databaseUrl: "unit-only-no-connection" } }));
vi.mock("../server/_core/mysql-config", () => ({ mysqlConnectionOptions: () => ({}) }));
vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: () => ({
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => table === driverProfiles
            ? [...persistence.profiles.values()]
            : [{ id: 7, appRole: "family", userStatus: "active" }],
        }),
      }),
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        onDuplicateKeyUpdate: async (input: { set: Record<string, unknown> }) => {
          persistence.duplicateUpdates(input);
          // Allow competing callers to reach their insert before either resumes.
          await Promise.resolve();
          const userId = Number(values.userId);
          const existing = persistence.profiles.get(userId);
          if (existing) Object.assign(existing, input.set);
          else persistence.profiles.set(userId, { id: 1, ...values });
        },
      }),
    }),
  }),
}));

beforeEach(() => { persistence.profiles.clear(); vi.clearAllMocks(); });

describe("atomic driver onboarding against a unit-modeled unique userId", () => {
  it("concurrent attempts converge to one pending profile without duplicate failure", async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => ensureDriverProfile(7)));
    expect(persistence.profiles.size).toBe(1);
    expect(results).toHaveLength(20);
    for (const profile of results) {
      expect(profile).toBe(results[0]);
      expect(profile).toMatchObject({ id: 1, userId: 7, verificationStatus: "pending", verifiedAt: null, verifiedBy: null });
    }
    expect(persistence.duplicateUpdates).toHaveBeenCalledTimes(20);
    for (const [update] of persistence.duplicateUpdates.mock.calls) expect(update).toEqual({ set: { userId: 7 } });
  });
  it.each(["approved", "rejected", "revoked"])("concurrent retry cannot overwrite existing %s review or vehicle", async (verificationStatus) => {
    const existing = { id: 11, userId: 7, vehicleType: "toktok", verificationStatus, verifiedAt: new Date(0), verifiedBy: 4 };
    persistence.profiles.set(7, { ...existing });
    const results = await Promise.all([ensureDriverProfile(7, "car"), ensureDriverProfile(7, "toktok")]);
    expect(persistence.profiles.size).toBe(1);
    expect(results).toEqual([existing, existing]);
  });
});