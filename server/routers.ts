import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { COOKIE_NAME } from "../shared/const";
import * as db from "./db";
import { sendPushToUser } from "./push";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
  }),
  profile: router({
    ensureDriver: protectedProcedure.input(z.object({ vehicleType: z.enum(["toktok", "car"]).default("car") })).mutation(({ ctx, input }) => db.ensureDriverProfile(ctx.user.id, input.vehicleType)),
  }),
  drivers: router({
    nearby: protectedProcedure.input(z.object({ lat: z.number(), lng: z.number() })).query(({ input }) => db.listNearbyDrivers(input.lat, input.lng)),
  }),
  push: router({
    register: protectedProcedure.input(z.object({ token: z.string().min(10), platform: z.enum(["android", "ios", "web"]) })).mutation(({ ctx, input }) => db.registerPushToken({ userId: ctx.user.id, token: input.token, platform: input.platform })),
  }),
  rides: router({
    create: protectedProcedure.input(z.object({ vehicleType: z.enum(["toktok", "car", "fast"]), pickupLabel: z.string().min(1), destinationLabel: z.string().min(1), pickupLat: z.number(), pickupLng: z.number(), destinationLat: z.number().optional(), destinationLng: z.number().optional(), estimatedFare: z.number().int().nonnegative().optional(), etaMinutes: z.number().int().nonnegative().optional() })).mutation(async ({ ctx, input }) => {
      const bookingCode = `WS-${Date.now().toString().slice(-7)}`;
      const ride = await db.createRide({ ...input, bookingCode, familyUserId: ctx.user.id });
      const nearbyDrivers = await db.listNearbyDrivers(input.pickupLat, input.pickupLng);
      await Promise.allSettled(nearbyDrivers.map((driver) => sendPushToUser(driver.userId, { title: "طلب رحلة قريب منك", body: `يوجد طلب ${input.vehicleType === "toktok" ? "توك توك" : "سيارة"} جديد بالقرب من ${input.pickupLabel}.`, data: { url: "/driver", rideId: ride?.id ?? null } })));
      return ride;
    }),
    mine: protectedProcedure.query(({ ctx }) => db.listFamilyRides(ctx.user.id)),
    status: protectedProcedure.input(z.object({ id: z.number(), status: z.enum(["accepted", "arriving", "active", "completed", "cancelled"]), driverUserId: z.number().optional(), familyUserId: z.number().optional() })).mutation(async ({ ctx, input }) => {
      await db.updateRideStatus(input.id, input.status, input.driverUserId ?? ctx.user.id);
      if (input.familyUserId && input.familyUserId !== ctx.user.id) {
        await sendPushToUser(input.familyUserId, { title: "تحديث الرحلة", body: input.status === "accepted" ? "تم قبول طلبك وسيصل السائق قريباً." : input.status === "arriving" ? "السائق في الطريق إليك." : input.status === "active" ? "بدأت الرحلة." : "تم تحديث حالة رحلتك." , data: { rideId: input.id, status: input.status } });
      }
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
