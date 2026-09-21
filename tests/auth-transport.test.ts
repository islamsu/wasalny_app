import { beforeEach, expect, it, vi } from "vitest";
import { authTransport, authRateLimit, registerAuthRoutes } from "../server/auth/routes";
function request(overrides: any = {}) {
  return { secure: true, method: "POST", headers: {}, socket: { remoteAddress: "192.0.2.99" }, ip: "192.0.2.99",
    is: (type: string) => type === "application/json", ...overrides } as any;
}
function response() {
  const res: any = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res); return res;
}
beforeEach(() => {
  vi.unstubAllEnvs(); vi.stubEnv("WASALNY_ALLOW_HTTP_LOCAL", "");
  vi.stubEnv("WASALNY_ALLOWED_ORIGINS", "https://staging.example.invalid");
});
it("requires HTTPS even if an untrusted forwarding header claims https", () => {
  const res = response(), next = vi.fn();
  authTransport(request({ secure: false, headers: { "x-forwarded-proto": "https" } }), res, next);
  expect(res.status).toHaveBeenCalledWith(400); expect(next).not.toHaveBeenCalled();
});
it("rejects unlisted browser origins", () => {
  const res = response(), next = vi.fn();
  authTransport(request({ headers: { origin: "https://evil.invalid" } }), res, next);
  expect(res.status).toHaveBeenCalledWith(403); expect(next).not.toHaveBeenCalled();
});
it("rejects simple form POSTs to prevent CSRF", () => {
  const res = response(), next = vi.fn();
  authTransport(request({ is: () => false }), res, next);
  expect(res.status).toHaveBeenCalledWith(415); expect(next).not.toHaveBeenCalled();
});
it("allows native JSON bearer transport without ambient cookies", () => {
  const res = response(), next = vi.fn();
  authTransport(request(), res, next);
  expect(next).toHaveBeenCalledOnce(); expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
});
it("rate limits before route execution", () => {
  const res = response(), next = vi.fn(), req = request({ ip: "192.0.2.30" });
  for (let i = 0; i < 31; i++) authRateLimit(req, res, next);
  expect(next).toHaveBeenCalledTimes(30); expect(res.status).toHaveBeenCalledWith(429);
});
it("registers transport/limiter before parser and terminal routes", () => {
  const app: any = { use: vi.fn(), get: vi.fn(), post: vi.fn() };
  registerAuthRoutes(app);
  expect(app.use.mock.calls[0]).toEqual(["/api/auth", authTransport, authRateLimit]);
  expect(app.use.mock.calls[1][1].name).toBe("jsonParser");
  expect(app.post.mock.calls.map((c: any[]) => c[0])).toEqual([
    "/api/auth/firebase/exchange", "/api/auth/refresh", "/api/auth/logout", "/api/auth/logout-all",
  ]);
  expect(app.get.mock.calls[0][0]).toBe("/api/auth/me");
});