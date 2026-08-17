import { boolean, double, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  appRole: mysqlEnum("appRole", ["family", "driver", "admin"]).default("family").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const driverProfiles = mysqlTable("driverProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  vehicleType: mysqlEnum("vehicleType", ["toktok", "car"]).default("car").notNull(),
  vehicleNumber: varchar("vehicleNumber", { length: 32 }),
  accountStatus: mysqlEnum("accountStatus", ["active", "frozen", "suspended", "pending"]).default("pending").notNull(),
  subscriptionStatus: mysqlEnum("subscriptionStatus", ["unpaid", "pending", "approved", "rejected"]).default("unpaid").notNull(),
  isOnline: boolean("isOnline").default(false).notNull(),
  lastLat: double("lastLat"),
  lastLng: double("lastLng"),
  lastLocationAt: timestamp("lastLocationAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

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
export type DriverProfile = typeof driverProfiles.$inferSelect;
export type Ride = typeof rides.$inferSelect;
export type PushToken = typeof pushTokens.$inferSelect;

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
