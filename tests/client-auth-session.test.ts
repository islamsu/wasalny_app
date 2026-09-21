import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  getItemAsync: vi.fn(), setItemAsync: vi.fn(), deleteItemAsync: vi.fn(),
}));
vi.mock("expo-secure-store", () => storage);
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
const user = (id: number) => ({ id, name: null, email: null, phone: null, role: "user", appRole: "family", userStatus: "active" });
const session = (id = 1, expired = false) => ({
  accessToken: `access-fixture-${id}`, refreshToken: `refresh-fixture-${id}`,
  accessTokenExpiresAt: new Date(Date.now() + (expired ? -1000 : 600_000)).toISOString(), user: user(id),
});
function response(body: unknown) { return { ok: true, json: async () => body }; }
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((r, j) => { resolve = r; reject = j; });
  return { promise, resolve, reject };
}
let network: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  storage.getItemAsync.mockResolvedValue(JSON.stringify(session(1, true)));
  storage.setItemAsync.mockResolvedValue(undefined);
  storage.deleteItemAsync.mockResolvedValue(undefined);
  network = vi.fn();
  vi.stubGlobal("fetch", network);
  vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "https://staging.example.test");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("client session rotation and account boundaries", () => {
  it("singleflights concurrent refresh and persists only one rotation", async () => {
    const pending = deferred<ReturnType<typeof response>>();
    network.mockReturnValue(pending.promise);
    const auth = await import("../lib/_core/auth");
    const calls = [auth.getSessionToken(), auth.getSessionToken(), auth.getSessionToken()];
    await vi.waitFor(() => expect(network).toHaveBeenCalledTimes(1));
    pending.resolve(response(session(2)));
    expect(await Promise.all(calls)).toEqual(Array(3).fill("access-fixture-2"));
    expect(storage.setItemAsync).toHaveBeenCalledTimes(1);
  });
  it.each([false, true])("fails closed when rotation persistence fails (cleanup failure=%s)", async cleanupFails => {
    storage.setItemAsync.mockRejectedValue(new Error("SECRET access-fixture-2"));
    if (cleanupFails) storage.deleteItemAsync.mockRejectedValue(new Error("SECRET refresh-fixture-1"));
    network.mockResolvedValueOnce(response(session(2)));
    if (cleanupFails) network.mockRejectedValueOnce(new Error("SECRET remote"));
    else network.mockResolvedValueOnce(response({ success: true }));
    const log = vi.spyOn(console, "log");
    const errorLog = vi.spyOn(console, "error");
    const auth = await import("../lib/_core/auth");
    const listener = vi.fn();
    auth.subscribeAuth(listener);
    await expect(auth.getSessionToken()).rejects.toThrow(/^SESSION_PERSISTENCE_FAILED:/);
    expect(await auth.getSessionToken()).toBeNull();
    expect(listener).toHaveBeenLastCalledWith(null);
    expect(storage.deleteItemAsync).toHaveBeenCalledTimes(1);
    expect(network).toHaveBeenLastCalledWith("https://staging.example.test/api/auth/logout",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer access-fixture-2" }) }));
    expect(log).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
  });
  it("never exposes a rotated credential while its durable write is pending", async () => {
    const disk = deferred<void>();
    storage.setItemAsync.mockReturnValueOnce(disk.promise);
    network.mockResolvedValueOnce(response(session(2))).mockResolvedValueOnce(response({ success: true }));
    const auth = await import("../lib/_core/auth");
    const first = auth.getSessionToken();
    const firstRejected = expect(first).rejects.toThrow(/^SESSION_PERSISTENCE_FAILED:/);
    await vi.waitFor(() => expect(storage.setItemAsync).toHaveBeenCalledTimes(1));
    const second = auth.getSessionToken();
    const secondRejected = expect(second).rejects.toThrow(/^SESSION_PERSISTENCE_FAILED:/);
    disk.reject(new Error("storage unavailable"));
    await Promise.all([firstRejected, secondRejected]);
    expect(await auth.getSessionToken()).toBeNull();
    expect(network.mock.calls.filter(([url]) => url.endsWith("/refresh"))).toHaveLength(1);
  });
  it("clears local state immediately on offline logout and rejects a late refresh result", async () => {
    const pending = deferred<ReturnType<typeof response>>();
    network.mockReturnValueOnce(pending.promise).mockRejectedValueOnce(new Error("offline"));
    const auth = await import("../lib/_core/auth");
    const refresh = auth.getSessionToken();
    await vi.waitFor(() => expect(network).toHaveBeenCalledTimes(1));
    await expect(auth.logout()).rejects.toThrow("محلياً");
    expect(await auth.getSessionToken()).toBeNull();
    pending.resolve(response(session(2)));
    expect(await refresh).toBeNull();
    expect(storage.setItemAsync).not.toHaveBeenCalled();
  });
  it("late refresh and rejected old token cannot replace/clear a new account", async () => {
    const pending = deferred<ReturnType<typeof response>>();
    network.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(response(session(3)));
    const auth = await import("../lib/_core/auth");
    const old = auth.getSessionToken();
    await vi.waitFor(() => expect(network).toHaveBeenCalledTimes(1));
    await auth.exchangeFirebaseToken("firebase-fixture");
    pending.resolve(response(session(2)));
    expect(await old).toBeNull();
    await auth.rejectSessionToken("access-fixture-1");
    expect(await auth.getSessionToken()).toBe("access-fixture-3");
    expect(storage.setItemAsync).toHaveBeenCalledTimes(1);
  });
  it("an older failed persistence write cannot clear a newer account", async () => {
    const oldWrite = deferred<void>();
    storage.setItemAsync.mockReturnValueOnce(oldWrite.promise).mockResolvedValue(undefined);
    network.mockImplementation(async (url: string) => response(
      url.endsWith("/refresh") ? session(2) : url.endsWith("/exchange") ? session(3) : { success: true },
    ));
    const auth = await import("../lib/_core/auth");
    const old = auth.getSessionToken();
    const failed = expect(old).rejects.toThrow(/^SESSION_PERSISTENCE_FAILED:/);
    await vi.waitFor(() => expect(storage.setItemAsync).toHaveBeenCalledTimes(1));
    const switched = auth.exchangeFirebaseToken("new-account-fixture");
    // The new-account clear advances the generation before queued disk I/O.
    oldWrite.reject(new Error("write failure"));
    await failed;
    await switched;
    expect(await auth.getSessionToken()).toBe("access-fixture-3");
  });
});