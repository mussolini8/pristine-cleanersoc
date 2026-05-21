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

export function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseDateKey(value: string | null | undefined) {
  if (!value) return null;
  const [datePart] = value.split("T");
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - start.getDay());
  return start;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function todayKey() {
  return formatDateKey(new Date());
}

export function dateKeyFromValue(value: string | null | undefined) {
  const date = parseDateKey(value);
  return date ? formatDateKey(date) : "";
}

export function getPeriodRange(mode: PeriodMode, anchorKey: string) {
  const anchor = parseDateKey(anchorKey) ?? new Date();
  if (mode === "week") {
    const start = startOfWeek(anchor);
    return { start: formatDateKey(start), end: formatDateKey(addDays(start, 6)), label: "This week" };
  }

  if (mode === "biweekly") {
    const start = startOfWeek(anchor);
    return { start: formatDateKey(start), end: formatDateKey(addDays(start, 13)), label: "This biweekly" };
  }

  return {
    start: formatDateKey(new Date(anchor.getFullYear(), anchor.getMonth(), 1)),
    end: formatDateKey(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)),
    label: "This month",
  };
}

export function isDateInRange(value: string | null | undefined, start: string, end: string) {
  const key = dateKeyFromValue(value);
  return Boolean(key && key >= start && key <= end);
}

export function displayDate(value: string | null | undefined) {
  const date = parseDateKey(value);
  if (!date) return "No date";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function weekRangeFromStart(weekStartKey: string) {
  const start = parseDateKey(weekStartKey) ?? startOfWeek(new Date());
  return { start: formatDateKey(start), end: formatDateKey(addDays(start, 6)) };
}

export function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function formatHours(value: number) {
  return roundHours(value).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function formatMoney(value: number) {
  return `$${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
