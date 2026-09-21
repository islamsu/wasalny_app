import type { NextFunction, Request, RequestHandler, Response } from "express";

const verifiedStagingRequests = new WeakSet<Request>();
const LOOPBACK_PEERS = new Set(["127.0.0.1", "::ffff:127.0.0.1", "::1"]);

export function isVerifiedStagingTransport(req: Request): boolean {
  return verifiedStagingRequests.has(req);
}

export function rejectLegacyTrustProxyConfiguration(): void {
  if (process.env.WASALNY_TRUST_PROXY_HOPS !== undefined) {
    throw new Error(
      "WASALNY_TRUST_PROXY_HOPS is unsupported; use verified WASALNY_STAGING_INGRESS_ORIGIN ingress",
    );
  }
}

function rawHeaderValues(req: Request, name: string): string[] {
  const values: string[] = [];
  const rawHeaders = req.rawHeaders;
  for (let index = 0; index < rawHeaders.length; index += 2) {
    if (rawHeaders[index]?.toLowerCase() === name) values.push(rawHeaders[index + 1] ?? "");
  }
  return values;
}

export function getConfiguredStagingOrigin(): string | undefined {
  rejectLegacyTrustProxyConfiguration();
  const configured = process.env.WASALNY_STAGING_INGRESS_ORIGIN;
  if (!configured) return undefined;

  let origin: URL;
  try {
    origin = new URL(configured);
  } catch {
    throw new Error("WASALNY_STAGING_INGRESS_ORIGIN must be an exact HTTPS origin");
  }
  if (
    origin.protocol !== "https:" ||
    configured !== origin.origin ||
    origin.username ||
    origin.password
  ) {
    throw new Error("WASALNY_STAGING_INGRESS_ORIGIN must be an exact HTTPS origin");
  }

  const runtimeDomain = process.env.REPLIT_DEV_DOMAIN;
  if (!runtimeDomain || origin.host !== runtimeDomain) {
    throw new Error(
      "WASALNY_STAGING_INGRESS_ORIGIN must exactly match https://REPLIT_DEV_DOMAIN",
    );
  }
  return origin.origin;
}

/**
 * Verifies the measured Replit workspace wrapper contract. This is intentionally
 * not Express trust-proxy configuration: no forwarded client address is trusted.
 */
export function createStagingIngressMiddleware(): RequestHandler | undefined {
  const configuredOrigin = getConfiguredStagingOrigin();
  if (!configuredOrigin) return undefined;
  const expectedHost = new URL(configuredOrigin).host;

  return (req: Request, res: Response, next: NextFunction) => {
    const host = rawHeaderValues(req, "host");
    const proto = rawHeaderValues(req, "x-forwarded-proto");
    const forwardedFor = rawHeaderValues(req, "x-forwarded-for");
    const unsupported = [
      "forwarded",
      "x-forwarded-host",
      "x-forwarded-port",
    ].some(name => rawHeaderValues(req, name).length !== 0);

    if (
      !LOOPBACK_PEERS.has(req.socket.remoteAddress ?? "") ||
      host.length !== 1 ||
      host[0] !== expectedHost ||
      proto.length !== 1 ||
      proto[0] !== "https" ||
      forwardedFor.length > 1 ||
      unsupported
    ) {
      res.status(400).json({ error: "STAGING_INGRESS_REJECTED" });
      return;
    }

    verifiedStagingRequests.add(req);
    next();
  };
}