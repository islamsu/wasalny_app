import { readFileSync } from "node:fs";

/** Shared by the server and Drizzle migrations; never fall back to DATABASE_URL. */
export function mysqlConnectionOptions() {
  const raw = process.env.WASALNY_DATABASE_URL;
  if (!raw) throw new Error("WASALNY_DATABASE_URL is required");
  let url: URL;
  try { url = new URL(raw); }
  catch { throw new Error("Invalid WASALNY_DATABASE_URL"); }
  if (url.protocol !== "mysql:") throw new Error("Wasalny requires a MySQL URL");
  for (const key of url.searchParams.keys()) {
    if (key !== "ssl-mode") throw new Error("Unsupported MySQL URL option");
  }
  const mode = url.searchParams.get("ssl-mode");
  if (mode && !["REQUIRED", "VERIFY_CA", "VERIFY_IDENTITY"].includes(mode.toUpperCase())) {
    throw new Error("Wasalny requires verified TLS");
  }
  const caPath = process.env.WASALNY_DATABASE_CA_PATH;
  return {
    host: url.hostname,
    port: Number(url.port || "3306"),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    ssl: { rejectUnauthorized: true, ...(caPath ? { ca: readFileSync(caPath, "utf8") } : {}) },
    connectTimeout: 12000,
    multipleStatements: false,
  };
}