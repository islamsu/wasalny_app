import { binary, boolean, double, foreignKey, index, int, mysqlEnum, mysqlTable, text, timestamp, varbinary, varchar, uniqueIndex } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  appRole: mysqlEnum("appRole", ["family", "driver", "admin"]).default("family").notNull(),
  userStatus: mysqlEnum("userStatus", ["active", "blocked", "suspended_temp", "suspended_permanent"]).default("active").notNull(),
  moderationReason: text("moderationReason"),
  suspendedUntil: timestamp("suspendedUntil"),
  moderatedBy: int("moderatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const authIdentities = mysqlTable("authIdentities", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
  issuer: varbinary("issuer", { length: 255 }).notNull(),
  subject: varbinary("subject", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastAuthenticatedAt: timestamp("lastAuthenticatedAt"),
}, (table) => ({
  issuerSubjectUnique: uniqueIndex("auth_identity_issuer_subject_unique").on(table.issuer, table.subject),
  identityUserUnique: uniqueIndex("auth_identity_id_user_unique").on(table.id, table.userId),
  userIdx: index("auth_identity_user_idx").on(table.userId),
}));

export const authSessions = mysqlTable("authSessions", {
  id: varbinary("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
  identityId: int("identityId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  absoluteExpiresAt: timestamp("absoluteExpiresAt").notNull(),
  lastActivityAt: timestamp("lastActivityAt").defaultNow().notNull(),
  inactivityExpiresAt: timestamp("inactivityExpiresAt").notNull(),
  revokedAt: timestamp("revokedAt"),
  revocationReason: varchar("revocationReason", { length: 255 }),
  authenticatedAt: timestamp("authenticatedAt").notNull(),
  authFreshUntil: timestamp("authFreshUntil").notNull(),
  mfaAuthenticatedAt: timestamp("mfaAuthenticatedAt"),
  mfaContext: text("mfaContext"),
}, (table) => ({
  identityUserFk: foreignKey({
    name: "auth_session_identity_user_fk",
    columns: [table.identityId, table.userId],
    foreignColumns: [authIdentities.id, authIdentities.userId],
  }).onDelete("restrict").onUpdate("restrict"),
  userIdx: index("auth_session_user_idx").on(table.userId),
  identityIdx: index("auth_session_identity_idx").on(table.identityId),
  absoluteExpiryIdx: index("auth_session_absolute_expiry_idx").on(table.absoluteExpiresAt),
  inactivityExpiryIdx: index("auth_session_inactivity_expiry_idx").on(table.inactivityExpiresAt),
  revokedIdx: index("auth_session_revoked_idx").on(table.revokedAt),
}));

export const authRefreshTokens = mysqlTable("authRefreshTokens", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varbinary("sessionId", { length: 64 }).notNull().references(() => authSessions.id, { onDelete: "restrict", onUpdate: "restrict" }),
  tokenHash: binary("tokenHash", { length: 32 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  consumedAt: timestamp("consumedAt"),
  revokedAt: timestamp("revokedAt"),
  replacedByTokenId: int("replacedByTokenId"),
  replayDetectedAt: timestamp("replayDetectedAt"),
}, (table) => ({
  replacementFk: foreignKey({
    name: "auth_refresh_replacement_fk",
    columns: [table.replacedByTokenId],
    foreignColumns: [table.id],
  }).onDelete("restrict").onUpdate("restrict"),
  tokenHashUnique: uniqueIndex("auth_refresh_token_hash_unique").on(table.tokenHash),
  sessionIdx: index("auth_refresh_session_idx").on(table.sessionId),
  expiryIdx: index("auth_refresh_expiry_idx").on(table.expiresAt),
  consumedIdx: index("auth_refresh_consumed_idx").on(table.consumedAt),
  revokedIdx: index("auth_refresh_revoked_idx").on(table.revokedAt),
  replacementIdx: index("auth_refresh_replacement_idx").on(table.replacedByTokenId),
  replayIdx: index("auth_refresh_replay_idx").on(table.replayDetectedAt),
}));

export const familyViolations = mysqlTable("familyViolations", {
  id: int("id").autoincrement().primaryKey(),
  familyUserId: int("familyUserId").notNull(),
  category: varchar("category", { length: 64 }).notNull(),
  reason: text("reason").notNull(),
  source: varchar("source", { length: 64 }).notNull(),
  relatedRideId: int("relatedRideId"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const familyComplaints = mysqlTable("familyComplaints", {
  id: int("id").autoincrement().primaryKey(),
  familyUserId: int("familyUserId").notNull(),
  category: varchar("category", { length: 64 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  adminNotes: text("adminNotes"),
  status: mysqlEnum("status", ["open", "in_review", "resolved", "closed"]).default("open").notNull(),
  relatedRideId: int("relatedRideId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const driverProfiles = mysqlTable("driverProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  vehicleType: mysqlEnum("vehicleType", ["toktok", "car"]).default("car").notNull(),
  vehicleNumber: varchar("vehicleNumber", { length: 32 }),
  accountStatus: mysqlEnum("accountStatus", ["active", "frozen", "suspended", "pending"]).default("pending").notNull(),
  verificationStatus: mysqlEnum("verificationStatus", ["pending", "approved", "rejected", "revoked"]).default("pending").notNull(),
  verifiedAt: timestamp("verifiedAt"),
  verifiedBy: int("verifiedBy").references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
  subscriptionStatus: mysqlEnum("subscriptionStatus", ["unpaid", "pending", "approved", "rejected"]).default("unpaid").notNull(),
  isOnline: boolean("isOnline").default(false).notNull(),
  lastLat: double("lastLat"),
  lastLng: double("lastLng"),
  lastLocationAt: timestamp("lastLocationAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userUnique: uniqueIndex("driver_profile_user_unique").on(table.userId),
}));

export const rides = mysqlTable("rides", {
  id: int("id").autoincrement().primaryKey(),
  bookingCode: varchar("bookingCode", { length: 32 }).notNull().unique(),
  familyUserId: int("familyUserId").notNull(),
  driverUserId: int("driverUserId"),
  vehicleType: mysqlEnum("vehicleType", ["toktok", "car", "fast"]).notNull(),
  status: mysqlEnum("status", ["requested", "accepted", "arriving", "active", "completed", "cancelled"]).default("requested").notNull(),
  pickupLabel: varchar("pickupLabel", { length: 255 }).notNull(),
  destinationLabel: varchar("destinationLabel", { length: 255 }).notNull(),
  pickupLat: double("pickupLat").notNull(),
  pickupLng: double("pickupLng").notNull(),
  destinationLat: double("destinationLat"),
  destinationLng: double("destinationLng"),
  estimatedFare: int("estimatedFare"),
  etaMinutes: int("etaMinutes"),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  acceptedAt: timestamp("acceptedAt"),
  completedAt: timestamp("completedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const favoriteDrivers = mysqlTable("favoriteDrivers", {
  id: int("id").autoincrement().primaryKey(),
  familyUserId: int("familyUserId").notNull(),
  driverUserId: int("driverUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ familyDriverUnique: uniqueIndex("favorite_family_driver_unique").on(table.familyUserId, table.driverUserId) }));

export const rideOffers = mysqlTable("rideOffers", {
  id: int("id").autoincrement().primaryKey(),
  rideId: int("rideId").notNull(),
  driverUserId: int("driverUserId").notNull(),
  offeredPrice: int("offeredPrice").notNull(),
  etaMinutes: int("etaMinutes").notNull(),
  status: mysqlEnum("status", ["pending", "selected", "rejected", "withdrawn"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ rideDriverUnique: uniqueIndex("offer_ride_driver_unique").on(table.rideId, table.driverUserId) }));

export const driverDocuments = mysqlTable("driverDocuments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  documentType: varchar("documentType", { length: 64 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  storageUrl: varchar("storageUrl", { length: 1024 }).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  reviewReason: text("reviewReason"),
  reviewedBy: int("reviewedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const rideRatings = mysqlTable("rideRatings", {
  id: int("id").autoincrement().primaryKey(),
  rideId: int("rideId").notNull(),
  familyUserId: int("familyUserId").notNull(),
  driverUserId: int("driverUserId").notNull(),
  rating: int("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ rideFamilyUnique: uniqueIndex("rating_ride_family_unique").on(table.rideId, table.familyUserId) }));

export const notificationEvents = mysqlTable("notificationEvents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  eventKey: varchar("eventKey", { length: 160 }).notNull().unique(),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  data: text("data"),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
});

export const pushTokens = mysqlTable("pushTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 512 }).notNull().unique(),
  platform: mysqlEnum("platform", ["android", "ios", "web"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type AuthIdentity = typeof authIdentities.$inferSelect;
export type AuthSession = typeof authSessions.$inferSelect;
export type AuthRefreshToken = typeof authRefreshTokens.$inferSelect;
export type DriverProfile = typeof driverProfiles.$inferSelect;
export type FamilyViolation = typeof familyViolations.$inferSelect;
export type FamilyComplaint = typeof familyComplaints.$inferSelect;
export type Ride = typeof rides.$inferSelect;
export type PushToken = typeof pushTokens.$inferSelect;
export type FavoriteDriver = typeof favoriteDrivers.$inferSelect;
export type RideOffer = typeof rideOffers.$inferSelect;
export type DriverDocument = typeof driverDocuments.$inferSelect;
export type RideRating = typeof rideRatings.$inferSelect;
export type NotificationEvent = typeof notificationEvents.$inferSelect;

export const adminSettings = mysqlTable("adminSettings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 64 }).notNull().unique(),
  settingValue: text("settingValue").notNull(),
  category: mysqlEnum("category", ["pricing", "permissions", "subscription", "notifications"]).notNull(),
  updatedBy: int("updatedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  actorUserId: int("actorUserId").notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: varchar("entityId", { length: 64 }),
  beforeValue: text("beforeValue"),
  afterValue: text("afterValue"),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdminSetting = typeof adminSettings.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
