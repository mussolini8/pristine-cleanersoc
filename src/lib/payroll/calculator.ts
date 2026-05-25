import type {
  CleanerPaymentSetting,
  CommercialAccount,
  CommercialScheduleRule,
  PayrollExceptionCode,
  PayrollGeneratedEntry,
  PayrollPeriod,
} from "./types";
import { eachDateInRange, formatDateOnly, parseDateOnly } from "@/lib/dates/periods";
import { isCommercialPayrollEligible } from "@/lib/staff-rules";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined) {
  return Boolean(value && UUID_RE.test(value));
}

export function formatISODate(date: Date) {
  return formatDateOnly(date);
}

export function parseISODate(value: string) {
  return parseDateOnly(value) ?? new Date(Number.NaN);
}

export function eachDateInPeriod(startDate: string, endDate: string) {
  return eachDateInRange(startDate, endDate);
}

function dateWithin(value: Date, start?: string | null, end?: string | null) {
  const time = value.getTime();
  if (start && parseISODate(start).getTime() > time) return false;
  if (end && parseISODate(end).getTime() < time) return false;
  return true;
}

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function appliesToIntervalRule(rule: CommercialScheduleRule, serviceDate: Date) {
  const interval = Math.max(1, Number(rule.frequency_interval ?? (rule.frequency_type === "biweekly" ? 2 : 1)) || 1);
  if (interval <= 1) return true;
  if (!rule.anchor_date) return false;
  const anchor = parseISODate(rule.anchor_date);
  const service = startOfLocalDay(serviceDate);
  const diffMs = service.getTime() - startOfLocalDay(anchor).getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 0) return false;
  const diffWeeks = Math.floor(diffDays / 7);
  return diffWeeks % interval === 0;
}

function ruleAppliesToDate(rule: CommercialScheduleRule, serviceDate: Date) {
  const frequencyType = rule.frequency_type ?? "weekly";
  if (frequencyType === "monthly") {
    if (!rule.anchor_date) return true;
    return serviceDate.getDate() === parseISODate(rule.anchor_date).getDate();
  }
  return appliesToIntervalRule(rule, serviceDate);
}

function normalizeFrequency(value?: string | null) {
  return (value ?? "").toLowerCase().trim();
}

export function parseHours(value: CommercialAccount["hours"]) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const exact = Number(value);
  if (Number.isFinite(exact)) return exact;
  const numbers = value.match(/\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) ?? [];
  return numbers.length === 1 ? numbers[0] : 0;
}

function visitsPerWeek(frequency?: string | null) {
  const freq = normalizeFrequency(frequency);
  const explicit = freq.match(/(\d+(?:\.\d+)?)\s*x/);
  if (explicit) return Number(explicit[1]);
  if (freq.includes("daily")) return 5;
  if (freq.includes("twice")) return 2;
  if (freq.includes("three")) return 3;
  if (freq.includes("four")) return 4;
  if (freq.includes("weekly") || freq.includes("every week") || freq === "week") return 1;
  if (freq.includes("biweekly") || freq.includes("every 2 weeks") || freq.includes("every two weeks")) return 0.5;
  if (freq.includes("monthly") || freq.includes("once a month") || freq.includes("twice a month")) return freq.includes("twice") ? 0.5 : 0.25;
  if (freq.includes("as needed") || freq.includes("custom")) return 0;
  const fallback = Number(freq.replace(/[^0-9.]/g, ""));
  return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
}

function fallbackVisitDates(account: CommercialAccount, period: PayrollPeriod) {
  const dates = eachDateInPeriod(period.startDate, period.endDate).filter((date) =>
    dateWithin(date, account.contract_start, account.contract_end),
  );
  const freq = normalizeFrequency(account.frequency);
  const perWeek = visitsPerWeek(account.frequency);

  if (perWeek <= 0) return [];

  if (freq.includes("biweekly") || freq.includes("every 2 weeks") || freq.includes("every two weeks")) {
    const anchor = account.contract_start ? parseISODate(account.contract_start) : parseISODate(period.startDate);
    const anchorDow = anchor.getDay();
    return dates.filter((date) => {
      if (date.getDay() !== anchorDow) return false;
      const days = Math.floor((date.getTime() - anchor.getTime()) / 86400000);
      return days >= 0 && days % 14 === 0;
    });
  }

  if (freq.includes("monthly") || freq.includes("once a month")) {
    const anchorDay = account.contract_start ? parseISODate(account.contract_start).getDate() : 1;
    const exact = dates.find((date) => date.getDate() === anchorDay);
    return exact ? [exact] : dates.slice(0, 1);
  }

  if (freq.includes("twice a month")) {
    return dates.filter((date) => date.getDate() === 1 || date.getDate() === 15).slice(0, 2);
  }

  const targetDays = Math.max(1, Math.min(7, Math.round(perWeek)));
  const preferred = targetDays >= 5 ? [1, 2, 3, 4, 5] : targetDays === 4 ? [1, 2, 3, 4] : targetDays === 3 ? [1, 3, 5] : targetDays === 2 ? [2, 5] : [account.contract_start ? parseISODate(account.contract_start).getDay() : 1];

  return dates.filter((date) => preferred.includes(date.getDay()));
}

function getSetting(settings: CleanerPaymentSetting[], cleanerName?: string | null) {
  if (!cleanerName) return null;
  return settings.find((setting) => setting.cleaner_name?.toLowerCase() === cleanerName.toLowerCase()) ?? null;
}

function cleanMoney(value: number) {
  return Number(value.toFixed(2));
}

function resolvePayRate(account: CommercialAccount, setting: CleanerPaymentSetting | null, hours: number) {
  const hourlyRate = Number(account.cleaner_hourly_rate ?? 0);
  if (hourlyRate > 0) return hourlyRate;

  const flatRate = Number(account.cleaner_flat_rate ?? 0);
  if ((account.cleaner_pay_type ?? "").toLowerCase() === "flat" && flatRate > 0 && hours > 0) {
    return cleanMoney(flatRate / hours);
  }

  const settingRate = Number(setting?.default_pay_rate ?? 0);
  if (settingRate > 0) return settingRate;

  return 0;
}

function buildExceptions(input: {
  cleanerName: string | null;
  payRate: number;
  hours: number;
  hasSchedule: boolean;
  setting: CleanerPaymentSetting | null;
  account: CommercialAccount;
}) {
const exceptions: PayrollExceptionCode[] = [];
  if (!input.cleanerName) exceptions.push("missing_cleaner");
  if (!input.payRate) {
    const hasAccountRate = Number(input.account.cleaner_hourly_rate ?? 0) > 0 || Number(input.account.cleaner_flat_rate ?? 0) > 0;
    const hasSettingRate = Number(input.setting?.default_pay_rate ?? 0) > 0;
    exceptions.push(hasAccountRate || hasSettingRate ? "missing_pay_rate" : "missing_account_pay_settings");
  }
  if (input.setting?.active === false) exceptions.push("inactive_cleaner");
  if (input.hours <= 0) exceptions.push("zero_hours");
  if (!input.hasSchedule) exceptions.push("missing_schedule");
  if (input.cleanerName && !isCommercialPayrollEligible(input.cleanerName)) exceptions.push("excluded_commercial_payroll");
  if (input.setting?.requires_manual_review) exceptions.push("manual_review");
  if (input.account.contract_start || input.account.contract_end) exceptions.push("contract_boundary");
  return exceptions;
}

function entryStatus(exceptions: PayrollExceptionCode[]) {
  return exceptions.some((code) => ["missing_cleaner", "missing_pay_rate", "inactive_cleaner", "zero_hours", "missing_anchor_date", "manual_review", "missing_account_pay_settings", "excluded_commercial_payroll", "hours_mismatch"].includes(code))
    ? "needs_review"
    : "draft";
}

function reviewNoteFor(exceptions: PayrollExceptionCode[], setting: CleanerPaymentSetting | null) {
  if (setting?.manual_review_reason) return setting.manual_review_reason;
  if (exceptions.includes("missing_account_pay_settings")) return "Missing account pay settings";
  if (exceptions.includes("missing_pay_rate")) return "Missing rate";
  if (exceptions.includes("missing_cleaner")) return "Missing cleaner";
  if (exceptions.includes("missing_anchor_date")) return "Missing anchor date";
  if (exceptions.includes("missing_schedule")) return "Missing schedule rule";
  if (exceptions.includes("zero_hours")) return "Missing paid hours";
  if (exceptions.includes("excluded_commercial_payroll")) return "Mixed route · Not in commercial payroll";
  if (exceptions.includes("hours_mismatch")) return "Paid hours do not match expected payable hours";
  if (exceptions.includes("inactive_cleaner")) return "Cleaner payment setting is inactive";
  return null;
}

function entryFor(input: {
  account: CommercialAccount;
  cleanerName: string | null;
  serviceDate: Date | null;
  scheduledDay: string | null;
  hours: number;
  payRate: number;
  paymentMethod: string | null;
  setting: CleanerPaymentSetting | null;
  hasSchedule: boolean;
  source: PayrollGeneratedEntry["source"];
  extraExceptions?: PayrollExceptionCode[];
}) {
  const exceptions = buildExceptions({
    cleanerName: input.cleanerName,
    payRate: input.payRate,
    hours: input.hours,
    hasSchedule: input.hasSchedule,
    setting: input.setting,
    account: input.account,
  });
  exceptions.push(...(input.extraExceptions ?? []));
  const payrollEligible = !exceptions.includes("excluded_commercial_payroll");
  const payableRate = payrollEligible ? input.payRate : 0;
  const estimated = payrollEligible ? cleanMoney(input.hours * input.payRate) : 0;
  const requiresManualReview = Boolean(input.setting?.requires_manual_review || exceptions.includes("manual_review") || exceptions.includes("excluded_commercial_payroll"));

  return {
    cleaner_name: input.cleanerName,
    account_id: isUuid(input.account.id) ? input.account.id : null,
    account_name: input.account.name,
    city: input.account.city ?? null,
    service_date: input.serviceDate ? formatISODate(input.serviceDate) : null,
    scheduled_day: input.scheduledDay,
    base_hours: input.hours,
    adjusted_hours: input.hours,
    pay_rate: payableRate,
    estimated_amount: estimated,
    adjustment_amount: 0,
    final_amount: estimated,
    status: entryStatus(exceptions),
    requires_manual_review: requiresManualReview,
    review_status: requiresManualReview ? "pending" : "not_required",
    review_notes: reviewNoteFor(exceptions, input.setting),
    payment_method: input.paymentMethod,
    source: input.source,
    exceptions,
  } satisfies PayrollGeneratedEntry;
}

export function generateEntriesForAccount(
  account: CommercialAccount,
  period: PayrollPeriod,
  settings: CleanerPaymentSetting[],
  scheduleRules: CommercialScheduleRule[],
) {
  const activeRules = scheduleRules.filter((rule) =>
    rule.active !== false &&
    Number(rule.paid_hours) > 0 &&
    eachDateInPeriod(period.startDate, period.endDate).some((date) => dateWithin(date, rule.effective_start_date, rule.effective_end_date)),
  );
  const entries: PayrollGeneratedEntry[] = [];

  if (activeRules.length > 0) {
    for (const rule of activeRules) {
      const extraExceptions: PayrollExceptionCode[] = [];
      const interval = Math.max(1, Number(rule.frequency_interval ?? (rule.frequency_type === "biweekly" ? 2 : 1)) || 1);
      if (interval > 1 && !rule.anchor_date) {
        extraExceptions.push("missing_anchor_date");
      }
      const dates = eachDateInPeriod(period.startDate, period.endDate).filter((date) =>
        date.getDay() === Number(rule.day_of_week) &&
        dateWithin(date, account.contract_start, account.contract_end) &&
        dateWithin(date, rule.effective_start_date, rule.effective_end_date) &&
        extraExceptions.length === 0 &&
        ruleAppliesToDate(rule, date),
      );
      for (const serviceDate of dates) {
        const cleanerName = rule.assigned_cleaner_name || account.cleaner_name || null;
        const setting = getSetting(settings, cleanerName);
        const payRate = resolvePayRate(account, setting, Number(rule.paid_hours));
        entries.push(entryFor({
          account,
          cleanerName,
          serviceDate,
          scheduledDay: DAY_NAMES[serviceDate.getDay()],
          hours: Number(rule.paid_hours),
          payRate,
          paymentMethod: account.payment_method ?? setting?.payment_method ?? null,
          setting,
          hasSchedule: true,
          source: "schedule_rule",
          extraExceptions,
        }));
      }
      if (extraExceptions.includes("missing_anchor_date")) {
        const cleanerName = rule.assigned_cleaner_name || account.cleaner_name || null;
        const setting = getSetting(settings, cleanerName);
        const payRate = resolvePayRate(account, setting, Number(rule.paid_hours));
        entries.push(entryFor({
          account,
          cleanerName,
          serviceDate: null,
          scheduledDay: DAY_NAMES[Number(rule.day_of_week)] ?? null,
          hours: Number(rule.paid_hours),
          payRate,
          paymentMethod: account.payment_method ?? setting?.payment_method ?? null,
          setting,
          hasSchedule: true,
          source: "schedule_rule",
          extraExceptions,
        }));
      }
    }
    return entries;
  }

  const hours = parseHours(account.hours);
  const dates = fallbackVisitDates(account, period);
  for (const serviceDate of dates) {
    const cleanerName = account.cleaner_name ?? null;
    const setting = getSetting(settings, cleanerName);
    const payRate = resolvePayRate(account, setting, hours);
    entries.push(entryFor({
      account,
      cleanerName,
      serviceDate,
      scheduledDay: DAY_NAMES[serviceDate.getDay()],
      hours,
      payRate,
      paymentMethod: account.payment_method ?? setting?.payment_method ?? null,
      setting,
      hasSchedule: false,
      source: "account_fallback",
    }));
  }

  if (entries.length === 0) {
    const cleanerName = account.cleaner_name ?? null;
    const setting = getSetting(settings, cleanerName);
    const payRate = resolvePayRate(account, setting, hours);
    entries.push(entryFor({
      account,
      cleanerName,
      serviceDate: null,
      scheduledDay: null,
      hours,
      payRate,
      paymentMethod: account.payment_method ?? setting?.payment_method ?? null,
      setting,
      hasSchedule: false,
      source: "account_fallback",
    }));
  }

  return entries;
}

export function summarizeEntries(entries: Pick<PayrollGeneratedEntry, "base_hours" | "adjusted_hours" | "estimated_amount" | "final_amount" | "status">[]) {
  return entries.reduce(
    (total, entry) => ({
      total_estimated_hours: cleanMoney(total.total_estimated_hours + Number(entry.base_hours ?? 0)),
      total_adjusted_hours: cleanMoney(total.total_adjusted_hours + Number(entry.adjusted_hours ?? entry.base_hours ?? 0)),
      total_estimated_amount: cleanMoney(total.total_estimated_amount + Number(entry.estimated_amount ?? 0)),
      total_final_amount: cleanMoney(total.total_final_amount + Number(entry.final_amount ?? entry.estimated_amount ?? 0)),
      needs_review_count: total.needs_review_count + (entry.status === "needs_review" ? 1 : 0),
    }),
    { total_estimated_hours: 0, total_adjusted_hours: 0, total_estimated_amount: 0, total_final_amount: 0, needs_review_count: 0 },
  );
}

export function getBiweeklyPeriod(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = date.getDate() <= 15 ? new Date(year, month, 1) : new Date(year, month, 16);
  const end = date.getDate() <= 15 ? new Date(year, month, 15) : new Date(year, month + 1, 0);
  const label = `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}-${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  return { startDate: formatISODate(start), endDate: formatISODate(end), label };
}
