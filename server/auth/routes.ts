import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { AuthError } from "./config";
import { sanitizedAuthError } from "./errors";
import { authenticate, exchange, logout, publicUser, refresh } from "./service";

// Bearer/JSON only: no ambient cookie authentication and no cookies issued.
// Trust forwarding headers only behind explicitly configured trusted proxy hops.
export function authTransport(req: Request, res: Response, next: NextFunction) {
  res.setHeader("Cache-Control", "no-store");
  const local = process.env.NODE_ENV !== "production" &&
    process.env.WASALNY_ALLOW_HTTP_LOCAL === "true" &&
    ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress ?? "");
  if (!req.secure && !local) { res.status(400).json({ error: "HTTPS_REQUIRED" }); return; }
  const origins = (process.env.WASALNY_ALLOWED_ORIGINS ?? "").split(",").map(x => x.trim()).filter(Boolean);
  if (req.headers.origin && !origins.includes(req.headers.origin)) {
    res.status(403).json({ error: "ORIGIN_REJECTED" }); return;
  }
  const bodylessLogout = ["/logout", "/logout-all"].includes(req.path) &&
    !req.headers["transfer-encoding"] && (!req.headers["content-length"] || req.headers["content-length"] === "0");
  if (req.method === "POST" && !req.is("application/json") && !bodylessLogout) {
    res.status(415).json({ error: "JSON_REQUIRED" }); return;
  }
  next();
}
// Per-process staging limiter; deploy a shared edge limiter before horizontal scaling.
const buckets = new Map<string, { count: number; until: number }>();
export function authRateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now(), key = req.ip ?? req.socket.remoteAddress ?? "unknown";
  for (const [k, v] of buckets) if (v.until <= now) buckets.delete(k);
  if (!buckets.has(key) && buckets.size >= 10000) { res.status(429).json({ error: "AUTH_RATE_LIMIT" }); return; }
  const bucket = buckets.get(key) ?? { count: 0, until: now + 60000 };
  buckets.set(key, bucket);
  if (++bucket.count > 30) { res.setHeader("Retry-After", "60"); res.status(429).json({ error: "AUTH_RATE_LIMIT" }); return; }
  next();
}
function bodyToken(req: Request, key: string) {
  if (!req.body || Object.keys(req.body).length !== 1 || typeof req.body[key] !== "string" ||
    !req.body[key] || req.body[key].length > 16384) throw new AuthError("INVALID_REQUEST", 400);
  return req.body[key] as string;
}
export function registerAuthRoutes(app: Express) {
  const route = (work: (req: Request) => Promise<unknown>) => async (req: Request, res: Response) => {
    try { res.json(await work(req)); }
    catch (e) {
      const error = sanitizedAuthError(e);
      res.status(error.status).json({ error: error.code });
    }
  };
  app.use("/api/auth", authTransport, authRateLimit);
  app.use("/api/auth", express.json({ limit: "20kb", strict: true }));
  app.use("/api/auth", (error: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(error.type === "entity.too.large" ? 413 : 400).json({ error: "INVALID_AUTH_BODY" });
  });
  app.post("/api/auth/firebase/exchange", route(req => exchange(bodyToken(req, "idToken"))));
  app.post("/api/auth/refresh", route(req => refresh(bodyToken(req, "refreshToken"))));
  app.post("/api/auth/logout", route(async req => { await logout(req); return { success: true }; }));
  app.post("/api/auth/logout-all", route(async req => { await logout(req, true); return { success: true }; }));
  app.get("/api/auth/me", route(async req => ({ user: publicUser((await authenticate(req)).user) })));
  app.use("/api/auth", (_req, res) => { res.status(404).json({ error: "AUTH_ENDPOINT_NOT_FOUND" }); });
}