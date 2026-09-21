export const APP_ROLES = ["family", "driver", "admin"] as const;
export type AppRole = (typeof APP_ROLES)[number];
export type RoleRoute = "index" | "history" | "driver" | "admin";

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLES.includes(value as AppRole);
}

export function homeRouteForRole(role: AppRole): "/" | "/driver" | "/admin" {
  if (role === "driver") return "/driver";
  if (role === "admin") return "/admin";
  return "/";
}

export function canAccessRoleRoute(role: AppRole, route: RoleRoute): boolean {
  if (role === "family") return route === "index" || route === "history";
  return route === role;
}

export function roleRouteFromSegments(segments: readonly string[]): RoleRoute {
  const route = segments.find((segment) => segment !== "(tabs)");
  if (route === "history" || route === "driver" || route === "admin") return route;
  return "index";
}