export type AppRole = "residential" | "commercial" | "admin" | "owner" | "operations_manager" | "seo" | "inspector";
export type AccessArea = "residential" | "commercial" | "seo" | "operations" | "workspace" | "tasks" | "qc";

export const USERNAME_AUTH_EMAILS: Record<string, string> = {
  pristinecleaners: "pristinecleaners@pristine.local",
  pristinejanitorial: "pristinejanitorial@pristine.local",
  pristineseo: "pristineseo@pristine.local",
  // QC Field Inspectors
  marial: "marial@pristine.local",
  anam: "anam@pristine.local",
};

export const ROLE_LABELS: Record<AppRole, string> = {
  residential: "Residential",
  commercial: "Commercial",
  admin: "Admin",
  owner: "Owner",
  operations_manager: "Operations Manager",
  seo: "SEO Specialist",
  inspector: "QC Inspector",
};

export const PROTECTED_ROUTE_ACCESS: { prefix: string; area: AccessArea }[] = [
  { prefix: "/dashboard", area: "workspace" },
  { prefix: "/tasks", area: "tasks" },
  { prefix: "/calendar", area: "workspace" },
  { prefix: "/residential", area: "residential" },
  { prefix: "/payments", area: "workspace" },
  { prefix: "/commercial", area: "commercial" },
  { prefix: "/seo", area: "seo" },
  { prefix: "/staff", area: "operations" },
  { prefix: "/reports", area: "operations" },
  { prefix: "/settings", area: "operations" },
  { prefix: "/qc", area: "qc" },
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
  if (
    value === "commercial" ||
    value === "admin" ||
    value === "owner" ||
    value === "operations_manager" ||
    value === "seo" ||
    value === "inspector"
  ) {
    return value;
  }
  return "residential";
}

export function canAccessArea(role: AppRole, area: AccessArea) {
  if (elevatedRoles.includes(role)) return true;
  if (role === "operations_manager") return true;
  // Inspectors: QC area only — read-only on bookings enforced in each page
  if (role === "inspector") return area === "qc";
  // Managers, admins, owners, residential, and commercial roles can access the QC area
  if (area === "qc") return true;
  if (area === "tasks") return role === "residential" || role === "commercial" || role === "seo";
  if (area === "workspace") return role === "residential" || role === "commercial";
  if (area === "operations") return role !== "seo";
  return role === area;
}

export function getDefaultPathForRole(role: AppRole) {
  if (role === "inspector") return "/qc/inspector";
  if (role === "commercial") return "/dashboard";
  if (role === "seo") return "/dashboard";
  return "/dashboard";
}

export function getRouteAccess(pathname: string) {
  return PROTECTED_ROUTE_ACCESS.find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`));
}
