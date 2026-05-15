export type AppRole = "residential" | "commercial" | "admin" | "owner" | "operations_manager";
export type AccessArea = "residential" | "commercial";

export const USERNAME_AUTH_EMAILS: Record<string, string> = {
  pristinecleaners: "pristinecleaners@pristine.local",
  pristinejanitorial: "pristinejanitorial@pristine.local",
};

export const ROLE_LABELS: Record<AppRole, string> = {
  residential: "Residential",
  commercial: "Commercial",
  admin: "Admin",
  owner: "Owner",
  operations_manager: "Operations Manager",
};

export const PROTECTED_ROUTE_ACCESS: { prefix: string; area: AccessArea }[] = [
  { prefix: "/dashboard", area: "residential" },
  { prefix: "/residential", area: "residential" },
  { prefix: "/payments", area: "residential" },
  { prefix: "/commercial", area: "commercial" },
];

const elevatedRoles: AppRole[] = ["admin", "owner"];

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function resolveLoginEmail(identifier: string) {
  const normalized = normalizeUsername(identifier);
  return USERNAME_AUTH_EMAILS[normalized] ?? normalized;
}

export function normalizeAppRole(value: string | null | undefined): AppRole {
  if (value === "commercial" || value === "admin" || value === "owner" || value === "operations_manager") {
    return value;
  }
  return "residential";
}

export function canAccessArea(role: AppRole, area: AccessArea) {
  if (elevatedRoles.includes(role)) return true;
  if (role === "operations_manager") return true;
  return role === area;
}

export function getDefaultPathForRole(role: AppRole) {
  if (role === "commercial") return "/commercial";
  return "/dashboard";
}

export function getRouteAccess(pathname: string) {
  return PROTECTED_ROUTE_ACCESS.find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`));
}
