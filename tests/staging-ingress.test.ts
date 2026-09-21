import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWasalnyApp } from "../server/_core/app";
import { getSessionCookieOptions } from "../server/_core/cookies";
import {
  createStagingIngressMiddleware,
  isVerifiedStagingTransport,
} from "../server/_core/staging-ingress";
import { authRateLimit, authTransport } from "../server/auth/routes";

const DOMAIN = "wasalny.example.replit.dev";

function request(rawHeaders: string[], remoteAddress = "127.0.0.1"): any {
  return {
    rawHeaders,
    headers: Object.fromEntries(
      Array.from({ length: rawHeaders.length / 2 }, (_, index) => [
        rawHeaders[index * 2].toLowerCase(),
        rawHeaders[index * 2 + 1],
      ]),
    ),
    socket: { remoteAddress },
    secure: false,
    protocol: "http",
    method: "GET",
    path: "/me",
    is: () => true,
  };
}

function response(): any {
  const res = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() } as any;
  res.status.mockReturnValue(res);
  return res;
}

function validRequest(extra: string[] = []): any {
  return request(["Host", DOMAIN, "X-Forwarded-Proto", "https", ...extra]);
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("WASALNY_STAGING_INGRESS_ORIGIN", `https://${DOMAIN}`);
  vi.stubEnv("REPLIT_DEV_DOMAIN", DOMAIN);
  vi.stubEnv("WASALNY_TRUST_PROXY_HOPS", undefined);
  vi.stubEnv("WASALNY_ALLOWED_ORIGINS", "");
});

describe("verified staging ingress", () => {
  it("is disabled by default and validates the exact runtime HTTPS origin", () => {
    vi.stubEnv("WASALNY_STAGING_INGRESS_ORIGIN", "");
    expect(createStagingIngressMiddleware()).toBeUndefined();

    vi.stubEnv("WASALNY_STAGING_INGRESS_ORIGIN", "http://wasalny.example.replit.dev");
    expect(() => createStagingIngressMiddleware()).toThrow(/exact HTTPS origin/);
    vi.stubEnv("WASALNY_STAGING_INGRESS_ORIGIN", "https://different.example.replit.dev");
    expect(() => createStagingIngressMiddleware()).toThrow(/REPLIT_DEV_DOMAIN/);
  });

  it("rejects the legacy numeric proxy bypass", () => {
    vi.stubEnv("WASALNY_STAGING_INGRESS_ORIGIN", "");
    vi.stubEnv("WASALNY_TRUST_PROXY_HOPS", "1");
    expect(() => createWasalnyApp()).toThrow(/unsupported/);
  });

  it("marks only an exact valid wrapper request", () => {
    const middleware = createStagingIngressMiddleware()!;
    const req = validRequest(["X-Forwarded-For", "one, two, three"]);
    const next = vi.fn();
    middleware(req, response(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(isVerifiedStagingTransport(req)).toBe(true);
  });

  it.each([
    ["forged proto", ["Host", DOMAIN, "X-Forwarded-Proto", "http"], "127.0.0.1"],
    ["duplicate proto", ["Host", DOMAIN, "X-Forwarded-Proto", "https", "X-Forwarded-Proto", "https"], "127.0.0.1"],
    ["duplicate XFF", ["Host", DOMAIN, "X-Forwarded-Proto", "https", "X-Forwarded-For", "one", "X-Forwarded-For", "two"], "127.0.0.1"],
    ["different host", ["Host", "evil.example", "X-Forwarded-Proto", "https"], "127.0.0.1"],
    ["duplicate host", ["Host", DOMAIN, "Host", DOMAIN, "X-Forwarded-Proto", "https"], "127.0.0.1"],
    ["untrusted peer", ["Host", DOMAIN, "X-Forwarded-Proto", "https"], "192.0.2.10"],
    ["Forwarded", ["Host", DOMAIN, "X-Forwarded-Proto", "https", "Forwarded", "proto=https"], "127.0.0.1"],
    ["forwarded host", ["Host", DOMAIN, "X-Forwarded-Proto", "https", "X-Forwarded-Host", DOMAIN], "127.0.0.1"],
    ["forwarded port", ["Host", DOMAIN, "X-Forwarded-Proto", "https", "X-Forwarded-Port", "80"], "127.0.0.1"],
  ])("rejects %s", (_label, headers, peer) => {
    const req = request(headers as string[], peer as string);
    const res = response();
    const next = vi.fn();
    createStagingIngressMiddleware()!(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "STAGING_INGRESS_REJECTED" });
    expect(next).not.toHaveBeenCalled();
    expect(isVerifiedStagingTransport(req)).toBe(false);
  });

  it("does not let a direct API request forge verified HTTPS", () => {
    const req = validRequest();
    const res = response();
    const next = vi.fn();
    authTransport(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows auth transport only after wrapper verification", () => {
    const req = validRequest();
    req.headers.origin = `https://${DOMAIN}`;
    createStagingIngressMiddleware()!(req, response(), vi.fn());
    const res = response();
    const next = vi.fn();
    authTransport(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("never infers cookie security from a raw forwarded header", () => {
    const forged = validRequest();
    Object.assign(forged, { hostname: DOMAIN });
    expect(getSessionCookieOptions(forged).secure).toBe(false);

    createStagingIngressMiddleware()!(forged, response(), vi.fn());
    expect(getSessionCookieOptions(forged).secure).toBe(true);
  });

  it("rate limits by socket peer regardless of attacker X-Forwarded-For", () => {
    const next = vi.fn();
    const res = response();
    for (let index = 0; index < 31; index++) {
      const req = validRequest(["X-Forwarded-For", `203.0.113.${index}`]);
      req.socket.remoteAddress = "192.0.2.211";
      authRateLimit(req, res, next);
    }
    expect(next).toHaveBeenCalledTimes(30);
    expect(res.status).toHaveBeenCalledWith(429);
  });
});