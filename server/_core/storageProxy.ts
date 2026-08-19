import type { Express } from "express";
import * as db from "../db";
import { ENV } from "./env";
import { sdk } from "./sdk";

function isSafeStorageKey(key: string): boolean {
  return Boolean(key) && !key.startsWith("/") && !key.split("/").some((part) => !part || part === "." || part === "..");
}

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!isSafeStorageKey(key)) {
      res.status(400).send("Invalid storage key");
      return;
    }

    // Identity documents require an authenticated owner or a server-authorized admin.
    // Public application assets keep their existing delivery behavior.
    if (key.startsWith("drivers/")) {
      let user;
      try {
        user = await sdk.authenticateRequest(req);
      } catch {
        res.status(401).send("Authentication required");
        return;
      }
      const document = await db.getDriverDocumentByStorageKey(key);
      if (!document) {
        res.status(404).send("Document not found");
        return;
      }
      if (user.role !== "admin" && document.userId !== user.id) {
        res.status(403).send("Access denied");
        return;
      }
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const forgeUrl = new URL("v1/storage/presign/get", ENV.forgeApiUrl.replace(/\/+$/, "") + "/");
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, { headers: { Authorization: `Bearer ${ENV.forgeApiKey}` } });
      if (!forgeResp.ok) {
        console.error(`[StorageProxy] forge error: ${forgeResp.status}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch {
      console.error("[StorageProxy] failed");
      res.status(502).send("Storage proxy error");
    }
  });
}
