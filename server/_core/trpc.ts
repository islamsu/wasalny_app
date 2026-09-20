import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "../../shared/const.js";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { assertActiveUser, assertRole, authorizeProcedure } from "./authorization";
import { assertDriverEligibility } from "../db";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  assertActiveUser(ctx.user);
  if (authorizeProcedure(ctx.user, opts.path, opts.type) === "driver-operation") {
    await assertDriverEligibility(ctx.user.id);
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    assertRole(ctx.user, "admin");
    authorizeProcedure(ctx.user, opts.path, opts.type);

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
