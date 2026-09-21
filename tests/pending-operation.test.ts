import { beforeEach, describe, expect, it, vi } from "vitest";
const storage = vi.hoisted(() => new Map<string, string>());
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { storage.set(key, value); }),
    removeItem: vi.fn(async (key: string) => { storage.delete(key); }),
  },
}));
import { pendingOperation } from "../lib/pending-operation";
describe("persisted ride intents", () => {
  beforeEach(() => storage.clear());
  it("replays original bytes and key after an uncertain response", async () => {
    let original: unknown;
    await expect(pendingOperation(1, "create", { destination: "A" }, async (input) => {
      original = input; throw new Error("network timeout");
    })).rejects.toThrow("timeout");
    await pendingOperation(1, "create", { destination: "B" }, async (input) => {
      expect(input).toEqual(original); return true;
    });
    expect(storage.size).toBe(0);
  });
  it("scopes intents by authenticated user", async () => {
    await expect(pendingOperation(1, "bid", { price: 20 }, async () => { throw Error("offline"); })).rejects.toThrow();
    await pendingOperation(2, "bid", { price: 30 }, async (input) => {
      expect(input.price).toBe(30); return true;
    });
    expect(storage.size).toBe(1);
  });
  it("allows correction after a definite validation rejection", async () => {
    await expect(pendingOperation(1, "bid", { price: -1 }, async () => {
      throw { data: { code: "BAD_REQUEST" } };
    })).rejects.toEqual({ data: { code: "BAD_REQUEST" } });
    expect(storage.size).toBe(0);
  });
  it("retains intent on a server timeout and explains safe retry", async () => {
    await expect(pendingOperation(1, "complete-4", { id: 4 }, async () => {
      throw Object.assign(new Error("Request timed out"), { data: { code: "TIMEOUT" } });
    })).rejects.toThrow("نفس الطلب المحفوظ");
    expect(storage.size).toBe(1);
  });
});