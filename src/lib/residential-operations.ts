import {
  addDays,
  dateKeyFromValue,
  formatDateOnly,
  formatDisplayDate,
  getPeriodRange,
  isDateWithinPeriod,
  parseDateOnly,
  startOfWeek,
  todayDateOnly,
  weekRangeFromStart,
} from "@/lib/dates/periods";

export const RESIDENTIAL_ASSIGNEES = ["Carlos Lopez", "Jake Ivan-Pal"] as const;

export type ResidentialAssignee = (typeof RESIDENTIAL_ASSIGNEES)[number];

export type TaskReminderFrequency =
  | "one_time"
  | "daily"
  | "weekly"
  | "every_2_weeks"
  | "monthly"
  | "custom";

export type ResidentialFrequency =
  | "weekly"
  | "every_2_weeks"
  | "every_3_weeks"
  | "monthly"
  | "custom";

export type PeriodMode = "week" | "biweekly" | "month";

export const TASK_FREQUENCY_LABELS: Record<TaskReminderFrequency, string> = {
  one_time: "One-time",
  daily: "Daily",
  weekly: "Weekly",
  every_2_weeks: "Every 2 weeks",
  monthly: "Monthly",
  custom: "Custom",
};

export const RESIDENTIAL_FREQUENCY_LABELS: Record<ResidentialFrequency, string> = {
  weekly: "Weekly",
  every_2_weeks: "Every 2 weeks",
  every_3_weeks: "Every 3 weeks",
  monthly: "Monthly",
  custom: "Custom",
};

export function roundHours(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateResidentialHours(scheduledHours: number, frequency: ResidentialFrequency) {
  if (!Number.isFinite(scheduledHours) || scheduledHours <= 0) {
    return { weekly: 0, biweekly: 0, monthly: 0 };
  }

  if (frequency === "weekly") {
    return {
      weekly: roundHours(scheduledHours),
      biweekly: roundHours(scheduledHours * 2),
      monthly: roundHours(scheduledHours * 4.33),
    };
  }

  if (frequency === "every_2_weeks") {
    return {
      weekly: roundHours(scheduledHours / 2),
      biweekly: roundHours(scheduledHours),
      monthly: roundHours(scheduledHours * 2.165),
    };
  }

  if (frequency === "every_3_weeks") {
    return {
      weekly: roundHours(scheduledHours / 3),
      biweekly: roundHours(scheduledHours * 0.67),
      monthly: roundHours(scheduledHours * 1.44),
    };
  }

  if (frequency === "monthly") {
    return {
      weekly: roundHours(scheduledHours / 4.33),
      biweekly: roundHours(scheduledHours / 2),
      monthly: roundHours(scheduledHours),
    };
  }

  return {
    weekly: roundHours(scheduledHours),
    biweekly: roundHours(scheduledHours * 2),
    monthly: roundHours(scheduledHours * 4.33),
  };
}

export const formatDateKey = formatDateOnly;
export const parseDateKey = parseDateOnly;
export const todayKey = todayDateOnly;
export const isDateInRange = isDateWithinPeriod;
export const displayDate = formatDisplayDate;

export {
  addDays,
  dateKeyFromValue,
  getPeriodRange,
  startOfWeek,
  weekRangeFromStart,
};

export function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function formatHours(value: number) {
  return roundHours(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatMoney(value: number) {
  return `$${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
