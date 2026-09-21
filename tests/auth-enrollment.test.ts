import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  verify: vi.fn(),
  users: [] as any[],
  identities: [] as any[],
  writes: [] as { sql: string; args: any[] }[],
}));

vi.mock("../server/auth/firebase", () => ({
  verifyFirebase: mock.verify,
  assertFirebaseIdentity: vi.fn(),
}));

vi.mock("../server/auth/repository", () => ({
  transaction: async (work: (connection: object) => Promise<unknown>) => work({}),
  rows: async (_connection: object, sql: string, args: any[]) => {
    if (sql.includes("FROM authIdentities")) {
      return mock.identities.filter(identity =>
        String(identity.issuer) === String(args[0]) && String(identity.subject) === String(args[1]));
    }
    if (sql.includes("FROM users")) return mock.users.filter(user => user.id === args[0]);
    throw new Error(`Unexpected query in enrollment test: ${sql}`);
  },
  write: async (_connection: object, sql: string, args: any[]) => {
    mock.writes.push({ sql, args });
    if (sql.startsWith("INSERT INTO users")) {
      const id = mock.users.length + 1;
      mock.users.push({
        id, openId: args[0], name: args[1], email: args[2],
        loginMethod: "firebase", role: "user", appRole: "family", userStatus: "active",
      });
      return { insertId: id };
    }
    if (sql.startsWith("INSERT INTO authIdentities")) {
      const id = mock.identities.length + 1;
      mock.identities.push({ id, userId: args[0], issuer: args[1], subject: args[2] });
      return { insertId: id };
    }
    if (sql.startsWith("UPDATE authIdentities") ||
        sql.startsWith("INSERT INTO authSessions") ||
        sql.startsWith("INSERT INTO authRefreshTokens")) return { insertId: 1, affectedRows: 1 };
    throw new Error(`Unexpected write in enrollment test: ${sql}`);
  },
}));

import { authConfig } from "../server/auth/config";
import { exchange } from "../server/auth/service";

const allowedUid = "firebase-human-uid-01";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("FIREBASE_PROJECT_ID", "unit-test-project");
  vi.stubEnv("WASALNY_SESSION_SIGNING_KEY", "ab".repeat(32));
  vi.stubEnv("FIREBASE_AUTH_EMULATOR_HOST", "");
  vi.stubEnv("WASALNY_AUTH_ALLOW_NEW_USERS", "");
  vi.stubEnv("WASALNY_AUTH_NEW_USER_UID_ALLOWLIST", "");
  mock.users = [];
  mock.identities = [];
  mock.writes = [];
  mock.verify.mockReset().mockResolvedValue({
    issuer: "https://securetoken.google.com/unit-test-project",
    subject: allowedUid,
    authenticatedAt: new Date(),
    name: "Verified Person",
    email: "person@example.invalid",
    appRole: "admin",
  });
});

describe("bounded Firebase UID enrollment", () => {
  it.each([
    ["absent", undefined],
    ["empty", ""],
    ["nonmatching", "another-human-uid"],
  ])("%s allowlist denies an unlinked identity", async (_case, value) => {
    vi.stubEnv("WASALNY_AUTH_NEW_USER_UID_ALLOWLIST", value);
    await expect(exchange("verified-token")).rejects.toThrow("IDENTITY_PRELINK_REQUIRED");
    expect(mock.users).toHaveLength(0);
  });

  it("allows only the matching verified UID and provisions a normal family", async () => {
    vi.stubEnv("WASALNY_AUTH_NEW_USER_UID_ALLOWLIST", `other-uid, ${allowedUid}`);
    const response = await exchange("verified-token");
    expect(response.user).toMatchObject({ role: "user", appRole: "family", userStatus: "active" });
    expect(mock.users).toHaveLength(1);
    expect(mock.users[0]).toMatchObject({ role: "user", appRole: "family", userStatus: "active" });
  });

  it.each([
    "valid-uid,,another-uid",
    "uid with spaces",
    "duplicate-uid,duplicate-uid",
    `${"a".repeat(129)}`,
    Array.from({ length: 101 }, (_, index) => `uid-${index}`).join(","),
  ])("rejects invalid allowlist configuration", async value => {
    vi.stubEnv("WASALNY_AUTH_NEW_USER_UID_ALLOWLIST", value);
    expect(authConfig).toThrow("AUTH_CONFIGURATION_INVALID");
    await expect(exchange("verified-token")).rejects.toThrow("AUTH_CONFIGURATION_INVALID");
    expect(mock.verify).not.toHaveBeenCalled();
    expect(mock.users).toHaveLength(0);
  });

  it("preserves the existing global new-user option", async () => {
    vi.stubEnv("WASALNY_AUTH_ALLOW_NEW_USERS", "true");
    vi.stubEnv("WASALNY_AUTH_NEW_USER_UID_ALLOWLIST", "nonmatching-uid");
    await expect(exchange("verified-token")).resolves.toMatchObject({
      user: { role: "user", appRole: "family", userStatus: "active" },
    });
  });
});