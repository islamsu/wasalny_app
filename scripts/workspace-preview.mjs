// Runs the existing Expo web export and Wasalny backend, not a replacement UI.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, ".workspace-web");
const pending = join(root, ".workspace-web-next");
const children = new Set();

export function webBuildEnvironment(source) {
  // Export runs without server credentials. Only intentional client config is
  // passed to Metro; GOOGLE_API_KEY here is the verified Firebase WEB API key.
  const result = {};
  for (const key of [
    "PATH", "HOME", "USER", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL",
    "SSL_CERT_FILE", "SSL_CERT_DIR", "NODE_EXTRA_CA_CERTS",
    "EXPO_PUBLIC_FIREBASE_API_KEY", "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "EXPO_PUBLIC_FIREBASE_PROJECT_ID", "EXPO_PUBLIC_FIREBASE_APP_ID",
    "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  ]) {
    if (source[key]) result[key] = source[key];
  }
  result.EXPO_PUBLIC_FIREBASE_API_KEY ||= source.GOOGLE_API_KEY || "";
  result.EXPO_PUBLIC_API_BASE_URL = "/wasalny-api";
  result.NODE_ENV = "production";
  result.CI = "1";
  result.COREPACK_ENABLE_PROJECT_SPEC = "0";
  result.EXPO_NO_DOTENV = "1";
  return result;
}

function run(args, env) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, env, stdio: "inherit" });
    children.add(child);
    child.once("exit", () => children.delete(child));
    child.once("error", () => reject(new Error("Preview subprocess failed to start")));
    child.once("exit", code => code === 0
      ? resolveRun()
      : reject(new Error("Preview build failed; see compiler output above")));
  });
}

async function assertNoServerSecrets(directory, environment) {
  const forbidden = [
    environment.FIREBASE_SERVICE_ACCOUNT_JSON,
    environment.WASALNY_SESSION_SIGNING_KEY,
    environment.WASALNY_DATABASE_URL,
  ].filter(value => value && value.length > 12);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await assertNoServerSecrets(path, environment);
    else if (/\.(?:html|js|json|css|map)$/.test(entry.name)) {
      const text = await readFile(path, "utf8");
      if (text.includes("-----BEGIN PRIVATE KEY-----") ||
          forbidden.some(value => text.includes(value))) {
        throw new Error("Refusing to serve an export containing server credentials");
      }
    }
  }
}

async function build(environment) {
  await rm(pending, { recursive: true, force: true });
  await run([
    join(root, "node_modules/expo/bin/cli"),
    "export", "--platform", "web", "--output-dir", pending, "--clear",
  ], webBuildEnvironment(environment));
  await assertNoServerSecrets(pending, environment);
  if (!existsSync(join(pending, "index.html"))) throw new Error("Expo export has no index.html");
  await rm(output, { recursive: true, force: true });
  await rename(pending, output);
  console.log("[wasalny-preview] Existing Expo app export is ready.");
}

async function main() {
  const mode = process.argv[2] || "dev";
  if (!["dev", "build", "serve"].includes(mode)) throw new Error("Unknown preview mode");
  if (!existsSync(join(root, "node_modules/tsx/dist/cli.mjs"))) {
    throw new Error("Install the existing standalone Wasalny dependencies before launching");
  }
  if (mode === "build") return build(process.env);
  if (mode === "serve" && !existsSync(join(output, "index.html"))) {
    throw new Error("Build the Wasalny web export before serving it");
  }
  // The backend retains its real authentication/transport policy and credentials.
  // No registration flag, trusted-proxy hop count or HTTP allowance is enabled.
  const child = spawn(process.execPath, [
    join(root, "node_modules/tsx/dist/cli.mjs"),
    "server/_core/workspace-preview.ts",
  ], { cwd: root, env: { ...process.env, COREPACK_ENABLE_PROJECT_SPEC: "0" }, stdio: "inherit" });
  children.add(child);
  child.once("exit", () => children.delete(child));
  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.once(signal, () => { for (const process of children) process.kill(signal); });
  }
  child.once("error", () => { console.error("[wasalny-preview] Server startup failed."); process.exitCode = 1; });
  child.once("exit", code => { process.exitCode = code ?? 1; });
  if (mode === "dev") {
    try { await build(process.env); }
    catch (error) { child.kill("SIGTERM"); throw error; }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}