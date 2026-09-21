import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { authenticate } from "../auth/service";
import { sanitizedAuthError, trpcAuthError } from "../auth/errors";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = (await authenticate(opts.req)).user;
  } catch (error) {
    // Only absent/invalid credentials can be anonymous on public procedures.
    // Provider/configuration/database outages remain sanitized HTTP 503 errors.
    const safe = sanitizedAuthError(error);
    if (safe.status !== 401) throw trpcAuthError(safe);
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
