import { randomBytes, createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { Request } from "express";
import type { PoolConnection } from "mysql2/promise";
import type { User } from "../../drizzle/schema";
import { authConfig, AuthError, ACCESS_SECONDS, ABSOLUTE_MS, INACTIVITY_MS } from "./config";
import { verifyFirebase, assertFirebaseIdentity } from "./firebase";
import { transaction, rows, write } from "./repository";

export const hashRefresh = (token: string) => createHash("sha256").update(token).digest();
const opaque = () => randomBytes(32).toString("base64url");
export function assertUsableSession(s: any, now = Date.now()) {
  if (!s || s.revokedAt || !(new Date(s.absoluteExpiresAt).getTime() > now) ||
    !(new Date(s.inactivityExpiresAt).getTime() > now)) throw new AuthError("SESSION_EXPIRED");
}
function assertUser(u: any): asserts u is User {
  if (!u || u.userStatus !== "active" || !["family", "driver", "admin"].includes(u.appRole)) throw new AuthError("ACCOUNT_UNAVAILABLE", 403);
}
export function publicUser(u: User) {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, appRole: u.appRole, userStatus: u.userStatus, role: u.role };
}
async function result(user: User, sid: string, refreshToken: string) {
  const config = authConfig();
  const now = Math.floor(Date.now() / 1000);
  const accessToken = await new SignJWT({ sid }).setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(user.id)).setIssuer(config.issuer).setAudience(config.audience)
    .setIssuedAt(now).setExpirationTime(now + ACCESS_SECONDS).sign(config.key);
  return { accessToken, refreshToken, accessTokenExpiresAt: new Date((now + ACCESS_SECONDS) * 1000).toISOString(), user: publicUser(user) };
}
async function insertRefresh(c: PoolConnection, sid: string, token: string, expires: Date) {
  return write(c, "INSERT INTO authRefreshTokens (sessionId,tokenHash,expiresAt) VALUES (?,?,?)", [Buffer.from(sid), hashRefresh(token), expires]);
}
export async function exchange(idToken: string) {
  authConfig();
  const identity = await verifyFirebase(idToken);
  // Unique issuer/subject plus transaction prevents partial or duplicate provisioning.
  // A duplicate-key/deadlock loser fails explicitly and can exchange again.
  return transaction(async c => {
    let [mapping] = await rows(c, "SELECT * FROM authIdentities WHERE issuer=? AND subject=? FOR UPDATE", [Buffer.from(identity.issuer), Buffer.from(identity.subject)]);
    if (!mapping) {
      // Operators prelink legacy accounts before opening self-registration.
      if (process.env.WASALNY_AUTH_ALLOW_NEW_USERS !== "true") throw new AuthError("IDENTITY_PRELINK_REQUIRED", 403);
      const created = await write(c, "INSERT INTO users (openId,name,email,loginMethod,role,appRole,userStatus) VALUES (?,?,?,'firebase','user','family','active')",
        [`firebase_${opaque()}`, identity.name, identity.email]);
      const linked = await write(c, "INSERT INTO authIdentities (userId,issuer,subject,lastAuthenticatedAt) VALUES (?,?,?,?)",
        [created.insertId, Buffer.from(identity.issuer), Buffer.from(identity.subject), new Date()]);
      mapping = { id: linked.insertId, userId: created.insertId } as any;
    }
    const [user] = await rows(c, "SELECT * FROM users WHERE id=? FOR UPDATE", [mapping.userId]);
    assertUser(user);
    await write(c, "UPDATE authIdentities SET lastAuthenticatedAt=? WHERE id=?", [new Date(), mapping.id]);
    const sid = opaque(), refreshToken = opaque(), now = Date.now(), expires = new Date(now + ABSOLUTE_MS);
    await write(c, "INSERT INTO authSessions (id,userId,identityId,absoluteExpiresAt,inactivityExpiresAt,authenticatedAt,authFreshUntil) VALUES (?,?,?,?,?,?,?)",
      [Buffer.from(sid), user.id, mapping.id, expires, new Date(now + INACTIVITY_MS), identity.authenticatedAt,
        new Date(identity.authenticatedAt.getTime() + 5 * 60000)]);
    // MFA intentionally not inferred from client claims; sensitive admin stays closed.
    await insertRefresh(c, sid, refreshToken, expires);
    return result(user, sid, refreshToken);
  });
}
export async function refresh(token: string) {
  authConfig();
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AuthError("REFRESH_REJECTED");
  const outcome = await transaction(async c => {
    // Discover session without locking token: every operation locks session FIRST,
    // then current-reads token. Concurrent reuse therefore sees committed consume.
    const [lookup] = await rows(c, "SELECT sessionId FROM authRefreshTokens WHERE tokenHash=?", [hashRefresh(token)]);
    if (!lookup) throw new AuthError("REFRESH_REJECTED");
    const [s] = await rows(c, "SELECT * FROM authSessions WHERE id=? FOR UPDATE", [lookup.sessionId]);
    const [t] = await rows(c, "SELECT * FROM authRefreshTokens WHERE tokenHash=? FOR UPDATE", [hashRefresh(token)]);
    if (!s || !t) throw new AuthError("REFRESH_REJECTED");
    if (t.consumedAt) {
      await write(c, "UPDATE authSessions SET revokedAt=COALESCE(revokedAt,?),revocationReason='refresh_replay' WHERE id=?", [new Date(), s.id]);
      await write(c, "UPDATE authRefreshTokens SET replayDetectedAt=? WHERE id=?", [new Date(), t.id]);
      return null; // Commit revocation BEFORE throwing outside transaction.
    }
    assertUsableSession(s);
    if (t.revokedAt || new Date(t.expiresAt).getTime() <= Date.now()) throw new AuthError("REFRESH_REJECTED");
    const [identity] = await rows(c, "SELECT * FROM authIdentities WHERE id=? AND userId=?", [s.identityId, s.userId]);
    if (!identity) throw new AuthError("IDENTITY_REJECTED");
    await assertFirebaseIdentity(identity.issuer.toString(), identity.subject.toString(), new Date(s.authenticatedAt));
    const [u] = await rows(c, "SELECT * FROM users WHERE id=? FOR UPDATE", [s.userId]);
    assertUser(u);
    const next = opaque(), sid = s.id.toString();
    const created = await insertRefresh(c, sid, next, new Date(s.absoluteExpiresAt));
    await write(c, "UPDATE authRefreshTokens SET consumedAt=?,replacedByTokenId=? WHERE id=? AND consumedAt IS NULL", [new Date(), created.insertId, t.id]);
    await write(c, "UPDATE authSessions SET lastActivityAt=?,inactivityExpiresAt=? WHERE id=?",
      [new Date(), new Date(Math.min(Date.now() + INACTIVITY_MS, new Date(s.absoluteExpiresAt).getTime())), s.id]);
    return result(u, sid, next);
  });
  if (!outcome) throw new AuthError("REFRESH_REPLAY_SESSION_REVOKED");
  return outcome;
}
export async function verifyAccess(token: string) {
  const c = authConfig();
  try {
    const { payload } = await jwtVerify(token, c.key, { algorithms: ["HS256"], issuer: c.issuer, audience: c.audience, typ: "JWT", requiredClaims: ["sub", "sid", "iat", "exp"], maxTokenAge: "10m" });
    if (typeof payload.sub !== "string" || !/^[1-9][0-9]*$/.test(payload.sub) ||
      typeof payload.sid !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(payload.sid) ||
      !Number.isSafeInteger(Number(payload.sub)) ||
      !payload.exp || !payload.iat || payload.exp - payload.iat > ACCESS_SECONDS || payload.iat > Date.now()/1000) throw new Error();
    return { userId: Number(payload.sub), sid: payload.sid };
  } catch { throw new AuthError("ACCESS_REJECTED"); }
}
export async function authenticate(req: Pick<Request, "headers">) {
  const header = req.headers.authorization;
  if (!header || !/^Bearer [^\s]+$/.test(header)) throw new AuthError("BEARER_REQUIRED");
  const claims = await verifyAccess(header.slice(7));
  return transaction(async c => {
    const [s] = await rows(c, "SELECT * FROM authSessions WHERE id=? AND userId=?", [Buffer.from(claims.sid), claims.userId]);
    assertUsableSession(s);
    const [identity] = await rows(c, "SELECT * FROM authIdentities WHERE id=? AND userId=?", [s.identityId, s.userId]);
    if (!identity) throw new AuthError("IDENTITY_REJECTED");
    await assertFirebaseIdentity(identity.issuer.toString(), identity.subject.toString(), new Date(s.authenticatedAt));
    const [user] = await rows(c, "SELECT * FROM users WHERE id=?", [claims.userId]);
    assertUser(user);
    return { user, sessionId: claims.sid };
  });
}
export async function logout(req: Pick<Request, "headers">, all = false) {
  const principal = await authenticate(req);
  await transaction(c => write(c, `UPDATE authSessions SET revokedAt=?,revocationReason=? WHERE ${all ? "userId" : "id"}=? AND revokedAt IS NULL`,
    [new Date(), all ? "logout_all" : "logout", all ? principal.user.id : Buffer.from(principal.sessionId)]));
}