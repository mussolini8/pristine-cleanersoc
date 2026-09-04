"use client";

import Link from "next/link";
import { type FormEvent, useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  importedCommercialAccounts,
  type ImportedCommercialAccount,
} from "@/lib/commercial-accounts-data";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { PieLabelRenderProps } from "recharts";
import {
  Building2,
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Edit2,
  Key,
  Package,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { applyCommercialAccountChangesGoingForward } from "@/lib/payroll";
import { displayDate } from "@/lib/dates/periods";
import { AiSopCopilotModal } from "@/components/operations/ai-sop-copilot-modal";

// ─────────────────────────────────────────────
type Account = {
  id: string;
  name: string;
  city: string | null;
  pricing_model: string | null;
  cleaner_name: string | null;
  hours: number | string | null;
  frequency: string | null;
  revenue: number | null;
  cost: number | null;
  cleaner_pay_type?: "hourly" | "flat" | null;
  cleaner_hourly_rate?: number | null;
  cleaner_flat_rate?: number | null;
  rate_per_service?: number | null;
  payment_method: string | null;
  contract_start: string | null;
  contract_end: string | null;
  last_qcc_date: string | null;
  last_contact_date: string | null;
  net_price_per_booking?: number | null;
  monthly_gross_profit?: number | null;
  qc_monthly_cost?: number | null;
  has_supplies: boolean;
  has_keys: boolean;
  supply_delivery_date?: string | null;
  estimated_fill_date?: string | null;
  supplies_notes: string | null;
  source_sheet?: string | null;
};

type CleanerChartDatum = {
  name: string;
  value: number;
  pct: string;
};

type AccountDraft = Omit<Account, "id">;

type AccountFormMode = "create" | "edit";

type ScheduleFrequencyType = "weekly" | "biweekly" | "monthly" | "custom";

type ScheduleRule = {
  id?: string;
  commercial_account_id?: string | null;
  day_of_week: number;
  selected_days?: number[];
  start_time?: string | null;
  end_time?: string | null;
  paid_hours: number | string | null;
  assigned_cleaner_name?: string | null;
  frequency_type?: ScheduleFrequencyType | null;
  frequency_interval?: number | string | null;
  anchor_date?: string | null;
  effective_start_date?: string | null;
  effective_end_date?: string | null;
  active?: boolean | null;
  notes?: string | null;
};

const CLEANERS = [
  "", "Juan Romero", "Sandra Hernandez", "Lorena Benitez", "Luz Uribe",
  "Susana Bautista", "Mirna Contreras", "Esperanza Youseff", "Ana Morales", "Maria Lopez",
  "Emmi Guerra", "Lucia Portillo", "Kassandra Valentin", "Vanessa Ortega", "Luz and Vanessa",
];

const PRICING_MODELS = ["Monthly", "Biweekly", "Weekly", "Per Service", "Variable", "One Time"] as const;

const FREQUENCIES = [
  "Daily (7x/week)", "6x per week", "5x per week", "4x per week",
  "3x per week", "2x per week", "Weekly", "Every 2 weeks", "Every 3 weeks",
  "Monthly", "As needed", "One Time",
] as const;

const PIE_COLORS = [
  "#437d65", "#2563eb", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#10b981", "#f97316", "#e11d48", "#64748b", "#a21caf",
];

const DAY_OPTIONS = [
  ["0", "Sunday"],
  ["1", "Monday"],
  ["2", "Tuesday"],
  ["3", "Wednesday"],
  ["4", "Thursday"],
  ["5", "Friday"],
  ["6", "Saturday"],
] as const;

function getVisitsPerMonth(frequency: string | null | undefined): number {
  if (!frequency) return 4.33;
  const f = frequency.toLowerCase();
  if (f.includes("7x") || f.includes("daily")) return 30.4;
  if (f.includes("6x")) return 26;
  if (f.includes("5x")) return 21.67;
  if (f.includes("4x")) return 17.33;
  if (f.includes("3x")) return 13;
  if (f.includes("2x") || f.includes("twice")) return 8.66;
  if (f.includes("biweekly") || f.includes("every 2 weeks") || f.includes("every two weeks")) return 2.17;
  if (f.includes("every 3 weeks")) return 1.44;
  if (f.includes("monthly") || f.includes("1x month")) return 1;
  if (f.includes("weekly") || f.includes("1x week")) return 4.33;
  return 4.33;
}

function emptyAccountDraft(): AccountDraft {
  return {
    name: "",
    city: "",
    pricing_model: "Monthly",
    cleaner_name: null,
    hours: null,
    frequency: "Weekly",
    revenue: null,
    cost: null,
    rate_per_service: null,
    cleaner_pay_type: "flat",
    cleaner_hourly_rate: null,
    cleaner_flat_rate: null,
    net_price_per_booking: null,
    monthly_gross_profit: null,
    payment_method: "ACH",
    contract_start: "",
    contract_end: "",
    last_contact_date: "",
    last_qcc_date: "",
    qc_monthly_cost: null,
    supply_delivery_date: "",
    estimated_fill_date: "",
    has_supplies: false,
    has_keys: false,
    supplies_notes: "",
  };
}

function accountToDraft(account: Account): AccountDraft {
  return {
    name: account.name ?? "",
    city: account.city ?? "",
    pricing_model: account.pricing_model ?? "Monthly",
    cleaner_name: account.cleaner_name ?? null,
    hours: account.hours ?? null,
    frequency: account.frequency ?? "Weekly",
    revenue: account.revenue ?? null,
    cost: account.cost ?? null,
    rate_per_service: account.rate_per_service ?? account.cleaner_flat_rate ?? null,
    cleaner_pay_type: account.cleaner_pay_type ?? "flat",
    cleaner_hourly_rate: account.cleaner_hourly_rate ?? null,
    cleaner_flat_rate: account.cleaner_flat_rate ?? null,
    net_price_per_booking: account.net_price_per_booking ?? null,
    monthly_gross_profit: account.monthly_gross_profit ?? null,
    payment_method: account.payment_method ?? "ACH",
    contract_start: account.contract_start ?? "",
    contract_end: account.contract_end ?? "",
    last_contact_date: account.last_contact_date ?? "",
    last_qcc_date: account.last_qcc_date ?? "",
    qc_monthly_cost: account.qc_monthly_cost ?? null,
    supply_delivery_date: account.supply_delivery_date ?? "",
    estimated_fill_date: account.estimated_fill_date ?? "",
    has_supplies: Boolean(account.has_supplies),
    has_keys: Boolean(account.has_keys),
    supplies_notes: account.supplies_notes ?? "",
    source_sheet: account.source_sheet,
  };
}

function dateOrNull(value: string | null) {
  return value?.trim() ? value : null;
}

function textOrNull(value: string | null) {
  return value?.trim() ? value.trim() : null;
}

function numberOrNull(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseDateStr(value: any): string | null {
  if (typeof value !== "string" || !value) return null;
  const reg = /^\d{4}-\d{2}-\d{2}$/;
  return reg.test(value) ? value : null;
}

function isPersistedAccount(account: Pick<Account, "id"> | null | undefined) {
  return Boolean(account?.id && !account.id.startsWith("import-"));
}

// displayDate is imported from periods utility

function numericHours(value: Account["hours"]) {
  return typeof value === "number" ? value : Number(value) || 0;
}

function getRealCost(account: Pick<Account, "cost" | "hours" | "cleaner_pay_type" | "cleaner_hourly_rate" | "cleaner_flat_rate" | "rate_per_service" | "frequency">) {
  const visits = getVisitsPerMonth(account.frequency);
  const perServiceRate = account.rate_per_service ?? account.cleaner_flat_rate;
  if (perServiceRate !== null && perServiceRate !== undefined && perServiceRate > 0) {
    return Number((perServiceRate * visits).toFixed(2));
  }
  if (account.cleaner_pay_type === "hourly" && account.cleaner_hourly_rate !== null && account.cleaner_hourly_rate !== undefined) {
    return Number((numericHours(account.hours) * account.cleaner_hourly_rate * visits).toFixed(2));
  }
  return account.cost ?? 0;
}

function normalizeAccountKey(account: Pick<Account, "name" | "city">) {
  const city = !account.city || account.city.toLowerCase() === "unknown" ? "" : account.city;
  return `${account.name} ${city}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function toAccount(account: ImportedCommercialAccount): Account {
  const norm = account.name.toLowerCase().trim();
  const isNonHourly = [
    "green leaf",
    "green leaf botanicals",
    "mama's restaurant",
    "mamas restaurant",
    "globar",
    "glo bar",
    "the harper",
  ].some((name) => norm.includes(name));

  const hasPerServiceRate = typeof account.rate_per_service === "number";

  return {
    ...account,
    rate_per_service: account.rate_per_service ?? null,
    cleaner_pay_type: hasPerServiceRate || isNonHourly ? "flat" : "hourly",
    cleaner_hourly_rate: hasPerServiceRate || isNonHourly ? null : 18,
    cleaner_flat_rate: account.rate_per_service ?? (isNonHourly ? (account.cost ?? null) : null),
  };
}

function mergeImportedAccounts(remoteAccounts: Account[]) {
  const importedMap = new Map<string, Account>();
  for (const imported of importedCommercialAccounts.map(toAccount)) {
    importedMap.set(normalizeAccountKey(imported), imported);
  }

  let localCustomAccounts: Account[] = [];
  try {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("pristine_commercial_accounts");
      if (stored) localCustomAccounts = JSON.parse(stored);
    }
  } catch (e) {
    console.warn("Could not read local commercial accounts:", e);
  }

  const merged: Account[] = [];
  const seenKeys = new Set<string>();

  for (const remote of remoteAccounts) {
    const key = normalizeAccountKey(remote);
    seenKeys.add(key);
    const imported = importedMap.get(key);
    merged.push({
      ...imported,
      ...remote,
      rate_per_service: remote.rate_per_service ?? imported?.rate_per_service ?? null,
      cleaner_flat_rate: remote.cleaner_flat_rate ?? remote.rate_per_service ?? imported?.cleaner_flat_rate ?? null,
      supply_delivery_date: remote.supply_delivery_date ?? imported?.supply_delivery_date ?? null,
      estimated_fill_date: remote.estimated_fill_date ?? imported?.estimated_fill_date ?? null,
      source_sheet: remote.source_sheet ?? imported?.source_sheet ?? "Manual entry",
      supplies_notes: remote.supplies_notes ?? imported?.supplies_notes ?? null,
      cleaner_pay_type: remote.cleaner_pay_type ?? imported?.cleaner_pay_type ?? null,
      cleaner_hourly_rate: remote.cleaner_hourly_rate ?? imported?.cleaner_hourly_rate ?? null,
      net_price_per_booking: remote.net_price_per_booking ?? null,
      monthly_gross_profit: remote.monthly_gross_profit ?? null,
      qc_monthly_cost: remote.qc_monthly_cost ?? null,
    });
  }

  // Include any local custom accounts that are not in remote yet
  for (const localAcc of localCustomAccounts) {
    const key = normalizeAccountKey(localAcc);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      merged.push(localAcc);
    }
  }

  // Include all imported commercial accounts from CleanGuru not yet present in remote
  for (const [key, imported] of importedMap) {
    if (!seenKeys.has(key)) {
      merged.push(imported);
    }
  }

  return merged.sort((a, b) =>
    `${a.name} ${a.city ?? ""}`.localeCompare(`${b.name} ${b.city ?? ""}`),
  );
}

// ─────────────────────────────────────────────
function Pill({ yes }: { yes: boolean }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "2px 10px",
      borderRadius: 99, fontSize: "0.72rem", fontWeight: 700,
      background: yes ? "hsl(142 76% 36% / .15)" : "hsl(0 84% 60% / .12)",
      color: yes ? "hsl(142 76% 30%)" : "hsl(0 84% 50%)",
    }}>
      {yes ? "Yes" : "No"}
    </span>
  );
}

// ─────────────────────────────────────────────
function AccountRow({ acc, onEdit, onDelete }: { acc: Account; onEdit: (account: Account) => void; onDelete: (account: Account) => void }) {
  const [expanded, setExpanded] = useState(false);

  const realCost = getRealCost(acc);
  const profit = (acc.revenue ?? 0) - realCost;

  return (
    <>
      <tr className="acc-row">
        {/* Account */}
        <td className="acc-cell">
          <div className="account-cell-content">
            <button className="expand-btn" onClick={() => setExpanded(!expanded)} aria-label={expanded ? "Collapse account details" : "Expand account details"}>
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            <div className="account-primary">
              <span className="acc-name">{acc.name}</span>
              <span className="acc-city-badge">{acc.city ?? "No city"}</span>
            </div>
          </div>
        </td>

        {/* Cleaner */}
        <td className="acc-cell">
          <span className="cleaner-name-cell">
            <strong>{acc.cleaner_name ?? "Unassigned"}</strong>
            <span>{acc.frequency ?? "No frequency"}</span>
            {acc.rate_per_service ? (
              <span style={{ fontSize: "0.74rem", color: "hsl(142 76% 36%)", fontWeight: 700, marginTop: 2, display: "inline-block" }}>
                ${Number(acc.rate_per_service).toFixed(2)} / serv
              </span>
            ) : acc.cleaner_flat_rate ? (
              <span style={{ fontSize: "0.74rem", color: "hsl(142 76% 36%)", fontWeight: 700, marginTop: 2, display: "inline-block" }}>
                ${Number(acc.cleaner_flat_rate).toFixed(2)} / serv
              </span>
            ) : null}
          </span>
        </td>

        {/* Supplies */}
        <td className="acc-cell" style={{ textAlign: "center" }}>
          <Pill yes={acc.has_supplies} />
        </td>

        {/* Delivery date */}
        <td className="acc-cell">
          <span className="date-text">{displayDate(acc.supply_delivery_date ?? null)}</span>
        </td>

        {/* Estimated fill */}
        <td className="acc-cell">
          <span className="date-text">{acc.estimated_fill_date ?? "—"}</span>
        </td>

        {/* Keys */}
        <td className="acc-cell" style={{ textAlign: "center" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                {acc.has_keys && <Key size={12} style={{ color: "hsl(142 76% 36%)" }} />}
                <Pill yes={acc.has_keys} />
              </span>
        </td>

        {/* Last QC Check */}
        <td className="acc-cell">
          <span className="date-text">{displayDate(acc.last_qcc_date)}</span>
        </td>

        {/* Notes */}
        <td className="acc-cell" style={{ maxWidth: 160 }}>
          <div style={{ fontSize: "0.74rem", color: "hsl(var(--muted-foreground))", fontStyle: "italic", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={acc.supplies_notes ?? ""}>{acc.supplies_notes ?? ""}</div>
        </td>

        {/* Revenue / Cost / Profit */}
        <td className="acc-cell" style={{ textAlign: "right" }}>
          <span style={{ fontWeight: 700 }}>${(acc.revenue ?? 0).toFixed(2)}</span>
        </td>
        <td className="acc-cell" style={{ textAlign: "right", color: "hsl(var(--muted-foreground))" }}>
          ${realCost.toFixed(2)}
        </td>
        <td className="acc-cell" style={{ textAlign: "right", fontWeight: 700,
          color: profit >= 0 ? "hsl(142 76% 30%)" : "hsl(0 84% 50%)" }}>
          ${profit.toFixed(2)}
        </td>

        {/* Actions */}
        <td className="acc-cell" style={{ width: 80 }}>
          <div className="row-actions">
            <button className="action-btn edit-btn" onClick={() => onEdit(acc)} aria-label="Edit account">
              <Edit2 size={13} />
            </button>
            <button className="action-btn delete-btn" onClick={() => onDelete(acc)} aria-label="Delete account">
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr style={{ background: "hsl(var(--muted)/.3)", borderBottom: "2px solid hsl(var(--primary)/.3)" }}>
          <td colSpan={12}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, padding: "14px 20px" }}>
              {[
                ["Pricing Model", acc.pricing_model],
                ["Hours", acc.hours],
                ["Cleaner Pay", acc.cleaner_pay_type === "hourly" ? `$${acc.cleaner_hourly_rate ?? 0}/hr` : acc.cleaner_pay_type === "flat" ? `$${acc.cleaner_flat_rate ?? 0} flat` : "Legacy cost"],
                ["Labor / Service (w/ Ins)", acc.rate_per_service ? `$${Number(acc.rate_per_service).toFixed(2)}` : (acc.cleaner_flat_rate ? `$${Number(acc.cleaner_flat_rate).toFixed(2)}` : "—")],
                ["Frequency", acc.frequency],
                ["Payment Method", acc.payment_method],
                ["Last Contact", displayDate(acc.last_contact_date)],
                ["Contract Start", displayDate(acc.contract_start)],
                ["Contract End", displayDate(acc.contract_end)],
                ["Source", acc.source_sheet],
              ].map(([label, val]) => (
                <div key={String(label)} style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 120 }}>
                  <span style={{ fontSize: "0.64rem", fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: ".05em", color: "hsl(var(--muted-foreground))" }}>{label}</span>
                  <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>{val ?? "—"}</span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}


function scheduleRuleSummary(rule: ScheduleRule) {
  const selectedDays = rule.selected_days?.length ? rule.selected_days : [Number(rule.day_of_week)];
  const dayLabels = selectedDays
    .map((day) => DAY_OPTIONS.find(([value]) => Number(value) === day)?.[1])
    .filter(Boolean)
    .join(", ");
  const interval = numberOrNull(rule.frequency_interval) ?? (rule.frequency_type === "biweekly" ? 2 : 1);
  const cadence = interval <= 1 ? "Every week" : `Every ${interval} weeks`;
  const hours = numberOrNull(rule.paid_hours) ?? 0;
  const cleaner = rule.assigned_cleaner_name || "account cleaner";
  return `${cadence} on ${dayLabels || "no days selected"} · ${hours || "No"} paid hours · ${cleaner}`;
}
function emptyScheduleRule(accountId: string): ScheduleRule {
  return {
    commercial_account_id: accountId,
    day_of_week: 1,
    selected_days: [1],
    paid_hours: 0,
    start_time: null,
    end_time: null,
    assigned_cleaner_name: null,
    frequency_type: "weekly",
    frequency_interval: 1,
    anchor_date: null,
    effective_start_date: null,
    effective_end_date: null,
    active: true,
  };
}

function ScheduleRulesEditor({ account }: { account: Account }) {
  const supabase = useMemo(() => createClient(), []);
  const [rules, setRules] = useState<ScheduleRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);
  const [savingRules, setSavingRules] = useState(false);
  const [rulesMessage, setRulesMessage] = useState<string | null>(null);
  const [deletedRuleIds, setDeletedRuleIds] = useState<string[]>([]);

  useEffect(() => {
    setDeletedRuleIds([]);
    let mounted = true;
    async function loadRules() {
      setLoadingRules(true);
      const { data, error } = await supabase
        .from("commercial_account_schedule_rules")
        .select("*")
        .eq("commercial_account_id", account.id)
        .order("day_of_week");

      if (!mounted) return;
      if (error) {
        setRulesMessage(error.message);
        setRules([]);
      } else {
        setRules(((data ?? []) as ScheduleRule[]).map((rule) => ({
          ...rule,
          selected_days: [Number(rule.day_of_week)],
          frequency_type: rule.frequency_type ?? "weekly",
          frequency_interval: rule.frequency_interval ?? (rule.frequency_type === "biweekly" ? 2 : 1),
        })));
      }
      setLoadingRules(false);
    }

    loadRules();
    return () => { mounted = false; };
  }, [account.id, supabase]);

  function updateRule(index: number, patch: Partial<ScheduleRule>) {
    setRules((current) => current.map((rule, ruleIndex) => {
      if (ruleIndex !== index) return rule;
      const next = { ...rule, ...patch };
      if (patch.frequency_type === "biweekly") next.frequency_interval = 2;
      if (patch.frequency_type === "weekly" && !next.frequency_interval) next.frequency_interval = 1;
      if (patch.frequency_type === "custom" && !next.frequency_interval) next.frequency_interval = 3;
      return next;
    }));
  }

  function deleteRule(index: number) {
    const rule = rules[index];
    if (rule.id) {
      setDeletedRuleIds((prev) => [...prev, rule.id!]);
    }
    setRules((current) => current.filter((_, ruleIndex) => ruleIndex !== index));
  }

  async function saveRules() {
    setSavingRules(true);
    setRulesMessage(null);

    const validationErrors: string[] = [];
    for (const rule of rules) {
      const selectedDays = rule.selected_days?.length ? rule.selected_days : [Number(rule.day_of_week)];
      const interval = numberOrNull(rule.frequency_interval) ?? (rule.frequency_type === "biweekly" ? 2 : 1);
      const paidHours = numberOrNull(rule.paid_hours) ?? 0;
      if (selectedDays.length === 0) validationErrors.push("Select at least one cleaning day for every active schedule rule.");
      if (interval <= 0) validationErrors.push("Frequency interval must be greater than zero.");
      if (interval > 1 && !dateOrNull(rule.anchor_date ?? null)) validationErrors.push("Anchor date is required for every 2 weeks, every 3 weeks, or custom intervals.");
      if (paidHours <= 0) validationErrors.push("Paid hours must be greater than zero so payroll can calculate the amount.");
      if (rule.start_time && rule.end_time && rule.end_time <= rule.start_time) validationErrors.push("End time must be after start time.");
    }

    if (validationErrors.length > 0) {
      setSavingRules(false);
      setRulesMessage(Array.from(new Set(validationErrors)).join(" "));
      return;
    }

    const baseFields = (day: number, rule: ScheduleRule) => ({
      commercial_account_id: account.id,
      day_of_week: day,
      paid_hours: numberOrNull(rule.paid_hours) ?? 0,
      start_time: dateOrNull(rule.start_time ?? null),
      end_time: dateOrNull(rule.end_time ?? null),
      assigned_cleaner_name: textOrNull(rule.assigned_cleaner_name ?? null),
      frequency_type: rule.frequency_type ?? "weekly",
      frequency_interval: numberOrNull(rule.frequency_interval) ?? (rule.frequency_type === "biweekly" ? 2 : 1),
      anchor_date: dateOrNull(rule.anchor_date ?? null),
      effective_start_date: dateOrNull(rule.effective_start_date ?? null),
      effective_end_date: dateOrNull(rule.effective_end_date ?? null),
      active: rule.active !== false,
      notes: textOrNull(rule.notes ?? null),
      updated_at: new Date().toISOString(),
    });

    const newRows: ReturnType<typeof baseFields>[] = [];
    const existingRows: (ReturnType<typeof baseFields> & { id: string })[] = [];

    for (const rule of rules) {
      const selectedDays = rule.selected_days?.length ? rule.selected_days : [Number(rule.day_of_week)];
      selectedDays.forEach((day, dayIndex) => {
        const fields = baseFields(day, rule);
        if (rule.id && dayIndex === 0) {
          existingRows.push({ id: rule.id, ...fields });
        } else {
          newRows.push(fields);
        }
      });
    }

    if (deletedRuleIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("commercial_account_schedule_rules")
        .delete()
        .in("id", deletedRuleIds);
      if (deleteError) {
        setSavingRules(false);
        setRulesMessage(deleteError.message);
        return;
      }
    }

    await supabase
      .from("commercial_account_schedule_rules")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("commercial_account_id", account.id);

    let error: { message: string } | null = null;

    if (existingRows.length > 0) {
      const { error: upsertError } = await supabase
        .from("commercial_account_schedule_rules")
        .upsert(existingRows, { onConflict: "id" });
      if (upsertError) error = upsertError;
    }

    if (!error && newRows.length > 0) {
      const { error: insertError } = await supabase
        .from("commercial_account_schedule_rules")
        .insert(newRows);
      if (insertError) error = insertError;
    }

    const { data } = await supabase
      .from("commercial_account_schedule_rules")
      .select("*")
      .eq("commercial_account_id", account.id)
      .eq("active", true)
      .order("day_of_week");

    setSavingRules(false);
    if (error) {
      setRulesMessage(error.message);
      return;
    }

    setDeletedRuleIds([]);
    setRules(((data ?? []) as ScheduleRule[]).map((rule) => ({ ...rule, selected_days: [Number(rule.day_of_week)] })));
    setRulesMessage("Schedule pay rules saved. Existing approved, paid, and locked payroll stays untouched.");
  }

  return (
    <div className="schedule-editor">
      <div className="studio-section-title"><CalendarCheck size={15} /> Schedule pay rules</div>
      <div className="payroll-impact">Schedule rules feed future commercial payroll only. Paid, approved, locked, and closed periods stay protected.</div>
      {loadingRules ? <p className="schedule-note">Loading schedule rules...</p> : null}
      <div className="schedule-rule-list">
        {rules.map((rule, index) => {
          const interval = numberOrNull(rule.frequency_interval) ?? (rule.frequency_type === "biweekly" ? 2 : 1);
          const selectedDays = rule.selected_days?.length ? rule.selected_days : [Number(rule.day_of_week)];
          const needsAnchor = interval > 1;
          return (
            <div className="schedule-rule-card" key={rule.id ?? index}>
              <div className="schedule-rule-summary">
                <strong>{scheduleRuleSummary(rule)}</strong>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span>{needsAnchor ? "Anchor date required for this cadence" : "Payroll-ready cadence"}</span>
                  <button
                    className="action-btn delete-btn"
                    type="button"
                    onClick={() => deleteRule(index)}
                    aria-label="Delete schedule rule"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div className="form-grid four">
                <div className="studio-field day-chip-field"><span>Cleaning days</span><div className="day-chip-list">{DAY_OPTIONS.map(([value, label]) => { const day = Number(value); const active = selectedDays.includes(day); return <button className={active ? "day-chip active" : "day-chip"} key={value} type="button" onClick={() => updateRule(index, { day_of_week: day, selected_days: active ? selectedDays.filter((item) => item !== day) : [...selectedDays, day].sort((a, b) => a - b) })}>{label}</button>; })}</div></div>
                <label className="studio-field"><span>Paid hours</span><input min="0" step="any" type="number" value={rule.paid_hours ?? ""} onChange={(event) => updateRule(index, { paid_hours: event.target.value })} /></label>
                <label className="studio-field"><span>Frequency</span><select value={rule.frequency_type ?? "weekly"} onChange={(event) => updateRule(index, { frequency_type: event.target.value as ScheduleFrequencyType })}><option value="weekly">Weekly</option><option value="biweekly">Every 2 weeks</option><option value="monthly">Monthly</option><option value="custom">Custom</option></select></label>
                <label className="studio-field"><span>Interval</span><input min="1" step="1" type="number" value={rule.frequency_interval ?? interval} onChange={(event) => updateRule(index, { frequency_interval: event.target.value })} /></label>
              </div>
              <div className="form-grid four">
                <label className="studio-field"><span>Start time</span><input type="time" value={rule.start_time ?? ""} onChange={(event) => updateRule(index, { start_time: event.target.value || null })} /></label>
                <label className="studio-field"><span>End time</span><input type="time" value={rule.end_time ?? ""} onChange={(event) => updateRule(index, { end_time: event.target.value || null })} /></label>
                <label className="studio-field"><span>Anchor date</span><input type="date" lang="en-US" value={rule.anchor_date ?? ""} onChange={(event) => updateRule(index, { anchor_date: event.target.value || null })} /></label>
                <label className="studio-field"><span>Cleaner override</span><select value={rule.assigned_cleaner_name ?? ""} onChange={(event) => updateRule(index, { assigned_cleaner_name: event.target.value || null })}>{CLEANERS.map((cleaner) => <option key={cleaner} value={cleaner}>{cleaner || "Use account cleaner"}</option>)}</select></label>
              </div>
              <div className="form-grid three">
                <label className="studio-field"><span>Effective start</span><input type="date" lang="en-US" value={rule.effective_start_date ?? ""} onChange={(event) => updateRule(index, { effective_start_date: event.target.value || null })} /></label>
                <label className="studio-field"><span>Effective end</span><input type="date" lang="en-US" value={rule.effective_end_date ?? ""} onChange={(event) => updateRule(index, { effective_end_date: event.target.value || null })} /></label>
                <label className="studio-field"><span>Status</span><select value={rule.active === false ? "inactive" : "active"} onChange={(event) => updateRule(index, { active: event.target.value === "active" })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
              </div>
              {needsAnchor && !rule.anchor_date ? <p className="schedule-warning">Intervals over one week need an anchor date so payroll knows which cycle applies.</p> : null}
            </div>
          );
        })}
      </div>
      <div className="schedule-actions">
        <button className="add-rule-btn" type="button" onClick={() => setRules((current) => [...current, emptyScheduleRule(account.id)])}>Add schedule rule</button>
        <button className="studio-save compact" disabled={savingRules || loadingRules} type="button" onClick={saveRules}>{savingRules ? "Saving rules..." : "Save schedule rules"}</button>
      </div>
      {rules.length === 0 && !loadingRules ? <p className="schedule-note">Schedule rules are required for exact payroll. Add one rule per paid cleaning day.</p> : null}
      {rulesMessage ? <p className="studio-error">{rulesMessage}</p> : null}
    </div>
  );
}

function AccountStudio({
  mode,
  editingAccount,
  draft,
  error,
  notice,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  mode: AccountFormMode;
  editingAccount?: Account | null;
  draft: AccountDraft;
  error: string | null;
  notice: string | null;
  saving: boolean;
  onChange: (draft: AccountDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const visits = getVisitsPerMonth(draft.frequency);
  const revenue = draft.revenue ?? 0;
  const cost = getRealCost(draft);
  const qcCost = draft.qc_monthly_cost ?? 0;
  const autoNetPrice = visits > 0 && draft.revenue !== null && draft.revenue !== undefined ? Number((draft.revenue / visits).toFixed(2)) : (draft.revenue ?? null);
  const autoGrossProfit = draft.revenue !== null && draft.revenue !== undefined ? Number((draft.revenue - cost - qcCost).toFixed(2)) : null;
  const displayNetPrice = draft.net_price_per_booking !== null && draft.net_price_per_booking !== undefined ? draft.net_price_per_booking : autoNetPrice;
  const displayGrossProfit = draft.monthly_gross_profit !== null && draft.monthly_gross_profit !== undefined ? draft.monthly_gross_profit : autoGrossProfit;
  const profit = displayGrossProfit ?? (revenue - cost - qcCost);
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;
  const isEdit = mode === "edit";

  const readyChecks = [
    draft.name.trim(),
    draft.city?.trim(),
    draft.pricing_model,
    draft.cleaner_name,
    draft.frequency,
    draft.revenue !== null,
    (draft.rate_per_service !== null || draft.cleaner_flat_rate !== null || cost > 0),
    draft.payment_method,
    draft.contract_start,
    draft.contract_end,
    draft.last_contact_date,
    draft.last_qcc_date,
  ].filter(Boolean).length;
  const readiness = Math.round((readyChecks / 12) * 100);

  // Contract expiry helpers
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const contractEndDate = draft.contract_end ? new Date(draft.contract_end) : null;
  const daysUntilExpiry = contractEndDate
    ? Math.round((contractEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <form className="account-studio" onSubmit={onSubmit}>
      <div className="studio-hero">
        <div>
          <span className="studio-kicker"><Sparkles size={14} /> Account Studio</span>
          <h2 className="studio-title">{isEdit ? "Edit Commercial Account" : "Add a Commercial Account"}</h2>
          <p className="studio-copy">{isEdit ? "Update account defaults, contract terms, per-service labor rates, and payroll inputs." : "Create the account with all 16 required fields, labor rates, and live profit preview."}</p>
        </div>
        <button className="studio-close" onClick={onClose} type="button"><X size={16} /></button>
      </div>

      <div className="studio-grid">
        <div className="studio-fields">
          {/* Section 1: Account & Assignment (Fields 1-4) */}
          <div className="studio-section-title"><Building2 size={15} /> 1. Account & Assignment</div>
          <div className="form-grid two">
            {/* 1. Account */}
            <label className="studio-field">
              <span>Account *</span>
              <input required value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} placeholder="Account name (e.g. Mama's Restaurant)" />
            </label>
            {/* 2. City */}
            <label className="studio-field">
              <span>City *</span>
              <input required value={draft.city ?? ""} onChange={(e) => onChange({ ...draft, city: e.target.value })} placeholder="City (e.g. Irvine, Costa Mesa)" />
            </label>
          </div>

          <div className="form-grid two">
            {/* 3. Charged by */}
            <label className="studio-field">
              <span>Charged by</span>
              <select value={draft.pricing_model ?? "per Service"} onChange={(e) => onChange({ ...draft, pricing_model: textOrNull(e.target.value) })}>
                {["per Service", "Monthly", "Flat Rate", "Hourly", "Biweekly", "Weekly", "Contract", "Variable", "One Time"].map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            {/* 4. Team Assigned */}
            <label className="studio-field">
              <span>Team Assigned</span>
              <select value={draft.cleaner_name ?? ""} onChange={(e) => onChange({ ...draft, cleaner_name: e.target.value || null })}>
                {CLEANERS.map((cleaner) => <option key={cleaner} value={cleaner}>{cleaner || "Unassigned"}</option>)}
              </select>
            </label>
          </div>

          {/* Section 2: Service & Labor Rates (Fields 5-7) */}
          <div className="studio-section-title"><Sparkles size={15} /> 2. Service & Labor Rates (Per Booking)</div>
          <div className="form-grid three">
            {/* 5. Hours paid (Per Service) */}
            <label className="studio-field">
              <span>Hours paid (Per Service)</span>
              <input
                min="0"
                step="any"
                type="number"
                value={draft.hours ?? ""}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  onChange({ ...draft, hours: val });
                }}
                placeholder="e.g. 2.25"
              />
            </label>
            {/* 6. Labor Amount Per Service (including insurances) */}
            <label className="studio-field">
              <span>Labor Amount Per Service (including insurances)</span>
              <input
                min="0"
                step="0.01"
                type="number"
                value={draft.rate_per_service ?? draft.cleaner_flat_rate ?? ""}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  const newCost = val ? Number((val * visits).toFixed(2)) : null;
                  onChange({
                    ...draft,
                    rate_per_service: val,
                    cleaner_flat_rate: val,
                    cost: newCost,
                  });
                }}
                placeholder="e.g. 69.00"
              />
            </label>
            {/* 7. Frequency */}
            <label className="studio-field">
              <span>Frequency</span>
              <select
                value={draft.frequency ?? "Weekly"}
                onChange={(e) => {
                  const freq = textOrNull(e.target.value);
                  const nextVisits = getVisitsPerMonth(freq);
                  const curRate = draft.rate_per_service ?? draft.cleaner_flat_rate;
                  const newCost = curRate ? Number((curRate * nextVisits).toFixed(2)) : draft.cost;
                  onChange({
                    ...draft,
                    frequency: freq,
                    cost: newCost,
                  });
                }}
              >
                {[
                  "Weekly",
                  "2x per week",
                  "3x per week",
                  "4x per week",
                  "5x per week",
                  "6x per week",
                  "Daily (7x/week)",
                  "Every 2 weeks",
                  "Every 3 weeks",
                  "Monthly",
                  "As needed",
                  "Custom",
                ].map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>

          {/* Section 3: Financials & Profitability (Fields 8-10, 16) */}
          <div className="studio-section-title"><DollarSign size={15} /> 3. Contract Price & Profitability</div>
          <div className="form-grid four">
            {/* 8. Monthly Contract Price (Average) */}
            <label className="studio-field">
              <span>Monthly Contract Price (Average)</span>
              <input
                min="0"
                step="0.01"
                type="number"
                value={draft.revenue ?? ""}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  onChange({ ...draft, revenue: val });
                }}
                placeholder="e.g. 1200.00"
              />
            </label>
            {/* 9. Net Price per Booking each Month */}
            <label className="studio-field">
              <span>Net Price per Booking each Month</span>
              <input
                min="0"
                step="0.01"
                type="number"
                value={draft.net_price_per_booking ?? (autoNetPrice !== null ? autoNetPrice : "")}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  onChange({ ...draft, net_price_per_booking: val });
                }}
                placeholder={autoNetPrice !== null ? `$${autoNetPrice.toFixed(2)}` : "0.00"}
              />
            </label>
            {/* 16. QC Monthly Cost */}
            <label className="studio-field">
              <span>QC Monthly Cost</span>
              <input
                min="0"
                step="0.01"
                type="number"
                value={draft.qc_monthly_cost ?? ""}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  onChange({ ...draft, qc_monthly_cost: val });
                }}
                placeholder="0.00"
              />
            </label>
            {/* 10. Monthly Gross Profit */}
            <label className="studio-field">
              <span>Monthly Gross Profit</span>
              <input
                step="0.01"
                type="number"
                value={draft.monthly_gross_profit ?? (autoGrossProfit !== null ? autoGrossProfit : "")}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  onChange({ ...draft, monthly_gross_profit: val });
                }}
                placeholder={autoGrossProfit !== null ? `$${autoGrossProfit.toFixed(2)}` : "0.00"}
              />
            </label>
          </div>

          {/* Section 4: Payment Method & Dates (Fields 11-15) */}
          <div className="studio-section-title"><CalendarCheck size={15} /> 4. Payment Method & Dates</div>
          <div className="form-grid three">
            {/* 11. Payment Method */}
            <label className="studio-field">
              <span>Payment Method</span>
              <select value={draft.payment_method ?? "ACH"} onChange={(e) => onChange({ ...draft, payment_method: textOrNull(e.target.value) })}>
                {["ACH", "Direct Deposit", "Check", "Credit Card", "Zelle", "Cash", "Wire", "Other"].map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            {/* 12. Start Date */}
            <label className="studio-field">
              <span>Start Date</span>
              <input type="date" lang="en-US" value={draft.contract_start ?? ""} onChange={(e) => onChange({ ...draft, contract_start: e.target.value || null })} />
            </label>
            {/* 13. Renewal Date */}
            <label className="studio-field">
              <span>Renewal Date</span>
              <input type="date" lang="en-US" value={draft.contract_end ?? ""} onChange={(e) => onChange({ ...draft, contract_end: e.target.value || null })} />
              {daysUntilExpiry !== null && (
                <span className={`contract-expiry-badge ${daysUntilExpiry < 0 ? "expired" : daysUntilExpiry <= 30 ? "expiring-soon" : "expiring-ok"}`}>
                  {daysUntilExpiry < 0 ? "Expired" : daysUntilExpiry === 0 ? "Expires today" : `${daysUntilExpiry}d left`}
                </span>
              )}
            </label>
          </div>

          <div className="form-grid two">
            {/* 14. Last Contacted */}
            <label className="studio-field">
              <span>Last Contacted</span>
              <input type="date" lang="en-US" value={draft.last_contact_date ?? ""} onChange={(e) => onChange({ ...draft, last_contact_date: e.target.value || null })} />
            </label>
            {/* 15. Last Quality Control Check */}
            <label className="studio-field">
              <span>Last Quality Control Check</span>
              <input type="date" lang="en-US" value={draft.last_qcc_date ?? ""} onChange={(e) => onChange({ ...draft, last_qcc_date: e.target.value || null })} />
            </label>
          </div>

          {/* Section 5: Supplies & Operations (Logistics) */}
          <div className="studio-section-title"><Package size={15} /> 5. Supplies & Access Logistics</div>
          <div className="toggle-row">
            <button className={`choice ${draft.has_supplies ? "active" : ""}`} onClick={() => onChange({ ...draft, has_supplies: !draft.has_supplies })} type="button">
              <Package size={14} /> Supplies ready
            </button>
            <button className={`choice ${draft.has_keys ? "active" : ""}`} onClick={() => onChange({ ...draft, has_keys: !draft.has_keys })} type="button">
              <Key size={14} /> Keys secured
            </button>
          </div>

          <div className="form-grid two">
            <label className="studio-field">
              <span>Supply delivery date</span>
              <input type="date" lang="en-US" value={draft.supply_delivery_date ?? ""} onChange={(e) => onChange({ ...draft, supply_delivery_date: e.target.value || null })} />
            </label>
            <label className="studio-field">
              <span>Estimated fill date</span>
              <input type="date" lang="en-US" value={draft.estimated_fill_date ?? ""} onChange={(e) => onChange({ ...draft, estimated_fill_date: e.target.value || null })} />
            </label>
          </div>

          <label className="studio-field">
            <span>Notes (Access Codes & Special Instructions)</span>
            <textarea value={draft.supplies_notes ?? ""} onChange={(e) => onChange({ ...draft, supplies_notes: e.target.value })} placeholder="Lockbox code, alarm code, gate code, key location, parking & entry instructions..." />
          </label>

          {isEdit ? (
            <div className="payroll-impact-block">
              <strong>Payroll-safe account update</strong>
              <p>Closed, paid, approved, and locked periods will not be changed.</p>
              <div className="impact-actions"><button className="impact-primary" name="saveIntent" type="submit" value="save-only">Save changes only</button><button className="impact-secondary" name="saveIntent" type="submit" value="apply-forward">Apply going forward</button><Link className="impact-link" href="/commercial/payroll">Open Commercial Payroll</Link></div>
            </div>
          ) : null}

          {isEdit && editingAccount ? (
            isPersistedAccount(editingAccount)
              ? <ScheduleRulesEditor account={editingAccount} />
              : <p className="schedule-note">Save this imported account into the database before adding schedule rules.</p>
          ) : null}
        </div>

        <aside className="studio-preview">
          <div
            className="preview-ring"
            style={{ background: `conic-gradient(hsl(var(--primary)) ${readiness}%, hsl(var(--border)) 0)` }}
          >
            <span>{readiness}%</span>
            <small>setup</small>
          </div>
          <div>
            <p className="preview-label">Live gross profit preview</p>
            <p className="preview-money">${profit.toLocaleString("en-US", { maximumFractionDigits: 2 })}</p>
            <p className={`preview-margin ${margin >= 35 ? "good" : margin > 0 ? "warning" : "bad"}`}>{margin}% margin</p>
          </div>
          <div className="preview-line"><span>Account</span><strong>{draft.name || "New account"}</strong></div>
          <div className="preview-line"><span>Team Assigned</span><strong>{draft.cleaner_name || "Unassigned"}</strong></div>
          <div className="preview-line"><span>Visits / Mo</span><strong>{visits}x</strong></div>
          <div className="preview-line"><span>Monthly Revenue</span><strong>${revenue.toLocaleString("en-US", { maximumFractionDigits: 2 })}</strong></div>
          <div className="preview-line"><span>Labor / Service</span><strong>${((draft.rate_per_service ?? draft.cleaner_flat_rate) ?? 0).toFixed(2)}</strong></div>
          <div className="preview-line"><span>Monthly Labor</span><strong>${cost.toLocaleString("en-US", { maximumFractionDigits: 2 })}</strong></div>
          {qcCost > 0 && <div className="preview-line"><span>QC Cost</span><strong>${qcCost.toFixed(2)}</strong></div>}
          <div className="preview-line"><span>Last QC Check</span><strong>{displayDate(draft.last_qcc_date)}</strong></div>
          <div className="preview-line"><span>Last Contact</span><strong>{displayDate(draft.last_contact_date)}</strong></div>
          <div className="preview-meter"><span style={{ width: `${readiness}%` }} /></div>
          {error ? <p className="studio-error">{error}</p> : null}
          {notice ? <p className="studio-success">{notice}</p> : null}
          <button className="studio-save" disabled={saving} name="saveIntent" type="submit" value="save-only">
            {saving ? "Saving..." : isEdit ? "Save changes only" : "Add Commercial Account"}
          </button>
        </aside>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────
export default function CommercialPage() {
  const [accounts, setAccounts] = useState<Account[]>(() => mergeImportedAccounts([]));
  const [loading, setLoading] = useState(false);
  const [showAccountStudio, setShowAccountStudio] = useState(false);
  const [accountFormMode, setAccountFormMode] = useState<AccountFormMode>("create");
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [newAccount, setNewAccount] = useState<AccountDraft>(() => emptyAccountDraft());
  const [savingNew, setSavingNew] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountView, setAccountView] = useState<"all" | "needs-qc" | "supplies" | "keys">("all");
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function loadAccounts() {
      setLoading(true);
      try {
        const { data: remoteData, error: readError } = await supabase
          .from("commercial_accounts")
          .select("*")
          .order("name");

        if (readError) throw readError;

        const remoteAccounts = (remoteData ?? []) as Account[];

        // Ensure all commercial cleaners exist in the staff_members table
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id;

        if (userId) {
          const { data: staffData } = await supabase
            .from("staff_members")
            .select("name")
            .eq("user_id", userId);

          const existingStaffNames = new Set(
            (staffData ?? []).map((s) => s.name.trim().toLowerCase())
          );

          const seedCleaners = [
            "Juan Romero", "Sandra Hernandez", "Lorena Benitez", "Luz Uribe",
            "Mirna Contreras", "Esperanza Youseff", "Esperanza Yoseff", "Ana Morales",
            "Maria Lopez", "Emmi Guerra", "Lucia Portillo", "Kassandra Valentin",
            "Vanessa Ortega"
          ];

          const staffToInsert = [];
          for (const name of seedCleaners) {
            const normalized = name.trim().toLowerCase();
            if (!existingStaffNames.has(normalized)) {
              const isMixed = ["juan romero", "lorena benitez", "esperanza youseff", "esperanza yoseff"].includes(normalized);
              const emailName = name.toLowerCase().replace(/[^a-z0-9]+/g, ".");
              staffToInsert.push({
                user_id: userId,
                name: name,
                email: `${emailName}@pristine.local`,
                role: isMixed ? "Mixed Route Cleaner" : "Commercial Cleaner",
                display_role: isMixed ? "Mixed Route Cleaner" : "Commercial Cleaner",
                team_scope: isMixed ? "mixed" : "commercial",
                payment_mode: isMixed ? "mixed" : "residential_only",
                commercial_payroll_eligible: !isMixed,
                status: "Active",
                active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }
          }

          if (staffToInsert.length > 0) {
            const { error: staffInsertError } = await supabase
              .from("staff_members")
              .insert(staffToInsert);
            if (staffInsertError) {
              console.error("Error auto-seeding staff members:", staffInsertError);
            } else {
              console.log(`Auto-seeded ${staffToInsert.length} staff members.`);
            }
          }
        }

        if (remoteAccounts.length === 0 && importedCommercialAccounts.length > 0) {
          const payloads = importedCommercialAccounts.map((imported) => {
            return {
              user_id: userId,
              name: imported.name,
              city: imported.city || "Unknown",
              pricing_model: imported.pricing_model,
              cleaner_name: imported.cleaner_name,
              hours: numberOrNull(imported.hours),
              frequency: imported.frequency,
              revenue: imported.revenue,
              cost: imported.cost,
              payment_method: imported.payment_method,
              contract_start: parseDateStr(imported.contract_start),
              contract_end: parseDateStr(imported.contract_end),
              last_qcc_date: parseDateStr(imported.last_qcc_date),
              last_contact_date: parseDateStr(imported.last_contact_date),
              has_supplies: imported.has_supplies === true,
              has_keys: imported.has_keys === true,
              supplies_notes: imported.supplies_notes,
              supply_delivery_date: parseDateStr(imported.supply_delivery_date),
              estimated_fill_date: parseDateStr(imported.estimated_fill_date),
            };
          });

          const { error: insertError } = await supabase
            .from("commercial_accounts")
            .insert(payloads);

          if (insertError) {
            console.error("Error seeding missing commercial accounts:", insertError);
          } else {
            // Re-fetch to get accounts with their database IDs
            const { data: refreshedData, error: refreshError } = await supabase
              .from("commercial_accounts")
              .select("*")
              .order("name");
            if (!refreshError && refreshedData) {
              setAccounts(mergeImportedAccounts((refreshedData ?? []) as Account[]));
              setLoading(false);
              return;
            }
          }
        }

        setAccounts(mergeImportedAccounts(remoteAccounts));
        setLoading(false);
      } catch (err) {
        console.error("Error loading accounts:", err);
        setAccounts(mergeImportedAccounts([]));
        setLoading(false);
      }
    }

    loadAccounts();
  }, [supabase]);

  async function refreshAccounts() {
    const { data, error } = await supabase.from("commercial_accounts").select("*").order("name");
    if (!error) setAccounts(mergeImportedAccounts((data ?? []) as Account[]));
  }

  async function handleDeleteAccount(account: Account) {
    if (!isPersistedAccount(account)) {
      alert("This account is imported from spreadsheet data and cannot be deleted from the database.");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete the account "${account.name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      const { error } = await supabase.from("commercial_accounts").delete().eq("id", account.id);
      if (error) throw error;
      setAccounts((current) => current.filter((item) => item.id !== account.id));
      alert("Account deleted successfully.");
    } catch (err) {
      alert(`Could not delete account: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function openCreateStudio() {
    setAccountFormMode("create");
    setEditingAccount(null);
    setNewAccount(emptyAccountDraft());
    setFormError(null);
    setFormNotice(null);
    setShowAccountStudio(true);
  }

  function openEditStudio(account: Account) {
    setAccountFormMode("edit");
    setEditingAccount(account);
    setNewAccount(accountToDraft(account));
    setFormError(null);
    setFormNotice(null);
    setShowAccountStudio(true);
  }

  function closeAccountStudio() {
    setShowAccountStudio(false);
    setFormError(null);
    setFormNotice(null);
    setEditingAccount(null);
    setAccountFormMode("create");
    setNewAccount(emptyAccountDraft());
  }

  function buildAccountPayload(draft: AccountDraft, id = crypto.randomUUID()): Account {
    const visits = getVisitsPerMonth(draft.frequency);
    const perServiceRate = numberOrNull(draft.rate_per_service ?? draft.cleaner_flat_rate);
    const cost = getRealCost(draft);
    const revenue = numberOrNull(draft.revenue);
    const qc_cost = numberOrNull(draft.qc_monthly_cost);
    const autoNetPrice = visits > 0 && revenue !== null ? Number((revenue / visits).toFixed(2)) : revenue;
    const autoGrossProfit = revenue !== null ? Number((revenue - cost - (qc_cost ?? 0)).toFixed(2)) : null;

    return {
      id,
      name: draft.name.trim(),
      city: draft.city?.trim() ?? null,
      pricing_model: textOrNull(draft.pricing_model),
      cleaner_name: textOrNull(draft.cleaner_name),
      hours: numberOrNull(draft.hours),
      frequency: textOrNull(draft.frequency),
      revenue,
      cost,
      cleaner_pay_type: draft.cleaner_pay_type ?? "flat",
      cleaner_hourly_rate: numberOrNull(draft.cleaner_hourly_rate),
      cleaner_flat_rate: perServiceRate,
      rate_per_service: perServiceRate,
      net_price_per_booking: numberOrNull(draft.net_price_per_booking) ?? autoNetPrice,
      monthly_gross_profit: numberOrNull(draft.monthly_gross_profit) ?? autoGrossProfit,
      qc_monthly_cost: qc_cost,
      payment_method: textOrNull(draft.payment_method),
      contract_start: dateOrNull(draft.contract_start),
      contract_end: dateOrNull(draft.contract_end),
      last_contact_date: dateOrNull(draft.last_contact_date),
      last_qcc_date: dateOrNull(draft.last_qcc_date),
      has_supplies: draft.has_supplies,
      has_keys: draft.has_keys,
      supply_delivery_date: dateOrNull(draft.supply_delivery_date ?? null),
      estimated_fill_date: textOrNull(draft.estimated_fill_date ?? null),
      supplies_notes: textOrNull(draft.supplies_notes),
      source_sheet: accountFormMode === "create" ? "Manual entry" : editingAccount?.source_sheet ?? "Manual entry",
    };
  }

  function toDbPayload(account: Account) {
    return {
      name: account.name,
      city: account.city,
      pricing_model: account.pricing_model,
      cleaner_name: account.cleaner_name,
      hours: typeof account.hours === "number" ? account.hours : numberOrNull(account.hours),
      frequency: account.frequency,
      revenue: account.revenue,
      cost: account.cost,
      cleaner_pay_type: account.cleaner_pay_type,
      cleaner_hourly_rate: account.cleaner_hourly_rate,
      cleaner_flat_rate: account.cleaner_flat_rate,
      payment_method: account.payment_method,
      contract_start: account.contract_start,
      contract_end: account.contract_end,
      last_qcc_date: account.last_qcc_date,
      last_contact_date: account.last_contact_date,
      has_supplies: account.has_supplies,
      has_keys: account.has_keys,
      supply_delivery_date: account.supply_delivery_date ?? null,
      estimated_fill_date: account.estimated_fill_date ?? null,
      supplies_notes: account.supplies_notes,
      updated_at: new Date().toISOString(),
    };
  }

  async function handleAccountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFormNotice(null);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const saveIntent = submitter?.value === "apply-forward" ? "apply-forward" : "save-only";

    if (saveIntent === "apply-forward" && !window.confirm("Apply these account settings to future open commercial payroll periods? Approved, paid, and locked periods will not be changed.")) {
      return;
    }

    if (!newAccount.name.trim() || !newAccount.city?.trim()) {
      setFormError("Account name and city are required.");
      return;
    }

    setSavingNew(true);
    const localPayload = buildAccountPayload(
      newAccount,
      accountFormMode === "edit" && isPersistedAccount(editingAccount) && editingAccount ? editingAccount.id : crypto.randomUUID(),
    );

    // 1. Immediately update state and localStorage
    setAccounts((current) => {
      const exists = current.some((a) => a.id === localPayload.id);
      const next = exists ? current.map((a) => (a.id === localPayload.id ? localPayload : a)) : [localPayload, ...current];
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem("pristine_commercial_accounts", JSON.stringify(next));
          window.dispatchEvent(new CustomEvent("pristine:data-updated"));
        }
      } catch (err) {
        console.warn("Could not cache commercial accounts locally:", err);
      }
      return next;
    });

    if (accountFormMode === "edit" && editingAccount && isPersistedAccount(editingAccount)) {
      try {
        const { error } = await supabase
          .from("commercial_accounts")
          .update(toDbPayload(localPayload))
          .eq("id", editingAccount.id);

        if (error) {
          console.warn("Supabase update error:", error.message);
        } else {
          if (saveIntent === "apply-forward") {
            const { data: userData } = await supabase.auth.getUser();
            const result = await applyCommercialAccountChangesGoingForward(editingAccount.id, { userId: userData.user?.id ?? null });
            setFormNotice(
              result.refreshedPeriods > 0
                ? `Account saved. Refreshed ${result.refreshedPeriods} open commercial payroll period(s) and ${result.refreshedEntries} synced entries.`
                : "Account saved. No open future commercial payroll periods needed recalculation.",
            );
          } else {
            await supabase.from("payroll_audit_log").insert({ entity_type: "commercial_account", entity_id: editingAccount.id, action: "account_settings_saved_only", new_value: JSON.stringify(toDbPayload(localPayload)), changed_by: null });
            setFormNotice("Account settings saved.");
          }
        }
      } catch (err) {
        console.warn("Supabase update exception:", err);
      }
      setSavingNew(false);
      setEditingAccount(localPayload);
      setNewAccount(accountToDraft(localPayload));
      return;
    }

    try {
      const dbPayload: Record<string, unknown> = { id: localPayload.id, ...toDbPayload(localPayload) };
      delete dbPayload.updated_at;

      const { error } = await supabase
        .from("commercial_accounts")
        .insert(dbPayload);

      if (error) {
        console.warn("Supabase insert warning:", error.message);
      }
    } catch (err) {
      console.warn("Supabase insert exception:", err);
    }

    setSavingNew(false);
    closeAccountStudio();
  }

  // Chart data
  const cleanerCounts: Record<string, number> = {};
  for (const a of accounts) {
    const key = a.cleaner_name ?? "Unassigned";
    cleanerCounts[key] = (cleanerCounts[key] ?? 0) + 1;
  }
  const total = accounts.length || 1;
  const chartData: CleanerChartDatum[] = Object.entries(cleanerCounts).sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      name, value, pct: ((value / total) * 100).toFixed(1) + "%",
    }));

  const totalRevenue = accounts.reduce((s, a) => s + (a.revenue ?? 0), 0);
  const totalCost    = accounts.reduce((s, a) => s + getRealCost(a), 0);
  const accountsNeedingQc = accounts.filter((account) => !account.last_qcc_date).length;
  const supplyReady = accounts.filter((account) => account.has_supplies).length;
  const keyedAccounts = accounts.filter((account) => account.has_keys).length;
  const filteredAccounts = accounts.filter((account) => {
    const q = accountSearch.trim().toLowerCase();
    const matchesSearch = !q || [
      account.name,
      account.city,
      account.cleaner_name,
      account.supplies_notes,
      account.source_sheet,
    ].some((value) => String(value ?? "").toLowerCase().includes(q));
    const matchesView =
      accountView === "all" ||
      (accountView === "needs-qc" && !account.last_qcc_date) ||
      (accountView === "supplies" && account.has_supplies) ||
      (accountView === "keys" && account.has_keys);

    return matchesSearch && matchesView;
  });

  return (
    <DashboardShell userEmail="pristinecleanersoc@gmail.com">
      <style>{`
        .commercial-page { display:flex; flex-direction:column; gap:18px; }
        .commercial-head { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:14px;
          padding:4px 0 12px 0; border:none; background:transparent; box-shadow:none; }
        .dark .commercial-head { background:transparent; }
        .page-title { font-size:2.2rem; font-weight:800; color:hsl(var(--foreground)); line-height:1.05; letter-spacing:-0.02em; }
        .page-sub { font-size:0.88rem; color:hsl(var(--muted-foreground)); margin-top:6px; font-weight:500; }
        .add-account-btn { display:flex; align-items:center; gap:7px; border:none; border-radius:12px;
          background:hsl(var(--primary)); color:hsl(var(--primary-foreground)); padding:8px 14px; height:40px;
          font-size:.78rem; font-weight:700; cursor:pointer; transition: transform 0.2s; }
        .add-account-btn:hover { transform:translateY(-1px); }

        .account-studio-wrapper {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(4px);
          display: grid;
          place-items: center;
          padding: 20px;
        }
        .account-studio { border:1px solid hsl(var(--border)); background:hsl(var(--card));
          border-radius:12px; overflow:hidden; box-shadow:0 20px 60px -15px rgba(0,0,0,0.3);
          width:100%; max-width:1024px; max-height:90vh; display:flex; flex-direction:column; }
        .studio-hero { display:flex; align-items:flex-start; justify-content:space-between; gap:16px;
          padding:18px 20px; border-bottom:1px solid hsl(var(--border));
          background:linear-gradient(135deg, hsl(var(--primary)/.12), hsl(215 90% 58%/.08)); flex-shrink:0; }
        .studio-kicker { display:inline-flex; align-items:center; gap:6px; color:hsl(var(--primary));
          font-size:.72rem; font-weight:900; text-transform:uppercase; letter-spacing:.11em; }
        .studio-title { margin-top:6px; font-size:1.2rem; font-weight:900; color:hsl(var(--foreground)); }
        .studio-copy { margin-top:3px; max-width:620px; font-size:.82rem; font-weight:500; color:hsl(var(--muted-foreground)); }
        .studio-close { display:grid; place-items:center; width:32px; height:32px; border-radius:8px;
          border:1px solid hsl(var(--border)); background:hsl(var(--background)); color:hsl(var(--muted-foreground)); cursor:pointer; }
        .studio-grid { display:grid; grid-template-columns:minmax(0, 1fr) 280px; gap:0; overflow-y:auto; flex:1; }
        @media (max-width:940px) { .studio-grid { grid-template-columns:1fr; } }
        .studio-fields { padding:20px; display:flex; flex-direction:column; gap:14px; }
        .studio-section-title { display:flex; align-items:center; gap:7px; font-size:.75rem; font-weight:900;
          color:hsl(var(--foreground)); text-transform:uppercase; letter-spacing:.08em; }
        .form-grid { display:grid; gap:12px; }
        .form-grid.two { grid-template-columns:repeat(2, minmax(0, 1fr)); }
        .form-grid.three { grid-template-columns:repeat(3, minmax(0, 1fr)); }
        .form-grid.four { grid-template-columns:repeat(4, minmax(0, 1fr)); }
        @media (max-width:900px) { .form-grid.two, .form-grid.three, .form-grid.four { grid-template-columns:1fr 1fr; } }
        @media (max-width:560px) { .form-grid.two, .form-grid.three, .form-grid.four { grid-template-columns:1fr; } }
        .studio-field { display:flex; flex-direction:column; gap:5px; min-width:0; }
        .studio-field span { font-size:.68rem; font-weight:900; color:hsl(var(--muted-foreground));
          text-transform:uppercase; letter-spacing:.06em; }
        .studio-field input, .studio-field select, .studio-field textarea { width:100%; min-width:0; border:1px solid hsl(var(--border));
          background:hsl(var(--background)); color:hsl(var(--foreground)); border-radius:8px; padding:8px 10px;
          font:inherit; font-size:.82rem; outline:none; box-sizing:border-box; }
        .studio-field textarea { min-height:76px; resize:vertical; }
        .studio-field input:focus, .studio-field select:focus, .studio-field textarea:focus { border-color:hsl(var(--primary)); box-shadow:0 0 0 3px hsl(var(--primary)/.1); }
        .toggle-row { display:flex; flex-wrap:wrap; gap:9px; }
        .choice { display:flex; align-items:center; gap:7px; padding:8px 12px; border-radius:999px;
          border:1px solid hsl(var(--border)); background:hsl(var(--background)); color:hsl(var(--muted-foreground));
          font-size:.78rem; font-weight:900; cursor:pointer; }
        .choice.active { background:hsl(var(--primary)); border-color:hsl(var(--primary)); color:hsl(var(--primary-foreground)); }
        .studio-preview { border-left:1px solid hsl(var(--border)); padding:20px; display:flex; flex-direction:column; gap:14px;
          background:hsl(var(--muted)/.34); }
        @media (max-width:940px) { .studio-preview { border-left:none; border-top:1px solid hsl(var(--border)); } }
        .preview-ring { width:94px; height:94px; border-radius:50%; display:grid; place-items:center; align-self:center;
          background:conic-gradient(hsl(var(--primary)) var(--ready, 0%), hsl(var(--border)) 0); position:relative; }
        .preview-ring::after { content:""; position:absolute; inset:9px; border-radius:50%; background:hsl(var(--card)); }
        .preview-ring span, .preview-ring small { position:relative; z-index:1; }
        .preview-ring span { font-size:1.25rem; font-weight:900; align-self:end; }
        .preview-ring small { font-size:.65rem; font-weight:900; color:hsl(var(--muted-foreground)); text-transform:uppercase; align-self:start; }
        .preview-label { font-size:.68rem; font-weight:900; color:hsl(var(--muted-foreground)); text-transform:uppercase; letter-spacing:.08em; }
        .preview-money { font-size:1.85rem; font-weight:900; color:hsl(var(--foreground)); }
        .preview-margin { font-size:.8rem; font-weight:900; }
        .preview-margin.good { color:hsl(142 76% 30%); }
        .preview-margin.warning { color:hsl(38 92% 40%); }
        .preview-margin.bad { color:hsl(0 84% 50%); }
        .preview-line { display:flex; align-items:center; justify-content:space-between; gap:12px; border-top:1px solid hsl(var(--border)); padding-top:10px; }
        .preview-line span { font-size:.72rem; font-weight:800; color:hsl(var(--muted-foreground)); }
        .preview-line strong { text-align:right; font-size:.82rem; }
        .preview-meter { height:7px; border-radius:999px; background:hsl(var(--border)); overflow:hidden; }
        .preview-meter span { display:block; height:100%; border-radius:999px; background:hsl(var(--primary)); }
        .contract-expiry-badge { display:inline-block; margin-top:4px; border-radius:999px; padding:2px 8px; font-size:.68rem; font-weight:900; }
        .contract-expiry-badge.expiring-ok { background:hsl(142 76% 36%/.15); color:hsl(142 76% 28%); }
        .contract-expiry-badge.expiring-soon { background:hsl(38 92% 50%/.15); color:hsl(38 92% 32%); }
        .contract-expiry-badge.expired { background:hsl(0 84% 60%/.12); color:hsl(0 84% 45%); }
        .studio-error { border:1px solid hsl(0 84% 60%/.25); background:hsl(0 84% 60%/.1); color:hsl(0 84% 45%);
          border-radius:8px; padding:10px; font-size:.78rem; font-weight:800; }
        .studio-success { border:1px solid hsl(142 70% 35%/.25); background:hsl(142 70% 35%/.1); color:hsl(142 72% 28%);
          border-radius:8px; padding:10px; font-size:.78rem; font-weight:900; }
        .studio-save { border:none; border-radius:8px; padding:10px 12px; background:hsl(var(--primary));
          color:hsl(var(--primary-foreground)); font-weight:900; cursor:pointer; }
        .studio-save.compact { width:auto; padding:8px 12px; font-size:.78rem; }
        .studio-save:disabled { opacity:.65; cursor:not-allowed; }
        .payroll-impact, .payroll-impact-block { border:1px solid hsl(42 92% 50%/.32); background:hsl(42 92% 50%/.1); color:hsl(32 90% 28%);
          border-radius:8px; padding:10px 12px; font-size:.8rem; font-weight:850; }
        .dark .payroll-impact, .dark .payroll-impact-block { color:hsl(42 92% 82%); }
        .payroll-impact-block { display:flex; flex-direction:column; gap:8px; }
        .payroll-impact-block p { margin:0; color:hsl(var(--muted-foreground)); font-size:.78rem; font-weight:800; }
        .impact-actions { display:flex; flex-wrap:wrap; gap:8px; }
        .impact-actions button, .impact-actions a { border:1px solid hsl(var(--border)); border-radius:999px; background:hsl(var(--background)); color:hsl(var(--foreground));
          padding:7px 11px; font-size:.74rem; font-weight:900; text-decoration:none; cursor:pointer; }
        .impact-actions .impact-primary { background:hsl(var(--primary)); border-color:hsl(var(--primary)); color:hsl(var(--primary-foreground)); }
        .impact-actions .impact-secondary { background:hsl(var(--primary)/.08); border-color:hsl(var(--primary)/.28); color:hsl(var(--primary)); }
        .impact-actions .impact-link { color:hsl(var(--muted-foreground)); }
        .schedule-editor { display:flex; flex-direction:column; gap:12px; border-top:1px solid hsl(var(--border)); padding-top:14px; }
        .schedule-rule-list { display:flex; flex-direction:column; gap:12px; }
        .schedule-rule-card { border:1px solid hsl(var(--border)); border-radius:8px; background:hsl(var(--background)); padding:14px; display:flex; flex-direction:column; gap:14px; box-shadow:0 12px 30px -28px hsl(210 40% 20%); }
        .schedule-rule-summary { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px; border-radius:8px; background:hsl(var(--muted)/.38); padding:10px 12px; }
        .schedule-rule-summary strong { font-size:.84rem; font-weight:950; color:hsl(var(--foreground)); }
        .schedule-rule-summary span { font-size:.72rem; font-weight:900; color:hsl(var(--muted-foreground)); }
        .day-chip-field { grid-column:1 / -1; }
        .day-chip-list { display:flex; flex-wrap:wrap; gap:7px; }
        .day-chip { border:1px solid hsl(var(--border)); border-radius:999px; background:hsl(var(--background)); color:hsl(var(--muted-foreground)); padding:8px 11px; font-size:.74rem; font-weight:900; cursor:pointer; transition:all .14s ease; }
        .day-chip:hover { border-color:hsl(var(--primary)/.45); color:hsl(var(--primary)); }
        .day-chip.active { border-color:hsl(var(--primary)); background:hsl(var(--primary)); color:hsl(var(--primary-foreground)); box-shadow:0 10px 22px -18px hsl(var(--primary)); }
        .schedule-actions { display:flex; flex-wrap:wrap; align-items:center; gap:9px; }
        .add-rule-btn { border:1px solid hsl(var(--border)); border-radius:8px; background:hsl(var(--background)); color:hsl(var(--foreground));
          padding:8px 12px; font-size:.78rem; font-weight:900; cursor:pointer; }
        .schedule-note { margin:0; color:hsl(var(--muted-foreground)); font-size:.8rem; font-weight:800; }
        .schedule-warning { margin:0; border:1px solid hsl(42 92% 50%/.28); background:hsl(42 92% 50%/.1); color:hsl(32 90% 34%); border-radius:8px; padding:9px 10px; font-size:.78rem; font-weight:900; }

        .stat-bar { display:grid; grid-template-columns:1.4fr 1fr 1fr 1.2fr 1fr 1fr; gap:10px; }
        .stat-card { min-width:0; padding:12px 14px; border-radius:12px; background:hsl(var(--card)/.96); border:1px solid hsl(var(--border)/.55);
          box-shadow:0 8px 24px -20px hsl(210 40% 20%); }
        .stat-card.accent { background:linear-gradient(135deg, hsl(var(--primary)), hsl(160 42% 28%)); border-color:hsl(var(--primary)); }
        .stat-label { font-size:0.68rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:hsl(var(--muted-foreground)); }
        .stat-card.accent .stat-label { color:hsl(var(--primary-foreground)/.7); }
        .stat-value { font-size:1.28rem; font-weight:800; margin-top:4px; color:hsl(var(--foreground)); }
        .stat-card.accent .stat-value { color:hsl(var(--primary-foreground)); }
        .stat-note { margin-top:5px; font-size:.68rem; font-weight:800; color:hsl(var(--muted-foreground)); }
        .stat-card.accent .stat-note { color:hsl(var(--primary-foreground)/.72); }
        @media (max-width:1120px) { .stat-bar { grid-template-columns:repeat(3, minmax(0, 1fr)); } }
        @media (max-width:660px) { .stat-bar { grid-template-columns:1fr 1fr; } }

        .analytics-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
        @media (max-width:900px) { .analytics-grid { grid-template-columns:1fr; } }
        .analytics-card { background:hsl(var(--card)/.96); border:1px solid hsl(var(--border)/.55); border-radius:12px; padding:16px; box-shadow:0 8px 24px -20px hsl(210 40% 20%); }
        .analytics-title { font-size:0.9rem; font-weight:800; color:hsl(var(--foreground)); margin-bottom:16px; }

        .cleaner-table { width:100%; border-collapse:collapse; font-size:0.78rem; }
        .cleaner-table th { text-align:left; padding:6px 10px; font-size:0.68rem; font-weight:700;
          text-transform:uppercase; letter-spacing:.05em; color:hsl(var(--muted-foreground));
          border-bottom:1px solid hsl(var(--border)); }
        .cleaner-table td { padding:7px 10px; border-bottom:1px solid hsl(var(--border)/.4);
          color:hsl(var(--foreground)); font-weight:500; }
        .pct-bar-wrap { width:100%; background:hsl(var(--muted)); border-radius:99px; height:6px; }
        .pct-bar { height:6px; border-radius:99px; background:hsl(var(--primary)); }

        .table-card { background:hsl(var(--card)/.96); border:1px solid hsl(var(--border)/.55); border-radius:12px; overflow:hidden; box-shadow:0 12px 32px -24px hsl(210 40% 20%); }
        .table-header { display:grid; grid-template-columns:minmax(220px, 1fr) auto; align-items:center; gap:12px;
          padding:12px 16px; border-bottom:1px solid hsl(var(--border)/.55); background:hsl(var(--muted)/.15); }
        .table-title { display:flex; align-items:center; gap:8px; font-size:0.95rem; font-weight:900; color:hsl(var(--foreground)); }
        .account-controls { display:flex; flex-wrap:wrap; align-items:center; justify-content:flex-end; gap:8px; }
        .account-search { position:relative; min-width:230px; }
        .account-search svg { position:absolute; left:10px; top:50%; transform:translateY(-50%); color:hsl(var(--muted-foreground)); }
        .account-search input { width:100%; height:36px; border:1px solid hsl(var(--border)); border-radius:8px; padding:0 10px 0 32px;
          color:hsl(var(--foreground)); background:hsl(var(--background)); font:inherit; font-size:.8rem; font-weight:700; outline:none; box-sizing:border-box; }
        .account-search input:focus { border-color:hsl(var(--primary)); box-shadow:0 0 0 3px hsl(var(--primary)/.1); }
        .view-tabs { display:flex; gap:5px; padding:4px; border:1px solid hsl(var(--border)); border-radius:8px; background:hsl(var(--background)); }
        .view-tab { border:none; border-radius:6px; background:transparent; color:hsl(var(--muted-foreground)); padding:7px 9px;
          font:inherit; font-size:.72rem; font-weight:900; cursor:pointer; white-space:nowrap; }
        .view-tab.active { background:hsl(var(--primary)); color:hsl(var(--primary-foreground)); }
        .table-wrap { overflow-x:auto; scrollbar-gutter:stable; }

        table.main-table { width:100%; min-width:1280px; border-collapse:separate; border-spacing:0; table-layout:fixed; font-size:0.78rem; }
        table.main-table th:nth-child(1), table.main-table td:nth-child(1) { width:300px; }
        table.main-table th:nth-child(2), table.main-table td:nth-child(2) { width:190px; }
        table.main-table th:nth-child(3), table.main-table td:nth-child(3) { width:118px; }
        table.main-table th:nth-child(4), table.main-table td:nth-child(4),
        table.main-table th:nth-child(5), table.main-table td:nth-child(5),
        table.main-table th:nth-child(7), table.main-table td:nth-child(7) { width:136px; }
        table.main-table th:nth-child(6), table.main-table td:nth-child(6) { width:92px; }
        table.main-table th:nth-child(8), table.main-table td:nth-child(8) { width:170px; }
        table.main-table th:nth-child(9), table.main-table td:nth-child(9),
        table.main-table th:nth-child(10), table.main-table td:nth-child(10),
        table.main-table th:nth-child(11), table.main-table td:nth-child(11) { width:100px; }
        table.main-table th:nth-child(12), table.main-table td:nth-child(12) { width:74px; }
        table.main-table thead th { padding:10px 12px; text-align:left; font-size:0.68rem;
          font-weight:700; text-transform:uppercase; letter-spacing:.05em;
          color:hsl(var(--muted-foreground)); background:hsl(var(--muted)/.48);
          border-bottom:1px solid hsl(var(--border)); white-space:nowrap; }
        .acc-row { transition:background .12s, box-shadow .12s; }
        .acc-row:hover { background:hsl(var(--accent)/.36); box-shadow:inset 3px 0 0 hsl(var(--primary)); }
        .acc-cell { padding:10px 12px; border-bottom:1px solid hsl(var(--border)/.55); vertical-align:middle;
          background:hsl(var(--card)); line-height:1.25; overflow:hidden; }
        .acc-row:hover .acc-cell { background:hsl(var(--accent)/.36); }
        table.main-table thead th:first-child,
        .acc-cell:first-child { position:sticky; left:0; z-index:2; box-shadow:1px 0 0 hsl(var(--border)/.55); }
        table.main-table thead th:first-child { z-index:3; background:hsl(var(--muted)) !important; }
        .acc-cell:first-child { background:hsl(var(--card)) !important; }
        .acc-row:hover .acc-cell:first-child { background:hsl(var(--accent)) !important; }
        .account-cell-content { display:grid; grid-template-columns:28px minmax(0, 1fr); align-items:center; gap:10px; min-width:0; }
        .account-primary { display:grid; grid-template-columns:minmax(0, max-content) auto; align-items:center; justify-content:start; gap:7px; min-width:0; }
        .acc-name { display:block; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
          font-size:.84rem; font-weight:900; color:hsl(var(--foreground)); }
        .acc-city-badge { min-width:0; max-width:128px; overflow:hidden; text-overflow:ellipsis; font-size:0.66rem; font-weight:800;
          padding:3px 9px; border-radius:99px; background:hsl(var(--muted)); color:hsl(var(--muted-foreground)); white-space:nowrap; }
        .cleaner-name-cell { display:flex; flex-direction:column; gap:3px; min-width:0; }
        .cleaner-name-cell strong { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
          font-size:.8rem; font-weight:900; color:hsl(var(--foreground)); }
        .cleaner-name-cell span { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
          font-size:.68rem; color:hsl(var(--muted-foreground)); font-weight:800; }
        .date-text { font-size:0.76rem; color:hsl(var(--muted-foreground)); }
        .expand-btn { display:flex; align-items:center; justify-content:center; width:20px; height:20px;
          border-radius:5px; border:1px solid hsl(var(--border)); background:transparent; cursor:pointer;
          color:hsl(var(--muted-foreground)); flex-shrink:0; }
        .edit-input { min-width:80px; background:hsl(var(--input)); border:1px solid hsl(var(--border));
          border-radius:6px; padding:3px 7px; font-size:0.76rem; color:hsl(var(--foreground));
          font-family:inherit; outline:none; }
        .edit-input:focus { border-color:hsl(var(--primary)); }
        .edit-select { background:hsl(var(--input)); border:1px solid hsl(var(--border));
          border-radius:6px; padding:3px 7px; font-size:0.76rem; color:hsl(var(--foreground));
          font-family:inherit; outline:none; cursor:pointer; min-width:80px; }
        .row-actions { display:flex; align-items:center; gap:4px; }
        .action-btn { display:flex; align-items:center; justify-content:center; width:26px; height:26px;
          border-radius:7px; border:none; cursor:pointer; transition:all .12s; }
        .edit-btn { background:hsl(var(--muted)); color:hsl(var(--muted-foreground)); }
        .edit-btn:hover { background:hsl(var(--primary)/.12); color:hsl(var(--primary)); }
        .delete-btn { background:hsl(0 84% 60%/.1); color:hsl(0 84% 50%); }
        .delete-btn:hover { background:hsl(0 84% 60%/.2); color:hsl(0 84% 45%); }
        .save-btn { background:hsl(142 76% 36%/.12); color:hsl(142 76% 30%); margin-right:3px; }
        .save-btn:hover { background:hsl(142 76% 36%/.25); }
        .cancel-btn { background:hsl(0 84% 60%/.1); color:hsl(0 84% 50%); }
        .cancel-btn:hover { background:hsl(0 84% 60%/.2); }
        .loading-msg { text-align:center; padding:60px; color:hsl(var(--muted-foreground)); font-size:0.9rem; }
        .empty-accounts { text-align:center; padding:50px 20px; color:hsl(var(--muted-foreground)); font-size:.9rem; font-weight:800; }
        @media (max-width:900px) {
          .table-header { grid-template-columns:1fr; }
          .account-controls { justify-content:flex-start; }
          .account-search { min-width:100%; }
          table.main-table { min-width:1180px; }
          table.main-table th:nth-child(1), table.main-table td:nth-child(1) { width:260px; }
          table.main-table th:nth-child(2), table.main-table td:nth-child(2) { width:170px; }
          .account-primary { grid-template-columns:1fr; align-items:start; gap:4px; }
          .acc-city-badge { max-width:170px; justify-self:start; }
        }
      `}</style>

      <div className="commercial-page">
        <div className="commercial-head">
          <div>
            <h1 className="page-title">Commercial Accounts</h1>
            <p className="page-sub">Accounts sheet + Team supplies, including hidden rows, Last QC Check, and financial overview</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <Link
              href="/commercial/sales-track"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "12px",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
                color: "hsl(var(--foreground))",
                fontSize: "0.78rem",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              <TrendingUp size={15} color="hsl(142 76% 36%)" />
              Sales Track Report
            </Link>
            <button
              onClick={() => setIsCopilotOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "12px",
                border: "none",
                background: "linear-gradient(135deg, #059669, #0d9488)",
                color: "#ffffff",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
              type="button"
            >
              <Sparkles size={15} />
              Copiloto IA (Gemini)
            </button>
            <button className="add-account-btn" onClick={() => showAccountStudio ? closeAccountStudio() : openCreateStudio()} type="button">
              {showAccountStudio ? <X size={15} /> : <Plus size={15} />}
              {showAccountStudio ? "Close Form" : "Add Account"}
            </button>
          </div>
        </div>

        {showAccountStudio ? (
          <div
            className="account-studio-wrapper"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeAccountStudio();
              }
            }}
          >
            <AccountStudio
              mode={accountFormMode}
              editingAccount={editingAccount}
              draft={newAccount}
              error={formError}
              notice={formNotice}
              saving={savingNew}
              onChange={setNewAccount}
              onClose={closeAccountStudio}
              onSubmit={handleAccountSubmit}
            />
          </div>
        ) : null}

        <div className="stat-bar">
          <div className="stat-card"><div className="stat-label">Total Accounts</div><div className="stat-value">{accounts.length}</div><div className="stat-note">{filteredAccounts.length} visible</div></div>
          <div className="stat-card"><div className="stat-label">Monthly Revenue</div><div className="stat-value">${totalRevenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}</div><div className="stat-note">Booked billing</div></div>
          <div className="stat-card"><div className="stat-label">Monthly Cost</div><div className="stat-value">${totalCost.toLocaleString("en-US", { maximumFractionDigits: 0 })}</div><div className="stat-note">Cleaner cost</div></div>
          <div className="stat-card accent"><div className="stat-label">Monthly Profit</div><div className="stat-value">${(totalRevenue - totalCost).toLocaleString("en-US", { maximumFractionDigits: 0 })}</div><div className="stat-note">{totalRevenue ? Math.round(((totalRevenue - totalCost) / totalRevenue) * 100) : 0}% margin</div></div>
          <div className="stat-card"><div className="stat-label">Supplies Ready</div><div className="stat-value">{supplyReady}/{accounts.length}</div><div className="stat-note">{accountsNeedingQc} need QC</div></div>
          <div className="stat-card"><div className="stat-label">Keys Secured</div><div className="stat-value">{keyedAccounts}/{accounts.length}</div><div className="stat-note">Access tracked</div></div>
        </div>

        <div className="analytics-grid">
          <div className="analytics-card">
            <div className="analytics-title">Accounts by Cleaner</div>
            <table className="cleaner-table">
              <thead><tr><th>Cleaner</th><th style={{ textAlign: "center" }}>Accounts</th><th>% of Total</th></tr></thead>
              <tbody>
                {chartData.map((row) => (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td style={{ textAlign: "center", fontWeight: 700 }}>{row.value}</td>
                    <td style={{ width: "45%" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="pct-bar-wrap">
                          <div className="pct-bar" style={{ width: row.pct }} />
                        </div>
                        <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "hsl(var(--muted-foreground))", minWidth: 36 }}>{row.pct}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="analytics-card">
            <div className="analytics-title">Distribution by Cleaner</div>
            {accounts.length > 0 && (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95}
                    label={({ name, payload }: PieLabelRenderProps) => {
                      const pct = (payload as CleanerChartDatum | undefined)?.pct ?? "";
                      return name ? `${String(name).split(" ")[0]} ${pct}` : "";
                    }}
                    labelLine={false}>
                    {chartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value ?? 0} accounts`, name ?? ""]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="table-card">
          <div className="table-header">
            <div className="table-title"><Package size={16} />Commercial Accounts + Team Supplies</div>
            <div className="account-controls">
              <label className="account-search">
                <Search size={14} />
                <input
                  aria-label="Search accounts"
                  placeholder="Search account, cleaner, city..."
                  value={accountSearch}
                  onChange={(event) => setAccountSearch(event.target.value)}
                />
              </label>
              <div className="view-tabs" aria-label="Account views">
                {[
                  ["all", "All"],
                  ["needs-qc", "Needs QC"],
                  ["supplies", "Supplies"],
                  ["keys", "Keys"],
                ].map(([key, label]) => (
                  <button
                    className={`view-tab ${accountView === key ? "active" : ""}`}
                    key={key}
                    onClick={() => setAccountView(key as typeof accountView)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <SlidersHorizontal size={16} style={{ color: "hsl(var(--muted-foreground))" }} />
            </div>
          </div>
          {loading ? (
            <div className="loading-msg">Loading accounts…</div>
          ) : (
            <div className="table-wrap">
              <table className="main-table">
                <thead>
                  <tr>
                    <th>Account</th><th>Cleaner</th>
                    <th style={{ textAlign: "center" }}>All Supplies</th>
                    <th>Delivery Date</th><th>Est. Fill Date</th>
                    <th style={{ textAlign: "center" }}>Keys</th>
                    <th>Last QC Check</th>
                    <th>Notes</th>
                    <th style={{ textAlign: "right" }}>Revenue</th>
                    <th style={{ textAlign: "right" }}>Cost</th>
                    <th style={{ textAlign: "right" }}>Profit</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map((acc) => (
                    <AccountRow key={acc.id} acc={acc} onEdit={openEditStudio} onDelete={handleDeleteAccount} />
                  ))}
                </tbody>
              </table>
              {filteredAccounts.length === 0 ? <div className="empty-accounts">No accounts match this view.</div> : null}
            </div>
          )}
        </div>

        <AiSopCopilotModal
          isOpen={isCopilotOpen}
          onClose={() => setIsCopilotOpen(false)}
          onApplySopModifications={(mods) => {
            // Apply modifications to matching accounts in state
            setAccounts((prev) => {
              return prev.map((acc) => {
                const match = mods.find((m) => m.accountName && (acc.name.toLowerCase().includes(m.accountName.toLowerCase()) || m.accountName.toLowerCase().includes(acc.name.toLowerCase())));
                if (!match) return acc;
                const newRate = match.ratePerService !== undefined ? match.ratePerService : acc.rate_per_service;
                return {
                  ...acc,
                  hours: match.newHours !== undefined ? match.newHours : acc.hours,
                  cleaner_name: match.cleanerName || acc.cleaner_name,
                  revenue: match.newPricing !== undefined ? match.newPricing : acc.revenue,
                  cost: match.newCleanerCost !== undefined ? match.newCleanerCost : (newRate !== undefined ? newRate : acc.cost),
                  rate_per_service: newRate,
                  cleaner_flat_rate: newRate ?? acc.cleaner_flat_rate,
                  supplies_notes: match.notes ? `${acc.supplies_notes ? `${acc.supplies_notes}; ` : ""}${match.notes}` : acc.supplies_notes,
                };
              });
            });
          }}
          onApplyFullCopilotResponse={async (fullResp) => {
            if (fullResp.updateAccountFinancials && fullResp.updateAccountFinancials.length > 0) {
              setAccounts((prev) => {
                return prev.map((acc) => {
                  const match = fullResp.updateAccountFinancials?.find((f) => acc.name.toLowerCase().includes(f.accountName.toLowerCase()) || f.accountName.toLowerCase().includes(acc.name.toLowerCase()));
                  if (!match) return acc;
                  const newRate = match.ratePerService !== undefined ? match.ratePerService : acc.rate_per_service;
                  return {
                    ...acc,
                    revenue: match.revenue !== undefined ? match.revenue : acc.revenue,
                    cost: match.cost !== undefined ? match.cost : (newRate !== undefined ? newRate : acc.cost),
                    rate_per_service: newRate,
                    cleaner_flat_rate: newRate ?? acc.cleaner_flat_rate,
                    pricing_model: match.pricingModel || acc.pricing_model,
                  };
                });
              });
            }
            if (fullResp.sopModifications && fullResp.sopModifications.length > 0) {
              setAccounts((prev) => {
                return prev.map((acc) => {
                  const match = fullResp.sopModifications?.find((m) => acc.name.toLowerCase().includes(m.accountName?.toLowerCase() || "") || (m.accountName && m.accountName.toLowerCase().includes(acc.name.toLowerCase())));
                  if (!match) return acc;
                  const newRate = match.ratePerService !== undefined ? match.ratePerService : acc.rate_per_service;
                  return {
                    ...acc,
                    hours: match.newHours !== undefined ? match.newHours : acc.hours,
                    cleaner_name: match.cleanerName || acc.cleaner_name,
                    rate_per_service: newRate,
                    cleaner_flat_rate: newRate ?? acc.cleaner_flat_rate,
                    cost: match.newCleanerCost !== undefined ? match.newCleanerCost : (newRate !== undefined ? newRate : acc.cost),
                    supplies_notes: match.notes ? `${acc.supplies_notes ? `${acc.supplies_notes}; ` : ""}${match.notes}` : acc.supplies_notes,
                  };
                });
              });
            }
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("pristine:data-updated"));
            }
          }}
        />
      </div>
    </DashboardShell>
  );
}
