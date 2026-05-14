import { createClient } from "@/lib/supabase/client";
import {
  importedCommercialAccounts,
  type ImportedCommercialAccount,
} from "@/lib/commercial-accounts-data";
import {
  generateEntriesForAccount,
  getBiweeklyPeriod,
  isUuid,
  summarizeEntries,
} from "./calculator";
import type {
  CleanerPaymentSetting,
  CommercialAccount,
  CommercialScheduleRule,
  PayrollAdjustmentRow,
  PayrollEntryRow,
  PayrollPeriod,
  PayrollPeriodRow,
} from "./types";

export * from "./calculator";
export type * from "./types";

type SupabaseClient = ReturnType<typeof createClient>;

const LUCIA_REVIEW_SETTING: CleanerPaymentSetting = {
  cleaner_name: "Lucia Portillo",
  default_pay_type: "hourly",
  default_pay_rate: null,
  payment_method: "ACH",
  requires_manual_review: true,
  manual_review_reason: "Confirm final commercial hours before approval.",
  active: true,
};

function normalizeAccountKey(account: Pick<CommercialAccount, "name" | "city">) {
  return `${account.name} ${account.city ?? ""}`.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function toCommercialAccount(account: ImportedCommercialAccount): CommercialAccount {
  return {
    ...account,
    cleaner_pay_type: null,
    cleaner_hourly_rate: null,
    cleaner_flat_rate: null,
  };
}

function mergeCommercialAccounts(remoteAccounts: CommercialAccount[]) {
  const merged = new Map<string, CommercialAccount>();

  for (const imported of importedCommercialAccounts.map(toCommercialAccount)) {
    merged.set(normalizeAccountKey(imported), imported);
  }

  for (const remote of remoteAccounts) {
    const key = normalizeAccountKey(remote);
    const imported = merged.get(key);
    merged.set(key, {
      ...imported,
      ...remote,
      schedule_rules: imported?.schedule_rules ?? remote.schedule_rules ?? [],
      source_sheet: imported?.source_sheet ?? remote.source_sheet ?? null,
    });
  }

  return [...merged.values()].sort((a, b) => `${a.name} ${a.city ?? ""}`.localeCompare(`${b.name} ${b.city ?? ""}`));
}

async function getUserId(supabase: SupabaseClient) {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function fetchCommercialAccounts() {
  const supabase = createClient();
  const { data } = await supabase.from("commercial_accounts").select("*").order("name");
  return mergeCommercialAccounts((data ?? []) as CommercialAccount[]);
}

export async function fetchCleanerPaymentSettings() {
  const supabase = createClient();
  const { data, error } = await supabase.from("cleaner_payment_settings").select("*").order("cleaner_name");
  if (error) return [LUCIA_REVIEW_SETTING];

  const rows = (data ?? []) as CleanerPaymentSetting[];
  const hasLucia = rows.some((row) => row.cleaner_name?.toLowerCase() === "lucia portillo");
  return hasLucia ? rows : [...rows, LUCIA_REVIEW_SETTING];
}

export async function upsertCleanerPaymentSetting(setting: CleanerPaymentSetting) {
  const supabase = createClient();
  const userId = await getUserId(supabase);
  const payload = {
    user_id: userId,
    cleaner_name: setting.cleaner_name,
    cleaner_id: setting.cleaner_id ?? null,
    default_pay_type: setting.default_pay_type ?? "hourly",
    default_pay_rate: setting.default_pay_rate ?? null,
    payment_method: setting.payment_method ?? null,
    requires_manual_review: Boolean(setting.requires_manual_review),
    manual_review_reason: setting.manual_review_reason ?? null,
    review_notes: setting.review_notes ?? null,
    active: setting.active !== false,
  };

  const { data: existing } = await supabase
    .from("cleaner_payment_settings")
    .select("id")
    .eq("cleaner_name", setting.cleaner_name)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase.from("cleaner_payment_settings").update(payload).eq("id", existing.id);
    if (error) throw new Error(error.message);
    return existing.id as string;
  }

  const { data, error } = await supabase.from("cleaner_payment_settings").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function ensureDefaultSettings(accounts: CommercialAccount[]) {
  const existing = await fetchCleanerPaymentSettings();
  const byName = new Set(existing.map((setting) => setting.cleaner_name?.toLowerCase()).filter(Boolean));
  const names = Array.from(new Set(accounts.map((account) => account.cleaner_name).filter(Boolean))) as string[];

  for (const name of names) {
    if (byName.has(name.toLowerCase())) continue;
    try {
      await upsertCleanerPaymentSetting({
        cleaner_name: name,
        default_pay_type: "hourly",
        default_pay_rate: null,
        payment_method: null,
        requires_manual_review: name.toLowerCase() === "lucia portillo",
        manual_review_reason: name.toLowerCase() === "lucia portillo" ? LUCIA_REVIEW_SETTING.manual_review_reason : null,
        active: true,
      });
    } catch {
      // Settings are helpful, but payroll generation can still flag missing settings as exceptions.
    }
  }
}

async function fetchScheduleRules(accounts: CommercialAccount[]) {
  const supabase = createClient();
  const uuidAccountIds = accounts.map((account) => account.id).filter(isUuid);
  const rules: CommercialScheduleRule[] = accounts.flatMap((account) =>
    (account.schedule_rules ?? []).map((rule) => ({ ...rule, commercial_account_id: isUuid(account.id) ? account.id : null })),
  );

  if (uuidAccountIds.length === 0) return rules;

  const { data } = await supabase
    .from("commercial_account_schedule_rules")
    .select("*")
    .in("commercial_account_id", uuidAccountIds)
    .eq("active", true);

  return [...rules, ...((data ?? []) as CommercialScheduleRule[])];
}

function rulesForAccount(account: CommercialAccount, rules: CommercialScheduleRule[]) {
  const importedRules = account.schedule_rules ?? [];
  const dbRules = isUuid(account.id) ? rules.filter((rule) => rule.commercial_account_id === account.id) : [];
  return dbRules.length > 0 ? dbRules : importedRules;
}

async function findExistingPeriod(supabase: SupabaseClient, period: PayrollPeriod) {
  const { data } = await supabase
    .from("commercial_pay_periods")
    .select("*")
    .eq("start_date", period.startDate)
    .eq("end_date", period.endDate)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as PayrollPeriodRow | null;
}

export async function generatePayrollForPeriod(period: PayrollPeriod, options: { userId?: string | null; forceRecalculate?: boolean } = {}) {
  const supabase = createClient();
  const userId = options.userId ?? await getUserId(supabase);
  const accounts = await fetchCommercialAccounts();
  await ensureDefaultSettings(accounts);
  const settings = await fetchCleanerPaymentSettings();
  const scheduleRules = await fetchScheduleRules(accounts);
  const existing = await findExistingPeriod(supabase, period);

  if (existing && ["paid", "locked"].includes(existing.status) && !options.forceRecalculate) {
    throw new Error("This pay period is paid or locked. Confirm before recalculating from current schedules.");
  }

  let periodRow = existing;
  const generatedAt = new Date().toISOString();

  if (!periodRow) {
    const { data, error } = await supabase
      .from("commercial_pay_periods")
      .insert({
        user_id: userId,
        start_date: period.startDate,
        end_date: period.endDate,
        label: period.label,
        status: "draft",
        generated_at: generatedAt,
      })
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Could not create payroll period.");
    periodRow = data as PayrollPeriodRow;
  } else {
    await supabase.from("commercial_payroll_entries").delete().eq("pay_period_id", periodRow.id);
  }

  const entries = accounts.flatMap((account) => generateEntriesForAccount(account, period, settings, rulesForAccount(account, scheduleRules)));
  const summary = summarizeEntries(entries);
  const status = summary.needs_review_count > 0 ? "in_review" : "draft";

  const { error: periodError } = await supabase
    .from("commercial_pay_periods")
    .update({
      label: period.label,
      status,
      generated_at: generatedAt,
      total_estimated_hours: summary.total_estimated_hours,
      total_adjusted_hours: summary.total_adjusted_hours,
      total_estimated_amount: summary.total_estimated_amount,
      total_final_amount: summary.total_final_amount,
      updated_at: generatedAt,
    })
    .eq("id", periodRow.id);

  if (periodError) throw new Error(periodError.message);

  if (entries.length > 0) {
    const { error } = await supabase.from("commercial_payroll_entries").insert(
      entries.map((entry) => ({ ...entry, pay_period_id: periodRow.id })),
    );
    if (error) throw new Error(error.message);
  }

  await supabase.from("payroll_audit_log").insert({
    pay_period_id: periodRow.id,
    entity_type: "pay_period",
    entity_id: periodRow.id,
    action: existing ? "recalculated" : "generated",
    new_value: JSON.stringify({ entries: entries.length, summary }),
    changed_by: userId,
  });

  return { period: { ...periodRow, status }, createdEntries: entries.length, summary };
}

export async function fetchPayrollOverview() {
  const supabase = createClient();
  const [periodsResult, accounts, settings] = await Promise.all([
    supabase.from("commercial_pay_periods").select("*").order("start_date", { ascending: false }).limit(200),
    fetchCommercialAccounts(),
    fetchCleanerPaymentSettings(),
  ]);

  return {
    periods: (periodsResult.data ?? []) as PayrollPeriodRow[],
    accounts,
    settings,
    currentPeriod: getBiweeklyPeriod(),
  };
}

export async function fetchPayrollPeriodDetails(periodId: string) {
  const supabase = createClient();
  const [{ data: period }, { data: entries }, { data: adjustments }] = await Promise.all([
    supabase.from("commercial_pay_periods").select("*").eq("id", periodId).maybeSingle(),
    supabase.from("commercial_payroll_entries").select("*").eq("pay_period_id", periodId).order("cleaner_name").order("service_date"),
    supabase.from("commercial_payroll_adjustments").select("*").eq("pay_period_id", periodId).order("created_at", { ascending: false }),
  ]);

  return {
    period: (period ?? null) as PayrollPeriodRow | null,
    entries: (entries ?? []) as PayrollEntryRow[],
    adjustments: (adjustments ?? []) as PayrollAdjustmentRow[],
  };
}

async function updatePeriodTotals(payPeriodId: string) {
  const supabase = createClient();
  const { data: entries } = await supabase.from("commercial_payroll_entries").select("*").eq("pay_period_id", payPeriodId);
  const summary = summarizeEntries((entries ?? []) as PayrollEntryRow[]);
  await supabase
    .from("commercial_pay_periods")
    .update({
      total_estimated_hours: summary.total_estimated_hours,
      total_adjusted_hours: summary.total_adjusted_hours,
      total_estimated_amount: summary.total_estimated_amount,
      total_final_amount: summary.total_final_amount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payPeriodId);
}

export async function updatePayrollEntry(entry: PayrollEntryRow, changes: Partial<PayrollEntryRow>) {
  const supabase = createClient();
  const userId = await getUserId(supabase);
  const nextAdjustedHours = Number(changes.adjusted_hours ?? entry.adjusted_hours ?? entry.base_hours ?? 0);
  const nextPayRate = Number(changes.pay_rate ?? entry.pay_rate ?? 0);
  const nextAdjustmentAmount = Number(changes.adjustment_amount ?? entry.adjustment_amount ?? 0);
  const finalAmount = Number((nextAdjustedHours * nextPayRate + nextAdjustmentAmount).toFixed(2));
  const payload = {
    ...changes,
    adjusted_hours: nextAdjustedHours,
    pay_rate: nextPayRate,
    final_amount: finalAmount,
    estimated_amount: Number((Number(entry.base_hours ?? 0) * nextPayRate).toFixed(2)),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("commercial_payroll_entries").update(payload).eq("id", entry.id);
  if (error) throw new Error(error.message);

  await supabase.from("payroll_audit_log").insert({
    pay_period_id: entry.pay_period_id,
    entity_type: "payroll_entry",
    entity_id: entry.id,
    action: "updated",
    old_value: JSON.stringify(entry),
    new_value: JSON.stringify(payload),
    changed_by: userId,
  });

  await updatePeriodTotals(entry.pay_period_id);
}

export async function addPayrollAdjustment(entry: PayrollEntryRow, adjustment: { adjustment_type: string; hours_delta: number; amount_delta: number; reason: string; internal_note?: string | null }) {
  const supabase = createClient();
  const userId = await getUserId(supabase);
  const { error } = await supabase.from("commercial_payroll_adjustments").insert({
    pay_period_id: entry.pay_period_id,
    payroll_entry_id: entry.id,
    cleaner_name: entry.cleaner_name,
    account_id: entry.account_id,
    adjustment_type: adjustment.adjustment_type,
    hours_delta: adjustment.hours_delta,
    amount_delta: adjustment.amount_delta,
    reason: adjustment.reason,
    internal_note: adjustment.internal_note ?? null,
    created_by: userId,
  });
  if (error) throw new Error(error.message);

  await updatePayrollEntry(entry, {
    adjusted_hours: Number(entry.adjusted_hours ?? entry.base_hours ?? 0) + adjustment.hours_delta,
    adjustment_amount: Number(entry.adjustment_amount ?? 0) + adjustment.amount_delta,
    status: "needs_review",
    review_notes: adjustment.reason,
  });
}

export async function updateEntryStatus(entry: PayrollEntryRow, status: PayrollEntryRow["status"]) {
  const reviewed = status === "reviewed" || status === "approved" || status === "paid";
  await updatePayrollEntry(entry, {
    status,
    review_status: reviewed ? "reviewed" : entry.review_status,
    reviewed_at: reviewed ? new Date().toISOString() : entry.reviewed_at,
    approved_at: status === "approved" || status === "paid" ? new Date().toISOString() : entry.approved_at,
    paid_at: status === "paid" ? new Date().toISOString() : entry.paid_at,
  });
}

export async function updatePeriodStatus(period: PayrollPeriodRow, status: PayrollPeriodRow["status"], notes?: string | null) {
  const supabase = createClient();
  const userId = await getUserId(supabase);
  const now = new Date().toISOString();
  const payload = {
    status,
    notes: notes ?? period.notes,
    approved_at: status === "approved" ? now : period.approved_at,
    paid_at: status === "paid" ? now : period.paid_at,
    locked_at: status === "locked" ? now : period.locked_at,
    updated_at: now,
  };
  const { error } = await supabase.from("commercial_pay_periods").update(payload).eq("id", period.id);
  if (error) throw new Error(error.message);

  await supabase.from("payroll_audit_log").insert({
    pay_period_id: period.id,
    entity_type: "pay_period",
    entity_id: period.id,
    action: `status:${status}`,
    old_value: JSON.stringify({ status: period.status, notes: period.notes }),
    new_value: JSON.stringify(payload),
    changed_by: userId,
  });
}
