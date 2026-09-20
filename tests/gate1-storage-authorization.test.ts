import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express, Request, Response } from "express";
import { registerStorageProxy } from "../server/_core/storageProxy";

const mocks = vi.hoisted(() => ({ authenticateRequest: vi.fn(), getDriverDocumentByStorageKey: vi.fn() }));
vi.mock("../server/_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));
vi.mock("../server/db", () => ({ getDriverDocumentByStorageKey: mocks.getDriverDocumentByStorageKey }));
vi.mock("../server/_core/env", () => ({ ENV: { forgeApiUrl: "https://unit.invalid", forgeApiKey: "unit-test-not-a-secret" } }));

let handler: (req: Request, res: Response) => Promise<void>;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetAllMocks();
  registerStorageProxy({ get: (_path: string, callback: typeof handler) => { handler = callback; } } as unknown as Express);
  mocks.getDriverDocumentByStorageKey.mockResolvedValue({ userId: 7 });
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: "https://unit.invalid/signed" }) });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

async function request(user: unknown) {
  mocks.authenticateRequest.mockResolvedValue(user);
  const response = { status: vi.fn(), send: vi.fn(), set: vi.fn(), redirect: vi.fn() };
  response.status.mockReturnValue(response);
  await handler({ params: { 0: "drivers/7/id/file.pdf" } } as unknown as Request, response as unknown as Response);
  return response;
}

describe("Gate 1 storage route authorization (unit-mocked provider)", () => {
  it.each(["family", "driver"])("active %s owner can retrieve own document", async (appRole) => {
    const response = await request({ id: 7, appRole, userStatus: "active", role: "user" });
    expect(response.redirect).toHaveBeenCalledWith(307, "https://unit.invalid/signed");
  });
  it("active appRole admin can retrieve document with legacy user role", async () => {
    const response = await request({ id: 8, appRole: "admin", userStatus: "active", role: "user" });
    expect(response.redirect).toHaveBeenCalled();
  });
  it("legacy admin cannot read another owner's document", async () => {
    const response = await request({ id: 8, appRole: "family", userStatus: "active", role: "admin" });
    expect(response.status).toHaveBeenCalledWith(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["blocked", "suspended_temp", "suspended_permanent"])("denies %s document owner before fetching metadata", async (userStatus) => {
    const response = await request({ id: 7, appRole: "admin", userStatus });
    expect(response.status).toHaveBeenCalledWith(403);
    expect(mocks.getDriverDocumentByStorageKey).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("denies unknown status", async () => {
    const response = await request({ id: 7, appRole: "driver" });
    expect(response.status).toHaveBeenCalledWith(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});