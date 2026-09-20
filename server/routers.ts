import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { COOKIE_NAME } from "../shared/const";
import * as db from "./db";
import { sendPushToUser, sendPushToUserOnce } from "./push";
import { assertActiveUser, assertDriverOnboarding, assertRole, assertSensitiveAdmin, DRIVER_DOCUMENT_TYPES } from "./_core/authorization";

export const familyModerationInput = z.object({
  userId: z.number().int().positive(),
  status: z.enum(["active", "blocked", "suspended_temp", "suspended_permanent"]),
  reason: z.string().trim().min(3, "سبب الإجراء مطلوب"),
  suspendedUntil: z.string().datetime().nullable().optional(),
}).superRefine((input, ctx) => {
  if (input.status === "suspended_temp" && (!input.suspendedUntil || new Date(input.suspendedUntil).getTime() <= Date.now())) {
    ctx.addIssue({ code: "custom", path: ["suspendedUntil"], message: "يجب تحديد تاريخ مستقبلي للإيقاف المؤقت" });
  }
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
  }),
  driverDocuments: router({
    listMine: protectedProcedure.query(({ ctx }) => { assertDriverOnboarding(ctx.user); return db.listDriverDocuments(ctx.user.id); }),
    upload: protectedProcedure.input(z.object({
      documentType: z.enum(DRIVER_DOCUMENT_TYPES),
      fileName: z.string().trim().min(1).max(255).refine((value) => !/[\\/]/.test(value) && value !== "." && value !== "..", "اسم الملف غير صالح"),
      mimeType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
      dataBase64: z.string().min(4).max(15_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/, "بيانات الملف غير صالحة"),
    }).strict()).mutation(({ ctx, input }) => { assertDriverOnboarding(ctx.user); return db.createDriverDocument({ ...input, userId: ctx.user.id }); }),
  }),
  ratings: router({
    create: protectedProcedure.input(z.object({ rideId: z.number().int().positive(), rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() })).mutation(async ({ ctx, input }) => { if ((ctx.user as any).appRole !== "family") throw new Error("متاح للعائلات فقط"); const rating = await db.createRideRating({ ...input, familyUserId: ctx.user.id }); if (rating?.driverUserId) await sendPushToUserOnce(rating.driverUserId, `rating:${rating.rideId}:${rating.familyUserId}`, "rating_created", { title: "تقييم جديد", body: `حصلت على تقييم ${rating.rating} من 5 بعد الرحلة.`, data: { rideId: rating.rideId, rating: rating.rating } }); return rating; }),
    mine: protectedProcedure.query(({ ctx }) => { if ((ctx.user as any).appRole !== "driver") throw new Error("متاح للسائقين فقط"); return db.listDriverRatings(ctx.user.id); }),
    forDriver: protectedProcedure.input(z.object({ driverUserId: z.number().int().positive() })).query(({ input }) => db.getDriverRatingSummary(input.driverUserId)),
  }),
  profile: router({
    ensureDriver: protectedProcedure.input(z.object({ vehicleType: z.enum(["toktok", "car"]).default("car") }).strict()).mutation(({ ctx, input }) => { assertDriverOnboarding(ctx.user); return db.ensureDriverProfile(ctx.user.id, input.vehicleType); }),
    availability: protectedProcedure.input(z.object({ isOnline: z.boolean(), lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional() }).refine((input) => (input.lat === undefined) === (input.lng === undefined), { message: "يجب إرسال خط العرض وخط الطول معاً" })).mutation(({ ctx, input }) => { if ((ctx.user as any).appRole !== "driver") throw new Error("متاح للسائقين فقط"); return db.updateDriverAvailability({ ...input, userId: ctx.user.id }); }),
  }),
  drivers: router({
    nearby: protectedProcedure.input(z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), vehicleType: z.enum(["toktok", "car"]).optional() })).query(({ ctx, input }) => { assertRole(ctx.user, "family"); return db.listNearbyDrivers(input.lat, input.lng, input.vehicleType); }),
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
      list: protectedProcedure.query(({ ctx }) => { assertRole(ctx.user, "admin"); return db.listAdminSettings(ctx.user.id); }),
      update: protectedProcedure.input(z.object({ settingKey: z.string().min(1), settingValue: z.string().min(1), category: z.enum(["pricing", "permissions", "subscription", "notifications"]) })).mutation(({ ctx, input }) => { assertSensitiveAdmin(ctx.user); return db.updateAdminSetting({ ...input, updatedBy: ctx.user.id }); }),
    }),
    audit: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(50) })).query(({ ctx, input }) => { assertRole(ctx.user, "admin"); return db.listAdminAuditLogs(input.limit, ctx.user.id); }),
    documents: router({
      list: protectedProcedure.query(({ ctx }) => { assertRole(ctx.user, "admin"); return db.listDriverDocuments(undefined, ctx.user.id); }),
      reviewDocument: protectedProcedure.input(z.object({ documentId: z.number().int().positive(), status: z.enum(["approved", "rejected"]), reviewReason: z.string().trim().min(3) })).mutation(({ ctx, input }) => { assertSensitiveAdmin(ctx.user); return db.reviewDriverDocument({ ...input, reviewedBy: ctx.user.id }); }),
    }),
    users: router({
      listFamilies: protectedProcedure.query(({ ctx }) => { assertRole(ctx.user, "admin"); return db.listNonDriverUsers(ctx.user.id); }),
      familyHistory: protectedProcedure.input(z.object({ userId: z.number().int().positive() })).query(({ ctx, input }) => { assertRole(ctx.user, "admin"); return db.getFamilyGovernanceHistory(input.userId, ctx.user.id); }),
      updateComplaint: protectedProcedure.input(z.object({ complaintId: z.number().int().positive(), status: z.enum(["open", "in_review", "resolved", "closed"]), adminNotes: z.string().max(2000).default("") })).mutation(({ ctx, input }) => { assertSensitiveAdmin(ctx.user); return db.updateFamilyComplaint({ ...input, updatedBy: ctx.user.id }); }),
      moderateFamily: protectedProcedure.input(familyModerationInput).mutation(async ({ ctx, input }) => { assertSensitiveAdmin(ctx.user); const until = input.suspendedUntil ? new Date(input.suspendedUntil) : null; const user = await db.moderateNonDriverUser({ userId: input.userId, status: input.status, reason: input.reason, suspendedUntil: until, moderatedBy: ctx.user.id }); const name = user?.name ?? "المستخدم العزيز"; const body = input.status === "active" ? `تمت إعادة تفعيل حسابك في وصلني. السبب: ${input.reason}` : input.status === "blocked" ? `تم حظر حسابك في وصلني. السبب: ${input.reason}` : input.status === "suspended_permanent" ? `تم إيقاف حسابك نهائياً في وصلني. السبب: ${input.reason}` : `تم إيقاف حسابك مؤقتاً حتى ${until?.toLocaleDateString("ar-EG")}. السبب: ${input.reason}`; const notification = await sendPushToUser(input.userId, { title: input.status === "active" ? "تمت إعادة تفعيل حسابك" : "تحديث حالة حسابك", body, data: { type: "family_moderation", status: input.status, reason: input.reason, suspendedUntil: until?.toISOString() ?? null } }); return { user, notification, message: `تم تحديث حالة ${name} وإرسال الإشعار` }; }),
    }),
  }),
  push: router({
    register: protectedProcedure.input(z.object({ token: z.string().min(10), platform: z.enum(["android", "ios", "web"]) })).mutation(({ ctx, input }) => db.registerPushToken({ userId: ctx.user.id, token: input.token, platform: input.platform })),
  }),
  rides: router({
    create: protectedProcedure.input(z.object({ vehicleType: z.enum(["toktok", "car", "fast"]), pickupLabel: z.string().min(1), destinationLabel: z.string().min(1), pickupLat: z.number().min(-90).max(90), pickupLng: z.number().min(-180).max(180), destinationLat: z.number().min(-90).max(90).optional(), destinationLng: z.number().min(-180).max(180).optional(), estimatedFare: z.number().int().nonnegative().optional(), etaMinutes: z.number().int().nonnegative().optional() })).mutation(async ({ ctx, input }) => {
      if ((ctx.user as any).appRole !== "family") throw new Error("متاح للعائلات فقط");
      if ((ctx.user as any).userStatus && (ctx.user as any).userStatus !== "active") throw new Error("لا يمكن إنشاء طلب أثناء إيقاف الحساب أو حظره");
      const bookingCode = `WS-${Date.now().toString().slice(-7)}`;
      const ride = await db.createRide({ ...input, bookingCode, familyUserId: ctx.user.id });
      const nearbyDrivers = await db.listNearbyDrivers(input.pickupLat, input.pickupLng);
      await Promise.allSettled(nearbyDrivers.map((driver) => sendPushToUserOnce(driver.userId, `ride:${ride?.id}:request:${driver.userId}`, "ride_requested", { title: "طلب رحلة قريب منك", body: `يوجد طلب ${input.vehicleType === "toktok" ? "توك توك" : "سيارة"} جديد بالقرب من ${input.pickupLabel}.`, data: { url: "/driver", rideId: ride?.id ?? null } })));
      return ride;
    }),
    mine: protectedProcedure.query(({ ctx }) => db.listFamilyRides(ctx.user.id)),
    driverRequests: protectedProcedure.query(({ ctx }) => { if ((ctx.user as any).appRole !== "driver") throw new Error("متاح للسائقين فقط"); return db.listOpenCarRequests(ctx.user.id); }),
    offers: router({
      list: protectedProcedure.input(z.object({ rideId: z.number().int().positive() })).query(({ ctx, input }) => { if ((ctx.user as any).appRole !== "family") throw new Error("متاح للعائلات فقط"); return db.listRideOffers(input.rideId, ctx.user.id); }),
      create: protectedProcedure.input(z.object({ rideId: z.number().int().positive(), offeredPrice: z.number().int().positive(), etaMinutes: z.number().int().positive() })).mutation(async ({ ctx, input }) => { if ((ctx.user as any).appRole !== "driver") throw new Error("متاح للسائقين فقط"); const offer = await db.createCarOffer({ ...input, driverUserId: ctx.user.id }); const ride = await db.getRideById(input.rideId); if (ride?.familyUserId) await sendPushToUserOnce(ride.familyUserId, `ride:${input.rideId}:offer:${offer?.id}`, "ride_offer", { title: "عرض سعر جديد", body: `أرسل سائق عرضاً بقيمة ${input.offeredPrice} ج.م للوصول خلال ${input.etaMinutes} دقيقة.`, data: { type: "ride_offer", rideId: input.rideId, offerId: offer?.id ?? null } }); return offer; }),
      select: protectedProcedure.input(z.object({ rideId: z.number().int().positive(), offerId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { if ((ctx.user as any).appRole !== "family") throw new Error("متاح للعائلات فقط"); const offer = await db.selectCarOffer({ ...input, familyUserId: ctx.user.id }); if (offer?.driverUserId) await sendPushToUserOnce(offer.driverUserId, `ride:${input.rideId}:offer-selected:${input.offerId}`, "ride_offer_selected", { title: "تم اختيار عرضك", body: "اختارت العائلة عرضك ويمكنك متابعة الرحلة.", data: { type: "ride_offer_selected", rideId: input.rideId, offerId: input.offerId } }); return offer; }),
    }),
    status: protectedProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["accepted", "arriving", "active", "completed", "cancelled"]) })).mutation(async ({ ctx, input }) => {
      assertActiveUser(ctx.user);
      const actorRole = ctx.user.appRole;
      const updatedRide = await db.updateRideStatus({ id: input.id, status: input.status, actorUserId: ctx.user.id });
      const recipientId = actorRole === "driver" ? updatedRide?.familyUserId : updatedRide?.driverUserId;
      if (recipientId && recipientId !== ctx.user.id) {
        const body = input.status === "accepted" ? "تم قبول طلبك وسيصل السائق قريباً." : input.status === "arriving" ? "السائق في الطريق إليك." : input.status === "active" ? "بدأت الرحلة." : input.status === "completed" ? "اكتملت رحلتك." : "تم تحديث حالة رحلتك.";
        await sendPushToUserOnce(recipientId, `ride:${input.id}:status:${input.status}`, "ride_status", { title: "تحديث الرحلة", body, data: { rideId: input.id, status: input.status } });
      }
      return { success: true, ride: updatedRide };
    }),
  }),
});

export type AppRouter = typeof appRouter;
