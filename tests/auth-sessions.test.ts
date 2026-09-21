// Isolated security unit tests. Serialized in-memory repository is NOT live
// MySQL locking, Firebase staging, proxy, or Android evidence.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { serialize, deserialize } from "node:v8";

const mock = vi.hoisted(() => ({
  state: { users: [] as any[], identities: [] as any[], sessions: [] as any[], tokens: [] as any[] },
  queue: Promise.resolve(), verify: vi.fn(), identity: vi.fn(), writes: [] as { sql: string; args: any[] }[],
}));
vi.mock("../server/auth/firebase", () => ({ verifyFirebase: mock.verify, assertFirebaseIdentity: mock.identity }));
vi.mock("../server/auth/repository", () => ({
  transaction: async (work: any) => {
    const previous = mock.queue;
    let release!: () => void;
    mock.queue = new Promise<void>(resolve => { release = resolve; });
    await previous;
    const snapshot = deserialize(serialize(mock.state));
    try { return await work({}); } catch (e) { mock.state = snapshot; throw e; } finally { release(); }
  },
  rows: async (_c: any, sql: string, a: any[]) => {
    const eq = (x: any, y: any) => String(x) === String(y);
    if (sql.includes("FROM authRefreshTokens")) return mock.state.tokens.filter(t => Buffer.from(t.tokenHash).equals(a[0]));
    if (sql.includes("FROM authSessions")) return mock.state.sessions.filter(s => eq(s.id, a[0]) && (a.length < 2 || s.userId === a[1]));
    if (sql.includes("FROM authIdentities")) return mock.state.identities.filter(i =>
      sql.includes("issuer=?") ? eq(i.issuer, a[0]) && eq(i.subject, a[1]) : i.id === a[0] && i.userId === a[1]);
    if (sql.includes("FROM users")) return mock.state.users.filter(u => u.id === a[0]);
    throw new Error(`Unexpected mock query: ${sql}`);
  },
  write: async (_c: any, sql: string, a: any[]) => {
    mock.writes.push({ sql, args: a });
    if (sql.startsWith("INSERT INTO users")) {
      const id = mock.state.users.length + 1;
      mock.state.users.push({ id, openId: a[0], name: a[1], email: a[2], role: "user", appRole: "family", userStatus: "active" });
      return { insertId: id, affectedRows: 1 };
    }
    if (sql.startsWith("INSERT INTO authIdentities")) {
      const id = mock.state.identities.length + 1;
      mock.state.identities.push({ id, userId: a[0], issuer: a[1], subject: a[2] }); return { insertId: id };
    }
    if (sql.startsWith("INSERT INTO authSessions")) {
      mock.state.sessions.push({ id: a[0], userId: a[1], identityId: a[2], absoluteExpiresAt: a[3], inactivityExpiresAt: a[4], authenticatedAt: a[5] }); return { affectedRows: 1 };
    }
    if (sql.startsWith("INSERT INTO authRefreshTokens")) {
      const id = mock.state.tokens.length + 1;
      mock.state.tokens.push({ id, sessionId: a[0], tokenHash: a[1], expiresAt: a[2] }); return { insertId: id };
    }
    if (sql.startsWith("UPDATE authIdentities")) return { affectedRows: 1 };
    if (sql.includes("SET consumedAt=")) {
      Object.assign(mock.state.tokens.find(t => t.id === a[2]), { consumedAt: a[0], replacedByTokenId: a[1] }); return { affectedRows: 1 };
    }
    if (sql.includes("SET replayDetectedAt=")) {
      mock.state.tokens.find(t => t.id === a[1]).replayDetectedAt = a[0]; return { affectedRows: 1 };
    }
    if (sql.includes("SET lastActivityAt=")) {
      Object.assign(mock.state.sessions.find(s => String(s.id) === String(a[2])), { lastActivityAt: a[0], inactivityExpiresAt: a[1] }); return { affectedRows: 1 };
    }
    if (sql.includes("SET revokedAt=")) {
      const replay = sql.includes("refresh_replay");
      const target = replay ? a[1] : a[2];
      mock.state.sessions.filter(s => sql.includes("WHERE userId") ? s.userId === target : String(s.id) === String(target))
        .forEach(s => { s.revokedAt = a[0]; s.revocationReason = replay ? "refresh_replay" : a[1]; });
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected mock write: ${sql}`);
  },
}));
import { authenticate, exchange, refresh, logout, verifyAccess, assertUsableSession, hashRefresh } from "../server/auth/service";
import { authConfig, AuthError } from "../server/auth/config";

const bearer = (token: string) => ({ headers: { authorization: `Bearer ${token}` } });
beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("FIREBASE_PROJECT_ID", "unit-test-project");
  vi.stubEnv("WASALNY_SESSION_SIGNING_KEY", "ab".repeat(32));
  vi.stubEnv("WASALNY_AUTH_ALLOW_NEW_USERS", "true");
  vi.stubEnv("FIREBASE_AUTH_EMULATOR_HOST", "");
  mock.state = { users: [], identities: [], sessions: [], tokens: [] };
  mock.queue = Promise.resolve(); mock.writes = [];
  mock.verify.mockReset().mockResolvedValue({ issuer: "https://securetoken.google.com/unit-test-project", subject: "unit-subject", authenticatedAt: new Date(), name: "Unit Test", email: "fixture@example.invalid", appRole: "admin" });
  mock.identity.mockReset().mockResolvedValue(undefined);
});

describe("Wasalny sessions (mock repository)", () => {
  it("fails closed with missing config and refuses legacy secret fallback", async () => {
    vi.stubEnv("WASALNY_SESSION_SIGNING_KEY", "");
    vi.stubEnv("SESSION_SECRET", "ab".repeat(32));
    await expect(exchange("fixture")).rejects.toMatchObject({ status: 503 });
    expect(mock.verify).not.toHaveBeenCalled();
  });
  it("refuses emulator and weak keys", () => {
    vi.stubEnv("FIREBASE_AUTH_EMULATOR_HOST", "localhost:9099");
    expect(authConfig).toThrow();
    vi.stubEnv("FIREBASE_AUTH_EMULATOR_HOST", "");
    vi.stubEnv("WASALNY_SESSION_SIGNING_KEY", "weak");
    expect(authConfig).toThrow();
  });
  it("does not provision before prelinking gate is opened", async () => {
    vi.stubEnv("WASALNY_AUTH_ALLOW_NEW_USERS", "");
    await expect(exchange("fixture")).rejects.toThrow("IDENTITY_PRELINK_REQUIRED");
    expect(mock.state.users).toHaveLength(0);
  });
  it("defaults new users to family, ignores provider roles, stores only token hash", async () => {
    const r = await exchange("fixture");
    expect(r.user.appRole).toBe("family"); expect(r.user.role).toBe("user");
    expect(r.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(mock.state.tokens[0].tokenHash).toEqual(hashRefresh(r.refreshToken));
    expect(JSON.stringify(mock.writes)).not.toContain(r.refreshToken);
    expect(new Date(r.accessTokenExpiresAt).getTime() - Date.now()).toBeLessThanOrEqual(600000);
  });
  it("preserves mapped existing numeric ID and current database role", async () => {
    mock.state.users.push({ id: 97, appRole: "driver", role: "user", userStatus: "active" });
    mock.state.identities.push({ id: 42, userId: 97, issuer: Buffer.from("https://securetoken.google.com/unit-test-project"), subject: Buffer.from("unit-subject") });
    vi.stubEnv("WASALNY_AUTH_ALLOW_NEW_USERS", "");
    const r = await exchange("fixture");
    expect(r.user.id).toBe(97); expect(r.user.appRole).toBe("driver"); expect(mock.state.users).toHaveLength(1);
  });
  it("never links by email", async () => {
    mock.state.users.push({ id: 77, email: "fixture@example.invalid", appRole: "admin", userStatus: "active" });
    expect((await exchange("fixture")).user.id).not.toBe(77);
  });
  it("rejects provider verification failures without provisioning", async () => {
    mock.verify.mockRejectedValue(new AuthError("FIREBASE_TOKEN_REJECTED"));
    await expect(exchange("bad")).rejects.toThrow("FIREBASE_TOKEN_REJECTED");
    expect(mock.state.users).toHaveLength(0);
  });
  it("rotates once and commits replay revocation rather than rolling it back", async () => {
    const first = await exchange("fixture");
    const second = await refresh(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(mock.state.tokens[0].consumedAt).toBeInstanceOf(Date);
    await expect(refresh(first.refreshToken)).rejects.toThrow("REFRESH_REPLAY");
    expect(mock.state.sessions[0].revocationReason).toBe("refresh_replay");
    await expect(refresh(second.refreshToken)).rejects.toThrow("SESSION_EXPIRED");
    await expect(authenticate(bearer(second.accessToken))).rejects.toThrow("SESSION_EXPIRED");
  });
  it("concurrent refresh permits one winner and replay revokes winner session", async () => {
    const first = await exchange("fixture");
    const results = await Promise.allSettled([refresh(first.refreshToken), refresh(first.refreshToken)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
    expect(mock.state.tokens).toHaveLength(2);
    expect(mock.state.sessions[0].revokedAt).toBeTruthy();
    const winner = results.find(r => r.status === "fulfilled") as PromiseFulfilledResult<any>;
    await expect(authenticate(bearer(winner.value.accessToken))).rejects.toThrow();
  });
  it.each(["absoluteExpiresAt", "inactivityExpiresAt"])("enforces %s for refresh and access", async field => {
    const r = await exchange("fixture");
    mock.state.sessions[0][field] = new Date(Date.now() - 1);
    await expect(refresh(r.refreshToken)).rejects.toThrow("SESSION_EXPIRED");
    await expect(authenticate(bearer(r.accessToken))).rejects.toThrow("SESSION_EXPIRED");
  });
  it("rejects malformed session expiry", () => {
    expect(() => assertUsableSession({ absoluteExpiresAt: "bad", inactivityExpiresAt: "bad" })).toThrow();
  });
  it("inactivity rotation never extends absolute expiry", async () => {
    const r = await exchange("fixture");
    const absolute = new Date(Date.now() + 20000);
    mock.state.sessions[0].absoluteExpiresAt = absolute;
    await refresh(r.refreshToken);
    expect(mock.state.sessions[0].inactivityExpiresAt).toEqual(absolute);
  });
  it.each(["blocked", "suspended_temp", "suspended_permanent"])("rechecks database status %s", async status => {
    const r = await exchange("fixture"); mock.state.users[0].userStatus = status;
    await expect(authenticate(bearer(r.accessToken))).rejects.toThrow("ACCOUNT_UNAVAILABLE");
    await expect(refresh(r.refreshToken)).rejects.toThrow("ACCOUNT_UNAVAILABLE");
  });
  it("reads role from database on every protected request", async () => {
    const r = await exchange("fixture"); mock.state.users[0].appRole = "driver";
    expect((await authenticate(bearer(r.accessToken))).user.appRole).toBe("driver");
  });
  it("rechecks Firebase disabled/revoked identity on refresh and access", async () => {
    const r = await exchange("fixture"); mock.identity.mockRejectedValue(new AuthError("IDENTITY_REJECTED"));
    await expect(refresh(r.refreshToken)).rejects.toThrow("IDENTITY_REJECTED");
    await expect(authenticate(bearer(r.accessToken))).rejects.toThrow("IDENTITY_REJECTED");
  });
  it("logout-current leaves other session; logout-all revokes remaining", async () => {
    const a = await exchange("fixture"), b = await exchange("fixture");
    await logout(bearer(a.accessToken));
    await expect(authenticate(bearer(a.accessToken))).rejects.toThrow();
    await expect(authenticate(bearer(b.accessToken))).resolves.toBeTruthy();
    await logout(bearer(b.accessToken), true);
    await expect(authenticate(bearer(b.accessToken))).rejects.toThrow();
  });
  it("ignores ambient legacy cookies", async () => {
    await expect(authenticate({ headers: { cookie: "app_session_id=legacy" } })).rejects.toThrow("BEARER_REQUIRED");
  });
  it("rejects unknown and malformed refresh tokens without changes", async () => {
    await exchange("fixture");
    await expect(refresh("x")).rejects.toThrow("REFRESH_REJECTED");
    await expect(refresh("z".repeat(43))).rejects.toThrow("REFRESH_REJECTED");
    expect(mock.state.tokens).toHaveLength(1);
  });
  it.each(["signature", "algorithm", "issuer", "audience", "expired", "overlong", "missing", "future", "subject"])("rejects invalid JWT: %s", async kind => {
    const now = Math.floor(Date.now() / 1000), config = authConfig();
    const payload: any = { sid: "a".repeat(43), sub: "1", iss: config.issuer, aud: config.audience, iat: now, exp: now + 600 };
    if (kind === "issuer") payload.iss = "legacy";
    if (kind === "audience") payload.aud = "other";
    if (kind === "expired") { payload.iat = now - 601; payload.exp = now - 1; }
    if (kind === "overlong") payload.exp = now + 601;
    if (kind === "missing") delete payload.exp;
    if (kind === "future") payload.iat = now + 100;
    if (kind === "subject") payload.sub = "1e3";
    const token = await new SignJWT(payload).setProtectedHeader({ alg: kind === "algorithm" ? "HS384" : "HS256", typ: "JWT" })
      .sign(kind === "signature" ? Buffer.from("cd".repeat(32), "hex") : config.key);
    await expect(verifyAccess(token)).rejects.toThrow("ACCESS_REJECTED");
  });
});