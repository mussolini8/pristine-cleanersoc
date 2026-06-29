export type DateOnly = `${number}-${number}-${number}`;
export type PayrollPeriodMode = "week" | "biweekly" | "month" | "custom";

export type PayrollPeriodRange = {
  start: string;
  end: string;
  label: string;
};

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatDateOnly(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseDateOnly(value: string | null | undefined) {
  if (!value) return null;
  const [datePart] = value.split("T");
  const match = datePart.match(DATE_ONLY_RE);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function normalizeDateOnly(value: string | Date | null | undefined) {
  if (!value) return "";
  if (value instanceof Date) return formatDateOnly(value);
  const parsed = parseDateOnly(value);
  return parsed ? formatDateOnly(parsed) : "";
}

export function todayDateOnly() {
  return formatDateOnly(new Date());
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - start.getDay());
  return start;
}

export function getCurrentWeekPeriod(anchor: string | Date = new Date()): PayrollPeriodRange {
  const anchorDate = anchor instanceof Date ? anchor : parseDateOnly(anchor) ?? new Date();
  const start = startOfWeek(anchorDate);
  return { start: formatDateOnly(start), end: formatDateOnly(addDays(start, 6)), label: "This week" };
}

export function getEvery15DaysPeriod(anchor: string | Date = new Date()): PayrollPeriodRange {
  const anchorDate = anchor instanceof Date ? anchor : parseDateOnly(anchor) ?? new Date();
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();
  const start = anchorDate.getDate() <= 15 ? new Date(year, month, 1) : new Date(year, month, 16);
  const end = anchorDate.getDate() <= 15 ? new Date(year, month, 15) : new Date(year, month + 1, 0);
  const label = anchorDate.getDate() <= 15 ? "1st - 15th of Month" : "16th - End of Month";
  return { start: formatDateOnly(start), end: formatDateOnly(end), label };
}

export function getMonthPeriod(anchor: string | Date = new Date()): PayrollPeriodRange {
  const anchorDate = anchor instanceof Date ? anchor : parseDateOnly(anchor) ?? new Date();
  return {
    start: formatDateOnly(new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)),
    end: formatDateOnly(new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0)),
    label: "This month",
  };
}

export function getCustomPeriod(start: string, end: string, label = "Custom period"): PayrollPeriodRange {
  const normalizedStart = normalizeDateOnly(start);
  const normalizedEnd = normalizeDateOnly(end);
  if (!normalizedStart || !normalizedEnd) return getCurrentWeekPeriod();
  return normalizedStart <= normalizedEnd
    ? { start: normalizedStart, end: normalizedEnd, label }
    : { start: normalizedEnd, end: normalizedStart, label };
}

export function getPayrollPeriod(mode: PayrollPeriodMode, anchor: string | Date = new Date(), custom?: { start?: string; end?: string }) {
  if (mode === "custom") return getCustomPeriod(custom?.start ?? "", custom?.end ?? "");
  if (mode === "biweekly") return getEvery15DaysPeriod(anchor);
  if (mode === "month") return getMonthPeriod(anchor);
  return getCurrentWeekPeriod(anchor);
}

export function getPeriodRange(mode: Exclude<PayrollPeriodMode, "custom">, anchorKey: string) {
  return getPayrollPeriod(mode, anchorKey);
}

export function isDateWithinPeriod(value: string | null | undefined, start: string, end: string) {
  const key = normalizeDateOnly(value);
  return Boolean(key && key >= start && key <= end);
}

export function dateKeyFromValue(value: string | null | undefined) {
  return normalizeDateOnly(value);
}

export function formatDisplayDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return "—";
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const dd = String(value.getDate()).padStart(2, "0");
    const yyyy = value.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }

  const str = String(value).trim();
  if (!str) return "—";

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    return str;
  }

  const ymdMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    return `${ymdMatch[2]}/${ymdMatch[3]}/${ymdMatch[1]}`;
  }

  const mdyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (mdyMatch) {
    return `${mdyMatch[1].padStart(2, "0")}/${mdyMatch[2].padStart(2, "0")}/${mdyMatch[3]}`;
  }

  const date = parseDateOnly(str);
  if (date) {
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }

  const genericDate = new Date(str);
  if (!isNaN(genericDate.getTime())) {
    const mm = String(genericDate.getMonth() + 1).padStart(2, "0");
    const dd = String(genericDate.getDate()).padStart(2, "0");
    const yyyy = genericDate.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }

  return str;
}

export const displayDate = formatDisplayDate;


export function weekRangeFromStart(weekStartKey: string) {
  const start = parseDateOnly(weekStartKey) ?? startOfWeek(new Date());
  return { start: formatDateOnly(start), end: formatDateOnly(addDays(start, 6)) };
}

export function eachDateInRange(start: string, end: string) {
  const startDate = parseDateOnly(start);
  const endDate = parseDateOnly(end);
  if (!startDate || !endDate || startDate > endDate) return [];
  const dates: Date[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function minDateOnly(a: string, b: string) {
  return a < b ? a : b;
}
