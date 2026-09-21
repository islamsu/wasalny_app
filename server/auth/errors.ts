import { TRPCError } from "@trpc/server";
import { AuthError } from "./config";

/** Do not attach causes: SQL/provider errors may carry credentials or tokens. */
export function sanitizedAuthError(error: unknown): AuthError {
  return error instanceof AuthError ? error : new AuthError("AUTH_SERVICE_UNAVAILABLE", 503);
}
export function trpcAuthError(error: unknown): TRPCError {
  const safe = sanitizedAuthError(error);
  return new TRPCError({
    code: safe.status >= 500 ? "SERVICE_UNAVAILABLE" : safe.status === 403 ? "FORBIDDEN" : "UNAUTHORIZED",
    message: safe.code,
  });
}

const providerDenials = new Set([
  "auth/argument-error", "auth/invalid-argument", "auth/invalid-id-token",
  "auth/id-token-expired", "auth/id-token-revoked", "auth/user-disabled",
  "auth/user-not-found", "auth/tenant-id-mismatch",
]);
export function firebaseBoundaryError(error: unknown, denialCode: string): AuthError {
  if (error instanceof AuthError) return error;
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  return typeof code === "string" && providerDenials.has(code)
    ? new AuthError(denialCode)
    : new AuthError("FIREBASE_SERVICE_UNAVAILABLE", 503);
}