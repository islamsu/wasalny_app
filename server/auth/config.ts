export class AuthError extends Error {
  constructor(public code: string, public status = 401) { super(code); }
}
export function authConfig() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const key = process.env.WASALNY_SESSION_SIGNING_KEY;
  if (!projectId || !/^[a-z][a-z0-9-]{4,62}$/.test(projectId) ||
      !key || !/^[a-f0-9]{64,}$/i.test(key) || key.length % 2 ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new AuthError("AUTH_CONFIGURATION_REQUIRED", 503);
  }
  return { projectId, key: Buffer.from(key, "hex"),
    issuer: "wasalny:staging:sessions", audience: "wasalny:staging:api" };
}
export const ACCESS_SECONDS = 600;
export const ABSOLUTE_MS = 30 * 86400000;
export const INACTIVITY_MS = 7 * 86400000;