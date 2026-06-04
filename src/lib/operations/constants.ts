export const TASK_STATUSES = ["pending", "in_progress", "completed", "overdue"] as const;
export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const PAYMENT_STATUSES = ["pending", "verified", "needs_review", "paid", "no_jobs"] as const;
export const COMMERCIAL_HOURS_STATUSES = ["scheduled", "completed", "verified", "pending_payment", "paid", "needs_review", "skipped"] as const;
export const STAFF_TEAM_SCOPES = ["residential", "commercial", "mixed"] as const;
export const STAFF_PIPELINE_STATUSES = ["Active", "Potential", "Inactive"] as const;
export const PAYMENT_MODES = ["residential_only", "mixed"] as const;
export const COMMERCIAL_SCHEDULE_FREQUENCIES = ["weekly", "every_15_days", "every_3_weeks", "monthly", "custom"] as const;
export const WORK_LOG_STATUSES = ["pending", "approved", "paid"] as const;

export const ORANGE_COUNTY_CITIES = [
  "Aliso Viejo",
  "Anaheim",
  "Brea",
  "Buena Park",
  "Costa Mesa",
  "Cypress",
  "Dana Point",
  "Fountain Valley",
  "Fullerton",
  "Garden Grove",
  "Huntington Beach",
  "Irvine",
  "La Habra",
  "La Palma",
  "Laguna Beach",
  "Laguna Hills",
  "Laguna Niguel",
  "Laguna Woods",
  "Lake Forest",
  "Los Alamitos",
  "Mission Viejo",
  "Newport Beach",
  "Orange",
  "Placentia",
  "Rancho Santa Margarita",
  "San Clemente",
  "San Juan Capistrano",
  "Santa Ana",
  "Seal Beach",
  "Stanton",
  "Tustin",
  "Villa Park",
  "Westminster",
  "Yorba Linda",
] as const;

export const OUTSIDE_OC_CITY = "Other / Outside Orange County";
export const JUAN_ROMERO_NAME = "Juan Romero";
export const CARLOS_LOPEZ_NAME = "Carlos Lopez";
export const CARLOS_OVERTIME_RATE = 7;
export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export const RESIDENTIAL_STAFF_ROLES = [
  "Owner",
  "Operations Manager",
  "Residential Cleaner",
  "Deep Cleaning Specialist",
  "Move In/Move Out Cleaner",
  "Mixed Route Cleaner",
] as const;

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

export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type CommercialHoursStatus = (typeof COMMERCIAL_HOURS_STATUSES)[number];
export type StaffTeamScope = (typeof STAFF_TEAM_SCOPES)[number];
export type StaffPipelineStatus = (typeof STAFF_PIPELINE_STATUSES)[number];
export type PaymentMode = (typeof PAYMENT_MODES)[number];
export type CommercialScheduleFrequency = (typeof COMMERCIAL_SCHEDULE_FREQUENCIES)[number];
export type WorkLogStatus = (typeof WORK_LOG_STATUSES)[number];
