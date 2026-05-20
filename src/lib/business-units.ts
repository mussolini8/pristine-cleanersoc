import { type AppRole } from "@/lib/access-control";

export type BusinessUnit = "residential" | "commercial";
export type BusinessUnitFilter = BusinessUnit | "both";

export const BUSINESS_UNIT_LABELS: Record<BusinessUnitFilter, string> = {
  residential: "Residential",
  commercial: "Commercial",
  both: "Both",
};

export function normalizeBusinessUnit(value: string | null | undefined): BusinessUnit | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized.includes("commercial") || normalized.includes("janitorial")) return "commercial";
  if (normalized.includes("residential") || normalized.includes("home")) return "residential";
  return null;
}

export function normalizeBusinessUnitFilter(value: string | null | undefined): BusinessUnitFilter {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "commercial") return "commercial";
  if (normalized === "both") return "both";
  return "residential";
}

export function getUserAllowedUnits(role: AppRole): BusinessUnit[] {
  if (role === "admin" || role === "owner" || role === "operations_manager") return ["residential", "commercial"];
  if (role === "commercial") return ["commercial"];
  if (role === "residential") return ["residential"];
  return [];
}

export function canViewUnit(role: AppRole, unit: BusinessUnit) {
  return getUserAllowedUnits(role).includes(unit);
}

export function canManageUnit(role: AppRole, unit: BusinessUnit) {
  if (role === "admin" || role === "owner" || role === "operations_manager") return true;
  return canViewUnit(role, unit);
}

export function getBusinessUnitFilter(value: string | null | undefined, role: AppRole): BusinessUnitFilter {
  const requested = normalizeBusinessUnitFilter(value);
  const allowed = getUserAllowedUnits(role);

  if (allowed.length === 0) return "residential";
  if (requested === "both") return allowed.length > 1 ? "both" : allowed[0];
  return allowed.includes(requested) ? requested : allowed[0];
}

export function applyBusinessUnitFilter<T>(
  items: T[],
  filter: BusinessUnitFilter,
  getUnit: (item: T) => BusinessUnit | "seo" | null | undefined,
) {
  if (filter === "both") {
    return items.filter((item) => {
      const unit = getUnit(item);
      return unit === "residential" || unit === "commercial";
    });
  }
  return items.filter((item) => getUnit(item) === filter);
}

export function businessUnitBadgeTone(unit: BusinessUnit | "seo" | null | undefined) {
  if (unit === "commercial") return "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-200";
  if (unit === "seo") return "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200";
  return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200";
}

export function businessUnitLabel(unit: BusinessUnit | "seo" | null | undefined) {
  if (unit === "commercial") return "Commercial";
  if (unit === "seo") return "SEO";
  return "Residential";
}
