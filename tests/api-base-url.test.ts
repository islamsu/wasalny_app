import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

import { apiUrl, resolveApiBaseUrl } from "../lib/_core/api-url";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("API base URL namespaces", () => {
  it("uses a web root-relative namespace for auth and tRPC", () => {
    expect(apiUrl("/api/auth/me", "/wasalny-api", "web")).toBe("/wasalny-api/api/auth/me");
    expect(apiUrl("/api/trpc", "/wasalny-api/", "web")).toBe("/wasalny-api/api/trpc");
  });

  it("keeps HTTPS absolute namespaces", () => {
    expect(apiUrl("/api/auth/logout", "https://api.example.test/wasalny/", "android"))
      .toBe("https://api.example.test/wasalny/api/auth/logout");
  });

  it("rejects relative namespaces on native", () => {
    expect(() => resolveApiBaseUrl("/wasalny-api", "android")).toThrow(/HTTPS absolute URL/);
  });

  it.each([
    "//evil.example/api",
    "/\\evil",
    "/wasalny?next=/evil",
    "/wasalny#evil",
    "/../wasalny",
    "/%2e%2e/wasalny",
    "/%252e%252e/wasalny",
    "/wasalny/%2f%2fevil",
  ])("rejects an unsafe web namespace: %s", configured => {
    expect(() => resolveApiBaseUrl(configured, "web")).toThrow();
  });

  it.each([
    "http://api.example.test",
    "https://user:password@api.example.test",
    "https://api.example.test/../admin",
    "https://api.example.test/wasalny?tenant=other",
  ])("rejects an unsafe absolute base: %s", configured => {
    expect(() => resolveApiBaseUrl(configured, "web")).toThrow();
  });

  it("preserves the localhost development exception for native", () => {
    expect(resolveApiBaseUrl("http://localhost:3000/", "ios")).toBe("http://localhost:3000");
  });

  it("routes the generic API helper through the web namespace", async () => {
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "/wasalny-api");
    const network = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: null }),
    });
    vi.stubGlobal("fetch", network);
    const { apiCall } = await import("../lib/_core/api");

    await apiCall("/api/auth/me");

    expect(network).toHaveBeenCalledWith(
      "/wasalny-api/api/auth/me",
      expect.objectContaining({ credentials: "omit" }),
    );
  });
});