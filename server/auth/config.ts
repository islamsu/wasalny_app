export class AuthError extends Error {
  constructor(public code: string, public status = 401) { super(code); }
}

const MAX_NEW_USER_UIDS = 100;
const MAX_FIREBASE_UID_LENGTH = 128;
const FIREBASE_UID = /^[A-Za-z0-9_-]{1,128}$/;

function newUserUidAllowlist(raw: string | undefined): ReadonlySet<string> {
  if (raw === undefined || raw.trim() === "") return new Set();
  if (raw.length > MAX_NEW_USER_UIDS * (MAX_FIREBASE_UID_LENGTH + 1)) {
    throw new AuthError("AUTH_CONFIGURATION_INVALID", 503);
  }
  const values = raw.split(",").map(value => value.trim());
  if (values.length > MAX_NEW_USER_UIDS || values.some(value => !FIREBASE_UID.test(value)) ||
      new Set(values).size !== values.length) {
    throw new AuthError("AUTH_CONFIGURATION_INVALID", 503);
  }
  return new Set(values);
}

export function authConfig() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const key = process.env.WASALNY_SESSION_SIGNING_KEY;
  if (!projectId || !/^[a-z][a-z0-9-]{4,62}$/.test(projectId) ||
      !key || !/^[a-f0-9]{64,}$/i.test(key) || key.length % 2 ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new AuthError("AUTH_CONFIGURATION_REQUIRED", 503);
  }
  const uidAllowlist = newUserUidAllowlist(process.env.WASALNY_AUTH_NEW_USER_UID_ALLOWLIST);
  return { projectId, key: Buffer.from(key, "hex"),
    issuer: "wasalny:staging:sessions", audience: "wasalny:staging:api",
    allowNewUsers: process.env.WASALNY_AUTH_ALLOW_NEW_USERS === "true",
    newUserUidAllowlist: uidAllowlist };
}
export const ACCESS_SECONDS = 600;
export const ABSOLUTE_MS = 30 * 86400000;
export const INACTIVITY_MS = 7 * 86400000;