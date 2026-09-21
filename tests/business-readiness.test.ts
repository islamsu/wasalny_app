import { describe, expect, it } from "vitest";
import { documentIsCurrent, validInterval } from "../shared/business-policy";
import { durableCommand, payloadFingerprint, retryBusinessTransaction } from "../server/business-transactions";
import { businessIdempotency, rides, users } from "../drizzle/schema";
import { assertOperationalDriver } from "../server/_core/authorization";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

describe("business validity policy (not provider E2E)", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  it("requires real expiration evidence for regulated documents", () => {
    for (const documentType of ["id", "license", "vehicle"]) {
      expect(documentIsCurrent({ documentType }, now)).toBe(false);
      expect(documentIsCurrent({ documentType, expiresAt: new Date("2026-02-01") }, now)).toBe(true);
      expect(documentIsCurrent({ documentType, expiresAt: now }, now)).toBe(false);
    }
    expect(documentIsCurrent({ documentType: "photos" }, now)).toBe(true);
  });
  it("rejects future, reversed and malformed dates", () => {
    expect(documentIsCurrent({ documentType: "id", validFrom: new Date("2027-01-01"), expiresAt: new Date("2028-01-01") }, now)).toBe(false);
    expect(documentIsCurrent({ documentType: "id", expiresAt: new Date("invalid") }, now)).toBe(false);
  });
  it("subscription approval alone confers no current interval", () => {
    expect(validInterval(null, null, now)).toBe(false);
    expect(validInterval(new Date("2025-01-01"), now, now)).toBe(false);
    expect(validInterval(now, new Date("2026-01-02"), now)).toBe(true);
    expect(() => assertOperationalDriver({ id: 1, appRole: "driver", userStatus: "active" }, { verificationStatus: "approved", accountStatus: "active", subscriptionStatus: "approved" }, [])).toThrow(/interval/);
  });
});

describe("durable command fingerprint and locking contract", () => {
  it("canonicalizes object key order, not payload values", () => {
    expect(payloadFingerprint({ a: 1, b: 2, idempotencyKey: "key1" })).toBe(payloadFingerprint({ b: 2, a: 1, idempotencyKey: "key2" }));
    expect(payloadFingerprint({ a: 1 })).not.toBe(payloadFingerprint({ a: 2 }));
  });
  it("contains transactional reservation, actor locking and persisted replay; static contract, not live DB evidence", () => {
    const source = readFileSync(fileURLToPath(new URL("../server/business-transactions.ts", import.meta.url)), "utf8");
    expect(source).toContain('for("update")');
    expect(source).toContain("db.transaction");
    expect(source).toContain("record.fingerprint !== fingerprint");
    expect(source).toContain("superjson.parse<T>(record.response)");
    expect(source).toContain('isolationLevel: "read committed"');
    const schema = readFileSync(fileURLToPath(new URL("../drizzle/schema.ts", import.meta.url)), "utf8");
    expect(schema).toContain('uniqueIndex("business_idempotency_scope").on(table.actorUserId, table.operation, table.requestKey)');
  });
});

/** Small serial transaction model; intentionally not real database evidence. */
function commandModel() {
  const actor = { id: 1, appRole: "family", userStatus: "active" };
  const ride = { id: 10, familyUserId: 1, driverUserId: 2 };
  let record: any;
  let tail = Promise.resolve();
  const tx: any = {
    select: () => ({ from: (table: unknown) => ({ where: () => ({ for: async () => table === users ? [actor] : table === rides ? [ride] : record ? [record] : [] }) }) }),
    insert: () => ({ values: (value: any) => ({ onDuplicateKeyUpdate: async () => { record ??= { ...value, response: null }; } }) }),
    update: (table: unknown) => ({ set: (value: any) => ({ where: async () => { if (table === businessIdempotency) Object.assign(record, value); } }) }),
  };
  const db: any = { transaction: (work: (tx: any) => Promise<any>) => {
    const result = tail.then(async () => {
      const before = record ? { ...record } : undefined;
      try { return await work(tx); } catch (error) { record = before; throw error; }
    });
    tail = result.then(() => undefined, () => undefined);
    return result;
  } };
  return { db, actor, ride };
}

describe("durable command transaction model", () => {
  it("retries the complete deadlocked command with its original key and fingerprint", async () => {
    const { db } = commandModel();
    let attempts = 0;
    const execute = async () => {
      if (++attempts === 1) throw Object.assign(new Error("cross-operation deadlock"), { cause: { code: "ER_LOCK_DEADLOCK" } });
      return { id: 12 };
    };
    await expect(durableCommand(db, 1, "ride.create", "unchanged-key", { pickup: "A" }, execute)).resolves.toEqual({ id: 12 });
    await expect(durableCommand(db, 1, "ride.create", "unchanged-key", { pickup: "A" }, execute)).resolves.toEqual({ id: 12 });
    expect(attempts).toBe(2);
  });
  it("bounds retries and never retries business failures", async () => {
    let attempts = 0;
    await expect(retryBusinessTransaction(async () => { attempts++; throw { code: "ER_LOCK_WAIT_TIMEOUT" }; })).rejects.toMatchObject({ code: "ER_LOCK_WAIT_TIMEOUT" });
    expect(attempts).toBe(3);
    attempts = 0;
    await expect(retryBusinessTransaction(async () => { attempts++; throw new Error("business conflict"); })).rejects.toThrow("business conflict");
    expect(attempts).toBe(1);
  });
  it("concurrent duplicates execute once and replay typed output", async () => {
    const { db } = commandModel();
    let writes = 0;
    const execute = async () => ({ id: ++writes, at: new Date("2026-01-01") });
    const results = await Promise.all(Array.from({ length: 12 }, () => durableCommand(db, 1, "ride.create", "stable-key", { pickup: "A" }, execute)));
    expect(writes).toBe(1);
    expect(results.every(result => result.id === 1 && result.at instanceof Date)).toBe(true);
    await expect(durableCommand(db, 1, "ride.create", "stable-key", { pickup: "B" }, execute)).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("revalidates current role and ownership before replay", async () => {
    const model = commandModel();
    const invoke = () => durableCommand(model.db, 1, "rating.create", "stable-key", { rideId: 10 }, async () => ({ id: 99 }));
    await invoke();
    model.actor.appRole = "driver";
    await expect(invoke()).rejects.toMatchObject({ code: "FORBIDDEN" });
    model.actor.appRole = "family";
    model.ride.familyUserId = 3;
    await expect(invoke()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("rolls back failed reservation so retry can succeed", async () => {
    const { db } = commandModel();
    await expect(durableCommand(db, 1, "ride.create", "stable-key", {}, async () => { throw new Error("failure"); })).rejects.toThrow("failure");
    await expect(durableCommand(db, 1, "ride.create", "stable-key", {}, async () => ({ id: 2 }))).resolves.toEqual({ id: 2 });
  });
});