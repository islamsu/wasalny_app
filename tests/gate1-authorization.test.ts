import { describe, expect, it } from "vitest";
import { assertActiveUser, assertRole, assertDriverOnboarding, assertOperationalDriver, assertDocumentAccess, assertSensitiveAdmin, authorizeProcedure, REQUIRED_DRIVER_DOCUMENTS } from "../server/_core/authorization";

const user = (appRole = "family", userStatus = "active") => ({ id: 1, appRole, userStatus, role: "admin" });
// Supplied test evidence, not a production duration policy.
const driver = { verificationStatus: "approved", accountStatus: "active", subscriptionStatus: "approved", subscriptionStartsAt: new Date("2020-01-01"), subscriptionEndsAt: new Date("2099-01-01") };
const documents = REQUIRED_DRIVER_DOCUMENTS.map((documentType, id) => ({ id, documentType, status: "approved", expiresAt: new Date("2099-01-01") }));

describe("Gate 1 centralized authorization", () => {
  it.each(["family", "driver", "admin"] as const)("allows active %s only its own role", (role) => {
    expect(() => assertRole(user(role), role)).not.toThrow();
    for (const other of ["family", "driver", "admin"] as const) if (other !== role) expect(() => assertRole(user(role), other)).toThrow();
  });
  it.each(["blocked", "suspended_temp", "suspended_permanent", "suspended", "", undefined, null])("denies non-active status %s", (status) => {
    expect(() => assertActiveUser({ ...user("admin"), userStatus: status })).toThrow();
  });
  it.each([new Date(0), new Date(Date.now() + 86400000), null])("temporary suspension never self-reactivates (%s)", (suspendedUntil) => {
    const suspended = { ...user("family", "suspended_temp"), suspendedUntil };
    expect(() => assertActiveUser(suspended)).toThrow();
  });
  it.each([undefined, null, "", "owner", "user"])("rejects missing/unknown appRole despite legacy admin (%s)", (appRole) => {
    expect(() => assertActiveUser({ ...user(), appRole })).toThrow();
  });
  it("rejects anonymous principals", () => expect(() => assertActiveUser(null)).toThrow());
  it("legacy admin cannot authorize an admin action", () => expect(() => assertRole(user(), "admin")).toThrow());
  it.each(["family", "driver"])("allows %s onboarding without granting operations", (role) => {
    expect(() => assertDriverOnboarding(user(role))).not.toThrow();
    expect(() => assertOperationalDriver(user(role), { ...driver, verificationStatus: "pending" }, documents)).toThrow();
  });
  it("does not let admin create its own driver application", () => expect(() => assertDriverOnboarding(user("admin"))).toThrow());
  it("allows only a fully eligible operational driver", () => expect(() => assertOperationalDriver(user("driver"), driver, documents)).not.toThrow());
  it.each(["pending", "rejected", "revoked", undefined])("denies driver verification %s", (verificationStatus) => {
    expect(() => assertOperationalDriver(user("driver"), { ...driver, verificationStatus }, documents)).toThrow();
  });
  it.each(["blocked", "suspended", undefined])("denies driver account status %s", (accountStatus) => {
    expect(() => assertOperationalDriver(user("driver"), { ...driver, accountStatus }, documents)).toThrow();
  });
  it("denies blocked users even with approved driver profile", () => expect(() => assertOperationalDriver(user("driver", "blocked"), driver, documents)).toThrow());
  it("denies absent profile", () => expect(() => assertOperationalDriver(user("driver"), null, documents)).toThrow());
  it.each(REQUIRED_DRIVER_DOCUMENTS)("requires approved %s", (type) => {
    expect(() => assertOperationalDriver(user("driver"), driver, documents.filter((doc) => doc.documentType !== type))).toThrow();
    expect(() => assertOperationalDriver(user("driver"), driver, documents.map((doc) => doc.documentType === type ? { ...doc, status: "pending" } : doc))).toThrow();
  });
  it("new pending submission supersedes older approved document", () => {
    expect(() => assertOperationalDriver(user("driver"), driver, [...documents, { id: 100, documentType: "license", status: "pending" }])).toThrow();
  });
  it("requires subscription where applicable", () => {
    expect(() => assertOperationalDriver(user("driver"), { ...driver, subscriptionStatus: "pending" }, documents)).toThrow();
    expect(() => assertOperationalDriver(user("driver"), { ...driver, subscriptionStatus: "pending" }, documents, false)).not.toThrow();
  });
  it.each(["pending", "rejected", "invalid", ""])("latest %s payment receipt overrides older approval", (status) => {
    expect(() => assertOperationalDriver(user("driver"), driver, [...documents, { id: 100, documentType: "payment", status }])).toThrow(/payment/);
  });
  it("requires approved subscription status even with an approved receipt", () => {
    expect(() => assertOperationalDriver(user("driver"), { ...driver, subscriptionStatus: "pending" }, documents)).toThrow();
  });
  it("does not require a payment receipt only when subscription is explicitly inapplicable", () => {
    const withoutPayment = documents.filter((doc) => doc.documentType !== "payment");
    expect(() => assertOperationalDriver(user("driver"), driver, withoutPayment)).toThrow(/payment/);
    expect(() => assertOperationalDriver(user("driver"), driver, withoutPayment, false)).not.toThrow();
  });
  it("document ownership cannot be bypassed using legacy role", () => {
    expect(() => assertDocumentAccess(user(), 2)).toThrow();
    expect(() => assertDocumentAccess(user(), 1)).not.toThrow();
    expect(() => assertDocumentAccess(user("admin"), 2)).not.toThrow();
    expect(() => assertDocumentAccess(user("admin", "blocked"), 2)).toThrow();
  });
  it("sensitive admin proof is not fabricated", () => expect(() => assertSensitiveAdmin(user("admin"))).toThrow(/MFA/));
  it("new protected routes have no implicit authorization", () => expect(() => authorizeProcedure(user("admin"), "unknown.route", "query")).toThrow());
});