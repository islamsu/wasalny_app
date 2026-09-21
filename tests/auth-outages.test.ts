import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authenticate: vi.fn(), exchange: vi.fn(), logout: vi.fn(), refresh: vi.fn() }));
vi.mock("../server/auth/service", () => ({ ...mocks, publicUser: (user: unknown) => user }));
import { createContext } from "../server/_core/context";
import { registerAuthRoutes } from "../server/auth/routes";
import { AuthError } from "../server/auth/config";
const options = { req: { headers: { authorization: "Bearer fixture" } }, res: {} } as any;
beforeEach(() => { vi.resetAllMocks(); });

it.each([
  new AuthError("AUTH_CONFIGURATION_REQUIRED", 503),
  new AuthError("FIREBASE_SERVICE_UNAVAILABLE", 503),
  new Error("MySQL unavailable PASSWORD SECRET"),
])("tRPC context never converts infrastructure outage to anonymous", async error => {
  mocks.authenticate.mockRejectedValue(error);
  await expect(createContext(options)).rejects.toMatchObject({
    code: "SERVICE_UNAVAILABLE", message: error instanceof AuthError ? error.code : "AUTH_SERVICE_UNAVAILABLE",
  });
  try { await createContext(options); } catch (e: any) {
    expect(e.cause).toBeUndefined(); expect(e.message).not.toContain("SECRET");
  }
});
it("keeps optional invalid credentials anonymous and ineligible account forbidden", async () => {
  mocks.authenticate.mockRejectedValue(new AuthError("ACCESS_REJECTED"));
  expect((await createContext(options)).user).toBeNull();
  mocks.authenticate.mockRejectedValue(new AuthError("ACCOUNT_UNAVAILABLE", 403));
  await expect(createContext(options)).rejects.toMatchObject({ code: "FORBIDDEN" });
});
it.each([
  [new Error("SQL PASSWORD SECRET"), 503, "AUTH_SERVICE_UNAVAILABLE"],
  [new AuthError("FIREBASE_SERVICE_UNAVAILABLE", 503), 503, "FIREBASE_SERVICE_UNAVAILABLE"],
  [new AuthError("AUTH_CONFIGURATION_REQUIRED", 503), 503, "AUTH_CONFIGURATION_REQUIRED"],
  [new AuthError("ACCESS_REJECTED"), 401, "ACCESS_REJECTED"],
])("REST maps outages separately from invalid auth without sensitive causes", async (error, status, code) => {
  const app: any = { use: vi.fn(), get: vi.fn(), post: vi.fn() };
  registerAuthRoutes(app);
  mocks.authenticate.mockRejectedValue(error);
  const res: any = { status: vi.fn(), json: vi.fn() }; res.status.mockReturnValue(res);
  await app.get.mock.calls[0][1](options.req, res);
  expect(res.status).toHaveBeenCalledWith(status);
  expect(res.json).toHaveBeenCalledWith({ error: code });
  expect(JSON.stringify(res.json.mock.calls)).not.toContain("SECRET");
});