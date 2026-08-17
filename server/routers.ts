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
    ensureDriver: protectedProcedure.input(z.object({ vehicleType: z.enum(["toktok", "car"]).default("car") })).mutation(({ ctx, input }) => { if ((ctx.user as any).appRole !== "driver") throw new Error("متاح للسائقين فقط"); return db.ensureDriverProfile(ctx.user.id, input.vehicleType); }),
    availability: protectedProcedure.input(z.object({ isOnline: z.boolean(), lat: z.number().optional(), lng: z.number().optional() })).mutation(({ ctx, input }) => { if ((ctx.user as any).appRole !== "driver") throw new Error("متاح للسائقين فقط"); return db.updateDriverAvailability({ ...input, userId: ctx.user.id }); }),
  }),
  drivers: router({
    nearby: protectedProcedure.input(z.object({ lat: z.number(), lng: z.number() })).query(({ input }) => db.listNearbyDrivers(input.lat, input.lng)),
  }),
  favorites: router({
    list: protectedProcedure.query(({ ctx }) => { if ((ctx.user as any).appRole !== "family") throw new Error("متاح للعائلات فقط"); return db.listFavoriteDrivers(ctx.user.id); }),
    add: protectedProcedure.input(z.object({ driverUserId: z.number().int().positive() })).mutation(({ ctx, input }) => { if ((ctx.user as any).appRole !== "family") throw new Error("متاح للعائلات فقط"); return db.addFavoriteDriver(ctx.user.id, input.driverUserId); }),
    remove: protectedProcedure.input(z.object({ driverUserId: z.number().int().positive() })).mutation(({ ctx, input }) => { if ((ctx.user as any).appRole !== "family") throw new Error("متاح للعائلات فقط"); return db.removeFavoriteDriver(ctx.user.id, input.driverUserId); }),
  }),
  complaints: router({
    create: protectedProcedure.input(z.object({ category: z.string().min(1), title: z.string().trim().min(3).max(255), description: z.string().trim().min(5), relatedRideId: z.number().int().positive().nullable().optional() })).mutation(({ ctx, input }) => { if ((ctx.user as any).appRole !== "family") throw new Error("متاح للعائلات فقط"); return db.createFamilyComplaint({ familyUserId: ctx.user.id, category: input.category, title: input.title, description: input.description, relatedRideId: input.relatedRideId ?? null }); }),
  }),
  admin: router({
    settings: router({
      list: protectedProcedure.query(({ ctx }) => { if (ctx.user.role !== "admin" && (ctx.user as any).appRole !== "admin") throw new Error("Admin access required"); return db.listAdminSettings(); }),
      update: protectedProcedure.input(z.object({ settingKey: z.string().min(1), settingValue: z.string().min(1), category: z.enum(["pricing", "permissions", "subscription", "notifications"]) })).mutation(({ ctx, input }) => { if (ctx.user.role !== "admin" && (ctx.user as any).appRole !== "admin") throw new Error("Admin access required"); return db.updateAdminSetting({ ...input, updatedBy: ctx.user.id }); }),
    }),
    audit: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(50) })).query(({ ctx, input }) => { if (ctx.user.role !== "admin" && (ctx.user as any).appRole !== "admin") throw new Error("Admin access required"); return db.listAdminAuditLogs(input.limit); }),
    users: router({
      listFamilies: protectedProcedure.query(({ ctx }) => { if (ctx.user.role !== "admin" && (ctx.user as any).appRole !== "admin") throw new Error("Admin access required"); return db.listNonDriverUsers(); }),
      familyHistory: protectedProcedure.input(z.object({ userId: z.number().int().positive() })).query(({ ctx, input }) => { if (ctx.user.role !== "admin" && (ctx.user as any).appRole !== "admin") throw new Error("Admin access required"); return db.getFamilyGovernanceHistory(input.userId); }),
      updateComplaint: protectedProcedure.input(z.object({ complaintId: z.number().int().positive(), status: z.enum(["open", "in_review", "resolved", "closed"]), adminNotes: z.string().max(2000).default("") })).mutation(({ ctx, input }) => { if (ctx.user.role !== "admin" && (ctx.user as any).appRole !== "admin") throw new Error("Admin access required"); return db.updateFamilyComplaint({ ...input, updatedBy: ctx.user.id }); }),
      moderateFamily: protectedProcedure.input(z.object({ userId: z.number().int().positive(), status: z.enum(["active", "blocked", "suspended_temp", "suspended_permanent"]), reason: z.string().trim().min(3, "سبب الإجراء مطلوب"), suspendedUntil: z.string().datetime().nullable().optional() })).mutation(async ({ ctx, input }) => { if (ctx.user.role !== "admin" && (ctx.user as any).appRole !== "admin") throw new Error("Admin access required"); const until = input.suspendedUntil ? new Date(input.suspendedUntil) : null; if (input.status === "suspended_temp" && (!until || until.getTime() <= Date.now())) throw new Error("يجب تحديد تاريخ مستقبلي للإيقاف المؤقت"); const user = await db.moderateNonDriverUser({ userId: input.userId, status: input.status, reason: input.reason, suspendedUntil: until, moderatedBy: ctx.user.id }); const name = user?.name ?? "المستخدم العزيز"; const body = input.status === "active" ? `تمت إعادة تفعيل حسابك في وصلني. السبب: ${input.reason}` : input.status === "blocked" ? `تم حظر حسابك في وصلني. السبب: ${input.reason}` : input.status === "suspended_permanent" ? `تم إيقاف حسابك نهائياً في وصلني. السبب: ${input.reason}` : `تم إيقاف حسابك مؤقتاً حتى ${until?.toLocaleDateString("ar-EG")}. السبب: ${input.reason}`; const notification = await sendPushToUser(input.userId, { title: input.status === "active" ? "تمت إعادة تفعيل حسابك" : "تحديث حالة حسابك", body, data: { type: "family_moderation", status: input.status, reason: input.reason, suspendedUntil: until?.toISOString() ?? null } }); return { user, notification, message: `تم تحديث حالة ${name} وإرسال الإشعار` }; }),
    }),
  }),
  push: router({
    register: protectedProcedure.input(z.object({ token: z.string().min(10), platform: z.enum(["android", "ios", "web"]) })).mutation(({ ctx, input }) => db.registerPushToken({ userId: ctx.user.id, token: input.token, platform: input.platform })),
  }),
  rides: router({
    create: protectedProcedure.input(z.object({ vehicleType: z.enum(["toktok", "car", "fast"]), pickupLabel: z.string().min(1), destinationLabel: z.string().min(1), pickupLat: z.number(), pickupLng: z.number(), destinationLat: z.number().optional(), destinationLng: z.number().optional(), estimatedFare: z.number().int().nonnegative().optional(), etaMinutes: z.number().int().nonnegative().optional() })).mutation(async ({ ctx, input }) => {
      if ((ctx.user as any).appRole !== "family") throw new Error("متاح للعائلات فقط");
      if ((ctx.user as any).userStatus && (ctx.user as any).userStatus !== "active") throw new Error("لا يمكن إنشاء طلب أثناء إيقاف الحساب أو حظره");
      const bookingCode = `WS-${Date.now().toString().slice(-7)}`;
      const ride = await db.createRide({ ...input, bookingCode, familyUserId: ctx.user.id });
      const nearbyDrivers = await db.listNearbyDrivers(input.pickupLat, input.pickupLng);
      await Promise.allSettled(nearbyDrivers.map((driver) => sendPushToUser(driver.userId, { title: "طلب رحلة قريب منك", body: `يوجد طلب ${input.vehicleType === "toktok" ? "توك توك" : "سيارة"} جديد بالقرب من ${input.pickupLabel}.`, data: { url: "/driver", rideId: ride?.id ?? null } })));
      return ride;
    }),
    mine: protectedProcedure.query(({ ctx }) => db.listFamilyRides(ctx.user.id)),
    driverRequests: protectedProcedure.query(({ ctx }) => { if ((ctx.user as any).appRole !== "driver") throw new Error("متاح للسائقين فقط"); return db.listOpenCarRequests(); }),
    offers: router({
      list: protectedProcedure.input(z.object({ rideId: z.number().int().positive() })).query(({ ctx, input }) => { if ((ctx.user as any).appRole !== "family") throw new Error("متاح للعائلات فقط"); return db.listRideOffers(input.rideId, ctx.user.id); }),
      create: protectedProcedure.input(z.object({ rideId: z.number().int().positive(), offeredPrice: z.number().int().positive(), etaMinutes: z.number().int().positive() })).mutation(async ({ ctx, input }) => { if ((ctx.user as any).appRole !== "driver") throw new Error("متاح للسائقين فقط"); const offer = await db.createCarOffer({ ...input, driverUserId: ctx.user.id }); const ride = await db.getRideById(input.rideId); if (ride?.familyUserId) await sendPushToUser(ride.familyUserId, { title: "عرض سعر جديد", body: `أرسل سائق عرضاً بقيمة ${input.offeredPrice} ج.م للوصول خلال ${input.etaMinutes} دقيقة.`, data: { type: "ride_offer", rideId: input.rideId, offerId: offer?.id ?? null } }); return offer; }),
      select: protectedProcedure.input(z.object({ rideId: z.number().int().positive(), offerId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { if ((ctx.user as any).appRole !== "family") throw new Error("متاح للعائلات فقط"); const offer = await db.selectCarOffer({ ...input, familyUserId: ctx.user.id }); if (offer?.driverUserId) await sendPushToUser(offer.driverUserId, { title: "تم اختيار عرضك", body: "اختارت العائلة عرضك ويمكنك متابعة الرحلة.", data: { type: "ride_offer_selected", rideId: input.rideId, offerId: input.offerId } }); return offer; }),
    }),
    status: protectedProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["accepted", "arriving", "active", "completed", "cancelled"]) })).mutation(async ({ ctx, input }) => {
      const actorRole = ((ctx.user as any).appRole ?? (ctx.user.role === "admin" ? "admin" : "family")) as "family" | "driver" | "admin";
      const updatedRide = await db.updateRideStatus({ id: input.id, status: input.status, actorUserId: ctx.user.id, actorRole });
      if (updatedRide?.familyUserId && updatedRide.familyUserId !== ctx.user.id) {
        await sendPushToUser(updatedRide.familyUserId, { title: "تحديث الرحلة", body: input.status === "accepted" ? "تم قبول طلبك وسيصل السائق قريباً." : input.status === "arriving" ? "السائق في الطريق إليك." : input.status === "active" ? "بدأت الرحلة." : input.status === "completed" ? "اكتملت رحلتك." : "تم تحديث حالة رحلتك.", data: { rideId: input.id, status: input.status } });
      }
      return { success: true, ride: updatedRide };
    }),
  }),
});

export type AppRouter = typeof appRouter;
