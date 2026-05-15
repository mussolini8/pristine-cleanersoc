export type TeamScope = "residential" | "commercial" | "mixed" | "global";

export type StaffRoleDefinition = {
  displayRole: string;
  teamScope: TeamScope;
  commercialPayrollEligible: boolean;
  note?: string;
};

export const COMMERCIAL_STAFF_ROLES = [
  "Owner",
  "Operations Manager",
  "Commercial Cleaner",
  "Janitorial Cleaner",
  "Mixed Route Cleaner",
  "Day Porter",
  "Office Cleaning Crew",
  "Restaurant Cleaning Crew",
  "Post Construction Crew",
  "Commercial Supervisor",
  "Account Manager",
] as const;

export const RESIDENTIAL_STAFF_ROLES = [
  "Owner",
  "Operations Manager",
  "Residential Cleaner",
  "Deep Cleaning Specialist",
  "Move In/Move Out Cleaner",
  "Mixed Route Cleaner",
] as const;

export const MIXED_ROUTE_COMMERCIAL_PAYROLL_EXCLUDED = [
  "Juan Romero",
  "Esperanza Youseff",
  "Esperanza Yoseff",
  "Lorena Benitez",
] as const;

export function normalizePersonName(name: string | null | undefined) {
  return String(name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function isCommercialPayrollEligible(name: string | null | undefined) {
  const normalized = normalizePersonName(name);
  return !MIXED_ROUTE_COMMERCIAL_PAYROLL_EXCLUDED.some((excluded) => normalizePersonName(excluded) === normalized);
}

export function getStaffRoleDefinition(name: string | null | undefined, role?: string | null): StaffRoleDefinition {
  const normalized = normalizePersonName(name);
  const roleText = role?.trim() || "Residential Cleaner";

  if (normalized === "jake ivan-pal") {
    return { displayRole: "Owner", teamScope: "global", commercialPayrollEligible: false };
  }
  if (normalized === "carlos lopez") {
    return { displayRole: "Operations Manager", teamScope: "global", commercialPayrollEligible: false };
  }
  if (!isCommercialPayrollEligible(name)) {
    return {
      displayRole: "Mixed Route Cleaner",
      teamScope: "mixed",
      commercialPayrollEligible: false,
      note: "Mixed route · Not in commercial payroll",
    };
  }

  if (roleText.includes("Commercial") || roleText.includes("Janitorial") || roleText.includes("Day Porter") || roleText.includes("Office") || roleText.includes("Restaurant") || roleText.includes("Post Construction") || roleText.includes("Account Manager")) {
    return { displayRole: roleText, teamScope: "commercial", commercialPayrollEligible: true };
  }
  if (roleText.includes("Mixed")) {
    return { displayRole: "Mixed Route Cleaner", teamScope: "mixed", commercialPayrollEligible: true };
  }

  return { displayRole: roleText, teamScope: "residential", commercialPayrollEligible: false };
}

export function commercialContextRole(name: string | null | undefined, role?: string | null) {
  const definition = getStaffRoleDefinition(name, role);
  if (definition.teamScope === "residential" && isCommercialPayrollEligible(name)) return "Commercial Cleaner";
  return definition.displayRole;
}
