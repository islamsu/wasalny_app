import { describe, expect, it } from "vitest";
import {
  canAccessRoleRoute,
  homeRouteForRole,
  isAppRole,
  roleRouteFromSegments,
} from "../lib/role-routing";

describe("role-aware client routing", () => {
  it.each([
    ["family", "/"],
    ["driver", "/driver"],
    ["admin", "/admin"],
  ] as const)("routes %s to its authorized home", (role, route) => {
    expect(homeRouteForRole(role)).toBe(route);
  });

  it("allows only family screens to family accounts", () => {
    expect(canAccessRoleRoute("family", "index")).toBe(true);
    expect(canAccessRoleRoute("family", "history")).toBe(true);
    expect(canAccessRoleRoute("family", "driver")).toBe(false);
    expect(canAccessRoleRoute("family", "admin")).toBe(false);
  });

  it.each([
    ["driver", "driver"],
    ["admin", "admin"],
  ] as const)("allows %s only into its own application", (role, route) => {
    expect(canAccessRoleRoute(role, route)).toBe(true);
    expect(canAccessRoleRoute(role, "index")).toBe(false);
    expect(canAccessRoleRoute(role, "history")).toBe(false);
    expect(canAccessRoleRoute(role, role === "driver" ? "admin" : "driver")).toBe(false);
  });

  it("fails closed for unknown backend roles", () => {
    expect(isAppRole("family")).toBe(true);
    expect(isAppRole("user")).toBe(false);
    expect(isAppRole(null)).toBe(false);
  });

  it("normalizes Expo tab segments without trusting arbitrary paths", () => {
    expect(roleRouteFromSegments(["(tabs)"])).toBe("index");
    expect(roleRouteFromSegments(["(tabs)", "history"])).toBe("history");
    expect(roleRouteFromSegments(["(tabs)", "admin"])).toBe("admin");
    expect(roleRouteFromSegments(["(tabs)", "unexpected"])).toBe("index");
  });
});