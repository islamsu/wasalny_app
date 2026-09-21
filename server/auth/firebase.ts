import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { authConfig, AuthError } from "./config";
import { firebaseBoundaryError } from "./errors";

function firebase() {
  const { projectId } = authConfig();
  // In-memory server secret only. No file creation, ADC discovery, or fallback to
  // client config/another project. Validate even when the Admin app is cached.
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new AuthError("FIREBASE_CREDENTIALS_REQUIRED", 503);
  try {
    const account = JSON.parse(raw);
    if (!account || account.type !== "service_account" || account.project_id !== projectId ||
      typeof account.client_email !== "string" || !account.client_email.endsWith(".iam.gserviceaccount.com") ||
      typeof account.private_key !== "string" || !account.private_key.startsWith("-----BEGIN PRIVATE KEY-----")) {
      throw new Error();
    }
    const name = `wasalny-${projectId}`;
    const app = getApps().find(a => a.name === name) ??
      initializeApp({ projectId, credential: cert({
        projectId: account.project_id,
        clientEmail: account.client_email,
        privateKey: account.private_key,
      }) }, name);
    return getAuth(app);
  } catch {
    // Never include SDK/JSON parse errors: they can contain credential material.
    throw new AuthError("FIREBASE_CREDENTIALS_INVALID", 503);
  }
}
export async function verifyFirebase(idToken: string) {
  const auth = firebase();
  try {
    const token = await auth.verifyIdToken(idToken, true);
    const { projectId } = authConfig();
    if (token.iss !== `https://securetoken.google.com/${projectId}` ||
      token.aud !== projectId || !token.sub || token.sub !== token.uid ||
      !Number.isFinite(token.auth_time) || token.auth_time > Date.now() / 1000 + 30) throw new AuthError("FIREBASE_TOKEN_REJECTED");
    return { issuer: token.iss, subject: token.sub, authenticatedAt: new Date(token.auth_time * 1000),
      name: typeof token.name === "string" ? token.name : null,
      email: typeof token.email === "string" ? token.email : null };
  } catch (error) { throw firebaseBoundaryError(error, "FIREBASE_TOKEN_REJECTED"); }
}
export async function assertFirebaseIdentity(issuer: string, subject: string, authenticatedAt: Date) {
  const auth = firebase();
  if (issuer !== `https://securetoken.google.com/${authConfig().projectId}`) throw new AuthError("IDENTITY_REJECTED");
  try {
    const user = await auth.getUser(subject);
    const validAfter = user.tokensValidAfterTime ? new Date(user.tokensValidAfterTime).getTime() : NaN;
    if (user.disabled || !Number.isFinite(validAfter) || !Number.isFinite(authenticatedAt.getTime()) ||
      authenticatedAt.getTime() < validAfter) throw new AuthError("IDENTITY_REJECTED");
  } catch (error) { throw firebaseBoundaryError(error, "IDENTITY_REJECTED"); }
}