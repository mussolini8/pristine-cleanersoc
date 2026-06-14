import {
  WEEKDAY_NAMES,
  type CommercialHoursStatus,
} from "@/lib/operations/constants";
import type { CommercialAccountRow, CommercialHoursEntryRow, CommercialScheduleRuleRow } from "@/lib/operations/types";
import {
  eachDateInRange,
  formatDateOnly,
  isDateWithinPeriod,
  minDateOnly,
  normalizeDateOnly,
  parseDateOnly,
} from "@/lib/dates/periods";
import { roundHours, toNumber } from "@/lib/residential-operations";

type CommercialHoursPeriod = {
  start: string;
  end: string;
};

function normalizedName(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function isJuanRomero(value: string | null | undefined) {
  const normalized = normalizedName(value);
  return normalized === "juan romero" || normalized === "juan";
}

export function commercialFrequencyLabel(value: string | null | undefined) {
  if (value === "biweekly" || value === "every_2_weeks") return "Every 2 weeks";
  if (value === "every_15_days") return "Every 15 days";
  if (value === "every_3_weeks") return "Every 3 weeks";
  if (value === "monthly") return "Monthly";
  if (value === "custom") return "Custom";
  return "Weekly";
}

export function commercialRuleFrequency(rule: Pick<CommercialScheduleRuleRow, "frequency_type" | "frequency_interval">) {
  if (rule.frequency_type === "monthly" || rule.frequency_type === "custom") return rule.frequency_type;
  if (rule.frequency_type === "biweekly" || rule.frequency_interval === 2) return "biweekly";
  if (rule.frequency_type === "every_15_days" || rule.frequency_interval === 15) return "every_15_days";
  if (rule.frequency_type === "every_3_weeks" || rule.frequency_interval === 3) return "every_3_weeks";
  return "weekly";
}

export function commercialRuleMatchesDate(rule: CommercialScheduleRuleRow, dateKey: string) {
  const date = parseDateOnly(dateKey);
  if (!date) return false;
  const frequency = commercialRuleFrequency(rule);
  const anchor = parseDateOnly(rule.anchor_date ?? rule.effective_start_date ?? rule.effective_from ?? dateKey);
  if (!anchor) return true;
  const days = Math.floor((date.getTime() - anchor.getTime()) / 86400000);
  if (days < 0) return false;
  if (frequency === "biweekly") {
    const diffWeeks = Math.floor(days / 7);
    return diffWeeks % 2 === 0;
  }
  if (frequency === "every_15_days") return days % 15 === 0;
  if (frequency === "every_3_weeks") {
    const diffWeeks = Math.floor(days / 7);
    return diffWeeks % 3 === 0;
  }
  if (frequency === "monthly") return date.getDate() === anchor.getDate() || date.getDay() === Number(rule.day_of_week);
  
  // Handle other potential interval frequencies (e.g. custom rule with interval > 1)
  const interval = Number(rule.frequency_interval);
  if (Number.isFinite(interval) && interval > 1) {
    const diffWeeks = Math.floor(days / 7);
    return diffWeeks % interval === 0;
  }
  return true;
}

export function commercialScheduleSummary(rules: CommercialScheduleRuleRow[]) {
  const activeRules = rules.filter((rule) => rule.active !== false).sort((a, b) => Number(a.day_of_week) - Number(b.day_of_week));
  if (!activeRules.length) return "No schedule configured yet";
  const frequency = commercialFrequencyLabel(commercialRuleFrequency(activeRules[0]));
  const days = activeRules.map((rule) => `${WEEKDAY_NAMES[Number(rule.day_of_week)] ?? "Day"} ${roundHours(toNumber(rule.scheduled_hours) || toNumber(rule.paid_hours))}h`).join(" + ");
  return `${frequency} · ${days}`;
}

function storedEntryKey(entry: Pick<CommercialHoursEntryRow, "account_id" | "account_name" | "team_name" | "work_date">) {
  const accKey = entry.account_id || normalizedName(entry.account_name);
  return `${accKey}:${normalizedName(entry.team_name)}:${entry.work_date}`;
}

function generatedEntryKey(accountId: string, cleanerName: string | null | undefined, workDate: string, accountName?: string) {
  const accKey = accountId || normalizedName(accountName);
  return `${accKey}:${normalizedName(cleanerName)}:${workDate}`;
}

export function buildCommercialOccurrences(input: {
  accounts: CommercialAccountRow[];
  scheduleRules: CommercialScheduleRuleRow[];
  storedEntries: CommercialHoursEntryRow[];
  period: CommercialHoursPeriod;
  cutoffDate?: string;
}) {
  const cutoff = minDateOnly(input.period.end, input.cutoffDate ?? input.period.end);
  if (input.period.start > cutoff) return [];

  const stored = input.storedEntries.filter((entry) =>
    isDateWithinPeriod(entry.work_date, input.period.start, cutoff) && !isJuanRomero(entry.team_name),
  );

  const syncedStored: CommercialHoursEntryRow[] = [];
  for (const entry of stored) {
    const isModifiable = entry.manual_entry === false && entry.status !== "paid" && entry.status !== "approved" && !entry.verified;
    if (isModifiable) {
      const date = parseDateOnly(entry.work_date);
      const dayOfWeek = date ? date.getDay() : -1;
      const rule = input.scheduleRules.find(
        (r) => r.commercial_account_id === entry.account_id && r.active !== false && Number(r.day_of_week) === dayOfWeek
      );
      if (!rule) {
        // Schedule rule has been removed/deactivated, discard this entry
        continue;
      }

      // Sync cleaner and hours with the active schedule rule
      const account = input.accounts.find((a) => a.id === entry.account_id);
      const ruleCleaner = rule.assigned_cleaner_name ?? account?.cleaner_name ?? null;
      const ruleHours = toNumber(rule.scheduled_hours) || toNumber(rule.paid_hours);

      const updatedEntry = {
        ...entry,
        team_name: ruleCleaner,
        scheduled_hours: ruleHours,
      };
      if (toNumber(entry.completed_hours) === 0 || entry.completed_hours === entry.scheduled_hours) {
        updatedEntry.completed_hours = ruleHours;
      }
      syncedStored.push(updatedEntry);
    } else {
      syncedStored.push(entry);
    }
  }

  // Populate storedKeys set with both UUID-based and name-based keys for maximum robustness
  const storedKeys = new Set<string>();
  for (const entry of syncedStored) {
    const cleanerKey = normalizedName(entry.team_name);
    if (entry.account_id) {
      storedKeys.add(`${entry.account_id}:${cleanerKey}:${entry.work_date}`);
    }
    const nameKey = normalizedName(entry.account_name);
    storedKeys.add(`${nameKey}:${cleanerKey}:${entry.work_date}`);
  }

  const generatedKeys = new Set<string>();
  const generated: CommercialHoursEntryRow[] = [];
  const dates = eachDateInRange(input.period.start, cutoff);

  for (const account of input.accounts) {
    const rules = input.scheduleRules.filter((rule) => rule.commercial_account_id === account.id && rule.active !== false);
    for (const rule of rules) {
      if (isJuanRomero(rule.assigned_cleaner_name ?? account.cleaner_name)) continue;
      const day = Number(rule.day_of_week);
      if (!Number.isFinite(day)) continue;

      for (const date of dates) {
        const key = formatDateOnly(date);
        const effectiveFrom = normalizeDateOnly(rule.effective_from ?? rule.effective_start_date ?? account.contract_start);
        const effectiveUntil = normalizeDateOnly(rule.effective_until ?? rule.effective_end_date ?? account.contract_end);
        if (date.getDay() !== day) continue;
        if (effectiveFrom && key < effectiveFrom) continue;
        if (effectiveUntil && key > effectiveUntil) continue;
        if (!commercialRuleMatchesDate(rule, key)) continue;

        const cleanerName = rule.assigned_cleaner_name ?? account.cleaner_name;
        const cleanerKey = normalizedName(cleanerName);
        const keyWithId = `${account.id}:${cleanerKey}:${key}`;
        const keyWithName = `${normalizedName(account.name)}:${cleanerKey}:${key}`;

        if (
          storedKeys.has(keyWithId) ||
          storedKeys.has(keyWithName) ||
          generatedKeys.has(keyWithId) ||
          generatedKeys.has(keyWithName)
        ) {
          continue;
        }

        generatedKeys.add(keyWithId);
        generatedKeys.add(keyWithName);

        const scheduledHours = toNumber(rule.scheduled_hours) || toNumber(rule.paid_hours);
        generated.push({
          id: `scheduled-${rule.id}-${key}`,
          account_id: account.id,
          account_name: account.name,
          team_id: null,
          team_name: cleanerName,
          work_date: key,
          scheduled_day: WEEKDAY_NAMES[date.getDay()],
          scheduled_hours: scheduledHours,
          completed_hours: 0,
          verified_hours: 0,
          status: scheduledHours > 0 ? "needs_review" : "scheduled",
          verified: false,
          notes: rule.notes ?? commercialScheduleSummary([rule]),
          manual_entry: false,
        });
      }
    }
  }

  return [...syncedStored, ...generated].sort((a, b) => `${a.work_date}${a.account_name}`.localeCompare(`${b.work_date}${b.account_name}`));
}

export function getPayableCommercialHours(entry: Pick<CommercialHoursEntryRow, "status" | "verified" | "verified_hours" | "completed_hours" | "scheduled_hours">) {
  if (!(entry.verified || entry.status === "verified" || entry.status === "paid")) return 0;
  return toNumber(entry.verified_hours) || toNumber(entry.completed_hours) || toNumber(entry.scheduled_hours);
}

export function calculateCommercialHoursForPeriod(entries: CommercialHoursEntryRow[]) {
  return entries.reduce((totals, entry) => {
    const scheduled = toNumber(entry.scheduled_hours);
    const completed = toNumber(entry.completed_hours);
    const payable = getPayableCommercialHours(entry);
    return {
      scheduled: roundHours(totals.scheduled + scheduled),
      completed: roundHours(totals.completed + completed),
      verified: roundHours(totals.verified + payable),
      pending: roundHours(totals.pending + (entry.status === "paid" ? 0 : payable)),
      needsReview: totals.needsReview + (entry.status === "needs_review" ? 1 : 0),
      noEligibleService: totals.noEligibleService + (entry.status === "skipped" ? 1 : 0),
    };
  }, { scheduled: 0, completed: 0, verified: 0, pending: 0, needsReview: 0, noEligibleService: 0 });
}

export function commercialHoursStatusFromVerification(status: CommercialHoursStatus, verified: boolean) {
  return status === "paid" || status === "verified" ? true : verified;
}
