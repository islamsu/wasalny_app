import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import superjson from "superjson";
import { businessIdempotency, users, rides } from "../drizzle/schema";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { assertActiveUser } from "./_core/authorization";

// Business code uses query/transaction capabilities, not a concrete $client.
// Supports pooled production databases, dedicated test connections and txs.
type Database = MySql2Database;
export const businessTransaction = new AsyncLocalStorage<Database>();

function retryableLockFailure(error: unknown): boolean {
  const seen = new Set<unknown>();
  while (error && typeof error === "object" && !seen.has(error)) {
    seen.add(error);
    const detail = error as { code?: string; errno?: number; cause?: unknown };
    if (detail.code === "ER_LOCK_DEADLOCK" || detail.errno === 1213 || detail.code === "ER_LOCK_WAIT_TIMEOUT" || detail.errno === 1205) return true;
    error = detail.cause;
  }
  return false;
}

/** Only retry after the transaction promise has rejected/rolled back. Every
 * attempt retains the same actor, operation, key and fingerprint. No side-effect
 * delivery is allowed inside execute; routers deliver notifications afterwards.
 */
export async function retryBusinessTransaction<T>(transaction: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await transaction(); }
    catch (error) {
      if (attempt >= 2 || !retryableLockFailure(error)) throw error;
      await new Promise(resolve => setTimeout(resolve, 10 * (attempt + 1)));
    }
  }
}

export function payloadFingerprint(payload: unknown): string {
  function canonical(value: any): any {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined && key !== "idempotencyKey").map(key => [key, canonical(value[key])]));
    return value;
  }
  return createHash("sha256").update(JSON.stringify(canonical(payload))).digest("hex");
}

/** Unique reservation and business writes commit together; failures roll back both.
 * No in-memory success cache and no expiry that could re-execute old commands.
 */
export async function durableCommand<T>(db: Database, actorUserId: number, operation: string, key: string | undefined, payload: unknown, execute: () => Promise<T>): Promise<T> {
  if (!key || !/^[A-Za-z0-9_-]{8,128}$/.test(key)) throw new TRPCError({ code: "BAD_REQUEST", message: "A stable idempotencyKey (8–128 URL-safe characters) is required" });
  const fingerprint = payloadFingerprint(payload);
  return retryBusinessTransaction(() => db.transaction(async tx => {
    // Serialize commands per actor, including different keys, and read current role.
    const actor = (await tx.select().from(users).where(eq(users.id, actorUserId)).for("update"))[0];
    assertActiveUser(actor);
    const data = payload as { rideId?: number; id?: number };
    const requiredRole = operation === "offer.create" ? "driver" : ["ride.create", "offer.select", "rating.create"].includes(operation) ? "family" : null;
    if (requiredRole && actor.appRole !== requiredRole) throw new TRPCError({ code: "FORBIDDEN", message: "Current role cannot perform this operation" });
    if (!requiredRole && actor.appRole !== "family" && actor.appRole !== "driver") throw new TRPCError({ code: "FORBIDDEN" });
    if (operation !== "ride.create" && operation !== "offer.create") {
      const ride = (await tx.select().from(rides).where(eq(rides.id, data.rideId ?? data.id ?? -1)).for("update"))[0];
      if (!ride || (actor.appRole === "family" ? ride.familyUserId !== actor.id : ride.driverUserId !== actor.id)) throw new TRPCError({ code: "FORBIDDEN", message: "Ride ownership required" });
      if (operation.startsWith("ride.") && actor.appRole === "family" && operation !== "ride.cancelled") throw new TRPCError({ code: "FORBIDDEN" });
    }
    await tx.insert(businessIdempotency).values({ actorUserId, operation, requestKey: key, fingerprint }).onDuplicateKeyUpdate({ set: { requestKey: key } });
    const scope = and(eq(businessIdempotency.actorUserId, actorUserId), eq(businessIdempotency.operation, operation), eq(businessIdempotency.requestKey, key));
    const record = (await tx.select().from(businessIdempotency).where(scope).for("update"))[0];
    if (record.fingerprint !== fingerprint) throw new TRPCError({ code: "CONFLICT", message: "Idempotency key was already used with a different payload" });
    if (record.response !== null) return superjson.parse<T>(record.response);
    const result = await businessTransaction.run(tx, execute);
    await tx.update(businessIdempotency).set({ response: superjson.stringify(result) }).where(scope);
    return result;
  }, { isolationLevel: "read committed" }));
}