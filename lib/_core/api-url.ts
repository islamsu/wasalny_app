import { Platform } from "react-native";

const CONFIG_ERROR =
  "EXPO_PUBLIC_API_BASE_URL must be an HTTPS absolute URL (except localhost development), or a root-relative path on web.";

function safePath(path: string) {
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    /[\\?#\u0000-\u0020\u007f]/.test(path) ||
    /%(?:2e|2f|5c|25)/i.test(path)
  ) {
    return false;
  }

  return path.split("/").every(segment => segment !== "." && segment !== "..");
}

/**
 * Resolve the configured API namespace without allowing it to change origins.
 * Root-relative namespaces are intentionally web-only: native fetch requires an
 * absolute, authenticated transport endpoint.
 */
export function resolveApiBaseUrl(
  configured = process.env.EXPO_PUBLIC_API_BASE_URL,
  platform = Platform.OS,
): string {
  if (!configured) {
    throw new Error("Missing EXPO_PUBLIC_API_BASE_URL; configure the staging API URL.");
  }
  if (configured !== configured.trim() || configured.includes("?") || configured.includes("#") || configured.includes("\\")) {
    throw new Error(CONFIG_ERROR);
  }

  if (configured.startsWith("/")) {
    if (platform !== "web" || !safePath(configured)) throw new Error(CONFIG_ERROR);
    const normalized = configured.replace(/\/+$/, "");
    return normalized || "";
  }

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error(CONFIG_ERROR);
  }

  const localHttp =
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
  if (
    (parsed.protocol !== "https:" && !localHttp) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(CONFIG_ERROR);
  }

  const authorityEnd = configured.indexOf("://") + 3;
  const pathStart = configured.indexOf("/", authorityEnd);
  const rawPath = pathStart === -1 ? "/" : configured.slice(pathStart);
  if (!safePath(rawPath)) throw new Error(CONFIG_ERROR);

  return configured.replace(/\/+$/, "");
}

export function apiUrl(
  path: string,
  configured = process.env.EXPO_PUBLIC_API_BASE_URL,
  platform = Platform.OS,
): string {
  if (!safePath(path)) throw new Error("API endpoint must be a safe root-relative path.");
  return `${resolveApiBaseUrl(configured, platform)}${path}`;
}