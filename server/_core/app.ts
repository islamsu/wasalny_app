import express, { type Express } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerAuthRoutes, authTransport } from "../auth/routes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { registerStorageProxy } from "./storageProxy";
import {
  getConfiguredStagingOrigin,
  rejectLegacyTrustProxyConfiguration,
} from "./staging-ingress";

/**
 * Builds the Wasalny HTTP application without opening a socket.
 *
 * Keep middleware ordering here in sync with the production API: in particular,
 * auth's bounded parser must remain ahead of the larger document parser.
 */
export function createWasalnyApp(): Express {
  rejectLegacyTrustProxyConfiguration();
  const app = express();
  // Forwarding headers are never globally trusted. Staging transport is
  // verified only by the workspace wrapper's scoped ingress middleware.
  app.set("trust proxy", false);

  // Exact allowlist, never reflected credentials or wildcard origins.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowed = (process.env.WASALNY_ALLOWED_ORIGINS ?? "").split(",").map(x => x.trim());
    const stagingOrigin = getConfiguredStagingOrigin();
    if (stagingOrigin) allowed.push(stagingOrigin);
    if (origin && !allowed.includes(origin)) { res.status(403).json({ error: "ORIGIN_REJECTED" }); return; }
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Vary", "Origin");
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Authentication is bounded/rate-limited BEFORE the document upload parser.
  app.all(["/api/oauth/callback", "/api/oauth/mobile", "/api/auth/session"], (_req, res) => {
    res.status(410).json({ error: "LEGACY_AUTH_DISABLED" });
  });
  registerAuthRoutes(app);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.use(
    "/api/trpc",
    authTransport,
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  return app;
}