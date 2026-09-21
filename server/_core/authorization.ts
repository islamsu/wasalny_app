import { TRPCError } from "@trpc/server";
import { documentIsCurrent, validInterval } from "../../shared/business-policy";

export type AppRole = "family" | "driver" | "admin";
type Principal = { id: number; appRole?: string | null; userStatus?: string | null };
type Driver = { verificationStatus?: string | null; accountStatus?: string | null; subscriptionStatus?: string | null; subscriptionStartsAt?: Date | null; subscriptionEndsAt?: Date | null };
type Document = { documentType: string; status: string; id?: number; validFrom?: Date | null; expiresAt?: Date | null };

// Explicit fail-closed policy: even expired temporary suspensions need an
// audited reactivation. A timestamp never silently restores authorization.
export function assertActiveUser(user: Principal | null | undefined): asserts user is Principal & { appRole: AppRole } {
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
  if (user.userStatus !== "active" || !["family", "driver", "admin"].includes(user.appRole ?? "")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Account is not active or has no valid application role" });
  }
}

export function assertRole(user: Principal | null | undefined, role: AppRole) {
  assertActiveUser(user);
  if (user.appRole !== role) throw new TRPCError({ code: "FORBIDDEN", message: `${role} access required` });
}

export function assertDriverOnboarding(user: Principal | null | undefined) {
  assertActiveUser(user);
  if (user.appRole !== "family" && user.appRole !== "driver") throw new TRPCError({ code: "FORBIDDEN", message: "Driver onboarding requires a family or driver account" });
}

export const DRIVER_DOCUMENT_TYPES = ["id", "license", "vehicle", "photos", "personal", "payment"] as const;
export const REQUIRED_DRIVER_DOCUMENTS = DRIVER_DOCUMENT_TYPES;

export function assertDriverDocumentType(type: string): asserts type is typeof DRIVER_DOCUMENT_TYPES[number] {
  if (!(DRIVER_DOCUMENT_TYPES as readonly string[]).includes(type)) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown driver document type" });
}

export function assertOperationalDriver(user: Principal | null | undefined, driver: Driver | null | undefined, documents: Document[], subscriptionRequired = true) {
  assertRole(user, "driver");
  if (!driver || driver.verificationStatus !== "approved" || driver.accountStatus !== "active" || (subscriptionRequired && driver.subscriptionStatus !== "approved")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Driver is not operationally eligible" });
  }
  if (subscriptionRequired && !validInterval(driver.subscriptionStartsAt, driver.subscriptionEndsAt)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "A current explicit subscription interval is required" });
  }
  for (const type of REQUIRED_DRIVER_DOCUMENTS) {
    if (type === "payment" && !subscriptionRequired) continue;
    const latest = documents.filter((doc) => doc.documentType === type).sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];
    if (latest?.status !== "approved" || !documentIsCurrent(latest)) throw new TRPCError({ code: "FORBIDDEN", message: `Current approved driver document required: ${type}` });
  }
}

export function assertDocumentAccess(user: Principal | null | undefined, ownerId: number) {
  assertActiveUser(user);
  if (user.appRole !== "admin" && user.id !== ownerId) throw new TRPCError({ code: "FORBIDDEN", message: "Document access denied" });
}

// Gate 1 does not manufacture MFA/recent-auth proof or introduce a session
// implementation. Sensitive admin mutations remain unavailable until Gate 2.
export function assertSensitiveAdmin(user: Principal | null | undefined): void {
  assertRole(user, "admin");
  throw new TRPCError({ code: "FORBIDDEN", message: "Sensitive admin actions require provider/session MFA and recent-auth verification (not implemented in Gate 1)" });
}

/** Complete business procedure policy. Unknown protected paths fail closed. */
export function authorizeProcedure(user: Principal | null | undefined, path: string, type: string): "driver-operation" | void {
  assertActiveUser(user);
  if (path.startsWith("admin.") || path === "system.notifyOwner") {
    assertRole(user, "admin");
    if (type === "mutation") assertSensitiveAdmin(user);
    return;
  }
  if (["driverDocuments.listMine", "driverDocuments.upload", "profile.ensureDriver", "profile.onboarding", "profile.submitOnboarding"].includes(path)) {
    assertDriverOnboarding(user);
    return;
  }
  if (["profile.availability", "rides.driverRequests", "rides.offers.create"].includes(path)) {
    assertRole(user, "driver");
    return "driver-operation";
  }
  if (path === "ratings.mine") { assertRole(user, "driver"); return; }
  if (["drivers.nearby", "ratings.create", "favorites.list", "favorites.add", "favorites.remove", "complaints.create", "rides.create", "rides.mine", "rides.offers.list", "rides.offers.select"].includes(path)) {
    assertRole(user, "family");
    return;
  }
  if (path === "rides.status") {
    if (user.appRole === "admin") assertSensitiveAdmin(user);
    if (user.appRole === "driver") return "driver-operation";
    return;
  }
  if (["rides.detail", "rides.current", "ratings.forDriver", "push.register"].includes(path)) return;
  throw new TRPCError({ code: "FORBIDDEN", message: "No authorization policy for procedure" });
}