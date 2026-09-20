import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/mysql-core";
import {
  authIdentities,
  authRefreshTokens,
  authSessions,
  driverProfiles,
} from "../drizzle/schema";

const indexConfig = (table: Parameters<typeof getTableConfig>[0], name: string) =>
  getTableConfig(table).indexes.find((entry) => entry.config.name === name)?.config;

const indexColumnNames = (table: Parameters<typeof getTableConfig>[0], name: string) =>
  indexConfig(table, name)?.columns.map((column) => {
    if (!("name" in column)) {
      throw new Error(`Index ${name} contains an SQL expression instead of a named column`);
    }
    return column.name;
  });

const foreignKeyReference = (table: Parameters<typeof getTableConfig>[0], name: string) => {
  const foreignKey = getTableConfig(table).foreignKeys.find((entry) => entry.getName() === name);
  return foreignKey ? { foreignKey, reference: foreignKey.reference() } : undefined;
};

describe("authentication schema", () => {
  it("uses binary, case-sensitive identity keys and the required uniqueness constraints", () => {
    expect(authIdentities.issuer.getSQLType()).toBe("varbinary(255)");
    expect(authIdentities.subject.getSQLType()).toBe("varbinary(255)");

    const externalIdentity = indexConfig(authIdentities, "auth_identity_issuer_subject_unique");
    expect(externalIdentity?.unique).toBe(true);
    expect(indexColumnNames(authIdentities, "auth_identity_issuer_subject_unique")).toEqual(["issuer", "subject"]);

    const identityUser = indexConfig(authIdentities, "auth_identity_id_user_unique");
    expect(identityUser?.unique).toBe(true);
    expect(indexColumnNames(authIdentities, "auth_identity_id_user_unique")).toEqual(["id", "userId"]);
  });

  it("binds every session identity to the same session user", () => {
    const relation = foreignKeyReference(authSessions, "auth_session_identity_user_fk");
    expect(relation?.reference.columns.map((column) => column.name)).toEqual(["identityId", "userId"]);
    expect(relation?.reference.foreignTable).toBe(authIdentities);
    expect(relation?.reference.foreignColumns.map((column) => column.name)).toEqual(["id", "userId"]);
    expect(relation?.foreignKey.onDelete).toBe("restrict");
    expect(relation?.foreignKey.onUpdate).toBe("restrict");
  });

  it("stores only fixed-size binary refresh-token hashes and tracks token lifecycle", () => {
    expect(authRefreshTokens.tokenHash.getSQLType()).toBe("binary(32)");
    expect(indexConfig(authRefreshTokens, "auth_refresh_token_hash_unique")?.unique).toBe(true);
    expect(authRefreshTokens).toHaveProperty("expiresAt");
    expect(authRefreshTokens).toHaveProperty("consumedAt");
    expect(authRefreshTokens).toHaveProperty("revokedAt");
    expect(authRefreshTokens).toHaveProperty("replacedByTokenId");
    expect(authRefreshTokens).toHaveProperty("replayDetectedAt");
  });

  it("defines session security context and safe driver verification defaults", () => {
    expect(authSessions.id.getSQLType()).toBe("varbinary(64)");
    expect(authSessions).toHaveProperty("absoluteExpiresAt");
    expect(authSessions).toHaveProperty("inactivityExpiresAt");
    expect(authSessions).toHaveProperty("revokedAt");
    expect(authSessions).toHaveProperty("authFreshUntil");
    expect(authSessions).toHaveProperty("mfaAuthenticatedAt");
    expect(authSessions).toHaveProperty("mfaContext");

    expect(driverProfiles.verificationStatus.enumValues).toEqual([
      "pending",
      "approved",
      "rejected",
      "revoked",
    ]);
    expect(driverProfiles.verificationStatus.default).toBe("pending");
    expect(driverProfiles.verificationStatus.notNull).toBe(true);
    expect(driverProfiles.verifiedAt.notNull).toBe(false);
    expect(driverProfiles.verifiedBy.notNull).toBe(false);
  });

  it("allows at most one driver profile per user", () => {
    const driverUser = indexConfig(driverProfiles, "driver_profile_user_unique");
    expect(driverUser?.unique).toBe(true);
    expect(indexColumnNames(driverProfiles, "driver_profile_user_unique")).toEqual(["userId"]);
  });
});