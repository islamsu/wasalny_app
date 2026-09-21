import "dotenv/config";
import express, { type Express, type Request } from "express";
import { createServer, type Server } from "http";
import { existsSync } from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { createWasalnyApp } from "./app";
import { createStagingIngressMiddleware } from "./staging-ingress";

const DEFAULT_EXPORT_DIRECTORY = path.resolve(process.cwd(), ".workspace-web");
const BLOCKED_STATIC_SUFFIXES = [
  ".env",
  ".map",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".jsx",
];

function isBlockedStaticRequest(req: Request): boolean {
  let pathname: string;
  try {
    pathname = decodeURIComponent(req.path).toLowerCase();
  } catch {
    return true;
  }

  const segments = pathname.split("/");
  if (segments.some(segment => segment.startsWith("."))) return true;
  return BLOCKED_STATIC_SUFFIXES.some(suffix => pathname.endsWith(suffix));
}

export interface WorkspacePreviewOptions {
  exportDirectory?: string;
}

/**
 * Mounts the unchanged backend under its preview prefix and serves only files
 * emitted by Expo's static export.
 */
export function createWorkspacePreviewApp(options: WorkspacePreviewOptions = {}): Express {
  const exportDirectory = path.resolve(options.exportDirectory ?? DEFAULT_EXPORT_DIRECTORY);
  const app = express();
  const stagingIngress = createStagingIngressMiddleware();
  if (stagingIngress) app.use("/wasalny-api", stagingIngress);
  app.use("/wasalny-api", createWasalnyApp());
  app.use("/wasalny-api", (_req, res) => {
    res.status(404).json({ error: "API_ENDPOINT_NOT_FOUND" });
  });

  app.use((req, res, next) => {
    if (isBlockedStaticRequest(req)) {
      res.status(404).type("text").send("Not found");
      return;
    }
    next();
  });

  app.use((req, res, next) => {
    if (!existsSync(path.join(exportDirectory, "index.html"))) {
      res.status(503).type("html").send(
        "<!doctype html><html><head><meta charset=\"utf-8\"><title>Wasalny is warming up</title></head>" +
        "<body><main><h1>Wasalny is warming up</h1><p>The web export is still being prepared. Please retry shortly.</p></main></body></html>",
      );
      return;
    }
    next();
  });

  app.use(express.static(exportDirectory, {
    dotfiles: "deny",
    extensions: ["html"],
    fallthrough: true,
    index: "index.html",
    redirect: false,
  }));

  // Static Expo exports have one HTML file per route. Never turn a missing API
  // endpoint or asset into the root document.
  app.use((_req, res) => {
    res.status(404).type("text").send("Not found");
  });

  return app;
}

export function workspacePreviewPort(value = process.env.PORT): number {
  if (!value || !/^\d+$/.test(value)) throw new Error("PORT must be an integer between 1 and 65535");
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  return port;
}

export function startWorkspacePreviewServer(): Server {
  const port = workspacePreviewPort();
  const server = createServer(createWorkspacePreviewApp());
  server.listen(port, "0.0.0.0", () => {
    console.log(`[preview] Wasalny listening on 0.0.0.0:${port}`);
  });
  return server;
}

const entryFile = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === entryFile) {
  startWorkspacePreviewServer();
}