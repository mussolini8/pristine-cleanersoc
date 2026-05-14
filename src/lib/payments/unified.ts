import { createClient } from "@/lib/supabase/client";
import type { PayrollAdjustmentRow, PayrollEntryRow, PayrollPeriodRow } from "@/lib/payroll/types";

export type UnifiedPaymentSource = "legacy_payment" | "manual_extra" | "commercial_payroll" | "commercial_adjustment";
export type UnifiedPaymentCategory = "commercial" | "residential" | "manual" | "other";
export type UnifiedPaymentType = "hourly" | "fixed" | "bonus" | "deduction" | "correction" | "legacy";
export type UnifiedPaymentStatus = "draft" | "needs_review" | "reviewed" | "approved" | "paid" | "locked" | "legacy";

export type UnifiedPayment = {
  id: string;
  sourceType: UnifiedPaymentSource;
  sourceId?: string;
  cleanerName: string;
  cleanerEmail?: string;
  cleanerType?: string;
  accountId?: string;
  accountName?: string;
  category: UnifiedPaymentCategory;
  paymentType: UnifiedPaymentType;
  baseHours?: number;
  adjustedHours?: number;
  payRate?: number;
  adjustmentAmount?: number;
  finalAmount: number;
  status: UnifiedPaymentStatus;
  requiresReview: boolean;
  reviewStatus?: string;
  paymentMethod?: string;
  payPeriodId?: string;
  periodStart?: string;
  periodEnd?: string;
  serviceDate?: string;
  paidAt?: string;
  approvedAt?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  synced?: boolean;
};

export type LegacyPaymentEntryRow = {
  id: string;
  user_id?: string | null;
  cleaner_name: string;
  cleaner_email?: string | null;
  cleaner_type?: string | null;
  month_key: string;
  week_index: number;
  service_date?: string | null;
  city?: string | null;
  residential_amount?: number | null;
  commercial_amount?: number | null;
  payment_amount?: number | null;
  source_type?: string | null;
  source_id?: string | null;
  pay_period_id?: string | null;
  account_id?: string | null;
  account_name?: string | null;
  category?: string | null;
  payment_type?: string | null;
  base_hours?: number | null;
  adjusted_hours?: number | null;
  pay_rate?: number | null;
  adjustment_amount?: number | null;
  final_amount?: number | null;
  status?: string | null;
  requires_review?: boolean | null;
  review_status?: string | null;
  payment_method?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  paid_at?: string | null;
  approved_at?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PaymentExtraUnifiedRow = {
  id: string;
  user_id?: string | null;
  month_key: string;
  week_index: number;
  cleaner?: string | null;
  hours?: number | null;
  amount?: number | null;
  source_type?: string | null;
  source_id?: string | null;
  category?: string | null;
  payment_type?: string | null;
  status?: string | null;
  paid_at?: string | null;
  approved_at?: string | null;
  notes?: string | null;
  payment_method?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function asNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function asStatus(value: string | null | undefined): UnifiedPaymentStatus {
  if (["draft", "needs_review", "reviewed", "approved", "paid", "locked", "legacy"].includes(value ?? "")) {
    return value as UnifiedPaymentStatus;
  }
  return "legacy";
}

function asSource(value: string | null | undefined, fallback: UnifiedPaymentSource): UnifiedPaymentSource {
  if (["legacy_payment", "manual_extra", "commercial_payroll", "commercial_adjustment"].includes(value ?? "")) {
    return value as UnifiedPaymentSource;
  }
  return fallback;
}

function asCategory(value: string | null | undefined, fallback: UnifiedPaymentCategory): UnifiedPaymentCategory {
  if (["commercial", "residential", "manual", "other"].includes(value ?? "")) return value as UnifiedPaymentCategory;
  return fallback;
}

function asPaymentType(value: string | null | undefined, fallback: UnifiedPaymentType): UnifiedPaymentType {
  if (["hourly", "fixed", "bonus", "deduction", "correction", "legacy"].includes(value ?? "")) return value as UnifiedPaymentType;
  return fallback;
}

function inferLegacyCategory(row: LegacyPaymentEntryRow): UnifiedPaymentCategory {
  if (row.category) return asCategory(row.category, "other");
  if (asNumber(row.commercial_amount) > 0 && asNumber(row.residential_amount) === 0) return "commercial";
  if (asNumber(row.residential_amount) > 0 && asNumber(row.commercial_amount) === 0) return "residential";
  if (asNumber(row.payment_amount) > 0) return row.cleaner_type === "residential" ? "residential" : "manual";
  return "other";
}

export function normalizePaymentEntry(row: LegacyPaymentEntryRow): UnifiedPayment {
  const sourceType = asSource(row.source_type, "legacy_payment");
  const fallbackAmount = asNumber(row.payment_amount) || asNumber(row.residential_amount) + asNumber(row.commercial_amount);
  const finalAmount = row.final_amount === null || row.final_amount === undefined ? fallbackAmount : asNumber(row.final_amount);
  const category = asCategory(row.category, sourceType === "commercial_payroll" ? "commercial" : inferLegacyCategory(row));
  const status = row.status ? asStatus(row.status) : "legacy";

  return {
    id: row.id,
    sourceType,
    sourceId: row.source_id ?? undefined,
    cleanerName: row.cleaner_name || "Unassigned",
    cleanerEmail: row.cleaner_email ?? undefined,
    cleanerType: row.cleaner_type ?? undefined,
    accountId: row.account_id ?? undefined,
    accountName: row.account_name ?? undefined,
    category,
    paymentType: asPaymentType(row.payment_type, sourceType === "commercial_payroll" ? "hourly" : "legacy"),
    baseHours: row.base_hours ?? undefined,
    adjustedHours: row.adjusted_hours ?? undefined,
    payRate: row.pay_rate ?? undefined,
    adjustmentAmount: row.adjustment_amount ?? undefined,
    finalAmount,
    status,
    requiresReview: Boolean(row.requires_review || status === "needs_review"),
    reviewStatus: row.review_status ?? undefined,
    paymentMethod: row.payment_method ?? undefined,
    payPeriodId: row.pay_period_id ?? undefined,
    periodStart: row.period_start ?? undefined,
    periodEnd: row.period_end ?? undefined,
    serviceDate: row.service_date ?? undefined,
    paidAt: row.paid_at ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    synced: sourceType !== "legacy_payment",
  };
}

export function normalizePaymentExtra(row: PaymentExtraUnifiedRow): UnifiedPayment {
  const finalAmount = asNumber(row.amount);
  return {
    id: row.id,
    sourceType: asSource(row.source_type, "manual_extra"),
    sourceId: row.source_id ?? undefined,
    cleanerName: row.cleaner || "Manual extra",
    category: asCategory(row.category, "manual"),
    paymentType: asPaymentType(row.payment_type, "bonus"),
    adjustedHours: row.hours ?? undefined,
    finalAmount,
    status: row.status ? asStatus(row.status) : "legacy",
    requiresReview: false,
    paymentMethod: row.payment_method ?? undefined,
    periodStart: row.month_key,
    periodEnd: row.month_key,
    paidAt: row.paid_at ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

export function normalizeCommercialPayrollEntry(entry: PayrollEntryRow, period?: PayrollPeriodRow | null): UnifiedPayment {
  return {
    id: entry.id,
    sourceType: "commercial_payroll",
    sourceId: entry.id,
    cleanerName: entry.cleaner_name ?? "Unassigned",
    accountId: entry.account_id ?? undefined,
    accountName: entry.account_name,
    category: "commercial",
    paymentType: "hourly",
    baseHours: entry.base_hours,
    adjustedHours: entry.adjusted_hours,
    payRate: entry.pay_rate,
    adjustmentAmount: entry.adjustment_amount,
    finalAmount: entry.final_amount,
    status: asStatus(entry.status),
    requiresReview: Boolean(entry.requires_manual_review || entry.status === "needs_review"),
    reviewStatus: entry.review_status,
    paymentMethod: entry.payment_method ?? undefined,
    payPeriodId: entry.pay_period_id,
    periodStart: period?.start_date,
    periodEnd: period?.end_date,
    serviceDate: entry.service_date ?? undefined,
    paidAt: entry.paid_at ?? undefined,
    approvedAt: entry.approved_at ?? undefined,
    notes: entry.notes ?? entry.review_notes ?? undefined,
    createdAt: entry.created_at,
    updatedAt: entry.updated_at,
    synced: true,
  };
}

export function normalizeCommercialAdjustment(row: PayrollAdjustmentRow): UnifiedPayment {
  const amount = asNumber(row.amount_delta);
  return {
    id: row.id,
    sourceType: "commercial_adjustment",
    sourceId: row.payroll_entry_id ?? row.id,
    cleanerName: row.cleaner_name ?? "Unassigned",
    accountId: row.account_id ?? undefined,
    category: "commercial",
    paymentType: amount < 0 ? "deduction" : "correction",
    adjustedHours: row.hours_delta ?? undefined,
    adjustmentAmount: amount,
    finalAmount: amount,
    status: "needs_review",
    requiresReview: true,
    payPeriodId: row.pay_period_id,
    notes: row.reason ?? row.internal_note ?? undefined,
    createdAt: row.created_at,
  };
}

export async function syncCommercialPayrollEntryToPayment(entry: PayrollEntryRow, period: PayrollPeriodRow) {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;
  const now = new Date().toISOString();
  const payload = {
    user_id: userId,
    cleaner_name: entry.cleaner_name ?? "Unassigned",
    cleaner_email: null,
    cleaner_type: "commercial",
    month_key: period.start_date.slice(0, 7),
    week_index: 0,
    service_date: entry.service_date,
    city: entry.city,
    residential_amount: 0,
    commercial_amount: entry.final_amount ?? entry.estimated_amount ?? 0,
    payment_amount: entry.final_amount ?? entry.estimated_amount ?? 0,
    source_type: "commercial_payroll",
    source_id: entry.id,
    pay_period_id: entry.pay_period_id,
    account_id: entry.account_id,
    account_name: entry.account_name,
    category: "commercial",
    payment_type: "hourly",
    base_hours: entry.base_hours,
    adjusted_hours: entry.adjusted_hours,
    pay_rate: entry.pay_rate,
    adjustment_amount: entry.adjustment_amount,
    final_amount: entry.final_amount,
    status: entry.status,
    requires_review: entry.requires_manual_review,
    review_status: entry.review_status,
    payment_method: entry.payment_method,
    period_start: period.start_date,
    period_end: period.end_date,
    paid_at: entry.paid_at,
    approved_at: entry.approved_at,
    notes: entry.notes ?? entry.review_notes,
    updated_at: now,
  };

  const { data: bySource } = await supabase
    .from("payment_entries")
    .select("id,status")
    .eq("source_type", "commercial_payroll")
    .eq("source_id", entry.id)
    .maybeSingle();

  let byNaturalKey: { id: string; status: string | null } | null = null;
  if (!bySource) {
    let naturalQuery = supabase
      .from("payment_entries")
      .select("id,status")
      .eq("source_type", "commercial_payroll")
      .eq("pay_period_id", entry.pay_period_id)
      .eq("cleaner_name", entry.cleaner_name ?? "Unassigned")
      .eq("account_name", entry.account_name);
    naturalQuery = entry.service_date ? naturalQuery.eq("service_date", entry.service_date) : naturalQuery.is("service_date", null);
    const { data } = await naturalQuery.maybeSingle();
    byNaturalKey = data as { id: string; status: string | null } | null;
  }

  const existing = bySource ?? byNaturalKey;
  if (existing?.id) {
    if (["paid", "locked"].includes(String(existing.status))) {
      await supabase.from("payroll_audit_log").insert({
        pay_period_id: entry.pay_period_id,
        entity_type: "payment_entry",
        entity_id: existing.id,
        action: "payment_sync_skipped_paid",
        new_value: JSON.stringify({ payroll_entry_id: entry.id, final_amount: entry.final_amount }),
        changed_by: userId,
      });
      return { id: existing.id as string, skipped: true };
    }

    const { error } = await supabase.from("payment_entries").update(payload).eq("id", existing.id);
    if (error) throw new Error(error.message);
    await supabase.from("payroll_audit_log").insert({
      pay_period_id: entry.pay_period_id,
      entity_type: "payment_entry",
      entity_id: existing.id,
      action: "payment_updated_from_payroll",
      new_value: JSON.stringify(payload),
      changed_by: userId,
    });
    return { id: existing.id as string, skipped: false };
  }

  const { data, error } = await supabase.from("payment_entries").insert({ ...payload, created_at: now }).select("id").single();
  if (error) throw new Error(error.message);
  await supabase.from("payroll_audit_log").insert({
    pay_period_id: entry.pay_period_id,
    entity_type: "payment_entry",
    entity_id: data.id,
    action: "payment_generated_from_payroll",
    new_value: JSON.stringify(payload),
    changed_by: userId,
  });
  return { id: data.id as string, skipped: false };
}

export async function syncCommercialPayrollPeriodToPayments(periodId: string) {
  const supabase = createClient();
  const [{ data: period }, { data: entries }] = await Promise.all([
    supabase.from("commercial_pay_periods").select("*").eq("id", periodId).maybeSingle(),
    supabase.from("commercial_payroll_entries").select("*").eq("pay_period_id", periodId),
  ]);
  if (!period) throw new Error("Payroll period not found.");

  const results = [];
  for (const entry of (entries ?? []) as PayrollEntryRow[]) {
    results.push(await syncCommercialPayrollEntryToPayment(entry, period as PayrollPeriodRow));
  }
  return results;
}

export async function markUnifiedPaymentPaid(paymentId: string) {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;
  const now = new Date().toISOString();
  const { data: payment, error: paymentError } = await supabase
    .from("payment_entries")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();

  if (paymentError || !payment) throw new Error(paymentError?.message ?? "Payment not found.");
  if (payment.requires_review && payment.review_status !== "reviewed" && payment.status === "needs_review") {
    throw new Error("Review hours before marking this payment as paid.");
  }

  const { error } = await supabase.from("payment_entries").update({ status: "paid", paid_at: now, updated_at: now }).eq("id", paymentId);
  if (error) throw new Error(error.message);

  if (payment.source_type === "commercial_payroll" && payment.source_id) {
    const { data: updatedEntry } = await supabase
      .from("commercial_payroll_entries")
      .update({ status: "paid", paid_at: now, updated_at: now })
      .eq("id", payment.source_id)
      .select("pay_period_id")
      .maybeSingle();

    const payPeriodId = updatedEntry?.pay_period_id ?? payment.pay_period_id;
    if (payPeriodId) {
      const { data: periodEntries } = await supabase
        .from("commercial_payroll_entries")
        .select("status")
        .eq("pay_period_id", payPeriodId);
      const allPaid = (periodEntries ?? []).length > 0 && (periodEntries ?? []).every((entry) => entry.status === "paid");
      if (allPaid) {
        await supabase.from("commercial_pay_periods").update({ status: "paid", paid_at: now, updated_at: now }).eq("id", payPeriodId);
      }
      await supabase.from("payroll_audit_log").insert({
        pay_period_id: payPeriodId,
        entity_type: "payment_entry",
        entity_id: paymentId,
        action: "payment_marked_paid",
        old_value: JSON.stringify({ status: payment.status, paid_at: payment.paid_at }),
        new_value: JSON.stringify({ status: "paid", paid_at: now }),
        changed_by: userId,
      });
    }
  }
}
