import { mkdtemp, rm, writeFile } from "fs/promises";
import { createServer, type Server } from "http";
import { tmpdir } from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createWorkspacePreviewApp,
  workspacePreviewPort,
} from "../server/_core/workspace-preview";

const servers: Server[] = [];
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  })));
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
  vi.unstubAllEnvs();
});

async function exportDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), "wasalny-preview-"));
  directories.push(directory);
  return directory;
}

async function listen(exportDirectory: string) {
  const server = createServer(createWorkspacePreviewApp({ exportDirectory }));
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected an ephemeral TCP port");
  return `http://127.0.0.1:${address.port}`;
}

describe("workspace preview", () => {
  it("starts the real API while the Expo export is still warming", async () => {
    const baseUrl = await listen(await exportDirectory());

    const warming = await fetch(`${baseUrl}/`);
    expect(warming.status).toBe(503);
    expect(await warming.text()).toContain("Wasalny is warming up");

    const health = await fetch(`${baseUrl}/wasalny-api/api/health`);
    expect(health.status).toBe(200);
    expect((await health.json()).ok).toBe(true);

    const missingApi = await fetch(`${baseUrl}/wasalny-api/api/not-real`);
    expect(missingApi.status).toBe(404);
    expect(await missingApi.json()).toEqual({ error: "API_ENDPOINT_NOT_FOUND" });
  });

  it("serves exported routes but never falls back for assets or sensitive files", async () => {
    const directory = await exportDirectory();
    await Promise.all([
      writeFile(path.join(directory, "index.html"), "<h1>Home export</h1>"),
      writeFile(path.join(directory, "login.html"), "<h1>Login export</h1>"),
      writeFile(path.join(directory, "bundle.js"), "console.log('exported')"),
      writeFile(path.join(directory, "bundle.js.map"), "secret source map"),
      writeFile(path.join(directory, ".env"), "SECRET=value"),
      writeFile(path.join(directory, "source.ts"), "export const secret = true"),
    ]);
    const baseUrl = await listen(directory);

    const login = await fetch(`${baseUrl}/login`);
    expect(login.status).toBe(200);
    expect(await login.text()).toContain("Login export");
    expect((await fetch(`${baseUrl}/bundle.js`)).status).toBe(200);

    for (const pathname of ["/missing.js", "/unknown-route", "/bundle.js.map", "/.env", "/source.ts"]) {
      const response = await fetch(`${baseUrl}${pathname}`);
      expect(response.status, pathname).toBe(404);
      expect(await response.text(), pathname).not.toContain("Home export");
    }
  });

  it("uses only the configured origin allowlist and requires a strict PORT", async () => {
    vi.stubEnv("WASALNY_ALLOWED_ORIGINS", "https://allowed.example");
    const baseUrl = await listen(await exportDirectory());

    const rejected = await fetch(`${baseUrl}/wasalny-api/api/health`, {
      headers: { Origin: "https://preview-host.example" },
    });
    expect(rejected.status).toBe(403);
    expect(await rejected.json()).toEqual({ error: "ORIGIN_REJECTED" });

    expect(workspacePreviewPort("8080")).toBe(8080);
    expect(() => workspacePreviewPort(undefined)).toThrow(/PORT/);
    expect(() => workspacePreviewPort("8080junk")).toThrow(/PORT/);
    expect(() => workspacePreviewPort("0")).toThrow(/PORT/);
  });
});