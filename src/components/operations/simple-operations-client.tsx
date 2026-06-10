"use client";

import Link from "next/link";
import { type ComponentProps, type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Edit3,
  FileDown,
  FileSpreadsheet,
  FileText,
  MoreVertical,
  PauseCircle,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
  UserRoundCheck,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { exportRows, exportWorkbook, exportCleanerGridReport } from "@/lib/export/workbook";
import { writeOperationTaskAudit, writePayrollAudit } from "@/lib/operations/audit";
import {
  buildCommercialOccurrences,
  getPayableCommercialHours,
} from "@/lib/operations/commercial-hours";
import {
  CARLOS_LOPEZ_NAME,
  CARLOS_OVERTIME_RATE,
  JUAN_ROMERO_NAME,
  ORANGE_COUNTY_CITIES,
  OUTSIDE_OC_CITY,
  WEEKDAY_NAMES,
} from "@/lib/operations/constants";
import { OPERATION_TASK_COLUMNS, loadOperationsData } from "@/lib/operations/data";
import { errorMessage, isMissingSchemaTableError, parseSupabaseError } from "@/lib/operations/errors";
import type {
  AccountDraft,
  ActivityRow,
  CommercialAccountRow,
  CommercialHoursDraft,
  CommercialHoursEntryRow,
  CommercialHoursStatus,
  CommercialScheduleDraft,
  CommercialScheduleRuleRow,
  CommercialSourceFilter,
  CommercialVerifiedFilter,
  EnvStatus,
  MessageTone,
  OperationTaskRow,
  PaymentKindFilter,
  PaymentModalMode,
  PaymentMode,
  PaymentRowDraft,
  ReportKind,
  ResidentialAccountRow,
  ResidentialWeeklyPaymentLineRow,
  ResidentialWeeklyPaymentRow,
  ResidentialWorkLogRow,
  SimpleOperationsView,
  StaffDraft,
  StaffMemberRow,
  StaffPipelineStatus,
  StaffTeamScope,
  TaskDraft,
  TaskTab,
  TaskViewMode,
  WeeklyPaymentStatus,
  WorkLogDraft,
  WorkLogStatus,
} from "@/lib/operations/types";
import {
  commercialHoursEntrySchema,
  commercialScheduleSchema,
  residentialPaymentRowSchema,
  staffMemberSchema,
  taskReminderSchema,
  validateInput,
  workLogSchema,
} from "@/lib/operations/validation";
import {
  RESIDENTIAL_ASSIGNEES,
  RESIDENTIAL_FREQUENCY_LABELS,
  TASK_FREQUENCY_LABELS,
  addDays,
  calculateResidentialHours,
  dateKeyFromValue,
  displayDate,
  formatDateKey,
  formatHours,
  formatMoney,
  getPeriodRange,
  isDateInRange,
  parseDateKey,
  roundHours,
  startOfWeek,
  todayKey,
  toNumber,
  weekRangeFromStart,
  type PeriodMode,
  type ResidentialAssignee,
  type ResidentialFrequency,
  type TaskReminderFrequency,
} from "@/lib/residential-operations";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type { SimpleOperationsView } from "@/lib/operations/types";

type MonthlySopImportSummary = {
  message: string;
  expected: number;
  created: number;
  duplicatesSkipped: number;
  archivedDuplicates?: number;
  updated: number;
  templatesVerified: number;
  recurrence: string;
  month: string;
  calendarStart: string;
  sourceDocument: string;
  processed: number;
};

const EMPTY_TASK_DRAFT: TaskDraft = {
  title: "",
  description: "",
  assignee: "Carlos Lopez",
  dueDate: todayKey(),
  frequency: "one_time",
  customIntervalDays: "",
  priority: "normal",
  notifyAssignee: true,
  notifyOwnerOnCompletion: true,
};

const EMPTY_ACCOUNT_DRAFT: AccountDraft = {
  accountName: "",
  scheduledHours: "",
  frequency: "weekly",
  frequencyDetail: "Every Wednesday",
  dayOfWeek: "",
  city: "",
  customCity: "",
  assignedTeamId: "",
  assignedTeamName: "",
  active: true,
  notes: "",
};

const EMPTY_WORK_LOG_DRAFT: WorkLogDraft = {
  accountId: "",
  teamId: "",
  workDate: todayKey(),
  hoursWorked: "",
  notes: "",
  status: "pending",
};

const EMPTY_STAFF_DRAFT: StaffDraft = {
  name: "",
  email: "",
  role: "Residential Cleaner / Team",
  teamScope: "residential",
  status: "Active",
  hourlyRate: "",
  paymentMode: "residential_only",
  active: true,
};

const EMPTY_PAYMENT_ROW_DRAFT: PaymentRowDraft = {
  cleanerId: "",
  cleanerName: "",
  workDate: todayKey(),
  city: "",
  customCity: "",
  paymentAmount: "",
  residentialAmount: "",
  commercialAmount: "",
  notes: "",
  status: "pending",
};

const EMPTY_COMMERCIAL_HOURS_DRAFT: CommercialHoursDraft = {
  accountId: "",
  teamId: "",
  teamName: "",
  workDate: todayKey(),
  hours: "",
  status: "completed",
  verified: false,
  notes: "",
  manualEntry: true,
};

const EMPTY_COMMERCIAL_SCHEDULE_DRAFT: CommercialScheduleDraft = {
  accountId: "",
  assignedTeamId: "",
  assignedTeamName: "",
  frequency: "weekly",
  selectedDays: [],
  dayHours: {},
  effectiveFrom: todayKey(),
  effectiveUntil: "",
  active: true,
  notes: "",
};

function normalizeTaskStatus(status: string | null | undefined): "pending" | "completed" {
  return status === "completed" || status === "done" ? "completed" : "pending";
}

function normalizeResidentialFrequency(value: string | null | undefined): ResidentialFrequency {
  if (value === "every_2_weeks" || value === "every_3_weeks" || value === "monthly" || value === "custom") return value;
  return "weekly";
}

function frequencyFromRecurrence(value: string | null | undefined): TaskReminderFrequency {
  if (value === "daily" || value === "weekly" || value === "monthly" || value === "custom") return value;
  if (value === "biweekly" || value === "every_2_weeks") return "every_2_weeks";
  return "one_time";
}

function recurrenceFromFrequency(value: TaskReminderFrequency) {
  if (value === "one_time") return "none";
  if (value === "every_2_weeks") return "biweekly";
  return value;
}

function normalizeAssignee(value: string | null | undefined): ResidentialAssignee {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "jake ivan-pal" ? "Jake Ivan-Pal" : "Carlos Lopez";
}

function metadataFlag(metadata: Record<string, unknown> | null | undefined, key: string, fallback: boolean) {
  const value = metadata?.[key];
  return typeof value === "boolean" ? value : fallback;
}

function metadataText(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

function notificationAlreadySent(task: OperationTaskRow, key: "assignment_notification_sent_at" | "completion_notification_sent_at") {
  return Boolean(metadataText(task.metadata, key));
}

function taskIsOperationsReminder(task: OperationTaskRow) {
  const panel = String(task.panel ?? "").toLowerCase();
  const unit = String(task.business_unit ?? "").toLowerCase();
  return panel !== "seo" && panel !== "commercial" && unit !== "seo" && unit !== "commercial" && !task.deleted_at;
}

function taskSourceDocument(task: OperationTaskRow) {
  const metadata = task.metadata ?? {};
  return typeof metadata.source_document_name === "string" ? metadata.source_document_name : null;
}

function normalizedTaskTitle(title: string | null | undefined) {
  return String(title ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function operationTaskDedupeKey(task: OperationTaskRow) {
  const metadata = task.metadata ?? {};
  if (typeof metadata.dedupe_key === "string" && metadata.dedupe_key.trim()) return metadata.dedupe_key;
  return [
    taskSourceDocument(task) ?? "manual",
    metadata.target_month ?? "",
    metadata.target_year ?? "",
    metadata.source_section ?? "",
    dateKeyFromValue(task.due_date) ?? "",
    normalizedTaskTitle(task.title),
  ].join("|");
}

function dedupeOperationTasks(rows: OperationTaskRow[]) {
  const byKey = new Map<string, OperationTaskRow>();
  for (const task of rows) {
    const key = operationTaskDedupeKey(task);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, task);
      continue;
    }
    const existingCompleted = normalizeTaskStatus(existing.status) === "completed";
    const currentCompleted = normalizeTaskStatus(task.status) === "completed";
    if (currentCompleted && !existingCompleted) byKey.set(key, task);
  }
  return Array.from(byKey.values());
}

function isJuanRomero(name: string | null | undefined) {
  const normalized = String(name ?? "").trim().toLowerCase();
  return normalized === "juan romero" || normalized === "juan";
}

function isCarlosLopez(name: string | null | undefined) {
  return String(name ?? "").trim().toLowerCase() === "carlos lopez";
}

function normalizeStaffStatus(person: Pick<StaffMemberRow, "active" | "deleted_at" | "status">): "active" | "potential" | "inactive" {
  const status = String(person.status ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if (person.deleted_at || status === "inactive" || status === "removed") return "inactive";
  if (status === "potential" || status === "candidate" || status === "prospect" || status === "applicant") return "potential";
  if (person.active === false) return "inactive";
  return "active";
}

function staffIsActive(person: StaffMemberRow) {
  return normalizeStaffStatus(person) === "active";
}

function staffIsPotentialCleaner(person: StaffMemberRow) {
  return normalizeStaffStatus(person) === "potential" && !["owner", "operations manager"].includes(String(person.role ?? "").toLowerCase());
}

function staffScope(person: Pick<StaffMemberRow, "role" | "team_scope">): StaffTeamScope {
  const source = `${person.team_scope ?? ""} ${person.role ?? ""}`.toLowerCase();
  if (source.includes("mixed")) return "mixed";
  if (source.includes("commercial") || source.includes("janitorial") || source.includes("porter") || source.includes("office") || source.includes("restaurant") || source.includes("construction") || source.includes("account manager")) return "commercial";
  return "residential";
}

function staffScopeLabel(scope: StaffTeamScope) {
  if (scope === "commercial") return "Commercial";
  if (scope === "mixed") return "Mixed route";
  return "Residential";
}

function roleForStaffScope(scope: StaffTeamScope) {
  if (scope === "commercial") return "Commercial Cleaner";
  if (scope === "mixed") return "Mixed Route Cleaner";
  return "Residential Cleaner / Team";
}

function displayStaffRole(person: StaffMemberRow) {
  return person.display_role || person.role || roleForStaffScope(staffScope(person));
}

function staffDraftStatus(person: StaffMemberRow): StaffPipelineStatus {
  const status = normalizeStaffStatus(person);
  if (status === "potential") return "Potential";
  if (status === "inactive") return "Inactive";
  return "Active";
}

function normalizePaymentMode(value: string | null | undefined, name: string | null | undefined): PaymentMode {
  if (isJuanRomero(name)) return "mixed";
  if (value === "mixed") return "mixed";
  return "residential_only";
}

function isMixedPaySummary(summary: { team?: StaffMemberRow; teamName: string }) {
  return isJuanRomero(summary.teamName) || staffScope(summary.team ?? { role: "", team_scope: null }) === "mixed";
}

function canScheduleResidential(person: StaffMemberRow) {
  const scope = staffScope(person);
  return scope === "residential" || scope === "mixed";
}

function canScheduleCommercial(person: StaffMemberRow) {
  const scope = staffScope(person);
  return scope === "commercial" || scope === "mixed";
}

function teamKey(teamId: string | null | undefined, teamName: string) {
  if (isJuanRomero(teamName)) return "juan-romero";
  if (isCarlosLopez(teamName)) return "carlos-lopez-operations";
  return teamId || teamName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function makeTeamEmail(name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "") || "team";
  return `${slug}@pristine.local`;
}

function messageClass(tone: MessageTone) {
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50";
  if (tone === "error") return "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50";
  return "border-border bg-muted/30 text-foreground";
}

function actionLabel(action: string) {
  if (action === "task_assigned") return "Task assigned";
  if (action === "task_completed") return "Task completed";
  if (action === "task_deleted") return "Task deleted";
  if (action === "task_created") return "Reminder created";
  if (action === "task_updated") return "Reminder edited";
  if (action === "notification_sent") return "Notification sent";
  if (action === "notification_failed") return "Notification failed";
  if (action === "notification_skipped") return "Notification skipped";
  return action.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function cleanNotificationReason(reason: string | null) {
  if (!reason) return null;
  const lower = reason.toLowerCase();
  if (
    lower.includes("smtp.gmail.com") ||
    lower.includes("gmail smtp") ||
    lower.includes("esocket") ||
    lower.includes("etimedout") ||
    lower.includes("econnection")
  ) {
    return reason.length > 160 ? `${reason.slice(0, 157)}...` : reason;
  }
  if (lower.includes("email_provider_missing") || lower.includes("production email provider is not configured")) {
    return "SMTP credentials are not configured.";
  }
  return reason.length > 160 ? `${reason.slice(0, 157)}...` : reason;
}

function isEmailProviderMissingDetails(details: Record<string, unknown> | null | undefined) {
  const code = typeof details?.code === "string" ? details.code : "";
  const reason = typeof details?.reason === "string" ? details.reason.toLowerCase() : "";
  const message = typeof details?.message === "string" ? details.message.toLowerCase() : "";
  return code === "EMAIL_PROVIDER_MISSING" || reason.includes("email provider is not configured") || message.includes("email provider is not configured");
}

function dateRangeLabel(start: string, end: string) {
  return `${displayDate(start)} - ${displayDate(end)}`;
}

function paymentLineTotal(row: Pick<ResidentialWeeklyPaymentLineRow, "payment_amount" | "residential_amount" | "commercial_amount" | "payment_type">) {
  const isOperations = (row as any).payment_type === "operations_overtime";
  const isMixed = (row as any).payment_type === "mixed";
  if (isOperations || isMixed) {
    return toNumber(row.residential_amount) + toNumber(row.commercial_amount);
  }
  return toNumber(row.payment_amount);
}

function paymentSummaryStatus(summary: { rows: ResidentialWeeklyPaymentLineRow[]; payment?: ResidentialWeeklyPaymentRow }) {
  if (summary.rows.length > 0) return summary.rows.every((row) => row.status === "paid") ? "paid" : "pending";
  return summary.payment?.status === "paid" ? "paid" : "pending";
}

function displayPaymentCity(row: Pick<ResidentialWeeklyPaymentLineRow, "city" | "custom_city">) {
  return row.city === OUTSIDE_OC_CITY ? row.custom_city || OUTSIDE_OC_CITY : row.city || "No city";
}

function displayShortDate(value: string | null | undefined) {
  const date = parseDateKey(value);
  if (!date) return "No date";
  return date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" });
}

function monthWindow(value: string) {
  const anchor = parseDateKey(value) ?? new Date();
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return {
    start,
    end,
    startKey: formatDateKey(start),
    endKey: formatDateKey(end),
    month: start.getMonth() + 1,
    year: start.getFullYear(),
    label: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
  };
}

function statusBadgeClass(status: string | null | undefined) {
  if (status === "paid" || status === "verified" || status === "completed" || status === "active" || status === "approved") return "border-emerald-200/80 bg-emerald-50/80 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-100";
  if (status === "needs_review" || status === "pending_payment" || status === "pending" || status === "potential") return "border-amber-200/80 bg-amber-50/80 text-amber-800 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100";
  if (status === "overdue" || status === "urgent") return "border-rose-200/80 bg-rose-50/80 text-rose-800 dark:border-rose-900 dark:bg-rose-950/25 dark:text-rose-100";
  if (status === "skipped" || status === "no_jobs" || status === "inactive") return "border-slate-200/80 bg-slate-50/80 text-slate-600 dark:border-slate-800 dark:bg-slate-900/25 dark:text-slate-200";
  return "border-border/75 bg-card/70 text-muted-foreground";
}

function statusLabel(status: string | null | undefined) {
  if (status === "pending") return "Pending";
  if (status === "paid") return "Paid";
  if (status === "verified") return "Verified";
  if (status === "completed") return "Completed";
  if (status === "active") return "Active";
  if (status === "potential") return "Potential";
  if (status === "inactive") return "Inactive";
  if (status === "approved") return "Approved";
  if (status === "scheduled") return "Scheduled";
  if (status === "pending_payment") return "Pending payment";
  if (status === "needs_review") return "Needs review";
  if (status === "no_jobs") return "No jobs";
  if (status === "overdue") return "Overdue";
  if (status === "skipped") return "No eligible service";
  if (!status) return "Pending";
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function dateOutsideRange(value: string, start: string, end: string) {
  return Boolean(value && (value < start || value > end));
}

function AppMetricCard({
  icon: Icon,
  label,
  value,
  note,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  note?: string;
  tone?: "neutral" | "good" | "warn";
}) {
  const iconBg =
    tone === "warn"
      ? "rgba(245,158,11,0.12)"
      : tone === "good"
      ? "rgba(16,185,129,0.12)"
      : "hsl(var(--primary)/.10)";
  const iconColor =
    tone === "warn" ? "#d97706" : tone === "good" ? "#059669" : "hsl(var(--primary))";
  const glowColor =
    tone === "warn"
      ? "rgba(245,158,11,0.18)"
      : tone === "good"
      ? "rgba(16,185,129,0.18)"
      : "hsl(var(--primary)/.14)";
  const valColor =
    tone === "warn"
      ? "#b45309"
      : tone === "good"
      ? "#047857"
      : "hsl(var(--foreground))";

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        padding: "18px 22px 16px",
        borderRadius: "16px",
        border: "1px solid",
        borderColor:
          tone === "warn"
            ? "rgba(217,119,6,0.22)"
            : tone === "good"
            ? "rgba(16,185,129,0.22)"
            : "hsl(var(--border)/.7)",
        background: "hsl(var(--card))",
        boxShadow:
          "0 1px 3px hsl(215 30% 15%/.04), 0 6px 24px -10px hsl(215 30% 15%/.08)",
        overflow: "hidden",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLElement).style.boxShadow =
          "0 8px 32px -10px hsl(215 30% 15%/.14), 0 2px 8px hsl(215 30% 15%/.06)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "";
        (e.currentTarget as HTMLElement).style.boxShadow =
          "0 1px 3px hsl(215 30% 15%/.04), 0 6px 24px -10px hsl(215 30% 15%/.08)";
      }}
    >
      {/* Radial glow accent */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "120px",
          height: "120px",
          borderRadius: "50%",
          background: `radial-gradient(ellipse at top right, ${glowColor}, transparent 70%)`,
          pointerEvents: "none",
        }}
      />
      {/* Left: label + number + note */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
        <p
          style={{
            margin: 0,
            fontSize: "0.67rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            color: "hsl(var(--muted-foreground))",
            lineHeight: 1,
          }}
        >
          {label}
        </p>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: "2.1rem",
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: "-0.025em",
            color: valColor,
          }}
        >
          {value}
        </p>
        {note ? (
          <p
            style={{
              margin: "5px 0 0",
              fontSize: "0.7rem",
              fontWeight: 500,
              lineHeight: 1.3,
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {note}
          </p>
        ) : null}
      </div>
      {/* Right: Icon box */}
      <div
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: iconBg,
          color: iconColor,
          flexShrink: 0,
        }}
      >
        <Icon size={20} />
      </div>
    </div>
  );
}

function MetricCard(props: ComponentProps<typeof AppMetricCard>) {
  return <AppMetricCard {...props} />;
}


function AppPageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  actions?: ReactNode;
}) {
  return (
    <section className="py-0.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="mt-1 text-[2rem] font-semibold leading-tight tracking-[-0.02em] text-foreground flex items-center gap-2.5">
            <Icon className="size-6 text-primary shrink-0" />
            <span>{title}</span>
          </h1>
          <p className="mt-1 max-w-3xl text-[0.82rem] font-medium text-muted-foreground leading-relaxed">{subtitle}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div> : null}
      </div>
    </section>
  );
}

function AppSegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="inline-flex h-10 max-w-full overflow-x-auto rounded-xl border border-border/70 bg-background/80 p-1" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          type="button"
          className={cn(
            "h-8 whitespace-nowrap rounded-lg px-3 text-xs font-semibold text-muted-foreground transition hover:bg-accent/55 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
            value === option.value && "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground",
          )}
          key={option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function PeriodSegment({ value, onChange }: { value: PeriodMode; onChange: (value: PeriodMode) => void }) {
  const options: { value: PeriodMode; label: string }[] = [
    { value: "week", label: "This week" },
    { value: "biweekly", label: "Every 15 days" },
    { value: "month", label: "This month" },
  ];

  return (
    <AppSegmentedControl ariaLabel="Calculation period" value={value} options={options} onChange={onChange} />
  );
}

const PAYMENT_PANEL_CLASS = "sop-toolbar";
const PAYMENT_FIELD_CLASS = "h-10 min-w-0 rounded-xl border border-input bg-card/80 px-3 text-xs font-semibold text-foreground outline-none shadow-sm transition placeholder:text-muted-foreground focus:border-primary/45 focus:ring-2 focus:ring-primary/10";
const PAYMENT_LABEL_CLASS = "grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground";
const PAYMENT_ICON_BUTTON_CLASS = "inline-grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-accent/55 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-45";
const PAYMENT_MODAL_PANEL_CLASS = "max-h-[90dvh] w-full overflow-auto rounded-2xl border border-border/70 bg-card shadow-[0_28px_80px_-42px_hsl(215_40%_18%)]";
const SOP_PANEL_CLASS = "sop-card";
const SOP_TABLE_WRAP_CLASS = "overflow-hidden rounded-2xl border border-border/70 bg-card/70";
const SOP_ACTION_BUTTON_CLASS = "h-10 rounded-xl px-3.5 text-xs font-semibold";
const SOP_EMPTY_CLASS = "rounded-2xl border border-dashed border-border/70 bg-background/50 p-6 text-center text-xs font-medium text-muted-foreground";
const SOP_ROW_CLASS = "rounded-xl border border-border/70 bg-card/60 p-3 transition hover:border-primary/30 hover:bg-accent/20";
const SOP_CLOSE_BUTTON_CLASS = "grid size-10 place-items-center rounded-xl text-muted-foreground transition hover:bg-accent/55 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-50";

export function SimpleOperationsClient({
  view,
  envStatus,
}: {
  view: SimpleOperationsView;
  envStatus?: EnvStatus;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ tone: MessageTone; text: string } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [tasks, setTasks] = useState<OperationTaskRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [accounts, setAccounts] = useState<ResidentialAccountRow[]>([]);
  const [workLogs, setWorkLogs] = useState<ResidentialWorkLogRow[]>([]);
  const [weeklyPayments, setWeeklyPayments] = useState<ResidentialWeeklyPaymentRow[]>([]);
  const [weeklyPaymentRows, setWeeklyPaymentRows] = useState<ResidentialWeeklyPaymentLineRow[]>([]);
  const [commercialAccounts, setCommercialAccounts] = useState<CommercialAccountRow[]>([]);
  const [commercialScheduleRules, setCommercialScheduleRules] = useState<CommercialScheduleRuleRow[]>([]);
  const [commercialHoursEntries, setCommercialHoursEntries] = useState<CommercialHoursEntryRow[]>([]);
  const [staff, setStaff] = useState<StaffMemberRow[]>([]);
  const [taskTab, setTaskTab] = useState<TaskTab>("pending");
  const [taskSearch, setTaskSearch] = useState("");
  const [taskSourceFilter, setTaskSourceFilter] = useState<"all" | "monthly_sop">("all");
  const [taskViewMode, setTaskViewMode] = useState<TaskViewMode>("month");
  const [taskSelectedDay, setTaskSelectedDay] = useState(todayKey());
  const [taskCalendarAnchor, setTaskCalendarAnchor] = useState(() => formatDateKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [importingMonthlySop, setImportingMonthlySop] = useState(false);
  const monthlySopAutoImportAttempted = useRef(new Set<string>());
  const [monthlySopImportSummary, setMonthlySopImportSummary] = useState<MonthlySopImportSummary | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [taskFormError, setTaskFormError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<OperationTaskRow | null>(null);
  const [savingTask, setSavingTask] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [accountDraft, setAccountDraft] = useState<AccountDraft | null>(null);
  const [savingAccount, setSavingAccount] = useState(false);
  const [workLogDraft, setWorkLogDraft] = useState<WorkLogDraft>(EMPTY_WORK_LOG_DRAFT);
  const [savingWorkLog, setSavingWorkLog] = useState(false);
  const [staffDraft, setStaffDraft] = useState<StaffDraft | null>(null);
  const [savingStaff, setSavingStaff] = useState(false);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("week");
  const periodAnchor = todayKey();
  const [paymentWeekStart, setPaymentWeekStart] = useState(() => formatDateKey(startOfWeek(new Date())));
  const [paymentRowDrafts, setPaymentRowDrafts] = useState<Record<string, PaymentRowDraft>>({});
  const [expandedCleaners, setExpandedCleaners] = useState<Record<string, boolean>>({});
  const [activeDropdownRowId, setActiveDropdownRowId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number; row: any; summary: any; mixed: boolean; isCleaner: boolean } | null>(null);
  const [isExtraHours, setIsExtraHours] = useState(false);
  const [extraHoursValue, setExtraHoursValue] = useState("");
  const [commercialHoursDraft, setCommercialHoursDraft] = useState<CommercialHoursDraft>(EMPTY_COMMERCIAL_HOURS_DRAFT);
  const [commercialScheduleDraft, setCommercialScheduleDraft] = useState<CommercialScheduleDraft>(EMPTY_COMMERCIAL_SCHEDULE_DRAFT);
  const [paymentModalMode, setPaymentModalMode] = useState<PaymentModalMode | null>(null);
  const [commercialPanelOpen, setCommercialPanelOpen] = useState(false);
  const [paymentsRegistryOpen, setPaymentsRegistryOpen] = useState(false);
  const [activePaymentSummaryKey, setActivePaymentSummaryKey] = useState<string | null>(null);
  const [savingPaymentKey, setSavingPaymentKey] = useState<string | null>(null);
  const [deletingPaymentRowId, setDeletingPaymentRowId] = useState<string | null>(null);
  const [showAllPaymentCleaners, setShowAllPaymentCleaners] = useState(true);
  const [paymentFilter, setPaymentFilter] = useState("");
  const [paymentCleanerFilter, setPaymentCleanerFilter] = useState("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [paymentKindFilter, setPaymentKindFilter] = useState<PaymentKindFilter>("all");
  const [paymentCityFilter, setPaymentCityFilter] = useState("all");
  const [commercialAccountFilter, setCommercialAccountFilter] = useState("all");
  const [commercialTeamFilter, setCommercialTeamFilter] = useState("all");
  const [commercialStatusFilter, setCommercialStatusFilter] = useState("all");
  const [commercialVerifiedFilter, setCommercialVerifiedFilter] = useState<CommercialVerifiedFilter>("all");
  const [commercialSearchFilter, setCommercialSearchFilter] = useState("");
  const [commercialSourceFilter, setCommercialSourceFilter] = useState<CommercialSourceFilter>("all");
  const [commercialCustomStart, setCommercialCustomStart] = useState("");
  const [commercialCustomEnd, setCommercialCustomEnd] = useState("");
  const [commercialDateMenuOpen, setCommercialDateMenuOpen] = useState(false);
  const [carlosWeeklyPayment, setCarlosWeeklyPayment] = useState("");
  const [carlosOvertimeHours, setCarlosOvertimeHours] = useState("");
  const [staffSearch, setStaffSearch] = useState("");
  const [staffScopeFilter, setStaffScopeFilter] = useState<"all" | StaffTeamScope>("all");
  const [staffStatusFilter, setStaffStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [reportKind, setReportKind] = useState<ReportKind>("tasks");

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      setUserId(user.id);
      setUserEmail(user.email ?? null);

      const {
        taskResult,
        activityResult,
        accountResult,
        workLogResult,
        weeklyPaymentResult,
        weeklyPaymentRowResult,
        staffResult,
        commercialAccountResult,
        commercialScheduleResult,
        commercialHoursResult,
      } = await loadOperationsData(supabase);

    const requiredErrors = [taskResult.error, activityResult.error, staffResult.error].filter(Boolean);
    const residentialTableErrors = [accountResult.error, workLogResult.error, weeklyPaymentResult.error, weeklyPaymentRowResult.error, commercialHoursResult.error].filter(Boolean);
    const commercialOptionalErrors = [commercialAccountResult.error, commercialScheduleResult.error].filter(Boolean);
    const nonSetupResidentialErrors = residentialTableErrors.filter((error) => !isMissingSchemaTableError(error));
    const errors = [...requiredErrors, ...nonSetupResidentialErrors, ...commercialOptionalErrors.filter((error) => !isMissingSchemaTableError(error))].map((error) => parseSupabaseError(error)).filter(Boolean);
    const setupPending = residentialTableErrors.some(isMissingSchemaTableError);

    if (errors.length) {
      setMessage({
        tone: "error",
        text: `Some operations data could not load: ${errors.join(" | ")}`,
      });
    } else if (setupPending) {
      setMessage({
        tone: "info",
        text: "Residential payments setup needs a database update before new entries can appear.",
      });
    }

      setTasks(dedupeOperationTasks(((taskResult.data ?? []) as unknown as OperationTaskRow[]).filter(taskIsOperationsReminder)));
      setActivity((activityResult.data ?? []) as unknown as ActivityRow[]);
      setAccounts(isMissingSchemaTableError(accountResult.error) ? [] : (accountResult.data ?? []) as unknown as ResidentialAccountRow[]);
      setWorkLogs(isMissingSchemaTableError(workLogResult.error) ? [] : (workLogResult.data ?? []) as unknown as ResidentialWorkLogRow[]);
      setWeeklyPayments(isMissingSchemaTableError(weeklyPaymentResult.error) ? [] : (weeklyPaymentResult.data ?? []) as unknown as ResidentialWeeklyPaymentRow[]);
      setWeeklyPaymentRows(isMissingSchemaTableError(weeklyPaymentRowResult.error) ? [] : (weeklyPaymentRowResult.data ?? []) as unknown as ResidentialWeeklyPaymentLineRow[]);
      setCommercialAccounts(isMissingSchemaTableError(commercialAccountResult.error) ? [] : (commercialAccountResult.data ?? []) as unknown as CommercialAccountRow[]);
      setCommercialScheduleRules(isMissingSchemaTableError(commercialScheduleResult.error) ? [] : (commercialScheduleResult.data ?? []) as unknown as CommercialScheduleRuleRow[]);
      setCommercialHoursEntries(isMissingSchemaTableError(commercialHoursResult.error) ? [] : (commercialHoursResult.data ?? []) as unknown as CommercialHoursEntryRow[]);
      
      const currentStaff = (staffResult.data ?? []) as unknown as StaffMemberRow[];
      
      const { data: allStaffData } = await supabase
        .from("staff_members")
        .select("name")
        .eq("user_id", user.id);

      const existingStaffNames = new Set(
        (allStaffData ?? []).map((s) => s.name.trim().toLowerCase())
      );

      const seedCleaners = [
        "Juan Romero", "Sandra Hernandez", "Lorena Benitez", "Luz Uribe",
        "Mirna Contreras", "Esperanza Youseff", "Esperanza Yoseff", "Ana Morales",
        "Maria Lopez", "Emmi Guerra", "Lucia Portillo", "Kassandra Valentin"
      ];

      const staffToInsert = [];
      const nowString = new Date().toISOString();
      for (const name of seedCleaners) {
        const normalized = name.trim().toLowerCase();
        if (!existingStaffNames.has(normalized)) {
          const isMixed = ["juan romero", "lorena benitez", "esperanza youseff", "esperanza yoseff"].includes(normalized);
          const emailName = name.toLowerCase().replace(/[^a-z0-9]+/g, ".");
          staffToInsert.push({
            user_id: user.id,
            name: name,
            email: `${emailName}@pristine.local`,
            role: isMixed ? "Mixed Route Cleaner" : "Commercial Cleaner",
            display_role: isMixed ? "Mixed Route Cleaner" : "Commercial Cleaner",
            team_scope: isMixed ? "mixed" : "commercial",
            payment_mode: isMixed ? "mixed" : "residential_only",
            commercial_payroll_eligible: !isMixed,
            status: "Active",
            active: true,
            created_at: nowString,
            updated_at: nowString,
          });
        }
      }

      if (staffToInsert.length > 0) {
        const { error: staffInsertError } = await supabase
          .from("staff_members")
          .insert(staffToInsert);
        if (staffInsertError) {
          console.error("Error auto-seeding staff members in operations client:", staffInsertError);
        } else {
          console.log(`Auto-seeded ${staffToInsert.length} staff members.`);
          // Re-fetch staff members to update state in real-time
          const { data: refetchedStaff } = await supabase
            .from("staff_members")
            .select("*")
            .is("deleted_at", null)
            .order("name")
            .limit(700);
          if (refetchedStaff) {
            setStaff(refetchedStaff as unknown as StaffMemberRow[]);
          } else {
            setStaff(currentStaff);
          }
        }
      } else {
        setStaff(currentStaff);
      }
    } catch (error) {
      setMessage({ tone: "error", text: `Operations data could not load: ${errorMessage(error)}` });
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  const today = todayKey();
  const periodRange = getPeriodRange(periodMode, periodAnchor);
  const activeAccounts = useMemo(() => accounts.filter((account) => account.active !== false), [accounts]);
  const activeTeams = useMemo(() => staff.filter((person) => staffIsActive(person) && !["owner", "operations manager"].includes(String(person.role ?? "").toLowerCase()) && !["jake ivan-pal", "carlos lopez"].includes(person.name.toLowerCase())), [staff]);
  const activeResidentialTeams = useMemo(() => activeTeams.filter(canScheduleResidential), [activeTeams]);
  const activeCommercialTeams = useMemo(() => activeTeams.filter(canScheduleCommercial), [activeTeams]);
  const potentialCleaners = useMemo(() => staff.filter((person) => staffIsPotentialCleaner(person) && !["jake ivan-pal", "carlos lopez"].includes(person.name.toLowerCase())), [staff]);
  const potentialResidentialCleaners = useMemo(() => potentialCleaners.filter((person) => staffScope(person) !== "commercial"), [potentialCleaners]);
  const potentialCommercialCleaners = useMemo(() => potentialCleaners.filter((person) => staffScope(person) !== "residential"), [potentialCleaners]);
  const teamByKey = useMemo(() => {
    const map = new Map<string, StaffMemberRow>();
    for (const team of activeTeams) {
      map.set(teamKey(team.id, team.name), team);
      map.set(team.name.toLowerCase(), team);
    }
    return map;
  }, [activeTeams]);
  const operationsLeads = useMemo(() => {
    const known = new Map<string, StaffMemberRow>();
    for (const person of staff) {
      if (person.name.toLowerCase() === "jake ivan-pal" || person.name.toLowerCase() === "carlos lopez") known.set(person.name.toLowerCase(), person);
    }
    return RESIDENTIAL_ASSIGNEES.map((name) => known.get(name.toLowerCase()) ?? {
      id: name,
      name,
      email: name === "Jake Ivan-Pal" ? "OWNER_EMAIL" : "OPERATIONS_MANAGER_EMAIL",
      role: name === "Jake Ivan-Pal" ? "Owner" : "Operations Manager",
      status: "Active",
    });
  }, [staff]);

  const taskStats = useMemo(() => {
    const pending = tasks.filter((task) => normalizeTaskStatus(task.status) === "pending");
    const completed = tasks.filter((task) => normalizeTaskStatus(task.status) === "completed");
    const overdue = pending.filter((task) => task.due_date && dateKeyFromValue(task.due_date) < today);
    const dueToday = pending.filter((task) => dateKeyFromValue(task.due_date) === today);
    const weekStart = formatDateKey(startOfWeek(new Date()));
    const weekEnd = formatDateKey(addDays(startOfWeek(new Date()), 6));
    const completedThisWeek = completed.filter((task) => isDateInRange(task.completed_at ?? task.updated_at, weekStart, weekEnd));
    return { pending, completed, overdue, dueToday, completedThisWeek };
  }, [tasks, today]);
  const visibleTaskMonth = useMemo(() => monthWindow(taskCalendarAnchor), [taskCalendarAnchor]);
  const monthlySopTasksForVisibleMonth = useMemo(() => {
    return tasks.filter((task) => {
      const dueDate = dateKeyFromValue(task.due_date);
      return taskSourceDocument(task) === "Monthly SOP" && Boolean(dueDate && dueDate >= visibleTaskMonth.startKey && dueDate <= visibleTaskMonth.endKey);
    });
  }, [tasks, visibleTaskMonth.endKey, visibleTaskMonth.startKey]);
  const monthlySopTaskCount = monthlySopTasksForVisibleMonth.length;
  const selectedMonthCanGenerateSop = visibleTaskMonth.year > 2026 || (visibleTaskMonth.year === 2026 && visibleTaskMonth.month >= 6);

  const importMonthlySop = useCallback(async (target = visibleTaskMonth) => {
    if (importingMonthlySop) return;
    setImportingMonthlySop(true);
    setMonthlySopImportSummary(null);
    try {
      const response = await fetch("/api/residential-sop/import-monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: target.month, year: target.year }),
      });
      const result = await response.json() as Partial<MonthlySopImportSummary> & { ok?: boolean; error?: string };
      if (!response.ok || result.error) throw new Error(result.error ?? "Monthly SOP import failed.");
      const summary = result as MonthlySopImportSummary;
      setMonthlySopImportSummary(summary);
      setTaskSourceFilter("monthly_sop");
      setTaskViewMode("month");
      setTaskCalendarAnchor(target.startKey);
      setTaskSelectedDay(target.startKey);
      setTaskTab("all");
      setMessage({ tone: result.ok === false ? "error" : "success", text: summary.message });
      await loadData();
    } catch (error) {
      setMessage({ tone: "error", text: `Monthly SOP could not be imported: ${errorMessage(error)}` });
    } finally {
      setImportingMonthlySop(false);
    }
  }, [importingMonthlySop, loadData, visibleTaskMonth]);

  useEffect(() => {
    if (view !== "tasks" || loading || importingMonthlySop || !selectedMonthCanGenerateSop || monthlySopTaskCount >= 56) return;
    if (monthlySopAutoImportAttempted.current.has(visibleTaskMonth.key)) return;
    monthlySopAutoImportAttempted.current.add(visibleTaskMonth.key);
    const timeoutId = window.setTimeout(() => {
      void importMonthlySop(visibleTaskMonth);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [importMonthlySop, importingMonthlySop, loading, monthlySopTaskCount, selectedMonthCanGenerateSop, view, visibleTaskMonth]);

  const filteredTasks = useMemo(() => {
    const search = taskSearch.trim().toLowerCase();
    return tasks.filter((task) => {
      const status = normalizeTaskStatus(task.status);
      const overdue = status === "pending" && Boolean(task.due_date && dateKeyFromValue(task.due_date) < today);
      if (taskTab === "pending" && (status !== "pending" || overdue)) return false;
      if (taskTab === "completed" && status !== "completed") return false;
      if (taskTab === "overdue" && !overdue) return false;
      if (taskSourceFilter === "monthly_sop" && taskSourceDocument(task) !== "Monthly SOP") return false;
      if (search) {
        const haystack = [task.title, task.description, task.assignee, task.priority, task.recurrence, taskSourceDocument(task)].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [taskSearch, taskSourceFilter, taskTab, tasks, today]);

  const accountTotals = useMemo(() => {
    return activeAccounts.reduce((totals, account) => {
      const calculated = calculateResidentialHours(toNumber(account.scheduled_hours), normalizeResidentialFrequency(account.frequency));
      return {
        weekly: roundHours(totals.weekly + calculated.weekly),
        biweekly: roundHours(totals.biweekly + calculated.biweekly),
        monthly: roundHours(totals.monthly + calculated.monthly),
      };
    }, { weekly: 0, biweekly: 0, monthly: 0 });
  }, [activeAccounts]);

  const logsInPeriod = useMemo(() => workLogs.filter((log) => isDateInRange(log.work_date, periodRange.start, periodRange.end)), [periodRange.end, periodRange.start, workLogs]);
  const weekRange = getPeriodRange(periodMode, paymentWeekStart);
  const commercialRange = useMemo(() => {
    if (commercialCustomStart && commercialCustomEnd) {
      return commercialCustomStart <= commercialCustomEnd
        ? { start: commercialCustomStart, end: commercialCustomEnd, label: "Manual calendar range" }
        : { start: commercialCustomEnd, end: commercialCustomStart, label: "Manual calendar range" };
    }
    return weekRange;
  }, [commercialCustomEnd, commercialCustomStart, weekRange]);
  const logsInPaymentWeek = useMemo(() => workLogs.filter((log) => isDateInRange(log.work_date, weekRange.start, weekRange.end)), [weekRange.end, weekRange.start, workLogs]);
  const paymentRowsInWeek = useMemo(() => weeklyPaymentRows.filter((row) => {
    if (row.week_start === weekRange.start && row.week_end === weekRange.end) return true;
    return isDateInRange(row.work_date, weekRange.start, weekRange.end);
  }), [weekRange.end, weekRange.start, weeklyPaymentRows]);

  const teamHours = useMemo(() => {
    const map = new Map<string, {
      key: string;
      teamId: string | null;
      teamName: string;
      totalHours: number;
      accounts: Set<string>;
      logs: ResidentialWorkLogRow[];
    }>();

    for (const log of logsInPeriod) {
      const key = teamKey(log.team_id, log.team_name);
      const current = map.get(key) ?? {
        key,
        teamId: log.team_id,
        teamName: log.team_name,
        totalHours: 0,
        accounts: new Set<string>(),
        logs: [],
      };
      current.totalHours = roundHours(current.totalHours + toNumber(log.hours_worked));
      current.accounts.add(log.account_name);
      current.logs.push(log);
      map.set(key, current);
    }

    return Array.from(map.values()).sort((a, b) => b.totalHours - a.totalHours);
  }, [logsInPeriod]);

  const weeklyPaymentSummaries = useMemo(() => {
    const map = new Map<string, {
      key: string;
      teamId: string | null;
      teamName: string;
      totalHours: number;
      accounts: Set<string>;
      logs: ResidentialWorkLogRow[];
      rows: ResidentialWeeklyPaymentLineRow[];
      residentialTotal: number;
      commercialTotal: number;
      paymentTotal: number;
      payment?: ResidentialWeeklyPaymentRow;
      team?: StaffMemberRow;
    }>();

    function ensureSummary(teamId: string | null, teamName: string) {
      const key = teamKey(teamId, teamName);
      const team = activeResidentialTeams.find((item) => item.id === teamId || item.name === teamName) ?? teamByKey.get(key) ?? teamByKey.get(teamName.toLowerCase());
      const displayName = isJuanRomero(teamName) ? JUAN_ROMERO_NAME : teamName;
      const current = map.get(key) ?? {
        key,
        teamId,
        teamName: displayName,
        totalHours: 0,
        accounts: new Set<string>(),
        logs: [],
        rows: [],
        residentialTotal: 0,
        commercialTotal: 0,
        paymentTotal: 0,
        team,
      };
      if (isJuanRomero(teamName)) {
        current.teamId = current.teamId ?? teamId ?? team?.id ?? null;
        current.teamName = JUAN_ROMERO_NAME;
        current.team = current.team ?? team;
      }
      map.set(key, current);
      return current;
    }

    for (const team of activeResidentialTeams) {
      ensureSummary(team.id, team.name);
    }

    const juanTeam = activeResidentialTeams.find((team) => isJuanRomero(team.name)) ?? staff.find((person) => isJuanRomero(person.name));
    ensureSummary(juanTeam?.id ?? null, JUAN_ROMERO_NAME);
    const carlosTeam = staff.find((person) => isCarlosLopez(person.name));
    ensureSummary(carlosTeam?.id ?? null, CARLOS_LOPEZ_NAME);

    for (const log of logsInPaymentWeek) {
      const team = teamByKey.get(teamKey(log.team_id, log.team_name)) ?? teamByKey.get(log.team_name.toLowerCase());
      if (team && !canScheduleResidential(team)) continue;
      const current = ensureSummary(log.team_id, log.team_name);
      current.totalHours = roundHours(current.totalHours + toNumber(log.hours_worked));
      current.accounts.add(log.account_name);
      current.logs.push(log);
    }

    for (const row of paymentRowsInWeek) {
      const team = teamByKey.get(teamKey(row.cleaner_id, row.cleaner_name)) ?? teamByKey.get(row.cleaner_name.toLowerCase());
      if (team && !canScheduleResidential(team)) continue;
      const current = ensureSummary(row.cleaner_id, row.cleaner_name);
      current.rows.push(row);
      const rowHasAmount = paymentLineTotal(row) > 0;
      if (rowHasAmount) {
        current.residentialTotal = roundHours(current.residentialTotal + (toNumber(row.residential_amount) > 0 ? toNumber(row.residential_amount) : toNumber(row.payment_amount)));
        current.commercialTotal = roundHours(current.commercialTotal + toNumber(row.commercial_amount));
        current.paymentTotal = roundHours(current.paymentTotal + paymentLineTotal(row));
      }
    }

    for (const payment of weeklyPayments.filter((item) => item.week_start === weekRange.start)) {
      const team = teamByKey.get(teamKey(payment.team_id, payment.team_name)) ?? teamByKey.get(payment.team_name.toLowerCase());
      if (team && !canScheduleResidential(team)) continue;
      const current = ensureSummary(payment.team_id, payment.team_name);
      if (!current.totalHours) current.totalHours = toNumber(payment.total_hours);
      current.payment = payment;
    }

    return Array.from(map.values()).sort((a, b) => a.teamName.localeCompare(b.teamName));
  }, [activeResidentialTeams, logsInPaymentWeek, paymentRowsInWeek, staff, teamByKey, weekRange.start, weeklyPayments]);

  const pendingPaymentTotal = useMemo(() => weeklyPaymentSummaries.reduce((sum, item) => {
    return paymentSummaryStatus(item) === "paid" ? sum : sum + item.paymentTotal;
  }, 0), [weeklyPaymentSummaries]);
  const carlosPaymentSummary = useMemo(() => weeklyPaymentSummaries.find((summary) => isCarlosLopez(summary.teamName)), [weeklyPaymentSummaries]);

  const getCommercialEntryHours = useCallback((entry: CommercialHoursEntryRow) => {
    return toNumber(entry.verified_hours) || toNumber(entry.completed_hours) || toNumber(entry.scheduled_hours);
  }, []);

  const getCommercialEntryAmount = useCallback((entry: CommercialHoursEntryRow) => {
    const account = commercialAccounts.find((acc) => acc.id === entry.account_id);
    if (!account) return 0;
    const hours = getCommercialEntryHours(entry);
    const payType = String(account.cleaner_pay_type ?? "").toLowerCase();
    if (payType === "hourly") {
      return hours * toNumber(account.cleaner_hourly_rate);
    }
    if (payType === "flat") {
      return toNumber(account.cleaner_flat_rate);
    }
    const staffMember = staff.find((s) => s.id === entry.team_id || s.name.toLowerCase() === entry.team_name?.toLowerCase());
    if (staffMember && staffMember.hourly_rate) {
      return hours * toNumber(staffMember.hourly_rate);
    }
    return 0;
  }, [commercialAccounts, staff, getCommercialEntryHours]);

  const commercialRowsInWeek = useMemo(() => {
    return buildCommercialOccurrences({
      accounts: commercialAccounts,
      scheduleRules: commercialScheduleRules,
      storedEntries: commercialHoursEntries,
      period: { start: commercialRange.start, end: commercialRange.end },
      cutoffDate: today,
    });
  }, [commercialAccounts, commercialHoursEntries, commercialRange.end, commercialRange.start, commercialScheduleRules, today]);

  const filteredCommercialRows = useMemo(() => {
    return commercialRowsInWeek.filter((entry) => {
      if (commercialAccountFilter !== "all" && entry.account_id !== commercialAccountFilter) return false;
      if (commercialTeamFilter !== "all" && entry.team_name !== commercialTeamFilter) return false;
      if (commercialStatusFilter !== "all" && entry.status !== commercialStatusFilter) return false;
      if (commercialSourceFilter === "manual" && entry.manual_entry === false) return false;
      if (commercialSourceFilter === "scheduled" && entry.manual_entry !== false) return false;
      if (commercialVerifiedFilter === "verified" && !(entry.verified || entry.status === "verified" || entry.status === "paid")) return false;
      if (commercialVerifiedFilter === "needs_review" && (entry.verified || entry.status === "verified" || entry.status === "paid")) return false;
      if (commercialSearchFilter.trim()) {
        const needle = commercialSearchFilter.trim().toLowerCase();
        const haystack = [entry.account_name, entry.team_name, entry.scheduled_day, entry.notes].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [commercialAccountFilter, commercialRowsInWeek, commercialSearchFilter, commercialSourceFilter, commercialStatusFilter, commercialTeamFilter, commercialVerifiedFilter]);

  const commercialTotals = useMemo(() => {
    let scheduledHours = 0;
    let completedHours = 0;
    let verifiedHours = 0;
    let totalHours = 0;
    let completedCount = 0;
    let verifiedCount = 0;
    let needsReviewCount = 0;
    let totalAmount = 0;

    for (const entry of filteredCommercialRows) {
      const sch = toNumber(entry.scheduled_hours);
      const comp = toNumber(entry.completed_hours);
      const ver = entry.verified || entry.status === "verified" || entry.status === "paid"
        ? toNumber(entry.verified_hours) || toNumber(entry.completed_hours) || toNumber(entry.scheduled_hours)
        : 0;

      scheduledHours += sch;
      completedHours += comp;
      verifiedHours += ver;
      totalHours += getCommercialEntryHours(entry);

      const status = entry.status ?? "scheduled";
      if (status !== "scheduled" && status !== "skipped") {
        completedCount++;
      }
      if (status === "verified" || status === "paid" || entry.verified) {
        verifiedCount++;
      }
      if (status === "needs_review") {
        needsReviewCount++;
      }

      totalAmount += getCommercialEntryAmount(entry);
    }

    return {
      scheduled: roundHours(scheduledHours),
      completed: roundHours(completedHours),
      verified: roundHours(verifiedHours),
      hours: roundHours(totalHours),
      completedCount,
      verifiedCount,
      needsReview: needsReviewCount,
      amount: totalAmount,
    };
  }, [filteredCommercialRows, getCommercialEntryHours, getCommercialEntryAmount]);

  async function writeTaskAudit(taskId: string, action: string, details: Record<string, unknown>) {
    await writeOperationTaskAudit(supabase, taskId, action, details);
  }

  async function notifyTask(
    event: "task_assigned" | "task_completed",
    task: OperationTaskRow,
    enabled: boolean,
    actorName = "Pristine Operations",
  ) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch("/api/tasks/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          event,
          enabled,
          actorName,
          task: {
            id: task.id,
            title: task.title,
            category: task.category ?? "Operations",
            priority: task.priority ?? "normal",
            dueDate: task.due_date,
            frequency: TASK_FREQUENCY_LABELS[frequencyFromRecurrence(task.recurrence)],
            assignedBy: task.assigned_by ?? "Pristine Operations",
            assignedTo: task.assignee,
            createdBy: task.assigned_by ?? "Pristine Operations",
            completedBy: actorName,
            completedAt: task.completed_at,
            accountOrProperty: "Residential operations",
            panel: "Operations",
            description: task.description,
            notes: task.description,
            status: task.status,
            completionNotes: task.completion_notes ?? task.description,
            completionEmailEnabled: metadataFlag(task.metadata, "notify_owner_on_completed", true),
            assignmentEmailEnabled: metadataFlag(task.metadata, "notify_assignee_on_assignment", true),
            sourceSection: metadataText(task.metadata, "source_section"),
          },
        }),
      });
      const data = await response.json().catch(() => null) as { notification?: { sent?: boolean; reason?: string; skipped?: boolean; code?: string } } | null;
      if (!response.ok) return { sent: false, reason: `Notification request failed with HTTP ${response.status}` };
      return data?.notification ?? { sent: false, reason: "Notification service returned no status." };
    } catch (error) {
      const reason = error instanceof Error && error.name === "AbortError" ? "Notification request timed out after 60 seconds. Gmail SMTP did not respond in time." : error instanceof Error ? error.message : "Notification request failed.";
      await writeTaskAudit(task.id, "notification_failed", { event, reason });
      return { sent: false, reason };
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  function openTaskDraft(task?: OperationTaskRow) {
    setTaskFormError(null);
    if (!task) {
      setSelectedTask(null);
      setTaskDraft(EMPTY_TASK_DRAFT);
      return;
    }
    setSelectedTask(null);
    setTaskDraft({
      id: task.id,
      title: task.title,
      description: task.description ?? "",
      assignee: normalizeAssignee(task.assignee),
      dueDate: task.due_date ?? todayKey(),
      frequency: frequencyFromRecurrence(task.recurrence),
      customIntervalDays: task.custom_interval_days ? String(task.custom_interval_days) : "",
      priority: task.priority === "low" || task.priority === "high" || task.priority === "urgent" ? task.priority : "normal",
      notifyAssignee: metadataFlag(task.metadata, "notify_assignee_on_assignment", true),
      notifyOwnerOnCompletion: metadataFlag(task.metadata, "notify_owner_on_completed", true),
    });
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!taskDraft || !userId || savingTask) return;

    const validation = validateInput(taskReminderSchema, {
      title: taskDraft.title,
      description: taskDraft.description,
      assignee: taskDraft.assignee,
      dueDate: taskDraft.dueDate,
      priority: taskDraft.priority,
      status: "pending",
      frequency: taskDraft.frequency,
      customIntervalDays: taskDraft.frequency === "custom" ? Number(taskDraft.customIntervalDays) || null : null,
    });
    if (!validation.ok) {
      setTaskFormError(validation.message);
      setMessage({ tone: "error", text: `Task could not be saved: ${validation.message}` });
      return;
    }
    if (taskDraft.notifyAssignee && !taskDraft.assignee) {
      const message = "Choose an assignee before enabling Notify assignee.";
      setTaskFormError(message);
      setMessage({ tone: "error", text: message });
      return;
    }

    setSavingTask(true);
    const now = new Date().toISOString();
    const previousTask = taskDraft.id ? tasks.find((task) => task.id === taskDraft.id) : null;
    const previousMetadata = previousTask?.metadata ?? {};
    const previousNotifyAssignee = previousTask ? metadataFlag(previousMetadata, "notify_assignee_on_assignment", true) : false;
    const reactivatedAssignmentNotification = Boolean(previousTask && !previousNotifyAssignee && taskDraft.notifyAssignee);
    const existingAssignmentSentTo = metadataText(previousMetadata, "assignment_notification_assignee");
    const assigneeChanged = !previousTask || String(previousTask.assignee ?? "").trim() !== taskDraft.assignee;
    const shouldSendAssignmentNotification = taskDraft.notifyAssignee && (
      assigneeChanged ||
      reactivatedAssignmentNotification ||
      !metadataText(previousMetadata, "assignment_notification_sent_at") ||
      existingAssignmentSentTo !== taskDraft.assignee
    );
    const payload = {
      user_id: userId,
      title: taskDraft.title.trim(),
      description: taskDraft.description.trim() || null,
      priority: taskDraft.priority,
      status: "pending",
      category: "Operations",
      due_date: taskDraft.dueDate || null,
      assignee: taskDraft.assignee,
      assigned_by: "Pristine Operations",
      panel: "Operations",
      business_unit: "residential",
      reminder: true,
      recurrence: recurrenceFromFrequency(taskDraft.frequency),
      custom_interval_days: taskDraft.frequency === "custom" ? Number(taskDraft.customIntervalDays) || null : null,
      metadata: {
        ...previousMetadata,
        task_scope: "residential_operations",
        frequency: taskDraft.frequency,
        notify_assignee_on_assignment: taskDraft.notifyAssignee,
        notify_owner_on_completed: taskDraft.notifyOwnerOnCompletion,
        ...(taskDraft.notifyAssignee ? {} : { assignment_notification_disabled_at: now }),
      },
      created_by: userId,
      updated_at: now,
    };

    try {
      const result = taskDraft.id
        ? await supabase.from("operation_tasks").update(payload).eq("id", taskDraft.id).select(OPERATION_TASK_COLUMNS).single()
        : await supabase.from("operation_tasks").insert({ ...payload, created_at: now }).select(OPERATION_TASK_COLUMNS).single();

      if (result.error) throw new Error(result.error.message);
      const savedTask = result.data as unknown as OperationTaskRow;
      await writeTaskAudit(savedTask.id, taskDraft.id ? "task_updated" : "task_created", {
        before: previousTask,
        after: savedTask,
      });

      let feedback = "Task saved.";
      if (shouldSendAssignmentNotification) {
        const notification = await notifyTask("task_assigned", savedTask, taskDraft.notifyAssignee);
        const notificationMetadata = notification.sent
          ? {
              assignment_notification_sent_at: new Date().toISOString(),
              assignment_notification_assignee: savedTask.assignee,
              assignment_notification_error: null,
            }
          : {
              assignment_notification_failed_at: new Date().toISOString(),
              assignment_notification_error: notification.reason ?? "unknown reason",
            };
        const { data: updatedTask } = await supabase
          .from("operation_tasks")
          .update({ metadata: { ...(savedTask.metadata ?? {}), ...notificationMetadata }, updated_at: new Date().toISOString() })
          .eq("id", savedTask.id)
          .select(OPERATION_TASK_COLUMNS)
          .single();
        if (updatedTask) setTasks((current) => current.map((task) => task.id === savedTask.id ? updatedTask as unknown as OperationTaskRow : task));
        if (notification.sent) feedback = "Task saved. Assignment email sent.";
        if (!notification.sent) feedback = notification.code === "EMAIL_PROVIDER_MISSING"
          ? "Task saved. SMTP credentials are not configured."
          : `Task saved. Assignment email failed - ${notification.reason ?? "unknown reason"}`;
      } else if (!taskDraft.notifyAssignee) {
        feedback = "Task saved. Assignment email disabled.";
      } else if (notificationAlreadySent(savedTask, "assignment_notification_sent_at")) {
        feedback = "Task saved. Assignment email already sent for this assignee.";
      }

      setTaskDraft(null);
      setTaskFormError(null);
      setMessage({ tone: feedback.includes("failed") ? "error" : feedback.includes("SMTP credentials") ? "info" : "success", text: feedback });
      await loadData();
    } catch (error) {
      const message = `Task could not be saved: ${errorMessage(error)}`;
      setTaskFormError(message);
      setMessage({ tone: "error", text: message });
    } finally {
      setSavingTask(false);
    }
  }

  async function completeTask(task: OperationTaskRow) {
    if (!userId || normalizeTaskStatus(task.status) === "completed" || completingTaskId) return;
    setCompletingTaskId(task.id);
    const completedAt = new Date().toISOString();
    const actorName = normalizeAssignee(task.assignee);
    const notifyOwner = metadataFlag(task.metadata, "notify_owner_on_completed", true) && actorName !== "Jake Ivan-Pal";
    const completionAlreadyNotified = notificationAlreadySent(task, "completion_notification_sent_at");

    try {
      const { error } = await supabase
        .from("operation_tasks")
        .update({
          status: "completed",
          completed_at: completedAt,
          completed_by: userId,
          completion_notes: task.completion_notes ?? task.description,
          updated_at: completedAt,
        })
        .eq("id", task.id);

      if (error) throw new Error(error.message);

      const completedTask = { ...task, status: "completed", completed_at: completedAt, completed_by: userId };
      setTasks((current) => current.map((item) => item.id === task.id ? completedTask : item));
      setSelectedTask((current) => current?.id === task.id ? completedTask : current);
      if (notifyOwner && !completionAlreadyNotified) {
        const notification = await notifyTask("task_completed", completedTask, true, actorName);
        const notificationMetadata = notification.sent
          ? {
              completion_notification_sent_at: new Date().toISOString(),
              completion_notification_recipient: "Jake Ivan-Pal",
              completion_notification_error: null,
            }
          : {
              completion_notification_failed_at: new Date().toISOString(),
              completion_notification_error: notification.reason ?? "unknown reason",
            };
        await supabase
          .from("operation_tasks")
          .update({ metadata: { ...(task.metadata ?? {}), ...notificationMetadata }, updated_at: new Date().toISOString() })
          .eq("id", task.id);
        const providerMissing = notification.code === "EMAIL_PROVIDER_MISSING";
        const notificationText = notification.sent
          ? " Owner completion email sent."
          : providerMissing
            ? " SMTP credentials are not configured."
            : ` Owner completion email failed - ${notification.reason ?? "unknown reason"}`;
        setMessage({ tone: notification.sent ? "success" : providerMissing ? "info" : "error", text: `Task completed.${notificationText}` });
      } else if (notifyOwner && completionAlreadyNotified) {
        await writeTaskAudit(task.id, "task_completed", {
          actor: actorName,
          completedAt,
          notifyOwner,
          notificationSkipped: "Owner completion email already sent.",
        });
        setMessage({ tone: "success", text: "Task completed. Owner completion email was already sent." });
      } else {
        await notifyTask("task_completed", completedTask, false, actorName);
        setMessage({ tone: "success", text: "Task completed. Owner completion email disabled." });
      }
      await loadData();
    } catch (error) {
      setMessage({ tone: "error", text: `Task could not be completed: ${errorMessage(error)}` });
    } finally {
      setCompletingTaskId(null);
    }
  }

  async function deleteTask(task: OperationTaskRow) {
    if (deletingTaskId) return;
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    setDeletingTaskId(task.id);
    const now = new Date().toISOString();
    try {
      const { error } = await supabase.from("operation_tasks").update({ deleted_at: now, updated_at: now }).eq("id", task.id);
      if (error) throw new Error(error.message);
      await writeTaskAudit(task.id, "task_deleted", { title: task.title, assignee: task.assignee });
      setTasks((current) => current.filter((item) => item.id !== task.id));
      setSelectedTask((current) => current?.id === task.id ? null : current);
      setMessage({ tone: "success", text: "Task deleted." });
      await loadData();
    } catch (error) {
      setMessage({ tone: "error", text: `Task could not be deleted: ${errorMessage(error)}` });
    } finally {
      setDeletingTaskId(null);
    }
  }

  function openAccountDraft(account?: ResidentialAccountRow) {
    if (!account) {
      setAccountDraft(EMPTY_ACCOUNT_DRAFT);
      return;
    }
    setAccountDraft({
      id: account.id,
      accountName: account.account_name,
      scheduledHours: String(account.scheduled_hours ?? ""),
      frequency: normalizeResidentialFrequency(account.frequency),
      frequencyDetail: account.frequency_detail ?? "",
      dayOfWeek: account.day_of_week ?? "",
      city: account.city ?? "",
      customCity: account.custom_city ?? "",
      assignedTeamId: account.assigned_team_id ?? "",
      assignedTeamName: account.assigned_team_name ?? "",
      active: account.active !== false,
      notes: account.notes ?? "",
    });
  }

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accountDraft || !userId || savingAccount) return;
    if (!accountDraft.accountName.trim()) {
      setMessage({ tone: "error", text: "Residential account could not be saved: account name is required." });
      return;
    }
    const selectedTeam = activeResidentialTeams.find((team) => team.id === accountDraft.assignedTeamId);
    const now = new Date().toISOString();
    const payload = {
      user_id: userId,
      account_name: accountDraft.accountName.trim(),
      scheduled_hours: Number(accountDraft.scheduledHours) || 0,
      frequency: accountDraft.frequency,
      frequency_detail: accountDraft.frequencyDetail.trim() || null,
      day_of_week: accountDraft.dayOfWeek || null,
      city: accountDraft.city || null,
      custom_city: accountDraft.city === OUTSIDE_OC_CITY ? accountDraft.customCity.trim() || null : null,
      assigned_team_id: selectedTeam?.id ?? null,
      assigned_team_name: selectedTeam?.name ?? (accountDraft.assignedTeamName.trim() || null),
      active: accountDraft.active,
      notes: accountDraft.notes.trim() || null,
      updated_at: now,
    };

    setSavingAccount(true);
    try {
      const result = accountDraft.id
        ? await supabase.from("residential_recurring_cleaning_accounts").update(payload).eq("id", accountDraft.id)
        : await supabase.from("residential_recurring_cleaning_accounts").insert({ ...payload, created_at: now });
      if (result.error) throw new Error(result.error.message);
      await writePayrollAudit(supabase, {
        entityType: "residential_recurring_cleaning_accounts",
        entityId: accountDraft.id ?? null,
        action: accountDraft.id ? "residential_account_updated" : "residential_account_created",
        before: accountDraft.id ? accounts.find((account) => account.id === accountDraft.id) : null,
        after: payload,
        actorId: userId,
      });
      setAccountDraft(null);
      setMessage({ tone: "success", text: "Residential account saved." });
      await loadData();
    } catch (error) {
      setMessage({ tone: "error", text: `Residential account could not be saved: ${errorMessage(error)}` });
    } finally {
      setSavingAccount(false);
    }
  }

  async function toggleAccount(account: ResidentialAccountRow) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("residential_recurring_cleaning_accounts")
      .update({ active: account.active === false, updated_at: now })
      .eq("id", account.id);
    if (error) {
      setMessage({ tone: "error", text: `Account status could not be updated: ${parseSupabaseError(error)}` });
      return;
    }
    setMessage({ tone: "success", text: account.active === false ? "Account activated." : "Account paused." });
    await loadData();
  }

  async function deleteAccount(account: ResidentialAccountRow) {
    if (!window.confirm("Are you sure you want to delete this residential account?")) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from("residential_recurring_cleaning_accounts").update({ deleted_at: now, updated_at: now }).eq("id", account.id);
    if (error) {
      setMessage({ tone: "error", text: `Residential account could not be deleted: ${parseSupabaseError(error)}` });
      return;
    }
    setMessage({ tone: "success", text: "Residential account deleted." });
    await loadData();
  }

  async function saveWorkLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || savingWorkLog) return;
    const account = accounts.find((item) => item.id === workLogDraft.accountId);
    const team = activeResidentialTeams.find((item) => item.id === workLogDraft.teamId);
    const validation = validateInput(workLogSchema, {
      accountId: workLogDraft.accountId,
      teamId: workLogDraft.teamId,
      workDate: workLogDraft.workDate,
      hoursWorked: Number(workLogDraft.hoursWorked),
      status: workLogDraft.status,
    });
    if (!account || !team || !validation.ok) {
      setMessage({ tone: "error", text: `Hours could not be saved: ${validation.ok ? "account and team are required." : validation.message}` });
      return;
    }
    const now = new Date().toISOString();
    setSavingWorkLog(true);
    try {
      const { error } = await supabase.from("residential_work_logs").insert({
        user_id: userId,
        account_id: account.id,
        account_name: account.account_name,
        team_id: team.id,
        team_name: team.name,
        work_date: workLogDraft.workDate,
        hours_worked: Number(workLogDraft.hoursWorked),
        notes: workLogDraft.notes.trim() || null,
        status: workLogDraft.status,
        created_at: now,
        updated_at: now,
      });
      if (error) throw new Error(error.message);
      await writePayrollAudit(supabase, {
        entityType: "residential_work_logs",
        action: "work_log_created",
        after: {
          account_id: account.id,
          account_name: account.account_name,
          team_id: team.id,
          team_name: team.name,
          work_date: workLogDraft.workDate,
          hours_worked: Number(workLogDraft.hoursWorked),
          status: workLogDraft.status,
        },
        actorId: userId,
      });
      setWorkLogDraft({ ...EMPTY_WORK_LOG_DRAFT, workDate: workLogDraft.workDate });
      setMessage({ tone: "success", text: "Hours saved." });
      await loadData();
    } catch (error) {
      setMessage({ tone: "error", text: `Hours could not be saved: ${errorMessage(error)}` });
    } finally {
      setSavingWorkLog(false);
    }
  }

  function openStaffDraft(person?: StaffMemberRow) {
    if (!person) {
      setStaffDraft(EMPTY_STAFF_DRAFT);
      return;
    }
    setStaffDraft({
      id: person.id,
      name: person.name,
      email: person.email ?? "",
      role: displayStaffRole(person),
      teamScope: staffScope(person),
      status: staffDraftStatus(person),
      hourlyRate: String(person.hourly_rate ?? ""),
      paymentMode: normalizePaymentMode(person.payment_mode, person.name),
      active: staffIsActive(person),
    });
  }

  function openPotentialCleanerDraft(teamScope: StaffTeamScope) {
    setStaffDraft({
      ...EMPTY_STAFF_DRAFT,
      role: roleForStaffScope(teamScope),
      teamScope,
      status: "Potential",
      active: false,
      paymentMode: teamScope === "mixed" ? "mixed" : "residential_only",
    });
  }

  async function saveStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!staffDraft || !userId || savingStaff) return;
    const now = new Date().toISOString();
    const status = staffDraft.status;
    const teamScope = staffDraft.teamScope;
    const role = staffDraft.role.trim() || roleForStaffScope(teamScope);
    const isActiveStatus = status === "Active";
    const validation = validateInput(staffMemberSchema, {
      name: staffDraft.name,
      email: staffDraft.email,
      role,
      teamScope,
      status,
      hourlyRate: staffDraft.hourlyRate ? Number(staffDraft.hourlyRate) : null,
      paymentMode: staffDraft.paymentMode,
      active: staffDraft.active,
    });
    if (!validation.ok) {
      setMessage({ tone: "error", text: `Cleaner could not be saved: ${validation.message}` });
      return;
    }
    const payload = {
      user_id: userId,
      name: staffDraft.name.trim(),
      email: staffDraft.email.trim() || makeTeamEmail(staffDraft.name),
      role,
      display_role: role,
      team_scope: teamScope,
      hourly_rate: Number(staffDraft.hourlyRate) || null,
      payment_mode: isJuanRomero(staffDraft.name) || teamScope === "mixed" ? "mixed" : "residential_only",
      active: isActiveStatus ? staffDraft.active : false,
      status,
      commercial_payroll_eligible: isActiveStatus && (teamScope === "commercial" || teamScope === "mixed") && !isJuanRomero(staffDraft.name),
      updated_at: now,
    };
    setSavingStaff(true);
    try {
      const result = staffDraft.id
        ? await supabase.from("staff_members").update(payload).eq("id", staffDraft.id)
        : await supabase.from("staff_members").insert({ ...payload, created_at: now });
      if (result.error) throw new Error(result.error.message);
      await writePayrollAudit(supabase, {
        entityType: "staff_members",
        entityId: staffDraft.id ?? null,
        action: staffDraft.id ? "staff_updated" : "staff_created",
        before: staffDraft.id ? staff.find((person) => person.id === staffDraft.id) : null,
        after: payload,
        actorId: userId,
      });
      setStaffDraft(null);
      setMessage({ tone: "success", text: "Cleaner saved." });
      await loadData();
    } catch (error) {
      setMessage({ tone: "error", text: `Cleaner could not be saved: ${errorMessage(error)}` });
    } finally {
      setSavingStaff(false);
    }
  }

  async function deleteStaff(person: StaffMemberRow) {
    if (!userId || savingStaff) return;
    if (!window.confirm(`Are you sure you want to delete the cleaner "${person.name}"?`)) return;

    setSavingStaff(true);
    const now = new Date().toISOString();
    try {
      const { error } = await supabase
        .from("staff_members")
        .update({
          deleted_at: now,
          active: false,
          updated_at: now,
        })
        .eq("id", person.id);

      if (error) throw new Error(error.message);

      await writePayrollAudit(supabase, {
        entityType: "staff_members",
        entityId: person.id,
        action: "staff_deleted",
        before: person,
        after: { ...person, deleted_at: now, active: false },
        actorId: userId,
      });

      setMessage({ tone: "success", text: "Cleaner deleted successfully." });
      await loadData();
    } catch (error) {
      setMessage({ tone: "error", text: `Cleaner could not be deleted: ${errorMessage(error)}` });
    } finally {
      setSavingStaff(false);
    }
  }

  function paymentDraftForSummary(summary: (typeof weeklyPaymentSummaries)[number]) {
    return paymentRowDrafts[summary.key] ?? {
      ...EMPTY_PAYMENT_ROW_DRAFT,
      cleanerId: summary.teamId ?? "",
      cleanerName: summary.teamName,
      workDate: weekRange.start,
      city: isCarlosLopez(summary.teamName) ? "Operations" : "",
    };
  }

  function setPaymentDraftForSummary(summary: (typeof weeklyPaymentSummaries)[number], draft: PaymentRowDraft) {
    setPaymentRowDrafts((current) => ({ ...current, [summary.key]: draft }));
  }

  function openPaymentModal(summary: (typeof weeklyPaymentSummaries)[number], mode: "residential" | "juan", row?: ResidentialWeeklyPaymentLineRow) {
    setActivePaymentSummaryKey(summary.key);
    setPaymentModalMode(mode);
    if (row) editPaymentRow(row);
  }

  // function openJuanPaymentModal(row?: ResidentialWeeklyPaymentLineRow) {
  //   const juanSummary = weeklyPaymentSummaries.find((summary) => isJuanRomero(summary.teamName));
  //   if (!juanSummary) {
  //     setMessage({ tone: "error", text: "Juan Romero profile is not available yet. Add Juan Romero in Staff / Teams first." });
  //     return;
  //   }
  //   openPaymentModal(juanSummary, "juan", row);
  // }

  function closePaymentModal() {
    setPaymentModalMode(null);
    setActivePaymentSummaryKey(null);
  }

  function editPaymentRow(row: ResidentialWeeklyPaymentLineRow) {
    const key = teamKey(row.cleaner_id, row.cleaner_name);
    setPaymentRowDrafts((current) => ({
      ...current,
      [key]: {
        id: row.id,
        cleanerId: row.cleaner_id ?? "",
        cleanerName: row.cleaner_name,
        workDate: row.work_date,
        city: row.city ?? "",
        customCity: row.custom_city ?? "",
        paymentAmount: row.payment_amount ? String(row.payment_amount) : "",
        residentialAmount: row.residential_amount ? String(row.residential_amount) : "",
        commercialAmount: row.commercial_amount ? String(row.commercial_amount) : "",
        notes: row.notes ?? "",
        status: (row.status as WeeklyPaymentStatus) || "pending",
      },
    }));
  }

  async function savePaymentRow(summary: (typeof weeklyPaymentSummaries)[number]) {
    if (!userId || savingPaymentKey) return;
    const draft = paymentDraftForSummary(summary);
    const mixed = isMixedPaySummary(summary);
    const paymentAmount = toNumber(draft.paymentAmount);
    const residentialAmount = toNumber(draft.residentialAmount);
    const commercialAmount = toNumber(draft.commercialAmount);
    const resolvedCity = draft.city === OUTSIDE_OC_CITY ? draft.customCity.trim() : draft.city.trim();

    const validation = validateInput(residentialPaymentRowSchema, {
      cleanerId: summary.teamId,
      cleanerName: summary.teamName,
      workDate: draft.workDate,
      city: draft.city,
      customCity: draft.customCity,
      paymentAmount,
      residentialAmount,
      commercialAmount,
      paymentMode: mixed ? "mixed" : "residential_only",
      status: draft.status || "pending",
    });
    if (!validation.ok) {
      setMessage({ tone: "error", text: `Payment row could not be saved: ${validation.message}` });
      return;
    }
    if (dateOutsideRange(draft.workDate, weekRange.start, weekRange.end) && !window.confirm("This date is outside the selected pay period. Save it anyway?")) {
      return;
    }
    const duplicate = weeklyPaymentRows.some((row) => {
      if (row.id === draft.id) return false;
      return row.cleaner_name === summary.teamName &&
        row.work_date === draft.workDate &&
        displayPaymentCity(row).toLowerCase() === resolvedCity.toLowerCase() &&
        paymentLineTotal(row) === (mixed ? residentialAmount + commercialAmount : paymentAmount);
    });
    if (duplicate && !window.confirm("Possible duplicate: same cleaner, date, city, and amount. Save anyway?")) {
      return;
    }
    const existing = draft.id ? weeklyPaymentRows.find((row) => row.id === draft.id) : null;
    if (existing?.status === "paid" && !window.confirm("This record is already marked as paid. Editing it may affect payroll history.")) {
      return;
    }

    const now = new Date().toISOString();
    setSavingPaymentKey(summary.key);
    try {
      const payload = {
        user_id: userId,
        cleaner_id: summary.teamId,
        cleaner_name: summary.teamName,
        work_date: draft.workDate,
        city: draft.city.trim(),
        custom_city: draft.city === OUTSIDE_OC_CITY ? draft.customCity.trim() || null : null,
        payment_amount: mixed ? 0 : paymentAmount,
        residential_amount: mixed ? residentialAmount : 0,
        commercial_amount: mixed ? commercialAmount : 0,
        payment_type: mixed ? "mixed" : "residential",
        payment_mode: mixed ? "mixed" : "residential_only",
        week_start: weekRange.start,
        week_end: weekRange.end,
        status: draft.status || existing?.status || "pending",
        notes: draft.notes.trim() || null,
        updated_at: now,
      };
      let result = draft.id
        ? await supabase.from("residential_weekly_payment_rows").update(payload).eq("id", draft.id)
        : await supabase.from("residential_weekly_payment_rows").insert({ ...payload, created_at: now });
      if (result.error && (result.error.message.toLowerCase().includes("payment_mode") || result.error.message.toLowerCase().includes("custom_city"))) {
        const { payment_mode: paymentModeSnapshot, custom_city: customCitySnapshot, ...fallbackPayload } = payload;
        void paymentModeSnapshot;
        void customCitySnapshot;
        result = draft.id
          ? await supabase.from("residential_weekly_payment_rows").update(fallbackPayload).eq("id", draft.id)
          : await supabase.from("residential_weekly_payment_rows").insert({ ...fallbackPayload, created_at: now });
      }
      if (result.error) throw new Error(result.error.message);
      await writePayrollAudit(supabase, {
        entityType: "residential_weekly_payment_rows",
        entityId: draft.id ?? null,
        action: draft.id ? "payment_row_updated" : "payment_row_created",
        before: existing,
        after: payload,
        actorId: userId,
      });
      setPaymentRowDrafts((current) => ({ ...current, [summary.key]: { ...EMPTY_PAYMENT_ROW_DRAFT, cleanerId: summary.teamId ?? "", cleanerName: summary.teamName, workDate: weekRange.start, city: isCarlosLopez(summary.teamName) ? "Operations" : "" } }));
      closePaymentModal();
      setMessage({ tone: "success", text: "Payment row saved." });
      await loadData();
    } catch (error) {
      setMessage({ tone: "error", text: `Payment row could not be saved: ${errorMessage(error)}` });
    } finally {
      setSavingPaymentKey(null);
    }
  }

  async function deletePaymentRow(row: ResidentialWeeklyPaymentLineRow) {
    if (deletingPaymentRowId) return;
    if (!window.confirm("Are you sure you want to delete this payment row?")) return;
    const now = new Date().toISOString();
    setDeletingPaymentRowId(row.id);
    try {
      const { error } = await supabase.from("residential_weekly_payment_rows").update({ deleted_at: now, updated_at: now }).eq("id", row.id);
      if (error) throw new Error(error.message);
      await writePayrollAudit(supabase, {
        entityType: "residential_weekly_payment_rows",
        entityId: row.id,
        action: "payment_row_deleted",
        before: row,
        after: { deleted_at: now },
        actorId: userId,
      });
      setWeeklyPaymentRows((current) => current.filter((item) => item.id !== row.id));
      setMessage({ tone: "success", text: "Payment row deleted." });
      await loadData();
    } catch (error) {
      setMessage({ tone: "error", text: `Payment row could not be deleted: ${errorMessage(error)}` });
    } finally {
      setDeletingPaymentRowId(null);
    }
  }

  async function clearJuanPaymentRows() {
    const juanRows = weeklyPaymentRows.filter((row) => isJuanRomero(row.cleaner_name) && row.week_start === weekRange.start && row.week_end === weekRange.end);
    if (!juanRows.length) {
      setMessage({ tone: "info", text: "Juan Romero has no payment rows in this period." });
      return;
    }
    if (!window.confirm(`Delete ${juanRows.length} Juan Romero payment row${juanRows.length === 1 ? "" : "s"} from this period?`)) return;
    const now = new Date().toISOString();
    setSavingPaymentKey("juan-clear");
    try {
      const { error } = await supabase.from("residential_weekly_payment_rows").update({ deleted_at: now, updated_at: now }).in("id", juanRows.map((row) => row.id));
      if (error) throw new Error(error.message);
      await writePayrollAudit(supabase, {
        entityType: "residential_weekly_payment_rows",
        action: "juan_payment_rows_cleared",
        before: juanRows,
        after: { deleted_at: now, row_count: juanRows.length },
        actorId: userId,
      });
      setWeeklyPaymentRows((current) => current.filter((row) => !juanRows.some((juanRow) => juanRow.id === row.id)));
      setMessage({ tone: "success", text: "Juan Romero payment total cleared for this period." });
      await loadData();
    } catch (error) {
      setMessage({ tone: "error", text: `Juan Romero payment rows could not be deleted: ${errorMessage(error)}` });
    } finally {
      setSavingPaymentKey(null);
    }
  }

  async function saveCarlosWeeklyPayment(summary: (typeof weeklyPaymentSummaries)[number]) {
    if (!userId || savingPaymentKey) return;
    const existingRow = summary.rows[0] ?? null;
    const persistedWeeklyPayment = existingRow ? toNumber(existingRow.residential_amount) || toNumber(existingRow.payment_amount) : 0;
    const persistedOvertimeHours = existingRow ? roundHours(toNumber(existingRow.commercial_amount) / CARLOS_OVERTIME_RATE) : 0;
    const weeklyPayment = carlosWeeklyPayment === "" ? persistedWeeklyPayment : toNumber(carlosWeeklyPayment);
    const hours = carlosOvertimeHours === "" ? persistedOvertimeHours : toNumber(carlosOvertimeHours);
    if (weeklyPayment <= 0 && hours <= 0) {
      setMessage({ tone: "error", text: "Carlos weekly payment or overtime hours must be greater than 0." });
      return;
    }
    const overtimeAmount = roundHours(hours * CARLOS_OVERTIME_RATE);
    const now = new Date().toISOString();
    setSavingPaymentKey("carlos-weekly-payment");
    try {
      const payload = {
        user_id: userId,
        cleaner_id: summary.teamId,
        cleaner_name: CARLOS_LOPEZ_NAME,
        work_date: weekRange.end,
        city: "Operations",
        custom_city: null,
        payment_amount: weeklyPayment + overtimeAmount,
        residential_amount: weeklyPayment,
        commercial_amount: overtimeAmount,
        payment_type: "operations_overtime",
        payment_mode: "residential_only",
        week_start: weekRange.start,
        week_end: weekRange.end,
        status: existingRow?.status ?? "pending",
        notes: `${CARLOS_LOPEZ_NAME} weekly operations manager payment. Overtime: ${hours} hour${hours === 1 ? "" : "s"} at $${CARLOS_OVERTIME_RATE}/hr.`,
        updated_at: now,
      };
      const { error } = existingRow
        ? await supabase.from("residential_weekly_payment_rows").update(payload).eq("id", existingRow.id)
        : await supabase.from("residential_weekly_payment_rows").insert({ ...payload, created_at: now });
      if (error) throw new Error(error.message);
      const extraRows = existingRow ? summary.rows.filter((row) => row.id !== existingRow.id) : [];
      if (extraRows.length > 0) {
        const { error: cleanupError } = await supabase.from("residential_weekly_payment_rows").update({ deleted_at: now, updated_at: now }).in("id", extraRows.map((row) => row.id));
        if (cleanupError) throw new Error(cleanupError.message);
      }
      await writePayrollAudit(supabase, {
        entityType: "residential_weekly_payment_rows",
        entityId: existingRow?.id ?? null,
        action: existingRow ? "carlos_weekly_payment_updated" : "carlos_weekly_payment_created",
        before: existingRow,
        after: payload,
        actorId: userId,
      });
      setMessage({ tone: "success", text: `Carlos Lopez weekly payment saved: ${formatMoney(weeklyPayment + overtimeAmount)}.` });
      await loadData();
    } catch (error) {
      setMessage({ tone: "error", text: `Carlos Lopez weekly payment could not be saved: ${errorMessage(error)}` });
    } finally {
      setSavingPaymentKey(null);
    }
  }

  async function updatePaymentRowsStatus(summary: (typeof weeklyPaymentSummaries)[number], status: WeeklyPaymentStatus) {
    if (!summary.rows.length || savingPaymentKey) return;
    setSavingPaymentKey(summary.key);
    const now = new Date().toISOString();
    try {
      const paidPayload = status === "paid" ? { status, paid_at: now, updated_at: now } : { status, updated_at: now };
      const { error } = await supabase.from("residential_weekly_payment_rows").update(paidPayload).in("id", summary.rows.map((row) => row.id));
      if (error) throw new Error(error.message);
      await writePayrollAudit(supabase, {
        entityType: "residential_weekly_payment_rows",
        action: `rows_marked_${status}`,
        before: summary.rows.map((row) => ({ id: row.id, status: row.status, paid_at: row.paid_at })),
        after: { cleaner: summary.teamName, row_count: summary.rows.length, status },
        actorId: userId,
      });
      setMessage({ tone: "success", text: status === "paid" ? "Selected cleaner rows marked paid." : `Rows marked ${status.replace("_", " ")}.` });
      await loadData();
    } catch (error) {
      setMessage({ tone: "error", text: `Payment status could not be updated: ${errorMessage(error)}` });
    } finally {
      setSavingPaymentKey(null);
    }
  }

  async function updatePaymentRowStatus(row: ResidentialWeeklyPaymentLineRow, status: WeeklyPaymentStatus) {
    if (savingPaymentKey) return;
    if (row.status === "paid" && status !== "paid" && !window.confirm("This record is already marked as paid. Editing it may affect payroll history.")) return;
    const now = new Date().toISOString();
    setSavingPaymentKey(row.id);
    try {
      const payload = status === "paid" ? { status, paid_at: now, updated_at: now } : { status, updated_at: now };
      const { error } = await supabase.from("residential_weekly_payment_rows").update(payload).eq("id", row.id);
      if (error) throw new Error(error.message);
      await writePayrollAudit(supabase, {
        entityType: "residential_weekly_payment_rows",
        entityId: row.id,
        action: `row_marked_${status}`,
        before: { status: row.status, paid_at: row.paid_at },
        after: payload,
        actorId: userId,
      });
      setMessage({ tone: "success", text: `Payment row marked ${status.replace("_", " ")}.` });
      await loadData();
    } catch (error) {
      setMessage({ tone: "error", text: `Payment row status could not be updated: ${errorMessage(error)}` });
    } finally {
      setSavingPaymentKey(null);
    }
  }

  function editCommercialHours(entry: CommercialHoursEntryRow) {
    setPaymentModalMode("commercial_hours");
    const match = entry.notes?.match(/\[Extra:\s*([\d.]+)h\]/);
    let regularHoursStr = "";
    if (entry.id.startsWith("scheduled-")) {
      const totalHrs = toNumber(entry.scheduled_hours);
      if (match) {
        setIsExtraHours(true);
        setExtraHoursValue(match[1]);
        regularHoursStr = String(Math.max(0, totalHrs - toNumber(match[1])));
      } else {
        setIsExtraHours(false);
        setExtraHoursValue("");
        regularHoursStr = String(totalHrs);
      }
      setCommercialHoursDraft({
        accountId: entry.account_id ?? "",
        teamId: "",
        teamName: entry.team_name ?? "",
        workDate: entry.work_date,
        hours: regularHoursStr,
        status: "completed",
        verified: false,
        notes: entry.notes ? entry.notes.replace(/\[Extra:\s*([\d.]+)h\]/, "").trim() : "",
        manualEntry: false,
      });
      return;
    }
    const team = activeCommercialTeams.find((person) => person.name === entry.team_name);
    const totalHrs = toNumber(entry.verified_hours) || toNumber(entry.completed_hours) || toNumber(entry.scheduled_hours);
    if (match) {
      setIsExtraHours(true);
      setExtraHoursValue(match[1]);
      regularHoursStr = String(Math.max(0, totalHrs - toNumber(match[1])));
    } else {
      setIsExtraHours(false);
      setExtraHoursValue("");
      regularHoursStr = String(totalHrs);
    }
    setCommercialHoursDraft({
      id: entry.id,
      accountId: entry.account_id ?? "",
      teamId: entry.team_id ?? team?.id ?? "",
      teamName: entry.team_name ?? "",
      workDate: entry.work_date,
      hours: regularHoursStr,
      status: (entry.status as CommercialHoursStatus) || "completed",
      verified: Boolean(entry.verified),
      notes: entry.notes ? entry.notes.replace(/\[Extra:\s*([\d.]+)h\]/, "").trim() : "",
      manualEntry: entry.manual_entry !== false,
    });
  }

  async function saveCommercialHours(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || savingPaymentKey) return;
    const account = commercialAccounts.find((item) => item.id === commercialHoursDraft.accountId);
    const team = activeCommercialTeams.find((item) => item.id === commercialHoursDraft.teamId);
    const teamName = team?.name ?? commercialHoursDraft.teamName.trim();
    const regularHours = toNumber(commercialHoursDraft.hours);
    const extraHours = isExtraHours ? toNumber(extraHoursValue) : 0;
    const totalHours = regularHours + extraHours;
    const verified = commercialHoursDraft.verified || commercialHoursDraft.status === "verified" || commercialHoursDraft.status === "paid";
    const validation = validateInput(commercialHoursEntrySchema, {
      commercialAccountId: commercialHoursDraft.accountId,
      teamName,
      workDate: commercialHoursDraft.workDate,
      hours: totalHours,
      status: commercialHoursDraft.status,
      source: commercialHoursDraft.manualEntry ? "manual" : "scheduled",
      verified,
    });
    if (!account || !validation.ok) {
      setMessage({ tone: "error", text: `Commercial hours could not be saved: ${validation.ok ? "account is required." : validation.message}` });
      return;
    }
    if (dateOutsideRange(commercialHoursDraft.workDate, commercialRange.start, commercialRange.end) && !window.confirm("This commercial hours date is outside the selected commercial calculation range. Save it anyway?")) {
      return;
    }
    const now = new Date().toISOString();
    setSavingPaymentKey("commercial-hours");
    try {
      const extraSuffix = isExtraHours && extraHoursValue ? ` [Extra: ${extraHoursValue}h]` : "";
      const finalNotes = (commercialHoursDraft.notes.trim() + extraSuffix).trim();
      const payload = {
        user_id: userId,
        account_id: account.id,
        account_name: account.name,
        team_id: team?.id ?? null,
        team_name: teamName,
        work_date: commercialHoursDraft.workDate,
        scheduled_day: WEEKDAY_NAMES[(parseDateKey(commercialHoursDraft.workDate) ?? new Date()).getDay()],
        scheduled_hours: totalHours,
        completed_hours: totalHours,
        verified_hours: verified ? totalHours : 0,
        status: commercialHoursDraft.status,
        verified,
        notes: finalNotes || null,
        manual_entry: commercialHoursDraft.manualEntry,
        updated_at: now,
      };
      const result = commercialHoursDraft.id
        ? await supabase.from("commercial_hours_entries").update(payload).eq("id", commercialHoursDraft.id)
        : await supabase.from("commercial_hours_entries").insert({ ...payload, created_at: now });
      if (result.error) throw new Error(result.error.message);
      await writePayrollAudit(supabase, {
        entityType: "commercial_hours_entries",
        entityId: commercialHoursDraft.id ?? null,
        action: commercialHoursDraft.id ? "commercial_hours_updated" : "commercial_hours_created",
        before: commercialHoursDraft.id ? commercialHoursEntries.find((entry) => entry.id === commercialHoursDraft.id) : null,
        after: payload,
        actorId: userId,
      });
      setCommercialHoursDraft({ ...EMPTY_COMMERCIAL_HOURS_DRAFT, workDate: commercialHoursDraft.workDate });
      setIsExtraHours(false);
      setExtraHoursValue("");
      setPaymentModalMode(null);
      setMessage({ tone: "success", text: "Commercial hours saved." });
      await loadData();
    } catch (error) {
      setMessage({ tone: "error", text: `Commercial hours could not be saved: ${errorMessage(error)}` });
    } finally {
      setSavingPaymentKey(null);
    }
  }

  async function deleteCommercialHours() {
    if (!userId || !commercialHoursDraft.id) return;
    if (!window.confirm("Are you sure you want to delete this commercial hours entry?")) return;
    setSavingPaymentKey("commercial-hours");
    try {
      const { error } = await supabase
        .from("commercial_hours_entries")
        .delete()
        .eq("id", commercialHoursDraft.id);
      if (error) throw new Error(error.message);
      await writePayrollAudit(supabase, {
        entityType: "commercial_hours_entries",
        entityId: commercialHoursDraft.id,
        action: "commercial_hours_deleted",
        before: commercialHoursEntries.find((entry) => entry.id === commercialHoursDraft.id) || null,
        after: null,
        actorId: userId,
      });
      setCommercialHoursDraft({ ...EMPTY_COMMERCIAL_HOURS_DRAFT, workDate: commercialHoursDraft.workDate });
      setIsExtraHours(false);
      setExtraHoursValue("");
      setPaymentModalMode(null);
      setMessage({ tone: "success", text: "Commercial hours deleted." });
      await loadData();
    } catch (err) {
      setMessage({ tone: "error", text: `Commercial hours could not be deleted: ${errorMessage(err)}` });
    } finally {
      setSavingPaymentKey(null);
    }
  }

  async function saveCommercialSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || savingPaymentKey) return;
    const account = commercialAccounts.find((item) => item.id === commercialScheduleDraft.accountId);
    const team = activeCommercialTeams.find((item) => item.id === commercialScheduleDraft.assignedTeamId);
    const assignedName = team?.name ?? commercialScheduleDraft.assignedTeamName.trim();
    const dayPayloads = commercialScheduleDraft.selectedDays.map((day) => {
      const hours = toNumber(commercialScheduleDraft.dayHours[day]);
      return { day: Number(day), hours };
    });
    const validation = validateInput(commercialScheduleSchema, {
      commercialAccountId: commercialScheduleDraft.accountId,
      assignedName,
      frequency: commercialScheduleDraft.frequency,
      selectedDays: commercialScheduleDraft.selectedDays,
      dayHours: Object.fromEntries(dayPayloads.map((item) => [String(item.day), item.hours])),
      effectiveFrom: commercialScheduleDraft.effectiveFrom,
      effectiveUntil: commercialScheduleDraft.effectiveUntil,
      active: commercialScheduleDraft.active,
    });
    if (!account || !validation.ok || dayPayloads.some((item) => !Number.isFinite(item.day))) {
      setMessage({ tone: "error", text: `Commercial schedule could not be saved: ${validation.ok ? "account is required." : validation.message}` });
      return;
    }
    const now = new Date().toISOString();
    setSavingPaymentKey("commercial-schedule");
    try {
      const { error: deactivateError } = await supabase
        .from("commercial_account_schedule_rules")
        .update({ active: false, updated_at: now })
        .eq("commercial_account_id", account.id);
      if (deactivateError) throw new Error(deactivateError.message);

      const rows = dayPayloads.map((item) => ({
        user_id: userId,
        commercial_account_id: account.id,
        day_of_week: item.day,
        paid_hours: item.hours,
        scheduled_hours: item.hours,
        assigned_cleaner_name: assignedName,
        active: commercialScheduleDraft.active,
        effective_start_date: commercialScheduleDraft.effectiveFrom,
        effective_end_date: commercialScheduleDraft.effectiveUntil || null,
        effective_from: commercialScheduleDraft.effectiveFrom,
        effective_until: commercialScheduleDraft.effectiveUntil || null,
        frequency_type: commercialScheduleDraft.frequency,
        frequency_interval: commercialScheduleDraft.frequency === "every_15_days" ? 15 : commercialScheduleDraft.frequency === "every_3_weeks" ? 3 : 1,
        anchor_date: commercialScheduleDraft.effectiveFrom,
        notes: commercialScheduleDraft.notes.trim() || null,
        created_at: now,
        updated_at: now,
      }));
      const { error } = await supabase.from("commercial_account_schedule_rules").insert(rows);
      if (error) throw new Error(error.message);
      await writePayrollAudit(supabase, {
        entityType: "commercial_account_schedule_rules",
        action: "commercial_schedule_created",
        after: { account_id: account.id, account_name: account.name, rows },
        actorId: userId,
      });
      setCommercialScheduleDraft({ ...EMPTY_COMMERCIAL_SCHEDULE_DRAFT, effectiveFrom: todayKey() });
      setPaymentModalMode(null);
      setMessage({ tone: "success", text: "Commercial schedule saved. The hours table now uses those structured service days." });
      await loadData();
    } catch (error) {
      setMessage({ tone: "error", text: `Commercial schedule could not be saved: ${errorMessage(error)}` });
    } finally {
      setSavingPaymentKey(null);
    }
  }

  async function updateCommercialHoursStatus(entry: CommercialHoursEntryRow, status: CommercialHoursStatus) {
    if (savingPaymentKey) return;
    if (entry.id.startsWith("scheduled-")) {
      setSavingPaymentKey(entry.id);
      const now = new Date().toISOString();
      const hours = toNumber(entry.scheduled_hours);
      const verified = status === "verified" || status === "paid";
      try {
        const payload = {
          user_id: userId,
          account_id: entry.account_id,
          account_name: entry.account_name,
          team_id: entry.team_id || null,
          team_name: entry.team_name,
          work_date: entry.work_date,
          scheduled_day: entry.scheduled_day,
          scheduled_hours: hours,
          completed_hours: hours,
          verified_hours: verified ? hours : 0,
          status,
          verified,
          notes: entry.notes || null,
          manual_entry: false,
          updated_at: now,
        };
        const { error } = await supabase.from("commercial_hours_entries").insert({ ...payload, created_at: now });
        if (error) throw error;
        await writePayrollAudit(supabase, {
          entityType: "commercial_hours_entries",
          action: `commercial_hours_marked_${status}_from_schedule`,
          before: null,
          after: payload,
          actorId: userId,
        });
        setMessage({ tone: "success", text: `Commercial hours marked ${status.replace("_", " ")}.` });
        await loadData();
      } catch (error) {
        setMessage({ tone: "error", text: `Commercial hours status could not be updated: ${parseSupabaseError(error as Error)}` });
      } finally {
        setSavingPaymentKey(null);
      }
      return;
    }
    if (entry.status === "paid" && status !== "paid" && !window.confirm("This record is already marked as paid. Editing it may affect payroll history.")) return;
    const now = new Date().toISOString();
    const hours = toNumber(entry.completed_hours) || toNumber(entry.scheduled_hours);
    const payload = {
      status,
      verified: status === "verified" || status === "paid" ? true : entry.verified,
      verified_hours: status === "verified" || status === "paid" ? hours : entry.verified_hours,
      paid_at: status === "paid" ? now : entry.paid_at ?? null,
      updated_at: now,
    };
    setSavingPaymentKey(entry.id);
    try {
      const { error } = await supabase.from("commercial_hours_entries").update(payload).eq("id", entry.id);
      if (error) throw error;
      await writePayrollAudit(supabase, {
        entityType: "commercial_hours_entries",
        entityId: entry.id,
        action: `commercial_hours_marked_${status}`,
        before: { status: entry.status, verified: entry.verified, paid_at: entry.paid_at },
        after: payload,
        actorId: userId,
      });
      setMessage({ tone: "success", text: `Commercial hours marked ${status.replace("_", " ")}.` });
      await loadData();
    } catch (error) {
      setMessage({ tone: "error", text: `Commercial hours status could not be updated: ${parseSupabaseError(error as Error)}` });
    } finally {
      setSavingPaymentKey(null);
    }
  }

  async function exportCurrentReport() {
    await exportRows(`pristine-${reportKind}-${todayKey()}.xlsx`, getReportRows());
  }

  async function exportWeeklyPayments() {
    const anchor = parseDateKey(paymentWeekStart) ?? new Date();
    const year = anchor.getFullYear();
    const month = anchor.getMonth() + 1; // 1-12
    const monthLabel = anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    // Fetch all active payment rows belonging to the selected month/year
    const monthRows = weeklyPaymentRows.filter((row) => {
      const date = parseDateKey(row.work_date);
      if (!date) return false;
      return date.getFullYear() === year && (date.getMonth() + 1) === month;
    });

    const cleanersMap = new Map<string, { cleanings: number; amount: number }[]>();
    
    // Initialize weeks 1 to 5 for every active residential cleaner
    const residentialStaff = staff.filter((person) => {
      const isLead = ["owner", "operations manager"].includes(String(person.role ?? "").toLowerCase());
      return staffIsActive(person) && !isLead;
    });

    for (const person of residentialStaff) {
      cleanersMap.set(person.name, Array.from({ length: 5 }, () => ({ cleanings: 0, amount: 0 })));
    }

    // Include any other cleaners who have recorded payments in this month
    for (const row of monthRows) {
      if (!cleanersMap.has(row.cleaner_name)) {
        cleanersMap.set(row.cleaner_name, Array.from({ length: 5 }, () => ({ cleanings: 0, amount: 0 })));
      }
    }

    // Populate cleaner weeks data based on work dates
    for (const row of monthRows) {
      const date = parseDateKey(row.work_date);
      if (!date) continue;
      const day = date.getDate();
      const weekIndex = Math.min(4, Math.floor((day - 1) / 7));
      
      const weeks = cleanersMap.get(row.cleaner_name);
      if (weeks) {
        weeks[weekIndex].cleanings += 1;
        weeks[weekIndex].amount += paymentLineTotal(row);
      }
    }

    // Format cleaner array for the exporter
    const gridCleaners = Array.from(cleanersMap.entries()).map(([cleanerName, weeks]) => ({
      cleanerName,
      weeks,
    })).sort((a, b) => a.cleanerName.localeCompare(b.cleanerName));

    // Construct raw ledger rows for Tab 2
    const rawLedgerRows = monthRows.map((row) => {
      const summary = weeklyPaymentSummaries.find((s) => s.teamId === row.cleaner_id || s.teamName === row.cleaner_name);
      const mixed = summary ? isMixedPaySummary(summary) : false;
      return {
        Cleaner: row.cleaner_name,
        Date: row.work_date,
        City: displayPaymentCity(row),
        Payment: mixed ? "" : toNumber(row.payment_amount),
        Residential: mixed ? toNumber(row.residential_amount) : "",
        Commercial: mixed ? toNumber(row.commercial_amount) : "",
        Total: paymentLineTotal(row),
        Notes: row.notes ?? "",
        Status: row.status ?? "pending",
      };
    });

    const filename = `weekly-residential-payments-${monthLabel.replace(/\s+/g, "-")}.xlsx`;
    await exportCleanerGridReport(filename, monthLabel, gridCleaners, rawLedgerRows);
  }

  async function exportCommercialHours() {
    await exportRows(`commercial-hours-${commercialRange.start}.xlsx`, filteredCommercialRows.map((entry) => {
      return {
        Date: entry.work_date,
        "Commercial Account": entry.account_name,
        Team: entry.team_name,
        "Scheduled Day": entry.scheduled_day,
        "Scheduled Hours": toNumber(entry.scheduled_hours),
        "Actual Hours": toNumber(entry.completed_hours),
        "Verified Payable": getPayableCommercialHours(entry),
        Status: entry.status,
        Source: entry.manual_entry === false ? "scheduled" : "manual",
      };
    }));
  }

  function getReportRows() {
    if (reportKind === "tasks") {
      return tasks.map((task) => {
        const status = normalizeTaskStatus(task.status);
        const overdue = status === "pending" && Boolean(task.due_date && dateKeyFromValue(task.due_date) < today);
        return {
          title: task.title,
          status: overdue ? "overdue" : status,
          assigned_to: task.assignee,
          due_date: task.due_date,
          completed_at: task.completed_at,
          frequency: TASK_FREQUENCY_LABELS[frequencyFromRecurrence(task.recurrence)],
          priority: task.priority,
        };
      });
    }

    if (reportKind === "hours") {
      return logsInPeriod.map((log) => ({
        account: log.account_name,
        team: log.team_name,
        work_date: log.work_date,
        hours_worked: toNumber(log.hours_worked),
        status: log.status,
        period_start: periodRange.start,
        period_end: periodRange.end,
      }));
    }

    return weeklyPaymentSummaries.flatMap((summary) => {
      const mixed = isMixedPaySummary(summary);
      return summary.rows.map((row) => ({
        cleaner: summary.teamName,
        date: row.work_date,
        city: row.city,
        payment: mixed ? "" : toNumber(row.payment_amount),
        residential: mixed ? toNumber(row.residential_amount) : "",
        commercial: mixed ? toNumber(row.commercial_amount) : "",
        total: paymentLineTotal(row),
        status: row.status ?? summary.payment?.status ?? "pending",
      }));
    });
  }

  return (
    <DashboardShell userEmail={userEmail}>
      <div className="space-y-5">
        {renderHeader()}
        {message ? (
          <div className={cn("flex items-start justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold shadow-sm", messageClass(message.tone))}>
            <span>{message.text}</span>
            <button type="button" className="grid size-6 place-items-center rounded-xl transition hover:bg-background/60" aria-label="Dismiss message" onClick={() => setMessage(null)}><X className="size-[18px]" /></button>
          </div>
        ) : null}
        {loading ? <Card className={SOP_PANEL_CLASS}><CardContent className="p-8 text-center text-sm font-semibold text-muted-foreground">Loading operations tracker...</CardContent></Card> : null}
        {!loading && view === "dashboard" ? renderDashboard() : null}
        {!loading && view === "tasks" ? renderTasks() : null}
        {!loading && view === "residential" ? renderResidential() : null}
        {!loading && view === "staff" ? renderStaff() : null}
        {!loading && view === "reports" ? renderReports() : null}
        {!loading && view === "settings" ? renderSettings() : null}
      </div>
      {taskDraft ? renderTaskModal() : null}
      {selectedTask ? renderTaskDetail() : null}
      {accountDraft ? renderAccountModal() : null}
      {staffDraft ? renderStaffModal() : null}
      {dropdownPos && activeDropdownRowId && (
        <>
          <div
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => { setActiveDropdownRowId(null); setDropdownPos(null); }}
          />
          <div
            className="fixed z-50 min-w-[140px] rounded-xl border border-border bg-popover p-1.5 shadow-xl animate-in fade-in-50 slide-in-from-top-1 text-left"
            style={{ top: dropdownPos.top, right: dropdownPos.right }}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-foreground hover:bg-accent transition-colors"
              onClick={() => {
                const { row, summary, mixed } = dropdownPos;
                setActiveDropdownRowId(null);
                setDropdownPos(null);
                if (summary) openPaymentModal(summary, mixed ? "juan" : "residential", row);
              }}
            >
              <Pencil className="size-3.5 text-muted-foreground/80" /> Edit
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-950/20 transition-colors"
              onClick={() => { setActiveDropdownRowId(null); setDropdownPos(null); updatePaymentRowStatus(dropdownPos.row, "pending"); }}
            >
              <Clock className="size-3.5 text-orange-500/80" /> Pending
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-sky-600 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950/20 transition-colors"
              onClick={() => { setActiveDropdownRowId(null); setDropdownPos(null); updatePaymentRowStatus(dropdownPos.row, "verified"); }}
            >
              <BadgeCheck className="size-3.5 text-sky-500/80" /> Verify
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/20 transition-colors"
              onClick={() => { setActiveDropdownRowId(null); setDropdownPos(null); updatePaymentRowStatus(dropdownPos.row, "paid"); }}
            >
              <CheckCircle2 className="size-3.5 text-emerald-500/80" /> Paid
            </button>
            <div className="my-1 border-t border-border/50" />
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/20 transition-colors"
              onClick={() => { setActiveDropdownRowId(null); setDropdownPos(null); deletePaymentRow(dropdownPos.row); }}
            >
              <Trash2 className="size-3.5 text-rose-500/80" /> Delete
            </button>
          </div>
        </>
      )}
    </DashboardShell>
  );

  function renderHeader() {
    const headers: Record<SimpleOperationsView, { title: string; sub: string; icon: LucideIcon }> = {
      dashboard: { title: "Operations dashboard", sub: "Daily reminders, residential payments, and commercial hours.", icon: CheckCircle2 },
      tasks: { title: "Task reminders", sub: "Operational reminders for Jake and Carlos.", icon: Clock },
      residential: commercialPanelOpen
        ? { title: "Commercial hours", sub: "Track commercial team hours by account, schedule, and pay period.", icon: Clock }
        : { title: "Residential payments", sub: "Weekly residential payments and tracking.", icon: WalletCards },
      staff: { title: "Staff / Teams", sub: "Manage team roles, areas, and payment sources.", icon: Users },
      reports: { title: "Reports", sub: "Task, hours, and weekly payment exports.", icon: FileText },
      settings: { title: "Settings", sub: "Notification setup and residential operations defaults.", icon: Settings2 },
    };
    const meta = headers[view];
    const Icon = meta.icon;
    return (
      <div className="flex items-center gap-2 flex-wrap">
            {view === "tasks" ? (
              <>
                <Button variant="outline" disabled={importingMonthlySop} onClick={() => importMonthlySop()}><CalendarDays /> {importingMonthlySop ? "Generating..." : "Generate Monthly SOP"}</Button>
                <Button onClick={() => openTaskDraft()}><Plus /> Add reminder</Button>
              </>
            ) : null}
            {view === "residential" ? (
              commercialPanelOpen ? (
                <>
                  <Button variant="outline" onClick={() => setCommercialPanelOpen(false)}><ChevronLeft className="size-4" /> Residential payments</Button>
                  <Button onClick={() => setPaymentModalMode("commercial_hours")}><Plus className="size-4" /> Add commercial hours</Button>
                  <Button variant="outline" onClick={() => setPaymentModalMode("commercial_schedule")}><Settings2 className="size-4" /> Configure</Button>
                  <Button variant="outline" onClick={exportCommercialHours}><FileDown className="size-4" /> Export</Button>
                </>
              ) : paymentsRegistryOpen ? (
                <>
                  <Button variant="outline" onClick={() => setPaymentsRegistryOpen(false)}><ChevronLeft className="size-4" /> Back to tracker</Button>
                  <Button variant="outline" onClick={exportWeeklyPayments}><FileDown className="size-4" /> Export</Button>
                </>
              ) : (
                <>
                  <Button onClick={() => {
                    setCommercialPanelOpen(false);
                    setPaymentsRegistryOpen(false);
                    const first = weeklyPaymentSummaries.find((summary) => !isCarlosLopez(summary.teamName));
                    if (first) openPaymentModal(first, "residential");
                  }}><Plus className="size-4" /> Add residential payment</Button>
                  <Button variant="outline" onClick={() => { setCommercialPanelOpen(true); setPaymentsRegistryOpen(false); }}><Clock className="size-4" /> Commercial hours</Button>
                  <Button variant="outline" onClick={() => { setPaymentsRegistryOpen(true); setCommercialPanelOpen(false); }}><FileText className="size-4" /> Payments registry</Button>
                  <Button variant="outline" onClick={exportWeeklyPayments}><FileDown className="size-4" /> Export</Button>
                </>
              )
            ) : null}
            {view === "staff" ? <Button onClick={() => openStaffDraft()}><Plus /> Add cleaner</Button> : null}
          </div>
    );
  }

  function renderDashboard() {
    const currentWeek = weekRangeFromStart(formatDateKey(startOfWeek(new Date())));
    const workedThisWeek = workLogs
      .filter((log) => isDateInRange(log.work_date, currentWeek.start, currentWeek.end))
      .reduce((sum, log) => sum + toNumber(log.hours_worked), 0);
    const recentCompleted = taskStats.completed
      .slice()
      .sort((a, b) => String(b.completed_at ?? b.updated_at).localeCompare(String(a.completed_at ?? a.updated_at)))
      .slice(0, 5);
    const pendingSummaries = weeklyPaymentSummaries.filter((summary) => summary.paymentTotal > 0 && summary.payment?.status !== "paid");
    const focusItems = [
      { label: "Review overdue tasks", value: taskStats.overdue.length, href: "/tasks", tone: taskStats.overdue.length ? "warn" : "good" },
      { label: "Close pending payments", value: pendingSummaries.length, href: "/residential", tone: pendingSummaries.length ? "warn" : "good" },
      { label: "Verify commercial hours", value: commercialTotals.needsReview, href: "/residential", tone: commercialTotals.needsReview ? "warn" : "good" },
    ];

    return (
      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Clock} label="Tasks due today" value={taskStats.dueToday.length} note={taskStats.dueToday.length ? "Needs attention today" : "No reminders due today."} tone={taskStats.dueToday.length ? "warn" : "good"} />
          <MetricCard icon={AlertTriangle} label="Overdue tasks" value={taskStats.overdue.length} note="Pending past due date" tone={taskStats.overdue.length ? "warn" : "good"} />
          <MetricCard icon={WalletCards} label="Pending residential payments" value={formatMoney(pendingPaymentTotal)} note="Open weekly payments" tone={pendingPaymentTotal ? "warn" : "good"} />
          <MetricCard icon={Users} label="Active teams" value={activeTeams.length} note={`${formatHours(workedThisWeek)}h logged this week`} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr] items-start">
          {/* LEFT COLUMN: Operations Queue & Residential Payments */}
          <div className="space-y-4">
            <Card className={SOP_PANEL_CLASS}>
              <CardHeader className="flex-row items-center justify-between space-y-0 p-4 sm:p-5">
                <div>
                  <CardTitle>Today&apos;s operating queue</CardTitle>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">Reminders that need a person, a date, or a close-out today.</p>
                </div>
                <Button asChild className={SOP_ACTION_BUTTON_CLASS} variant="outline" size="sm"><Link href="/tasks">Open reminders</Link></Button>
              </CardHeader>
              <CardContent className="grid gap-2">
                {taskStats.dueToday.length === 0 ? <div className={SOP_EMPTY_CLASS}>No reminders due today.</div> : null}
                {taskStats.dueToday.slice(0, 6).map((task) => renderCompactTaskRow(task))}
              </CardContent>
            </Card>

            <Card className={SOP_PANEL_CLASS}>
              <CardHeader className="flex-row items-center justify-between space-y-0 p-4 sm:p-5">
                <div>
                  <CardTitle>Residential payments</CardTitle>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">{dateRangeLabel(currentWeek.start, currentWeek.end)}</p>
                </div>
                <Button asChild className={SOP_ACTION_BUTTON_CLASS} variant="outline" size="sm"><Link href="/residential">Open tracker</Link></Button>
              </CardHeader>
              <CardContent className="grid gap-2">
                {pendingSummaries.length === 0 ? <div className={SOP_EMPTY_CLASS}>No residential payments need attention.</div> : null}
                {pendingSummaries.slice(0, 5).map((team) => (
                  <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/65 p-3" key={team.key}>
                    <div>
                      <p className="font-semibold">{team.teamName}</p>
                      <p className="text-xs font-medium text-muted-foreground">{team.rows.length} payment rows</p>
                    </div>
                    <p className="text-lg font-semibold text-primary">{formatMoney(team.paymentTotal)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN: Quick Focus & Activity */}
          <div className="space-y-4">
            <Card className={SOP_PANEL_CLASS}>
              <CardHeader className="p-4 sm:p-5">
                <CardTitle>Quick focus</CardTitle>
                <p className="mt-1 text-sm font-medium text-muted-foreground">The few checks that protect payroll and daily follow-up.</p>
              </CardHeader>
              <CardContent className="grid gap-2">
                {focusItems.map((item) => (
                  <Link className="flex items-center justify-between rounded-xl border border-border/70 bg-card/60 p-3 transition hover:border-primary/30 hover:bg-accent/20" href={item.href} key={item.label}>
                    <div>
                      <p className="font-semibold">{item.label}</p>
                      <p className="text-xs font-medium text-muted-foreground">{item.tone === "warn" ? "Needs review before the day closes." : "No action needed right now."}</p>
                    </div>
                    <Badge className={statusBadgeClass(item.tone === "warn" ? "needs_review" : "active")} variant="outline">{item.value}</Badge>
                  </Link>
                ))}
              </CardContent>
            </Card>

            {recentCompleted.length > 0 ? (
              <Card className={SOP_PANEL_CLASS}>
                <CardHeader className="p-4 sm:p-5">
                  <CardTitle>Recently completed</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {recentCompleted.map((task) => renderCompactTaskRow(task))}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  function renderCompactTaskRow(task: OperationTaskRow) {
    return (
      <button
        type="button"
        className={cn(SOP_ROW_CLASS, "flex items-start justify-between gap-3 text-left")}
        key={task.id}
        onClick={() => setSelectedTask(task)}
      >
        <div className="min-w-0">
          <p className="truncate font-semibold">{task.title}</p>
          <p className="text-xs font-medium text-muted-foreground">{task.assignee ?? "Unassigned"} · {displayDate(task.due_date)}</p>
        </div>
        <Badge className={statusBadgeClass(normalizeTaskStatus(task.status))} variant="outline">{statusLabel(normalizeTaskStatus(task.status))}</Badge>
      </button>
    );
  }

  function renderTasks() {
    const tabCounts: Record<TaskTab, number> = {
      pending: taskStats.pending.length - taskStats.overdue.length,
      completed: taskStats.completed.length,
      overdue: taskStats.overdue.length,
      all: tasks.length,
    };
    const anchorDate = visibleTaskMonth.start;
    const monthStart = visibleTaskMonth.start;
    const monthEnd = visibleTaskMonth.end;
    const calendarStart = startOfWeek(monthStart);
    const calendarDays = Array.from({ length: 42 }, (_, index) => {
      const date = addDays(calendarStart, index);
      return { key: formatDateKey(date), date, inMonth: date >= monthStart && date <= monthEnd };
    });
    const monthFilteredTasks = filteredTasks.filter((task) => {
      const dueDate = dateKeyFromValue(task.due_date);
      return Boolean(dueDate && dueDate >= visibleTaskMonth.startKey && dueDate <= visibleTaskMonth.endKey);
    });
    const tasksByDay = new Map<string, OperationTaskRow[]>();
    for (const task of monthFilteredTasks) {
      const key = dateKeyFromValue(task.due_date);
      if (!key) continue;
      const current = tasksByDay.get(key) ?? [];
      current.push(task);
      tasksByDay.set(key, current);
    }
    const unscheduledTasks = filteredTasks.filter((task) => !dateKeyFromValue(task.due_date));
    const selectedDayTasks = filteredTasks.filter((task) => dateKeyFromValue(task.due_date) === taskSelectedDay).sort((a, b) => a.title.localeCompare(b.title));
    const listTasks = monthFilteredTasks.slice().sort((a, b) => String(a.due_date ?? "9999-99-99").localeCompare(String(b.due_date ?? "9999-99-99")) || a.title.localeCompare(b.title));
    const monthlySopNote = monthlySopTaskCount >= 56
      ? `${monthlySopTaskCount} tasks generated for ${visibleTaskMonth.label}`
      : selectedMonthCanGenerateSop
        ? `0 generated for selected month`
        : "56 active SOP templates start in June 2026";
    const calendarButtonClass = "inline-flex h-10 min-w-10 items-center justify-center rounded-xl border border-border/70 bg-card px-3 text-sm font-semibold text-foreground shadow-none transition hover:border-primary/25 hover:bg-accent/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-55";
    const taskChipClass = (task: OperationTaskRow, dayKey: string) => {
      const status = normalizeTaskStatus(task.status);
      const overdue = status === "pending" && dayKey < today;
      if (overdue) return "border-rose-200/80 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/25 dark:text-rose-100";
      if (status === "completed") return "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-100";
      return "border-amber-200/70 bg-amber-50/70 text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100";
    };
    const compactMetrics = [
      { label: "Pending", value: taskStats.pending.length, Icon: Clock, note: "Open reminders", tone: "neutral" },
      { label: "Overdue", value: taskStats.overdue.length, Icon: AlertTriangle, note: "Past due", tone: taskStats.overdue.length ? "warn" : "good" },
      { label: "Completed", value: taskStats.completed.length, Icon: CheckCircle2, note: "Closed tasks", tone: "good" },
      { label: "Monthly SOP", value: monthlySopTaskCount >= 56 ? 56 : monthlySopTaskCount, Icon: FileText, note: monthlySopNote, tone: monthlySopTaskCount === 56 ? "good" : "warn" },
    ];

    function renderTaskList(rows: OperationTaskRow[], emptyText: string) {
      return (
        <div className="grid gap-2">
          {rows.length === 0 ? <div className={SOP_EMPTY_CLASS}>{emptyText}</div> : null}
          {rows.map((task) => {
            const status = normalizeTaskStatus(task.status);
            const dueKey = dateKeyFromValue(task.due_date);
            const overdue = status === "pending" && Boolean(dueKey && dueKey < today);
            const sourceDocument = taskSourceDocument(task);
            return (
              <div className={cn(SOP_ROW_CLASS, "flex flex-wrap items-center justify-between gap-3")} key={task.id}>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelectedTask(task)}>
                  <p className="truncate font-semibold">{task.title}</p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">{task.assignee ?? "Unassigned"} · {displayDate(task.due_date)} · {TASK_FREQUENCY_LABELS[frequencyFromRecurrence(task.recurrence)]}</p>
                </button>
                {sourceDocument ? <Badge variant="outline">{sourceDocument}</Badge> : null}
                <Badge className={statusBadgeClass(overdue ? "overdue" : status)} variant="outline">{statusLabel(overdue ? "overdue" : status)}</Badge>
                <div className="flex gap-1">
                  <Button className="h-10 rounded-xl px-2.5 text-xs" disabled={status === "completed" || completingTaskId === task.id} onClick={() => completeTask(task)}><Check className="size-[18px]" /> Mark completed</Button>
                  <Button className="size-10" size="icon" variant="outline" aria-label="Edit task" title="Edit task" onClick={() => openTaskDraft(task)}><Edit3 className="size-[18px]" /></Button>
                  <Button className="size-10 border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800" size="icon" variant="outline" aria-label="Delete task" title="Delete task" disabled={deletingTaskId === task.id} onClick={() => deleteTask(task)}><Trash2 className="size-[18px]" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {compactMetrics.map(({ label, value, Icon, note, tone }) => (
            <MetricCard key={label} icon={Icon} label={label} value={value} note={note} tone={tone as "neutral" | "good" | "warn"} />
          ))}
        </div>

        {selectedMonthCanGenerateSop && monthlySopTaskCount < 56 ? (
          <Card className="rounded-xl border-amber-200 bg-amber-50/55 shadow-none dark:border-amber-900 dark:bg-amber-950/15">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">Monthly SOP not generated for {visibleTaskMonth.label}</p>
                <p className="mt-1 text-sm font-medium text-muted-foreground">Generate the 56 recurring SOP task instances from active Monthly SOP templates.</p>
              </div>
              <Button className={SOP_ACTION_BUTTON_CLASS} disabled={importingMonthlySop} onClick={() => importMonthlySop(visibleTaskMonth)}><CalendarDays className="size-[18px]" /> {importingMonthlySop ? "Generating..." : `Generate ${visibleTaskMonth.label}`}</Button>
            </CardContent>
          </Card>
        ) : null}

        {monthlySopImportSummary ? (
          <Card className={cn("rounded-xl border shadow-none", monthlySopImportSummary.processed === monthlySopImportSummary.expected ? "border-emerald-200 bg-emerald-50/30 dark:border-emerald-900 dark:bg-emerald-950/15" : "border-amber-200 bg-amber-50/55 dark:border-amber-900 dark:bg-amber-950/15")}>
            <CardContent className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="min-w-0">
                <p className="text-lg font-semibold leading-tight">{monthlySopImportSummary.message}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm font-medium text-muted-foreground">
                  <span>{monthlySopImportSummary.sourceDocument}</span>
                  <span>{monthlySopImportSummary.month}</span>
                  <span>{monthlySopImportSummary.recurrence}</span>
                </div>
                <p className="mt-1 text-sm font-medium text-muted-foreground">{monthlySopImportSummary.calendarStart}</p>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Badge variant="outline">Expected {monthlySopImportSummary.expected}</Badge>
                <Badge variant="outline">Created {monthlySopImportSummary.created}</Badge>
                <Badge variant="outline">Skipped {monthlySopImportSummary.duplicatesSkipped}</Badge>
                {monthlySopImportSummary.archivedDuplicates ? <Badge variant="outline">Archived duplicates {monthlySopImportSummary.archivedDuplicates}</Badge> : null}
                <Badge variant="outline">Updated {monthlySopImportSummary.updated}</Badge>
                <Badge variant="outline">Templates {monthlySopImportSummary.templatesVerified}</Badge>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-3 rounded-2xl border border-border/65 bg-card p-4 shadow-[0_14px_42px_-40px_hsl(215_40%_20%)] xl:grid-cols-[auto_1fr] xl:items-center">
          <div className="flex min-w-0 flex-wrap gap-2">
            <AppSegmentedControl ariaLabel="Task calendar view" value={taskViewMode} onChange={setTaskViewMode} options={[
              { value: "month", label: "Month" },
              { value: "day", label: "Day" },
              { value: "list", label: "List" },
            ]} />
            <AppSegmentedControl ariaLabel="Task status filter" value={taskTab} onChange={setTaskTab} options={(["pending", "overdue", "completed", "all"] as TaskTab[]).map((tab) => ({ value: tab, label: `${statusLabel(tab)} (${tabCounts[tab]})` }))} />
          </div>
          <div className="grid min-w-0 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
            <input className={cn(PAYMENT_FIELD_CLASS, "bg-background")} placeholder="Search reminders" value={taskSearch} onChange={(event) => setTaskSearch(event.target.value)} />
            {taskViewMode === "day" ? <input className={PAYMENT_FIELD_CLASS} type="date" lang="en-US" value={taskSelectedDay} onChange={(event) => setTaskSelectedDay(event.target.value)} /> : null}
            <select className={cn(PAYMENT_FIELD_CLASS, "bg-background")} value={taskSourceFilter} onChange={(event) => setTaskSourceFilter(event.target.value as "all" | "monthly_sop")} aria-label="Task source filter">
              <option value="all">All sources</option>
              <option value="monthly_sop">Monthly SOP</option>
            </select>
            <Button className="w-full sm:w-auto" variant="outline" onClick={() => { setTaskSearch(""); setTaskSourceFilter("all"); setTaskTab("pending"); setTaskViewMode("month"); setTaskSelectedDay(todayKey()); }}><RotateCcw /> Clear</Button>
          </div>
        </div>

        <Card className="overflow-hidden rounded-2xl border border-border/65 bg-card shadow-[0_18px_58px_-50px_hsl(215_40%_20%)]">
          <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border/60 bg-card px-5 py-4">
            <div>
              <CardTitle className="text-xl font-semibold tracking-normal">{taskViewMode === "list" ? "Task list" : taskViewMode === "day" ? "Tasks by day" : "Task calendar"}</CardTitle>
              <p className="mt-1 text-sm font-medium text-muted-foreground">{taskViewMode === "day" ? displayDate(taskSelectedDay) : taskViewMode === "list" ? `${listTasks.length} reminders in ${visibleTaskMonth.label}` : visibleTaskMonth.label}</p>
            </div>
            <div className="flex items-center gap-1.5">
              {taskViewMode === "month" ? (
                <>
                  <button className={cn(calendarButtonClass, "px-0")} type="button" aria-label="Previous month" onClick={() => setTaskCalendarAnchor(formatDateKey(new Date(anchorDate.getFullYear(), anchorDate.getMonth() - 1, 1)))}><ChevronLeft className="size-[18px]" /></button>
                  <button className={calendarButtonClass} type="button" onClick={() => setTaskCalendarAnchor(formatDateKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))}>Today</button>
                  <button className={cn(calendarButtonClass, "px-0")} type="button" aria-label="Next month" onClick={() => setTaskCalendarAnchor(formatDateKey(new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 1)))}><ChevronRight className="size-[18px]" /></button>
                </>
              ) : null}
              {taskViewMode === "day" ? (
                <>
                  <button className={cn(calendarButtonClass, "px-0")} type="button" aria-label="Previous day" onClick={() => setTaskSelectedDay(formatDateKey(addDays(parseDateKey(taskSelectedDay) ?? new Date(), -1)))}><ChevronLeft className="size-[18px]" /></button>
                  <button className={calendarButtonClass} type="button" onClick={() => setTaskSelectedDay(todayKey())}>Today</button>
                  <button className={cn(calendarButtonClass, "px-0")} type="button" aria-label="Next day" onClick={() => setTaskSelectedDay(formatDateKey(addDays(parseDateKey(taskSelectedDay) ?? new Date(), 1)))}><ChevronRight className="size-[18px]" /></button>
                </>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {taskViewMode === "list" ? <div className="p-3">{renderTaskList(listTasks, "No reminders match this list.")}</div> : null}
            {taskViewMode === "day" ? <div className="p-3">{renderTaskList(selectedDayTasks, "No reminders for this day.")}</div> : null}
            {taskViewMode === "month" ? (
              <>
            <div className="grid grid-cols-7 border-b border-border/45 bg-muted/25 text-center text-xs font-semibold text-muted-foreground">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div className="border-r border-border/35 py-3 last:border-r-0" key={day}>{day}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map(({ key, date, inMonth }) => {
                const dayTasks = (tasksByDay.get(key) ?? []).slice().sort((a, b) => String(a.due_date ?? "").localeCompare(String(b.due_date ?? "")) || a.title.localeCompare(b.title));
                const isToday = key === today;
                return (
                  <section className={cn("group min-h-32 border-b border-r border-border/35 bg-card/80 p-2.5 transition hover:bg-accent/10 last:border-r-0", !inMonth && "bg-muted/15 text-muted-foreground", isToday && "bg-primary/[0.06]")} key={key}>
                    <div className="flex items-center justify-between gap-2">
                      <button type="button" className={cn("grid size-6 place-items-center rounded-md text-xs font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20", inMonth && "text-foreground", isToday && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground")} onClick={() => { setTaskSelectedDay(key); setTaskViewMode("day"); }}>{date.getDate()}</button>
                      {dayTasks.length ? <span className="rounded-full border border-border/55 bg-background px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{dayTasks.length}</span> : null}
                    </div>
                    <div className="mt-2 grid gap-1">
                      {dayTasks.slice(0, 3).map((task) => {
                        return (
                          <button
                            type="button"
                            className={cn("rounded-xl border px-2 py-1.5 text-left text-xs font-medium leading-tight shadow-none transition hover:border-primary/30 hover:bg-background", taskChipClass(task, key))}
                            key={task.id}
                            onClick={() => setSelectedTask(task)}
                          >
                            <span className="line-clamp-2">{task.title}</span>
                            <span className="mt-1 block truncate text-[10px] font-medium opacity-70">{taskSourceDocument(task) ?? task.assignee ?? "Unassigned"}</span>
                          </button>
                        );
                      })}
                      {dayTasks.length > 3 ? <button type="button" className="rounded-md px-1 text-left text-[11px] font-semibold text-primary transition hover:bg-accent/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20" onClick={() => { setTaskSelectedDay(key); setTaskViewMode("day"); }}>+{dayTasks.length - 3} more</button> : null}
                    </div>
                  </section>
                );
              })}
            </div>
            {unscheduledTasks.length ? (
              <div className="border-t border-border p-3">
                <p className="text-sm font-semibold">No due date</p>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  {unscheduledTasks.slice(0, 6).map((task) => renderCompactTaskRow(task))}
                </div>
              </div>
            ) : null}
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  function renderResidential() {
    void renderAccounts;
    void renderWorkLogs;
    return (
      <div className="space-y-4">
        {commercialPanelOpen 
          ? renderCommercialHoursPanel() 
          : paymentsRegistryOpen 
            ? renderPaymentsRegistryPanel() 
            : renderWeeklyPayments()}
      </div>
    );
  }

  function renderAccounts() {
    const selectedTotal = periodMode === "week" ? accountTotals.weekly : periodMode === "biweekly" ? accountTotals.biweekly : accountTotals.monthly;
    return (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard icon={BadgeCheck} label="Total scheduled accounts" value={activeAccounts.length} />
          <MetricCard icon={Clock} label="Total weekly hours" value={formatHours(accountTotals.weekly)} />
          <MetricCard icon={Clock} label="Total biweekly hours" value={formatHours(accountTotals.biweekly)} />
          <MetricCard icon={CalendarDays} label="Total monthly hours" value={formatHours(accountTotals.monthly)} note="Approximation: 4.33 weeks/month" />
        </div>
        <Card className={SOP_PANEL_CLASS}>
          <CardHeader className="flex-row items-center justify-between space-y-0 p-4 sm:p-5">
            <CardTitle>Residential recurring cleaning accounts</CardTitle>
            <Badge variant="outline">{formatHours(selectedTotal)} hours in selected period</Badge>
          </CardHeader>
          <CardContent>
            <div className={cn(SOP_TABLE_WRAP_CLASS, "overflow-x-auto")}>
            <table className="sop-table w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/25 text-left text-xs font-semibold text-muted-foreground">
                  <th className="px-4 py-3">Account name</th>
                  <th>Scheduled hours</th>
                  <th>Frequency</th>
                  <th>Total hours / week</th>
                  <th>Total hours / 2 weeks</th>
                  <th>Total hours / month</th>
                  <th>Assigned team</th>
                  <th className="text-center">Status</th>
                  <th className="text-right pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.length === 0 ? <tr><td className="px-4 py-8 text-center font-bold text-muted-foreground" colSpan={9}>No residential accounts yet.</td></tr> : null}
                {accounts.map((account) => {
                  const frequency = normalizeResidentialFrequency(account.frequency);
                  const totals = calculateResidentialHours(toNumber(account.scheduled_hours), frequency);
                  return (
                    <tr className="border-b border-border/70" key={account.id}>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{account.account_name}</p>
                        <p className="mt-1 text-xs font-medium text-muted-foreground">This account contributes {formatHours(totals.monthly)} hours/month.</p>
                      </td>
                      <td>{formatHours(toNumber(account.scheduled_hours))}</td>
                      <td>
                        <p className="font-bold">{RESIDENTIAL_FREQUENCY_LABELS[frequency]}</p>
                        <p className="text-xs font-semibold text-muted-foreground">{account.frequency_detail ?? "No detail"}</p>
                      </td>
                      <td>{formatHours(totals.weekly)}</td>
                      <td>{formatHours(totals.biweekly)}</td>
                      <td>{formatHours(totals.monthly)}</td>
                      <td>{account.assigned_team_name ?? "Unassigned"}</td>
                      <td className="align-middle text-center"><div className="flex justify-center"><Badge className={statusBadgeClass(account.active === false ? "inactive" : "active")} variant="outline">{statusLabel(account.active === false ? "inactive" : "active")}</Badge></div></td>
                      <td className="pr-4">
                        <div className="flex justify-end gap-2">
                          <Button size="icon" variant="outline" aria-label="Edit account" title="Edit account" onClick={() => openAccountDraft(account)}><Edit3 className="size-[18px]" /></Button>
                          <Button size="icon" variant="outline" aria-label="Toggle account active" title={account.active === false ? "Activate account" : "Pause account"} onClick={() => toggleAccount(account)}>{account.active === false ? <CheckCircle2 className="size-[18px]" /> : <PauseCircle className="size-[18px]" />}</Button>
                          <Button size="icon" variant="outline" aria-label="Delete account" title="Delete account" onClick={() => deleteAccount(account)}><Trash2 className="size-[18px]" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  function renderWorkLogs() {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard icon={Clock} label="Period hours worked" value={formatHours(logsInPeriod.reduce((sum, log) => sum + toNumber(log.hours_worked), 0))} note={dateRangeLabel(periodRange.start, periodRange.end)} />
          <MetricCard icon={Users} label="Teams with hours" value={teamHours.length} />
          <MetricCard icon={BadgeCheck} label="Accounts worked" value={new Set(logsInPeriod.map((log) => log.account_name)).size} />
          <MetricCard icon={WalletCards} label="Pending payment hours" value={formatHours(logsInPeriod.filter((log) => log.status !== "paid").reduce((sum, log) => sum + toNumber(log.hours_worked), 0))} />
        </div>

        <Card className={SOP_PANEL_CLASS}>
          <CardHeader className="p-4 sm:p-5">
            <CardTitle>Add work hours</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-5" onSubmit={saveWorkLog}>
              <label className={PAYMENT_LABEL_CLASS}>Account<select className={PAYMENT_FIELD_CLASS} value={workLogDraft.accountId} onChange={(event) => setWorkLogDraft((current) => ({ ...current, accountId: event.target.value }))}>
                <option value="">Select account</option>
                {activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.account_name}</option>)}
              </select></label>
              <label className={PAYMENT_LABEL_CLASS}>Team<select className={PAYMENT_FIELD_CLASS} value={workLogDraft.teamId} onChange={(event) => setWorkLogDraft((current) => ({ ...current, teamId: event.target.value }))}>
                <option value="">Select team</option>
                {activeResidentialTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select></label>
              <label className={PAYMENT_LABEL_CLASS}>Date<input className={PAYMENT_FIELD_CLASS} type="date" lang="en-US" value={workLogDraft.workDate} onChange={(event) => setWorkLogDraft((current) => ({ ...current, workDate: event.target.value }))} /></label>
              <label className={PAYMENT_LABEL_CLASS}>Hours worked<input className={PAYMENT_FIELD_CLASS} inputMode="decimal" value={workLogDraft.hoursWorked} onChange={(event) => setWorkLogDraft((current) => ({ ...current, hoursWorked: event.target.value }))} /></label>
              <div className="flex items-end"><Button className="h-10 w-full rounded-xl" type="submit" disabled={savingWorkLog}><Save className="size-[18px]" /> {savingWorkLog ? "Saving..." : "Save"}</Button></div>
              <label className={cn(PAYMENT_LABEL_CLASS, "md:col-span-4")}>Notes<input className={PAYMENT_FIELD_CLASS} value={workLogDraft.notes} onChange={(event) => setWorkLogDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
              <label className={PAYMENT_LABEL_CLASS}>Status<select className={PAYMENT_FIELD_CLASS} value={workLogDraft.status} onChange={(event) => setWorkLogDraft((current) => ({ ...current, status: event.target.value as WorkLogStatus }))}>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
              </select></label>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
          <Card className={SOP_PANEL_CLASS}>
            <CardHeader className="p-4 sm:p-5">
              <CardTitle>Total by team</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {teamHours.length === 0 ? <div className={SOP_EMPTY_CLASS}>No team hours in this period.</div> : null}
              {teamHours.map((team) => (
                <div className="rounded-xl border border-border/70 bg-background/65 p-3" key={team.key}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{team.teamName}</p>
                      <p className="text-xs font-medium text-muted-foreground">{team.accounts.size} accounts worked</p>
                    </div>
                    <p className="text-lg font-semibold text-primary">{formatHours(team.totalHours)}h</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className={SOP_PANEL_CLASS}>
            <CardHeader className="p-4 sm:p-5">
              <CardTitle>Work log entries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn(SOP_TABLE_WRAP_CLASS, "overflow-x-auto")}>
              <table className="sop-table w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/25 text-left text-xs font-semibold text-muted-foreground">
                    <th className="px-4 py-3">Date</th>
                    <th>Account</th>
                    <th>Team</th>
                    <th>Hours</th>
                    <th className="text-center">Status</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {logsInPeriod.length === 0 ? <tr><td className="px-4 py-8 text-center font-semibold text-muted-foreground" colSpan={6}>No work logs in this period.</td></tr> : null}
                  {logsInPeriod.map((log) => (
                    <tr className="border-b border-border/70" key={log.id}>
                      <td className="px-4 py-3">{displayDate(log.work_date)}</td>
                      <td className="font-semibold">{log.account_name}</td>
                      <td>{log.team_name}</td>
                      <td>{formatHours(toNumber(log.hours_worked))}</td>
                      <td className="align-middle text-center"><div className="flex justify-center"><Badge className={statusBadgeClass(log.status ?? "pending")} variant="outline">{statusLabel(log.status ?? "pending")}</Badge></div></td>
                      <td className="max-w-64 truncate text-muted-foreground">{log.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  function renderWeeklyPayments() {
    const weekStartDate = parseDateKey(paymentWeekStart) ?? startOfWeek(new Date());
    const periodStepDays = periodMode === "month" ? 31 : periodMode === "biweekly" ? 15 : 7;
    const residentialOnlyTotal = weeklyPaymentSummaries.filter((summary) => !isMixedPaySummary(summary)).reduce((sum, summary) => sum + summary.paymentTotal, 0);
    const juanResidentialTotal = weeklyPaymentSummaries.filter((summary) => isMixedPaySummary(summary)).reduce((sum, summary) => sum + summary.residentialTotal, 0);
    const juanCommercialTotal = weeklyPaymentSummaries.filter((summary) => isMixedPaySummary(summary)).reduce((sum, summary) => sum + summary.commercialTotal, 0);
    const weekTotal = residentialOnlyTotal + juanResidentialTotal + juanCommercialTotal;
    const paidTotal = weeklyPaymentSummaries.flatMap((summary) => summary.rows).filter((row) => row.status === "paid").reduce((sum, row) => sum + paymentLineTotal(row), 0);
    const pendingTotal = weekTotal - paidTotal;
    const totalJobs = weeklyPaymentSummaries.filter((summary) => !isCarlosLopez(summary.teamName)).reduce((sum, summary) => sum + summary.rows.length, 0);
    const displayedSummaries = (showAllPaymentCleaners ? weeklyPaymentSummaries : weeklyPaymentSummaries.filter((summary) => summary.rows.length > 0)).filter((summary) => {
      const mixed = isMixedPaySummary(summary);
      if (isCarlosLopez(summary.teamName)) return false;
      if (paymentCleanerFilter !== "all" && summary.key !== paymentCleanerFilter) return false;
      if (paymentKindFilter === "residential" && mixed) return false;
      if (paymentKindFilter === "mixed" && !mixed) return false;
      if (paymentStatusFilter !== "all" && paymentSummaryStatus(summary) !== paymentStatusFilter && !summary.rows.some((row) => row.status === paymentStatusFilter)) return false;
      if (paymentCityFilter !== "all" && !summary.rows.some((row) => displayPaymentCity(row) === paymentCityFilter)) return false;
      if (!paymentFilter.trim()) return true;
      const needle = paymentFilter.trim().toLowerCase();
      return [summary.teamName, ...summary.rows.flatMap((row) => [row.city, row.custom_city, row.notes])].filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
    const activePaymentSummary = activePaymentSummaryKey ? weeklyPaymentSummaries.find((summary) => summary.key === activePaymentSummaryKey) : null;
    const cityFilterOptions = Array.from(new Set(paymentRowsInWeek.map(displayPaymentCity).filter(Boolean))).sort((a, b) => a.localeCompare(b));

    const weeklyMetrics = [
      { label: "Total payments", value: formatMoney(weekTotal), Icon: WalletCards, tone: "neutral" },
      { label: "Pending", value: formatMoney(pendingTotal), Icon: Clock, tone: pendingTotal ? "warn" : "good" },
      { label: "Paid", value: formatMoney(paidTotal), Icon: BadgeCheck, tone: "good" },
      { label: "Total jobs", value: totalJobs, Icon: FileText, tone: "neutral" },
    ];

    return (
      <div className="space-y-5">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-card/80 p-3 shadow-sm">
            <Button size="icon" variant="outline" aria-label="Previous period" onClick={() => setPaymentWeekStart(formatDateKey(addDays(weekStartDate, -periodStepDays)))}><ChevronLeft /></Button>
            <div className="min-w-[220px] flex-1 text-center text-sm font-semibold text-foreground">{dateRangeLabel(weekRange.start, weekRange.end)}</div>
            <Button size="icon" variant="outline" aria-label="Next period" onClick={() => setPaymentWeekStart(formatDateKey(addDays(weekStartDate, periodStepDays)))}><ChevronRight /></Button>
            <Button variant="outline" size="sm" onClick={() => setPaymentWeekStart(formatDateKey(startOfWeek(new Date())))}>Current week</Button>
            <PeriodSegment value={periodMode} onChange={setPeriodMode} />
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {weeklyMetrics.map(({ label, value, Icon, tone }) => (
            <MetricCard key={label} icon={Icon} label={label} value={value} tone={tone as "neutral" | "good" | "warn"} />
          ))}
        </div>

        {carlosPaymentSummary ? renderCarlosPaymentPanel(carlosPaymentSummary) : null}

        <div className={cn(PAYMENT_PANEL_CLASS, "p-2.5")}>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-2">
            <input aria-label="Search cleaner or city" className={PAYMENT_FIELD_CLASS} placeholder="Search cleaner or city" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)} />
            <select className={PAYMENT_FIELD_CLASS} value={paymentCleanerFilter} onChange={(event) => setPaymentCleanerFilter(event.target.value)} aria-label="Cleaner filter">
              <option value="all">All cleaner names</option>
              {weeklyPaymentSummaries.filter((summary) => !isCarlosLopez(summary.teamName)).map((summary) => <option key={summary.key} value={summary.key}>{summary.teamName}</option>)}
            </select>
            <select className={PAYMENT_FIELD_CLASS} value={paymentKindFilter} onChange={(event) => setPaymentKindFilter(event.target.value as PaymentKindFilter)} aria-label="Payment kind filter">
              <option value="all">All cleaners</option>
              <option value="residential">Residential cleaners</option>
              <option value="mixed">Mixed cleaners</option>
            </select>
            <select className={PAYMENT_FIELD_CLASS} value={paymentStatusFilter} onChange={(event) => setPaymentStatusFilter(event.target.value)} aria-label="Payment status filter">
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
            </select>
            <select className={PAYMENT_FIELD_CLASS} value={paymentCityFilter} onChange={(event) => setPaymentCityFilter(event.target.value)} aria-label="City filter">
              <option value="all">All cities</option>
              {ORANGE_COUNTY_CITIES.map((city) => <option key={city} value={city}>{city}</option>)}
              {cityFilterOptions.filter((city) => !ORANGE_COUNTY_CITIES.includes(city as (typeof ORANGE_COUNTY_CITIES)[number])).map((city) => <option key={city} value={city}>{city}</option>)}
            </select>
            <label className="flex h-11 min-w-0 items-center gap-2 rounded-xl border border-input bg-background px-3.5 text-sm font-semibold">
              <input type="checkbox" checked={showAllPaymentCleaners} onChange={(event) => setShowAllPaymentCleaners(event.target.checked)} />
              Show all cleaners
            </label>
            <Button variant="outline" onClick={() => { setPaymentFilter(""); setPaymentCleanerFilter("all"); setPaymentKindFilter("all"); setPaymentStatusFilter("all"); setPaymentCityFilter("all"); setShowAllPaymentCleaners(true); }}><RotateCcw /> Clear</Button>
          </div>
        </div>

        <div className="grid gap-4">
          {displayedSummaries.length === 0 ? <Card><CardContent className="p-8 text-center text-sm font-bold text-muted-foreground">No residential payments recorded for this period.</CardContent></Card> : null}
          <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            {displayedSummaries.map((summary) => renderCleanerPaymentCard(summary))}
          </div>
        </div>
        {renderPaymentModal(activePaymentSummary)}
      </div>
    );
  }

  function renderPaymentsRegistryPanel() {
    const weekStartDate = parseDateKey(paymentWeekStart) ?? startOfWeek(new Date());
    const periodStepDays = periodMode === "month" ? 31 : periodMode === "biweekly" ? 15 : 7;
    const activePaymentSummary = activePaymentSummaryKey ? weeklyPaymentSummaries.find((summary) => summary.key === activePaymentSummaryKey) : null;
    
    const filteredRows = paymentRowsInWeek.filter((row) => {
      const summary = weeklyPaymentSummaries.find((s) => s.teamId === row.cleaner_id || s.teamName === row.cleaner_name);
      const mixed = summary ? isMixedPaySummary(summary) : false;
      const carlos = isCarlosLopez(row.cleaner_name);
      
      if (paymentCleanerFilter !== "all" && row.cleaner_name.toLowerCase() !== paymentCleanerFilter.toLowerCase() && row.cleaner_id !== paymentCleanerFilter) return false;
      if (paymentKindFilter === "residential" && (mixed || carlos)) return false;
      if (paymentKindFilter === "mixed" && !mixed) return false;
      if (paymentStatusFilter !== "all" && row.status !== paymentStatusFilter) return false;
      if (paymentCityFilter !== "all" && displayPaymentCity(row) !== paymentCityFilter) return false;
      
      if (!paymentFilter.trim()) return true;
      const needle = paymentFilter.trim().toLowerCase();
      return [row.cleaner_name, displayPaymentCity(row), row.notes].filter(Boolean).join(" ").toLowerCase().includes(needle);
    });

    const regTotal = filteredRows.reduce((sum, r) => sum + paymentLineTotal(r), 0);
    const regPaid = filteredRows.filter((r) => r.status === "paid").reduce((sum, r) => sum + paymentLineTotal(r), 0);
    const regPending = filteredRows.filter((r) => r.status === "pending").reduce((sum, r) => sum + paymentLineTotal(r), 0);
    const regVerified = filteredRows.filter((r) => r.status === "verified").reduce((sum, r) => sum + paymentLineTotal(r), 0);

    const registryMetrics = [
      { label: "Total payments", value: formatMoney(regTotal), Icon: WalletCards, tone: "neutral" },
      { label: "Pending", value: formatMoney(regPending), Icon: Clock, tone: regPending ? "warn" : "good" },
      { label: "Verified", value: formatMoney(regVerified), Icon: BadgeCheck, tone: "good" },
      { label: "Paid", value: formatMoney(regPaid), Icon: CheckCircle2, tone: "good" },
    ];

    const cityFilterOptions = Array.from(new Set(paymentRowsInWeek.map(displayPaymentCity).filter(Boolean))).sort((a, b) => a.localeCompare(b));

    return (
      <div className="space-y-5">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-card/80 p-3 shadow-sm">
            <Button size="icon" variant="outline" aria-label="Previous period" onClick={() => setPaymentWeekStart(formatDateKey(addDays(weekStartDate, -periodStepDays)))}><ChevronLeft /></Button>
            <div className="min-w-[220px] flex-1 text-center text-sm font-semibold text-foreground">{dateRangeLabel(weekRange.start, weekRange.end)}</div>
            <Button size="icon" variant="outline" aria-label="Next period" onClick={() => setPaymentWeekStart(formatDateKey(addDays(weekStartDate, periodStepDays)))}><ChevronRight /></Button>
            <Button variant="outline" size="sm" onClick={() => setPaymentWeekStart(formatDateKey(startOfWeek(new Date())))}>Current week</Button>
            <PeriodSegment value={periodMode} onChange={setPeriodMode} />
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {registryMetrics.map(({ label, value, Icon, tone }) => (
            <MetricCard key={label} icon={Icon} label={label} value={value} tone={tone as "neutral" | "good" | "warn"} />
          ))}
        </div>

        <div className={cn(PAYMENT_PANEL_CLASS, "p-2.5")}>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-2">
            <input aria-label="Search cleaner or city" className={PAYMENT_FIELD_CLASS} placeholder="Search cleaner, city, or notes..." value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)} />
            <select className={PAYMENT_FIELD_CLASS} value={paymentCleanerFilter} onChange={(event) => setPaymentCleanerFilter(event.target.value)} aria-label="Cleaner filter">
              <option value="all">All cleaner names</option>
              {weeklyPaymentSummaries.map((summary) => <option key={summary.key} value={summary.key}>{summary.teamName}</option>)}
            </select>
            <select className={PAYMENT_FIELD_CLASS} value={paymentKindFilter} onChange={(event) => setPaymentKindFilter(event.target.value as PaymentKindFilter)} aria-label="Payment kind filter">
              <option value="all">All types</option>
              <option value="residential">Residential cleaners</option>
              <option value="mixed">Mixed cleaners</option>
            </select>
            <select className={PAYMENT_FIELD_CLASS} value={paymentStatusFilter} onChange={(event) => setPaymentStatusFilter(event.target.value)} aria-label="Payment status filter">
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="paid">Paid</option>
            </select>
            <select className={PAYMENT_FIELD_CLASS} value={paymentCityFilter} onChange={(event) => setPaymentCityFilter(event.target.value)} aria-label="City filter">
              <option value="all">All cities</option>
              {ORANGE_COUNTY_CITIES.map((city) => <option key={city} value={city}>{city}</option>)}
              {cityFilterOptions.filter((city) => !ORANGE_COUNTY_CITIES.includes(city as (typeof ORANGE_COUNTY_CITIES)[number])).map((city) => <option key={city} value={city}>{city}</option>)}
            </select>
            <Button variant="outline" onClick={() => { setPaymentFilter(""); setPaymentCleanerFilter("all"); setPaymentKindFilter("all"); setPaymentStatusFilter("all"); setPaymentCityFilter("all"); }}><RotateCcw /> Clear</Button>
          </div>
        </div>

        <Card className={SOP_PANEL_CLASS}>
          <CardHeader className="flex-row items-center justify-between space-y-0 p-4 sm:p-5">
            <div>
              <CardTitle>Payments Ledger</CardTitle>
              <p className="mt-1 text-sm font-medium text-muted-foreground">Showing registered transactions for the selected period.</p>
            </div>
            <Badge variant="outline" className="h-7 text-xs font-semibold">{filteredRows.length} transactions</Badge>
          </CardHeader>
          <CardContent>
            <div className={cn(SOP_TABLE_WRAP_CLASS, "overflow-x-auto")}>
              <table className="sop-table w-full min-w-[1080px] text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/25 text-left text-xs font-semibold text-muted-foreground">
                    <th className="px-4 py-3 w-[15%]">Cleaner</th>
                    <th className="w-[8%]">Date</th>
                    <th className="w-[23%]">City</th>
                    <th className="w-[10%]">Type</th>
                    <th className="text-right w-[10%]">Res. Amount</th>
                    <th className="text-right w-[10%]">Com. Amount</th>
                    <th className="text-right w-[10%]">Total</th>
                    <th className="text-center w-[9%]">Status</th>
                    <th className="w-[15%]">Notes</th>
                    <th className="text-right pr-4 w-[5%]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center font-bold text-muted-foreground" colSpan={10}>
                        No transactions match the selected filters.
                      </td>
                    </tr>
                  ) : null}
                  {filteredRows.map((row) => {
                    const summary = weeklyPaymentSummaries.find((s) => s.teamId === row.cleaner_id || s.teamName === row.cleaner_name);
                    const mixed = summary ? isMixedPaySummary(summary) : false;
                    const carlos = isCarlosLopez(row.cleaner_name);
                    const typeLabel = mixed ? "Res + Com" : carlos ? "Ops Mgr." : "Residential";
                    const typeBadgeClass = mixed 
                      ? "border-amber-400/30 bg-amber-400/10 text-amber-600 dark:text-amber-400" 
                      : carlos 
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-600 dark:text-emerald-400" 
                        : "border-slate-400/30 bg-slate-400/10 text-slate-600 dark:text-slate-400";

                    return (
                      <tr className="border-b border-border/70 align-middle hover:bg-muted/10 transition-colors" key={row.id}>
                        <td className="px-4 py-3 font-semibold text-foreground">{row.cleaner_name}</td>
                        <td className="font-semibold text-foreground">{displayShortDate(row.work_date)}</td>
                        <td>{displayPaymentCity(row)}</td>
                        <td>
                          <Badge className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", typeBadgeClass)} variant="outline">
                            {typeLabel}
                          </Badge>
                        </td>
                        <td className="text-right font-semibold tabular-nums text-foreground">{formatMoney(toNumber(row.residential_amount))}</td>
                        <td className="text-right font-semibold tabular-nums text-foreground">
                          {toNumber(row.commercial_amount) > 0 ? formatMoney(toNumber(row.commercial_amount)) : <span className="text-muted-foreground/30">—</span>}
                        </td>
                        <td className="text-right font-semibold tabular-nums text-foreground">{formatMoney(paymentLineTotal(row))}</td>
                        <td className="align-middle text-center">
                          <div className="flex justify-center">
                            <Badge className={statusBadgeClass(row.status || "pending")} variant="outline">
                              {statusLabel(row.status || "pending")}
                            </Badge>
                          </div>
                        </td>
                        <td className="max-w-[200px] truncate text-xs text-muted-foreground font-medium" title={row.notes || ""}>
                          {row.notes || <span className="text-muted-foreground/30">—</span>}
                        </td>
                        <td className="pr-4">
                          <div className="flex items-center justify-end">
                            <button
                              type="button"
                              className={cn(
                                "grid size-7 place-items-center rounded-lg text-muted-foreground/50 transition hover:bg-accent hover:text-foreground",
                                activeDropdownRowId === row.id && "bg-accent text-foreground"
                              )}
                              title="Actions"
                              aria-label="Row actions"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (activeDropdownRowId === row.id) {
                                  setActiveDropdownRowId(null);
                                  setDropdownPos(null);
                                } else {
                                  const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                  setDropdownPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right, row, summary: summary || weeklyPaymentSummaries.find((s) => isCarlosLopez(s.teamName) === carlos) || null, mixed: false, isCleaner: false });
                                  setActiveDropdownRowId(row.id);
                                }
                              }}
                            >
                              <MoreVertical className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        {renderPaymentModal(activePaymentSummary)}
      </div>
    );
  }

  function renderCarlosPaymentPanel(summary: (typeof weeklyPaymentSummaries)[number]) {
    const row = summary.rows[0] ?? null;
    const persistedWeeklyPayment = row ? toNumber(row.residential_amount) || toNumber(row.payment_amount) : 0;
    const persistedOvertimeHours = row ? roundHours(toNumber(row.commercial_amount) / CARLOS_OVERTIME_RATE) : 0;
    const weeklyPaymentValue = carlosWeeklyPayment === "" && persistedWeeklyPayment ? String(persistedWeeklyPayment) : carlosWeeklyPayment;
    const overtimeHoursValue = carlosOvertimeHours === "" && persistedOvertimeHours ? String(persistedOvertimeHours) : carlosOvertimeHours;
    const weeklyPayment = toNumber(weeklyPaymentValue);
    const overtimeHours = toNumber(overtimeHoursValue);
    const overtimeAmount = roundHours(overtimeHours * CARLOS_OVERTIME_RATE);
    const total = weeklyPayment + overtimeAmount;
    const paid = row?.status === "paid";

    return (
      <Card className="rounded-2xl border-emerald-200 bg-emerald-50/45 shadow-[0_18px_50px_-46px_hsl(215_40%_20%)] dark:border-emerald-900 dark:bg-emerald-950/15">
        <CardContent className="grid gap-4 p-5 lg:grid-cols-[1.1fr_.8fr_.8fr_auto]">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">Operations manager</p>
            <h3 className="mt-1 text-lg font-semibold tracking-normal">Carlos Lopez</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-900" variant="outline">{paid ? "Paid" : "Pending"}</Badge>
              <Badge className="rounded-full bg-background text-muted-foreground" variant="outline">Weekly admin payment</Badge>
            </div>
          </div>
          <label className={cn(PAYMENT_LABEL_CLASS, "text-emerald-900")}>
            Weekly admin payment
            <input className={cn(PAYMENT_FIELD_CLASS, "border-emerald-200 bg-background")} inputMode="decimal" min="0" type="number" value={weeklyPaymentValue} onChange={(event) => setCarlosWeeklyPayment(event.target.value)} placeholder="$0.00" />
          </label>
          <label className={cn(PAYMENT_LABEL_CLASS, "text-emerald-900")}>
            Overtime notes
            <input className={cn(PAYMENT_FIELD_CLASS, "border-emerald-200 bg-background")} inputMode="decimal" min="0" step="any" type="number" value={overtimeHoursValue} onChange={(event) => setCarlosOvertimeHours(event.target.value)} placeholder="0" />
            {overtimeHours ? <span className="text-xs font-medium text-muted-foreground">{formatMoney(overtimeAmount)} overtime add-on</span> : null}
          </label>
          <div className="flex flex-wrap items-end justify-between gap-2 lg:justify-end">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Carlos total</p>
              <p className="mt-1 text-2xl font-semibold">{formatMoney(total)}</p>
            </div>
            <div className="flex gap-2">
              {row ? <Button className="rounded-xl" size="sm" variant="outline" disabled={savingPaymentKey === row.id} onClick={() => updatePaymentRowStatus(row, paid ? "pending" : "paid")}>{paid ? "Pending" : "Paid"}</Button> : null}
              <Button className="rounded-xl" size="sm" disabled={savingPaymentKey === "carlos-weekly-payment"} onClick={() => saveCarlosWeeklyPayment(summary)}><Save className="size-[18px]" /> Save</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderCleanerPaymentCard(summary: (typeof weeklyPaymentSummaries)[number]) {
    const mixed = isMixedPaySummary(summary);
    const carlos = isCarlosLopez(summary.teamName);
    const validJobRows = mixed ? summary.rows.filter((row) => toNumber(row.residential_amount) > 0 || toNumber(row.commercial_amount) > 0) : summary.rows.filter((row) => toNumber(row.payment_amount) > 0);
    const hasRows = validJobRows.length > 0;
    const paidAmount = summary.rows.filter((row) => row.status === "paid").reduce((sum, row) => sum + paymentLineTotal(row), 0);
    const pendingAmount = summary.paymentTotal - paidAmount;
    const overtimeAmount = roundHours(toNumber(carlosOvertimeHours) * CARLOS_OVERTIME_RATE);
    const overallStatus = paymentSummaryStatus(summary);
    const initials = summary.teamName.split(" ").map((w: string) => w[0] ?? "").slice(0, 2).join("").toUpperCase();
    const paidPct = summary.paymentTotal > 0 ? Math.round((paidAmount / summary.paymentTotal) * 100) : 0;

    const headerGradient = mixed ? "from-amber-950 via-amber-900 to-amber-800" : carlos ? "from-emerald-950 via-emerald-900 to-emerald-800" : "from-slate-950 via-slate-900 to-slate-800";
    const avatarBg = mixed ? "bg-amber-700/70" : carlos ? "bg-emerald-700/70" : "bg-slate-700/70";
    const typePillStyle = mixed ? "bg-amber-400/15 text-amber-200 border-amber-400/30" : carlos ? "bg-emerald-400/15 text-emerald-200 border-emerald-400/30" : "bg-slate-400/15 text-slate-300 border-slate-400/30";
    const statusPillStyle = overallStatus === "paid" ? "bg-emerald-400/20 text-emerald-300 border-emerald-400/40" : (overallStatus as string) === "verified" ? "bg-sky-400/20 text-sky-300 border-sky-400/40" : "bg-orange-400/20 text-orange-300 border-orange-400/40";

    function rowStatusAccent(st: string | null | undefined) {
      if (st === "paid") return "border-l-[3px] border-l-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10";
      if (st === "verified") return "border-l-[3px] border-l-sky-400 bg-sky-50/30 dark:bg-sky-950/10";
      return "border-l-[3px] border-l-orange-400/60";
    }

    return (
      <div className={cn("overflow-hidden rounded-2xl ring-1 shadow-[0_4px_24px_-4px_hsl(215_40%_12%/0.14)]", mixed ? "ring-amber-200/60 dark:ring-amber-800/40" : carlos ? "ring-emerald-200/60 dark:ring-emerald-800/40" : "ring-border/70")} key={summary.key}>
        {/* HEADER */}
        <div className={cn("bg-gradient-to-br px-4 py-3.5", headerGradient)}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white", avatarBg)}>{initials}</div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold leading-tight text-white">{summary.teamName}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", typePillStyle)}>{mixed ? "Res + Com" : carlos ? "Ops Mgr." : "Residential"}</span>
                  <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", statusPillStyle)}>{statusLabel(overallStatus)}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (mixed) {
                  openPaymentModal(summary, "juan");
                } else {
                  openPaymentModal(summary, "residential");
                }
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[12px] font-semibold text-white/90 transition hover:bg-white/20 active:scale-95"
            >
              <Plus className="size-3.5" /> Row
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="bg-card">
          {/* Table */}
          <div className="overflow-x-auto">
            <table className={cn("sop-table w-full table-fixed border-separate border-spacing-0 text-[13px]", mixed ? "min-w-[360px]" : "min-w-[280px]")}>
              <thead>
                <tr className="text-left">
                  <th className="w-[18%] border-b border-border/60 bg-muted/30 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className={cn("border-b border-border/60 bg-muted/30 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground", mixed ? "w-[38%]" : "w-[50%]")}>City</th>
                  {mixed ? (
                    <>
                      <th className="w-[15%] border-b border-border/60 bg-muted/30 px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Res.</th>
                      <th className="w-[15%] border-b border-border/60 bg-muted/30 px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Com.</th>
                    </>
                  ) : (
                    <th className="w-[18%] border-b border-border/60 bg-muted/30 px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Payment</th>
                  )}
                  <th className="w-[14%] border-b border-border/60 bg-muted/30 px-2 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {validJobRows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-[13px] font-medium text-muted-foreground/60" colSpan={mixed ? 5 : 4}>
                      No payments recorded for this period.
                    </td>
                  </tr>
                ) : null}
                {validJobRows.map((row) => (
                  <tr className={cn("group align-middle transition-colors hover:brightness-[0.97] dark:hover:brightness-110", rowStatusAccent(row.status))} key={row.id}>
                    <td className="border-b border-border/50 px-3 py-2.5 font-semibold text-foreground">{displayShortDate(row.work_date)}</td>
                    <td className="border-b border-border/50 px-3 py-2.5">
                      <span className="block truncate font-medium text-foreground/90" title={displayPaymentCity(row)}>{displayPaymentCity(row)}</span>
                    </td>
                    <td className="border-b border-border/50 px-3 py-2.5 text-right font-semibold tabular-nums text-foreground">{formatMoney(mixed ? toNumber(row.residential_amount) : toNumber(row.payment_amount))}</td>
                    {mixed ? (
                      <td className="border-b border-border/50 px-3 py-2.5 text-right font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                        {toNumber(row.commercial_amount) ? formatMoney(toNumber(row.commercial_amount)) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                    ) : null}
                    <td className="border-b border-border/50 px-1.5 py-2 text-right">
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          className={cn(
                            "grid size-7 place-items-center rounded-lg text-muted-foreground/50 transition hover:bg-accent hover:text-foreground",
                            activeDropdownRowId === row.id && "bg-accent text-foreground"
                          )}
                          title="Actions"
                          aria-label="Row actions"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activeDropdownRowId === row.id) {
                              setActiveDropdownRowId(null);
                              setDropdownPos(null);
                            } else {
                              const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                              setDropdownPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right, row, summary, mixed: !!mixed, isCleaner: true });
                              setActiveDropdownRowId(row.id);
                            }
                          }}
                        >
                          <MoreVertical className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* TOTAL FOOTER */}
          <div className={cn("flex items-center justify-between gap-3 border-t border-border/60 px-4 py-3", mixed ? "bg-amber-50/40 dark:bg-amber-950/10" : carlos ? "bg-emerald-50/40 dark:bg-emerald-950/10" : "bg-muted/15")}>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total</span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{validJobRows.length}</span>
            </div>
            <span className={cn("text-xl font-bold tabular-nums tracking-tight", hasRows ? (mixed ? "text-amber-700 dark:text-amber-400" : carlos ? "text-emerald-700 dark:text-emerald-400" : "text-foreground") : "text-muted-foreground/40")}>
              {formatMoney(summary.paymentTotal)}
            </span>
          </div>

          {/* PAID/PENDING PROGRESS BAR */}
          {hasRows && (
            <div className="border-t border-border/40 px-4 pb-3 pt-2.5">
              <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${paidPct}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  <span className="inline-block size-1.5 rounded-full bg-emerald-500" />Paid {formatMoney(paidAmount)}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-600 dark:text-orange-400">
                  <span className="inline-block size-1.5 rounded-full bg-orange-400" />Pending {formatMoney(pendingAmount)}
                </span>
              </div>
            </div>
          )}

          {/* MIXED COMBINED TOTAL */}
          {mixed && hasRows ? (
            <div className="mx-4 mb-3 mt-1 flex items-center justify-between gap-3 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 dark:border-amber-800/40 dark:bg-amber-950/20">
              <span className="text-[12px] font-semibold text-amber-900 dark:text-amber-300">{summary.teamName} combined</span>
              <strong className="text-[13px] font-bold tabular-nums text-amber-900 dark:text-amber-200">{formatMoney(summary.paymentTotal)}</strong>
            </div>
          ) : null}

          {/* CARLOS OVERTIME */}
          {carlos ? (
            <div className="mx-4 mb-3 mt-1 grid gap-2 rounded-xl border border-emerald-200/60 bg-emerald-50/60 p-3 dark:border-emerald-800/40 dark:bg-emerald-950/20 md:grid-cols-[1fr_auto]">
              <label className={cn(PAYMENT_LABEL_CLASS, "text-emerald-900 dark:text-emerald-300")}>
                Overtime hours
                <input className="h-9 rounded-xl border border-emerald-200/70 bg-white px-2 text-sm font-semibold text-slate-950 dark:bg-emerald-950/30 dark:text-emerald-100" inputMode="decimal" min="0" step="any" type="number" value={carlosOvertimeHours} onChange={(event) => setCarlosOvertimeHours(event.target.value)} />
              </label>
              <Button className="self-end rounded-xl" size="sm" disabled={savingPaymentKey === "carlos-weekly-payment"} onClick={() => saveCarlosWeeklyPayment(summary)} type="button">+ {formatMoney(overtimeAmount)}</Button>
            </div>
          ) : null}

          {/* JUAN CLEAR */}
          {mixed && isJuanRomero(summary.teamName) && summary.rows.length > 0 ? (
            <div className="mx-4 mb-3">
              <Button className="h-9 w-full justify-center rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-800 dark:text-rose-400" disabled={savingPaymentKey === "juan-clear"} variant="outline" onClick={clearJuanPaymentRows} type="button">
                <Trash2 className="size-[15px]" /> Clear mixed total
              </Button>
            </div>
          ) : null}

          {/* BULK ACTION BUTTONS */}
          <div className="grid grid-cols-3 gap-2 border-t border-border/50 bg-muted/10 px-3 py-3">
            <button
              type="button"
              disabled={savingPaymentKey === summary.key || summary.rows.length === 0}
              onClick={() => updatePaymentRowsStatus(summary, "verified")}
              className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 text-[12px] font-semibold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-sky-800/60 dark:bg-sky-950/20 dark:text-sky-400"
            >
              <BadgeCheck className="size-3.5" /> Verified
            </button>
            <button
              type="button"
              disabled={savingPaymentKey === summary.key || summary.rows.length === 0}
              onClick={() => updatePaymentRowsStatus(summary, "paid")}
              className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-[12px] font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-emerald-700 dark:hover:bg-emerald-600"
            >
              <CheckCircle2 className="size-3.5" /> Paid
            </button>
            <button
              type="button"
              disabled={savingPaymentKey === summary.key || summary.rows.length === 0}
              onClick={() => updatePaymentRowsStatus(summary, "pending")}
              className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 text-[12px] font-semibold text-orange-700 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-orange-800/60 dark:bg-orange-950/20 dark:text-orange-400"
            >
              <Clock className="size-3.5" /> Pending
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderPaymentModal(summary: (typeof weeklyPaymentSummaries)[number] | null | undefined) {
    if (!paymentModalMode) return null;
    if (paymentModalMode === "commercial_hours") {
      return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm sm:p-6">
          <div className={cn(PAYMENT_MODAL_PANEL_CLASS, "max-w-4xl")}>
            <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold tracking-normal">Commercial hours</h2>
                <p className="mt-1 text-sm font-medium text-muted-foreground">Add or update eligible commercial team hours.</p>
              </div>
              <button type="button" className="grid size-10 place-items-center rounded-xl text-muted-foreground transition hover:bg-accent hover:text-foreground" aria-label="Close commercial hours modal" onClick={() => setPaymentModalMode(null)}><X className="size-[18px]" /></button>
            </div>
            <div className="p-5">{renderCommercialHoursForm()}</div>
          </div>
        </div>
      );
    }
    if (paymentModalMode === "commercial_schedule") {
      const commercialTeamChoices = activeCommercialTeams;
      return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm sm:p-6">
          <div className={cn(PAYMENT_MODAL_PANEL_CLASS, "max-w-5xl")}>
            <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold tracking-normal">Configure commercial schedule</h2>
                <p className="mt-1 text-sm font-medium text-muted-foreground">Set structured service days and paid hours for an account.</p>
              </div>
              <button type="button" className="grid size-10 place-items-center rounded-xl text-muted-foreground transition hover:bg-accent hover:text-foreground" aria-label="Close schedule modal" onClick={() => setPaymentModalMode(null)}><X className="size-[18px]" /></button>
            </div>
            <form className="grid gap-5 p-5" onSubmit={saveCommercialSchedule}>
              <div className="grid gap-3 md:grid-cols-2">
                <label className={PAYMENT_LABEL_CLASS}>Commercial account<select className={PAYMENT_FIELD_CLASS} value={commercialScheduleDraft.accountId} onChange={(event) => setCommercialScheduleDraft({ ...commercialScheduleDraft, accountId: event.target.value })}>
                  <option value="">Select account</option>
                  {commercialAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select></label>
                <label className={PAYMENT_LABEL_CLASS}>Assigned team<select className={PAYMENT_FIELD_CLASS} value={commercialScheduleDraft.assignedTeamId} onChange={(event) => {
                  const team = activeCommercialTeams.find((item) => item.id === event.target.value);
                  setCommercialScheduleDraft({ ...commercialScheduleDraft, assignedTeamId: event.target.value, assignedTeamName: team?.name ?? "" });
                }}>
                  <option value="">Manual name</option>
                  {commercialTeamChoices.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select></label>
                {!commercialScheduleDraft.assignedTeamId ? <label className={PAYMENT_LABEL_CLASS}>Team/person<input className={PAYMENT_FIELD_CLASS} value={commercialScheduleDraft.assignedTeamName} onChange={(event) => setCommercialScheduleDraft({ ...commercialScheduleDraft, assignedTeamName: event.target.value })} /></label> : null}
                <label className={PAYMENT_LABEL_CLASS}>Frequency<select className={PAYMENT_FIELD_CLASS} value={commercialScheduleDraft.frequency} onChange={(event) => setCommercialScheduleDraft({ ...commercialScheduleDraft, frequency: event.target.value as CommercialScheduleDraft["frequency"] })}>
                  <option value="weekly">Weekly</option>
                  <option value="every_15_days">Every 15 days</option>
                  <option value="every_3_weeks">Every 3 weeks</option>
                  <option value="monthly">Monthly</option>
                  <option value="custom">Custom</option>
                </select></label>
                <label className={PAYMENT_LABEL_CLASS}>Effective from<input className={PAYMENT_FIELD_CLASS} type="date" lang="en-US" value={commercialScheduleDraft.effectiveFrom} onChange={(event) => setCommercialScheduleDraft({ ...commercialScheduleDraft, effectiveFrom: event.target.value })} /></label>
                <label className={PAYMENT_LABEL_CLASS}>Effective until<input className={PAYMENT_FIELD_CLASS} type="date" lang="en-US" value={commercialScheduleDraft.effectiveUntil} onChange={(event) => setCommercialScheduleDraft({ ...commercialScheduleDraft, effectiveUntil: event.target.value })} /></label>
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {WEEKDAY_NAMES.map((day, index) => {
                  const dayKey = String(index);
                  const selected = commercialScheduleDraft.selectedDays.includes(dayKey);
                  return (
                    <label className="grid gap-2 rounded-xl border border-border/70 bg-background/70 p-3 text-sm font-semibold" key={day}>
                      <span className="flex items-center gap-2"><input type="checkbox" checked={selected} onChange={(event) => {
                        setCommercialScheduleDraft((current) => ({
                          ...current,
                          selectedDays: event.target.checked ? [...current.selectedDays, dayKey] : current.selectedDays.filter((item) => item !== dayKey),
                        }));
                      }} /> {day}</span>
                      <input className={cn(PAYMENT_FIELD_CLASS, "bg-card disabled:opacity-50")} disabled={!selected} inputMode="decimal" min="0" step="any" placeholder="Hours" type="number" value={commercialScheduleDraft.dayHours[dayKey] ?? ""} onChange={(event) => setCommercialScheduleDraft({ ...commercialScheduleDraft, dayHours: { ...commercialScheduleDraft.dayHours, [dayKey]: event.target.value } })} />
                    </label>
                  );
                })}
              </div>
              <label className={PAYMENT_LABEL_CLASS}>Notes<input className={PAYMENT_FIELD_CLASS} value={commercialScheduleDraft.notes} onChange={(event) => setCommercialScheduleDraft({ ...commercialScheduleDraft, notes: event.target.value })} /></label>
              <div className="flex justify-end gap-2 border-t border-border/70 pt-4">
                <Button className="rounded-xl" type="button" variant="outline" onClick={() => setPaymentModalMode(null)}>Cancel</Button>
                <Button className="rounded-xl" disabled={savingPaymentKey === "commercial-schedule"} type="submit"><Save className="size-[18px]" /> Save schedule</Button>
              </div>
            </form>
          </div>
        </div>
      );
    }
    if (!summary) return null;
    const draft = paymentDraftForSummary(summary);
    const mixed = isMixedPaySummary(summary);
    const carlos = isCarlosLopez(summary.teamName);
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm sm:p-6">
        <div className={cn(PAYMENT_MODAL_PANEL_CLASS, "max-w-2xl")}>
          <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold tracking-normal">{mixed ? "Add mixed payment row" : carlos ? "Add Carlos Lopez payment" : "Add residential payment"}</h2>
              <p className="mt-1 text-sm font-medium text-muted-foreground">{mixed ? "Residential and commercial amounts stay separated." : "Quick entry for a residential payment row."}</p>
            </div>
            <button type="button" className="grid size-10 place-items-center rounded-xl text-muted-foreground transition hover:bg-accent hover:text-foreground" aria-label="Close payment modal" onClick={closePaymentModal}><X className="size-[18px]" /></button>
          </div>
          <div className="grid gap-3 p-5 md:grid-cols-2">
            <label className={PAYMENT_LABEL_CLASS}>Cleaner
              <input disabled className={cn(PAYMENT_FIELD_CLASS, "bg-muted/50 font-semibold cursor-not-allowed text-muted-foreground")} value={summary.teamName} readOnly />
            </label>
            <label className={PAYMENT_LABEL_CLASS}>Date<input className={PAYMENT_FIELD_CLASS} type="date" lang="en-US" value={draft.workDate} onChange={(event) => setPaymentDraftForSummary(summary, { ...draft, workDate: event.target.value })} /></label>
            <label className={PAYMENT_LABEL_CLASS}>City<select className={PAYMENT_FIELD_CLASS} value={draft.city} onChange={(event) => setPaymentDraftForSummary(summary, { ...draft, city: event.target.value, customCity: event.target.value === OUTSIDE_OC_CITY ? draft.customCity : "" })}>
              <option value="">Select city</option>
              {carlos ? <option value="Operations">Operations</option> : null}
              {ORANGE_COUNTY_CITIES.map((city) => <option key={city} value={city}>{city}</option>)}
              <option value={OUTSIDE_OC_CITY}>{OUTSIDE_OC_CITY}</option>
            </select></label>
            {draft.city === OUTSIDE_OC_CITY ? <label className={PAYMENT_LABEL_CLASS}>Custom city<input className={PAYMENT_FIELD_CLASS} value={draft.customCity} onChange={(event) => setPaymentDraftForSummary(summary, { ...draft, customCity: event.target.value })} /></label> : null}
            {mixed ? (
              <>
                <label className={PAYMENT_LABEL_CLASS}>Residential amount<input className={PAYMENT_FIELD_CLASS} inputMode="decimal" min="0" type="number" value={draft.residentialAmount} onChange={(event) => setPaymentDraftForSummary(summary, { ...draft, residentialAmount: event.target.value })} /></label>
                <label className={PAYMENT_LABEL_CLASS}>Commercial amount<input className={PAYMENT_FIELD_CLASS} inputMode="decimal" min="0" type="number" value={draft.commercialAmount} onChange={(event) => setPaymentDraftForSummary(summary, { ...draft, commercialAmount: event.target.value })} /></label>
              </>
            ) : <label className={PAYMENT_LABEL_CLASS}>Payment<input className={PAYMENT_FIELD_CLASS} inputMode="decimal" min="0" type="number" value={draft.paymentAmount} onChange={(event) => setPaymentDraftForSummary(summary, { ...draft, paymentAmount: event.target.value })} /></label>}
            <label className={PAYMENT_LABEL_CLASS}>Status<select className={PAYMENT_FIELD_CLASS} value={draft.status} onChange={(event) => setPaymentDraftForSummary(summary, { ...draft, status: event.target.value as WeeklyPaymentStatus })}>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
            </select></label>
            <label className={cn(PAYMENT_LABEL_CLASS, "md:col-span-2")}>Notes<input className={PAYMENT_FIELD_CLASS} value={draft.notes} onChange={(event) => setPaymentDraftForSummary(summary, { ...draft, notes: event.target.value })} /></label>
          </div>
          <div className="flex justify-end gap-2 border-t border-border/70 px-5 py-4">
            <Button className="rounded-xl" variant="outline" onClick={closePaymentModal}>Cancel</Button>
            <Button className="rounded-xl" disabled={savingPaymentKey === summary.key} onClick={() => savePaymentRow(summary)}><Save className="size-[18px]" /> {draft.id ? "Update row" : "Save row"}</Button>
          </div>
        </div>
      </div>
    );
  }

  function renderCommercialHoursForm() {
    const lucia = activeCommercialTeams.find((team) => team.name.toLowerCase() === "lucia portillo");
    const commercialTeamChoices = activeCommercialTeams;
    return (
      <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" onSubmit={saveCommercialHours}>
        <label className={PAYMENT_LABEL_CLASS}>Commercial account<select className={PAYMENT_FIELD_CLASS} value={commercialHoursDraft.accountId} onChange={(event) => setCommercialHoursDraft({ ...commercialHoursDraft, accountId: event.target.value })}>
          <option value="">Select account</option>
          {commercialAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select></label>
        <label className={PAYMENT_LABEL_CLASS}>Team/person<select className={PAYMENT_FIELD_CLASS} value={commercialHoursDraft.teamId} onChange={(event) => {
          const team = activeCommercialTeams.find((item) => item.id === event.target.value);
          setCommercialHoursDraft({ ...commercialHoursDraft, teamId: event.target.value, teamName: team?.name ?? "", manualEntry: true });
        }}>
          <option value="">Manual name</option>
          {commercialTeamChoices.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select></label>
        {!commercialHoursDraft.teamId ? <label className={PAYMENT_LABEL_CLASS}>Manual name<input className={PAYMENT_FIELD_CLASS} value={commercialHoursDraft.teamName} onChange={(event) => setCommercialHoursDraft({ ...commercialHoursDraft, teamName: event.target.value })} /></label> : null}
        <label className={PAYMENT_LABEL_CLASS}>Date<input className={PAYMENT_FIELD_CLASS} type="date" lang="en-US" value={commercialHoursDraft.workDate} onChange={(event) => setCommercialHoursDraft({ ...commercialHoursDraft, workDate: event.target.value })} /></label>
        <div className="flex flex-col gap-2 justify-end">
          <label className={PAYMENT_LABEL_CLASS}>Hours<input className={PAYMENT_FIELD_CLASS} inputMode="decimal" min="0" step="any" type="number" value={commercialHoursDraft.hours} onChange={(event) => setCommercialHoursDraft({ ...commercialHoursDraft, hours: event.target.value })} /></label>
          <label className="flex h-9 items-center gap-1.5 rounded-xl border border-input bg-background px-3 text-xs font-semibold select-none cursor-pointer">
            <input type="checkbox" checked={isExtraHours} onChange={(event) => {
              setIsExtraHours(event.target.checked);
              if (!event.target.checked) setExtraHoursValue("");
            }} />
            <span>Hora extra</span>
          </label>
        </div>
        {isExtraHours && (
          <label className={PAYMENT_LABEL_CLASS}>Horas extras necesarias
            <input required className={PAYMENT_FIELD_CLASS} inputMode="decimal" min="0" step="any" type="number" value={extraHoursValue} onChange={(event) => setExtraHoursValue(event.target.value)} placeholder="0" />
          </label>
        )}
        <label className={PAYMENT_LABEL_CLASS}>Source<select className={PAYMENT_FIELD_CLASS} value={commercialHoursDraft.manualEntry ? "manual" : "scheduled"} onChange={(event) => setCommercialHoursDraft({ ...commercialHoursDraft, manualEntry: event.target.value === "manual" })}>
          <option value="manual">Manual</option>
          <option value="scheduled">Scheduled</option>
        </select></label>
        <label className={PAYMENT_LABEL_CLASS}>Status<select className={PAYMENT_FIELD_CLASS} value={commercialHoursDraft.status} onChange={(event) => setCommercialHoursDraft({ ...commercialHoursDraft, status: event.target.value as CommercialHoursStatus })}>
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
          <option value="verified">Verified</option>
          <option value="pending_payment">Pending payment</option>
          <option value="needs_review">Needs review</option>
          <option value="paid">Paid</option>
          <option value="skipped">No eligible service</option>
        </select></label>
        <label className="flex h-10 items-center gap-2 self-end rounded-xl border border-input bg-background px-3 text-sm font-semibold"><input type="checkbox" checked={commercialHoursDraft.verified} onChange={(event) => setCommercialHoursDraft({ ...commercialHoursDraft, verified: event.target.checked })} /> Verified</label>
        <label className={cn(PAYMENT_LABEL_CLASS, "md:col-span-2 xl:col-span-3")}>Notes<input className={PAYMENT_FIELD_CLASS} value={commercialHoursDraft.notes} onChange={(event) => setCommercialHoursDraft({ ...commercialHoursDraft, notes: event.target.value })} /></label>
        {lucia ? <div className="self-end rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-950">Lucia Portillo · Manual hours</div> : null}
        <div className="flex justify-end gap-2 border-t border-border/70 pt-4 md:col-span-2 xl:col-span-4">
          {commercialHoursDraft.id && (
            <Button
              className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-800 dark:text-rose-400 mr-auto"
              type="button"
              variant="outline"
              disabled={savingPaymentKey === "commercial-hours"}
              onClick={deleteCommercialHours}
            >
              <Trash2 className="size-4 mr-1" /> Delete
            </Button>
          )}
          <Button className="rounded-xl" type="button" variant="outline" onClick={() => setPaymentModalMode(null)}>Cancel</Button>
          <Button className="rounded-xl" disabled={savingPaymentKey === "commercial-hours"} type="submit"><Save className="size-[18px]" /> {commercialHoursDraft.id ? "Update hours" : "Save hours"}</Button>
        </div>
      </form>
    );
  }

  function renderCommercialHoursPanel() {
    const teamOptions = Array.from(new Set(commercialRowsInWeek.map((entry) => entry.team_name).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b));
    return (
      <div className="space-y-5">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-card/80 p-3 shadow-sm">
            <Button size="icon" variant="outline" aria-label="Previous period" onClick={() => setPaymentWeekStart(formatDateKey(addDays(parseDateKey(paymentWeekStart) ?? new Date(), periodMode === "month" ? -31 : periodMode === "biweekly" ? -15 : -7)))}><ChevronLeft /></Button>
            <div className="min-w-[220px] flex-1 text-center text-sm font-semibold text-foreground">{dateRangeLabel(commercialRange.start, commercialRange.end)}</div>
            <Button size="icon" variant="outline" aria-label="Next period" onClick={() => setPaymentWeekStart(formatDateKey(addDays(parseDateKey(paymentWeekStart) ?? new Date(), periodMode === "month" ? 31 : periodMode === "biweekly" ? 15 : 7)))}><ChevronRight /></Button>
            <Button variant="outline" size="sm" onClick={() => { setCommercialCustomStart(""); setCommercialCustomEnd(""); setCommercialDateMenuOpen(false); setPaymentWeekStart(formatDateKey(startOfWeek(new Date()))); }}>Current week</Button>
            <PeriodSegment value={periodMode} onChange={setPeriodMode} />
            <div className="relative">
              <Button variant="outline" size="sm" onClick={() => setCommercialDateMenuOpen((open) => !open)}>
                <CalendarDays /> Date range
              </Button>
              {commercialDateMenuOpen ? (
                <div className="absolute right-0 z-20 mt-2 w-[290px] rounded-xl border border-border/70 bg-card p-3 shadow-xl">
                  <div className="grid gap-3">
                    <label className={PAYMENT_LABEL_CLASS}>From<input className={PAYMENT_FIELD_CLASS} type="date" lang="en-US" value={commercialCustomStart} onChange={(event) => setCommercialCustomStart(event.target.value)} /></label>
                    <label className={PAYMENT_LABEL_CLASS}>To<input className={PAYMENT_FIELD_CLASS} type="date" lang="en-US" value={commercialCustomEnd} onChange={(event) => setCommercialCustomEnd(event.target.value)} /></label>
                    <div className="flex justify-end gap-2">
                      <Button className="rounded-xl" variant="outline" size="sm" type="button" onClick={() => { setCommercialCustomStart(""); setCommercialCustomEnd(""); }}>Clear</Button>
                      <Button className="rounded-xl" size="sm" type="button" onClick={() => setCommercialDateMenuOpen(false)}>Apply</Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <div className={cn(PAYMENT_PANEL_CLASS, "p-2.5")}>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-2">
            <input aria-label="Search commercial hours" className={PAYMENT_FIELD_CLASS} placeholder="Search account, team, note" value={commercialSearchFilter} onChange={(event) => setCommercialSearchFilter(event.target.value)} />
            <select className={PAYMENT_FIELD_CLASS} value={commercialAccountFilter} onChange={(event) => setCommercialAccountFilter(event.target.value)} aria-label="Commercial account filter">
              <option value="all">All commercial accounts</option>
              {commercialAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
            <select className={PAYMENT_FIELD_CLASS} value={commercialTeamFilter} onChange={(event) => setCommercialTeamFilter(event.target.value)} aria-label="Commercial team filter">
              <option value="all">All teams</option>
              {teamOptions.map((team) => <option key={team} value={team}>{team}</option>)}
            </select>
            <select className={PAYMENT_FIELD_CLASS} value={commercialStatusFilter} onChange={(event) => setCommercialStatusFilter(event.target.value)} aria-label="Commercial status filter">
              <option value="all">All statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="verified">Verified</option>
              <option value="pending_payment">Pending payment</option>
              <option value="paid">Paid</option>
              <option value="needs_review">Needs review</option>
              <option value="skipped">No eligible service</option>
            </select>
            <select className={PAYMENT_FIELD_CLASS} value={commercialSourceFilter} onChange={(event) => setCommercialSourceFilter(event.target.value as CommercialSourceFilter)} aria-label="Commercial source filter">
              <option value="all">Manual + scheduled</option>
              <option value="manual">Manual hours</option>
              <option value="scheduled">Scheduled</option>
            </select>
            <select className={PAYMENT_FIELD_CLASS} value={commercialVerifiedFilter} onChange={(event) => setCommercialVerifiedFilter(event.target.value as CommercialVerifiedFilter)} aria-label="Commercial verified filter">
              <option value="all">Verified + needs review</option>
              <option value="verified">Verified</option>
              <option value="needs_review">Needs review</option>
            </select>
          </div>
        </div>

        {renderCommercialHoursCard()}
        {renderPaymentModal(null)}
      </div>
    );
  }

  function renderCommercialHoursCard() {
    const emptyCommercialText = commercialRowsInWeek.length === 0 ? "No eligible cleanings before this pay date." : "No commercial hours match these filters.";
    return (
      <Card className="overflow-hidden rounded-xl border-border/70 shadow-[0_18px_55px_-48px_hsl(215_40%_20%)]">
        <CardHeader className="border-b border-border/70 bg-background/55 px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold text-muted-foreground">Review scheduled, completed, and verified hours before closing payroll.</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild size="sm" variant="outline" className="h-9 rounded-xl px-2.5 text-xs font-semibold">
                <Link href="/commercial/accounts">
                  <Building2 className="size-4 mr-1" /> Manage Accounts
                </Link>
              </Button>
              <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-900" variant="outline">{formatHours(commercialTotals.verified)} verified payable hours</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 p-4">
          <div className="overflow-hidden rounded-xl border border-border/70">
            <div className="overflow-auto">
              <table className="sop-table w-full border-separate border-spacing-0 text-sm">
                <colgroup>
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "36%" }} />
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "8%" }} />
                </colgroup>
                <thead>
                  <tr className="bg-muted/40 text-left text-[11px] font-semibold uppercase text-muted-foreground">
                    <th className="border-b border-border/70 px-4 py-3">Date</th>
                    <th className="border-b border-border/70 px-4 py-3">Commercial Account</th>
                    <th className="border-b border-border/70 px-4 py-3">Team</th>
                    <th className="border-b border-border/70 px-4 py-3 text-right">Hours</th>
                    <th className="border-b border-border/70 px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCommercialRows.length === 0 ? <tr><td className="px-4 py-10 text-center font-medium text-muted-foreground" colSpan={6}>{emptyCommercialText}</td></tr> : null}
                  {filteredCommercialRows.map((entry) => {
                    const isLucia = String(entry.team_name ?? "").toLowerCase() === "lucia portillo";
                    const sch = toNumber(entry.scheduled_hours);
                    const comp = toNumber(entry.completed_hours);
                    return (
                      <tr className="align-top" key={entry.id}>
                        <td className="border-b border-border/60 px-4 py-3 font-medium text-foreground">
                          <div>{displayDate(entry.work_date)}</div>
                          <div className="text-xs text-muted-foreground font-medium mt-0.5">{entry.scheduled_day ?? "-"}</div>
                        </td>
                        <td className="border-b border-border/60 px-4 py-3">
                          <p className="font-semibold text-foreground">{entry.account_name}</p>
                          <p className="text-xs font-medium text-muted-foreground mt-0.5">{commercialAccounts.find((account) => account.id === entry.account_id)?.city ?? "No city"}</p>
                        </td>
                        <td className="border-b border-border/60 px-4 py-3 font-medium text-foreground">
                          <div className="flex items-center gap-1.5">
                            <span>{entry.team_name ?? "Unassigned"}</span>
                            {isLucia ? <Badge className="rounded-full border-sky-200 bg-sky-50 text-[10px] font-semibold text-sky-950 px-1.5 py-0" variant="outline">Manual</Badge> : null}
                          </div>
                        </td>
                        <td className="border-b border-border/60 px-4 py-3 text-right">
                          <div className="font-semibold text-foreground">{formatHours(getCommercialEntryHours(entry))}</div>
                          {comp !== sch && (
                            <div className="text-[10px] text-muted-foreground font-medium mt-0.5" title={`Scheduled: ${formatHours(sch)} | Completed: ${formatHours(comp)}`}>
                              sch: {formatHours(sch)} | comp: {formatHours(comp)}
                            </div>
                          )}
                        </td>
                        <td className="border-b border-border/60 px-4 py-3 align-middle text-center">
                          <div className="flex justify-center">
                            <Badge className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", statusBadgeClass(entry.status))} variant="outline">
                              {statusLabel(entry.status ?? "scheduled")}
                            </Badge>
                          </div>
                        </td>
                        <td className="border-b border-border/60 px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            <Button className="w-8 h-8 rounded-lg border border-border p-0 text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center" size="icon" variant="outline" aria-label="Edit commercial hours" title="Edit commercial hours" onClick={() => editCommercialHours(entry)}><Pencil className="size-3.5" /></Button>
                            <Button className="w-8 h-8 rounded-lg border border-border p-0 text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center" size="icon" variant="outline" aria-label="Mark verified" title="Verify hours" onClick={() => updateCommercialHoursStatus(entry, "verified")}><BadgeCheck className="size-3.5" /></Button>
                            <Button className="w-8 h-8 rounded-lg border border-border p-0 text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center" size="icon" variant="outline" aria-label="Mark paid" title="Mark paid" onClick={() => updateCommercialHoursStatus(entry, "paid")}><CheckCircle2 className="size-3.5" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-emerald-50/65 font-semibold text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-100 border-t-2 border-emerald-300">
                    <td colSpan={3} className="px-4 py-3.5 font-bold tracking-wider text-sm text-emerald-900 dark:text-emerald-300">
                      {commercialTeamFilter === "all" ? "GRAND TOTAL" : "TEAM TOTAL"}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="font-bold text-foreground">{formatHours(commercialTotals.hours)}</div>
                      <div className="text-[10px] text-muted-foreground font-medium mt-0.5">
                        Completed: {commercialTotals.completedCount}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-medium">
                        Verified: {commercialTotals.verifiedCount}
                      </div>
                    </td>
                    <td colSpan={2} className="px-4 py-3.5 align-middle">
                      {commercialTotals.needsReview > 0 ? (
                        <Badge className="border-amber-200 bg-amber-50 text-amber-900 font-semibold rounded-full" variant="outline">
                          {commercialTotals.needsReview} needs review
                        </Badge>
                      ) : (
                        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-900 font-semibold rounded-full" variant="outline">
                          All verified
                        </Badge>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderPotentialCleanerColumn(title: string, people: StaffMemberRow[], teamScope: StaffTeamScope) {
    return (
      <div className="rounded-xl border border-border/70 bg-background/60 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{title}</h3>
            <p className="mt-1 text-xs font-medium text-muted-foreground">{people.length} potential cleaner{people.length === 1 ? "" : "s"}</p>
          </div>
          <Button className={SOP_ACTION_BUTTON_CLASS} variant="outline" size="sm" onClick={() => openPotentialCleanerDraft(teamScope)}><Plus className="size-[18px]" /> Add</Button>
        </div>
        <div className="mt-3 grid gap-2">
          {people.length === 0 ? <div className={SOP_EMPTY_CLASS}>No potential cleaners listed.</div> : null}
          {people.map((person) => (
            <article className="rounded-xl border border-border/60 bg-card/70 p-3" key={person.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="truncate font-semibold">{person.name}</h4>
                  <p className="mt-1 truncate text-xs font-medium text-muted-foreground">{person.email || "No email on file"}</p>
                </div>
                <Badge className={statusBadgeClass("potential")} variant="outline">Potential</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge variant="outline">{displayStaffRole(person)}</Badge>
                <Badge variant="outline">{staffScopeLabel(staffScope(person))}</Badge>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button className={SOP_ACTION_BUTTON_CLASS} variant="outline" size="sm" onClick={() => openStaffDraft(person)}><Edit3 className="size-[18px]" /> Edit</Button>
                <Button 
                  className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-800 dark:text-rose-400 h-9 px-3 text-[12px] font-semibold flex items-center gap-1"
                  variant="outline" 
                  size="sm" 
                  onClick={() => deleteStaff(person)}
                >
                  <Trash2 className="size-[15px]" /> Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  function renderStaff() {
    const staffDirectory = staff.filter((person) => {
      const name = person.name.toLowerCase();
      return !staffIsPotentialCleaner(person) && !["jake ivan-pal", "carlos lopez"].includes(name) && !["owner", "operations manager"].includes(String(person.role ?? "").toLowerCase());
    });
    const filteredStaffDirectory = staffDirectory.filter((person) => {
      const personStatus = normalizeStaffStatus(person);
      const personScope = staffScope(person);
      const search = staffSearch.trim().toLowerCase();
      if (staffScopeFilter !== "all" && personScope !== staffScopeFilter) return false;
      if (staffStatusFilter !== "all" && personStatus !== staffStatusFilter) return false;
      if (!search) return true;
      return [
        person.name,
        person.email,
        person.role,
        person.display_role,
        person.team_scope,
        staffScopeLabel(personScope),
        person.status,
      ].filter(Boolean).join(" ").toLowerCase().includes(search);
    });
    const activeResidentialCleaners = staffDirectory.filter((person) => staffIsActive(person) && staffScope(person) === "residential").length;
    const activeCommercialCleaners = staffDirectory.filter((person) => staffIsActive(person) && staffScope(person) === "commercial").length;
    const mixedRouteCleaners = staffDirectory.filter((person) => staffIsActive(person) && staffScope(person) === "mixed").length;

    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard icon={UserRoundCheck} label="Operations leads" value={operationsLeads.length} />
          <MetricCard icon={Users} label="Active residential cleaners" value={activeResidentialCleaners} />
          <MetricCard icon={BadgeCheck} label="Active commercial cleaners" value={activeCommercialCleaners} />
          <MetricCard icon={Clock} label="Mixed route cleaners" value={mixedRouteCleaners} />
          <MetricCard icon={WalletCards} label="Active teams" value={activeTeams.length} />
        </div>

        <Card className={SOP_PANEL_CLASS}>
          <CardHeader className="p-4 sm:p-5">
            <CardTitle>Jake and Carlos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {operationsLeads.map((person) => {
              const personStatus = staffIsActive(person) ? "active" : "inactive";
              return (
                <article className="rounded-xl border border-border/70 bg-background/65 p-4" key={person.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{person.name}</h3>
                      <p className="mt-1 text-sm font-medium text-muted-foreground">{person.role}</p>
                      <p className="mt-2 text-xs font-medium text-muted-foreground">{person.email || "No email on file"}</p>
                    </div>
                    <Badge className={statusBadgeClass(personStatus)} variant="outline">{statusLabel(personStatus)}</Badge>
                  </div>
                </article>
              );
            })}
          </CardContent>
        </Card>

        <Card className={SOP_PANEL_CLASS}>
          <CardHeader className="p-4 sm:p-5">
            <CardTitle>Potential cleaners</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-2">
            {renderPotentialCleanerColumn("Residential candidates", potentialResidentialCleaners, "residential")}
            {renderPotentialCleanerColumn("Commercial candidates", potentialCommercialCleaners, "commercial")}
          </CardContent>
        </Card>

        <Card className={SOP_PANEL_CLASS}>
          <CardHeader className="flex-row items-start justify-between space-y-0 p-4 sm:p-5">
            <div>
              <CardTitle>Cleaner directory</CardTitle>
              <p className="mt-1 text-sm font-medium text-muted-foreground">Role, area, status, and current payroll context for every cleaner profile.</p>
            </div>
            <Button className={SOP_ACTION_BUTTON_CLASS} onClick={() => openStaffDraft()}><Plus className="size-[18px]" /> Add cleaner</Button>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className={cn(PAYMENT_PANEL_CLASS, "grid gap-2 p-2.5 md:grid-cols-[1fr_170px_160px_auto]")}>
              <input className={PAYMENT_FIELD_CLASS} placeholder="Search team member, role, email" value={staffSearch} onChange={(event) => setStaffSearch(event.target.value)} />
              <select className={PAYMENT_FIELD_CLASS} value={staffScopeFilter} onChange={(event) => setStaffScopeFilter(event.target.value as "all" | StaffTeamScope)} aria-label="Staff area filter">
                <option value="all">All areas</option>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="mixed">Mixed route</option>
              </select>
              <select className={PAYMENT_FIELD_CLASS} value={staffStatusFilter} onChange={(event) => setStaffStatusFilter(event.target.value as "all" | "active" | "inactive")} aria-label="Staff status filter">
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <Button className={SOP_ACTION_BUTTON_CLASS} variant="outline" onClick={() => { setStaffSearch(""); setStaffScopeFilter("all"); setStaffStatusFilter("all"); }}><RotateCcw className="size-[18px]" /> Clear</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredStaffDirectory.length === 0 ? <div className={cn(SOP_EMPTY_CLASS, "md:col-span-2 xl:col-span-3")}>No team members found.</div> : null}
            {filteredStaffDirectory.map((team) => {
              const teamStatus = normalizeStaffStatus(team);
              const teamScope = staffScope(team);
              return (
                <article className="flex min-h-[188px] flex-col rounded-xl border border-border/70 bg-background/65 p-4" key={team.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{team.name}</h3>
                      <p className="mt-1 text-xs font-medium text-muted-foreground">{team.email || "No email on file"}</p>
                    </div>
                    <Badge className={statusBadgeClass(teamStatus)} variant="outline">{statusLabel(teamStatus)}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl border border-border/60 bg-card/70 px-3 py-2">
                      <p className="text-[11px] font-semibold text-muted-foreground">Role</p>
                      <p className="mt-1 truncate font-semibold" title={displayStaffRole(team)}>{displayStaffRole(team)}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-card/70 px-3 py-2">
                      <p className="text-[11px] font-semibold text-muted-foreground">Area</p>
                      <p className="mt-1 font-semibold">{staffScopeLabel(teamScope)}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-card/70 px-3 py-2">
                      <p className="text-[11px] font-semibold text-muted-foreground">Pay method</p>
                      <p className="mt-1 font-semibold">{teamScope === "commercial" ? "Commercial hours" : teamScope === "mixed" ? "Mixed payments" : "Per house/service"}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-card/70 px-3 py-2">
                      <p className="text-[11px] font-semibold text-muted-foreground">Source</p>
                      <p className="mt-1 font-semibold">{teamScope === "commercial" ? "Commercial hours" : teamScope === "mixed" ? "Residential payments + commercial hours" : "Residential payments"}</p>
                    </div>
                  </div>
                  <div className="mt-auto flex gap-2 pt-4">
                    <Button className={SOP_ACTION_BUTTON_CLASS} variant="outline" size="sm" onClick={() => openStaffDraft(team)}><Edit3 className="size-[18px]" /> Edit</Button>
                    <Button 
                      className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-800 dark:text-rose-400 h-9 px-3 text-[12px] font-semibold flex items-center gap-1"
                      variant="outline" 
                      size="sm" 
                      onClick={() => deleteStaff(team)}
                    >
                      <Trash2 className="size-[15px]" /> Delete
                    </Button>
                  </div>
                </article>
              );
            })}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  function renderReports() {
    const rows = getReportRows();
    const previewKeys = Object.keys(rows[0] ?? { report: "No rows" }).slice(0, 7);
    return (
      <div className="space-y-4">
        <Card className={SOP_PANEL_CLASS}>
          <CardContent className="flex flex-wrap items-end justify-between gap-3 p-4">
            <div className="flex flex-wrap gap-2">
              <select className={PAYMENT_FIELD_CLASS} value={reportKind} onChange={(event) => setReportKind(event.target.value as ReportKind)}>
                <option value="tasks">Task report</option>
                <option value="hours">Hours report</option>
                <option value="weekly_payments">Weekly payment report</option>
              </select>
              <PeriodSegment value={periodMode} onChange={setPeriodMode} />
            </div>
            <Button className={SOP_ACTION_BUTTON_CLASS} onClick={exportCurrentReport}><FileSpreadsheet className="size-[18px]" /> Export current report</Button>
          </CardContent>
        </Card>
        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard icon={FileText} label="Rows" value={rows.length} />
          <MetricCard icon={CalendarDays} label="Period" value={periodRange.label} note={dateRangeLabel(periodRange.start, periodRange.end)} />
          <MetricCard icon={Download} label="Format" value="XLSX" />
          <MetricCard icon={WalletCards} label="Payment week" value={dateRangeLabel(weekRange.start, weekRange.end)} />
        </div>
        <Card className={SOP_PANEL_CLASS}>
          <CardHeader className="p-4 sm:p-5">
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(SOP_TABLE_WRAP_CLASS, "overflow-x-auto")}>
              <table className="sop-table w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/25 text-left text-xs font-semibold text-muted-foreground">
                    {previewKeys.map((key) => <th className="px-4 py-3" key={key}>{key.replace(/_/g, " ")}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? <tr><td className="px-4 py-8 text-center font-semibold text-muted-foreground" colSpan={previewKeys.length}>No report data for this period.</td></tr> : null}
                  {rows.slice(0, 20).map((row, index) => (
                    <tr className="border-b border-border/60 last:border-b-0" key={index}>
                      {Object.values(row).slice(0, 7).map((value, valueIndex) => <td className="px-4 py-3 font-medium" key={valueIndex}>{String(value ?? "")}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  function renderSettings() {
    const rows = [
      { label: "Owner email", configured: Boolean(envStatus?.ownerEmail), env: "OWNER_EMAIL" },
      { label: "Operations Manager email", configured: Boolean(envStatus?.operationsManagerEmail), env: "OPERATIONS_MANAGER_EMAIL" },
      { label: "Gmail user", configured: Boolean(envStatus?.gmailUser), env: "GMAIL_USER" },
      { label: "Gmail app password", configured: Boolean(envStatus?.gmailPassword), env: "GMAIL_APP_PASSWORD" },
      { label: "Owner Gmail user", configured: Boolean(envStatus?.ownerGmailUser), env: "OWNER_GMAIL_USER" },
      { label: "Owner Gmail app password", configured: Boolean(envStatus?.ownerGmailPassword), env: "OWNER_GMAIL_APP_PASSWORD" },
      { label: "App base URL", configured: Boolean(envStatus?.appBaseUrl), env: "APP_BASE_URL" },
    ];
    return (
      <div className="grid gap-4 xl:grid-cols-[1fr_.85fr]">
        <Card className={SOP_PANEL_CLASS}>
          <CardHeader className="p-4 sm:p-5">
            <CardTitle>Notification setup</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {rows.map((row) => (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/65 px-3 py-2.5" key={row.env}>
                <div>
                  <p className="text-sm font-semibold">{row.label}</p>
                  <p className="text-xs font-medium text-muted-foreground">{row.env}</p>
                </div>
                <Badge className={statusBadgeClass(row.configured ? "active" : "needs_review")} variant="outline">{row.configured ? "Configured" : "Missing"}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card className={SOP_PANEL_CLASS}>
            <CardHeader className="p-4 sm:p-5">
              <CardTitle>Residential operations defaults</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {[
                "Task assignees: Jake Ivan-Pal and Carlos Lopez",
                "Default task frequency: One-time",
                "Completion updates can notify the owner",
                "Hours calculation: weekly, biweekly, monthly approximation",
                "Records are archived instead of removed from operating history",
                "Cleaner details are managed from Staff / Teams",
                "Mixed cleaners use separated residential and commercial payment fields",
              ].map((row) => <div className="rounded-xl border border-border/70 bg-background/65 px-3 py-2.5 text-sm font-medium text-muted-foreground" key={row}>{row}</div>)}
            </CardContent>
          </Card>
          <Card className={SOP_PANEL_CLASS}>
            <CardHeader className="p-4 sm:p-5">
              <CardTitle>System scope</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm font-medium text-muted-foreground">
              <div className="rounded-xl border border-border/70 bg-background/65 px-3 py-2.5">Navigation follows the signed-in role and access scope.</div>
              <div className="rounded-xl border border-border/70 bg-background/65 px-3 py-2.5">Legacy routes redirect into the active SOP workspace.</div>
              <div className="rounded-xl border border-border/70 bg-background/65 px-3 py-2.5">Sensitive values stay in environment variables.</div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  function renderTaskModal() {
    if (!taskDraft) return null;
    return (
      <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/45 p-3 backdrop-blur-sm sm:p-6" onClick={() => savingTask ? undefined : setTaskDraft(null)}>
        <form className={cn(PAYMENT_MODAL_PANEL_CLASS, "flex max-h-[94dvh] max-w-3xl flex-col overflow-hidden")} onSubmit={saveTask} onClick={(event) => event.stopPropagation()}>
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border/70 bg-card/95 px-5 py-4 backdrop-blur">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-normal">{taskDraft.id ? "Edit reminder" : "Add reminder"}</h2>
              <p className="mt-1 text-sm font-medium text-muted-foreground">Keep operational follow-ups clear and assigned.</p>
            </div>
            <button className={SOP_CLOSE_BUTTON_CLASS} type="button" aria-label="Close task modal" disabled={savingTask} onClick={() => setTaskDraft(null)}><X className="size-[18px]" /></button>
          </div>
          <div className="grid gap-4 overflow-y-auto p-5">
            {taskFormError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-semibold text-rose-900 dark:border-rose-900 dark:bg-rose-950/25 dark:text-rose-100">{taskFormError}</div> : null}
            <label className={PAYMENT_LABEL_CLASS}>Title<input className={PAYMENT_FIELD_CLASS} value={taskDraft.title} onChange={(event) => setTaskDraft({ ...taskDraft, title: event.target.value })} /></label>
            <label className={PAYMENT_LABEL_CLASS}>Notes<textarea className={cn(PAYMENT_FIELD_CLASS, "h-auto min-h-24 py-2 font-medium normal-case")} value={taskDraft.description} onChange={(event) => setTaskDraft({ ...taskDraft, description: event.target.value })} /></label>
            <div className="grid gap-3 md:grid-cols-3">
              <label className={PAYMENT_LABEL_CLASS}>Assigned to<select className={PAYMENT_FIELD_CLASS} value={taskDraft.assignee} onChange={(event) => setTaskDraft({ ...taskDraft, assignee: event.target.value as ResidentialAssignee })}>
                {RESIDENTIAL_ASSIGNEES.map((assignee) => <option key={assignee} value={assignee}>{assignee}</option>)}
              </select></label>
              <label className={PAYMENT_LABEL_CLASS}>Due date<input className={PAYMENT_FIELD_CLASS} type="date" lang="en-US" value={taskDraft.dueDate} onChange={(event) => setTaskDraft({ ...taskDraft, dueDate: event.target.value })} /></label>
              <label className={PAYMENT_LABEL_CLASS}>Priority<select className={PAYMENT_FIELD_CLASS} value={taskDraft.priority} onChange={(event) => setTaskDraft({ ...taskDraft, priority: event.target.value as TaskDraft["priority"] })}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select></label>
              <label className={PAYMENT_LABEL_CLASS}>Frequency<select className={PAYMENT_FIELD_CLASS} value={taskDraft.frequency} onChange={(event) => setTaskDraft({ ...taskDraft, frequency: event.target.value as TaskReminderFrequency })}>
                {Object.entries(TASK_FREQUENCY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select></label>
              {taskDraft.frequency === "custom" ? <label className={PAYMENT_LABEL_CLASS}>Custom days<input className={PAYMENT_FIELD_CLASS} inputMode="numeric" value={taskDraft.customIntervalDays} onChange={(event) => setTaskDraft({ ...taskDraft, customIntervalDays: event.target.value })} /></label> : null}
            </div>
            <div className="grid gap-2 text-sm font-semibold text-foreground sm:grid-cols-2">
              <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border/70 bg-background/65 px-3.5">
                <input type="checkbox" checked={taskDraft.notifyAssignee} onChange={(event) => setTaskDraft({ ...taskDraft, notifyAssignee: event.target.checked })} />
                Notify assignee
              </label>
              <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border/70 bg-background/65 px-3.5">
                <input type="checkbox" checked={taskDraft.notifyOwnerOnCompletion} onChange={(event) => setTaskDraft({ ...taskDraft, notifyOwnerOnCompletion: event.target.checked })} />
                Notify owner on completion
              </label>
            </div>
          </div>
          <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-border/70 bg-card/95 px-5 py-4 backdrop-blur sm:flex-row sm:justify-end">
            <Button className={SOP_ACTION_BUTTON_CLASS} type="button" variant="outline" disabled={savingTask} onClick={() => setTaskDraft(null)}>Cancel</Button>
            <Button className={SOP_ACTION_BUTTON_CLASS} type="submit" disabled={savingTask}><Save className="size-[18px]" /> {savingTask ? "Saving..." : "Save reminder"}</Button>
          </div>
        </form>
      </div>
    );
  }

  function renderTaskDetail() {
    if (!selectedTask) return null;
    const taskActivity = activity.filter((item) => item.task_id === selectedTask.id && !isEmailProviderMissingDetails(item.details));
    const selectedStatus = normalizeTaskStatus(selectedTask.status);
    const sourceDocument = taskSourceDocument(selectedTask);
    const sourceSection = typeof selectedTask.metadata?.source_section === "string" ? selectedTask.metadata.source_section : null;
    const notifyAssignee = metadataFlag(selectedTask.metadata, "notify_assignee_on_assignment", true);
    const notifyOwner = metadataFlag(selectedTask.metadata, "notify_owner_on_completed", true);
    const assignmentSentAt = metadataText(selectedTask.metadata, "assignment_notification_sent_at");
    const completionSentAt = metadataText(selectedTask.metadata, "completion_notification_sent_at");
    return (
      <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-xl overflow-auto border-l border-border/70 bg-card/95 shadow-[0_28px_80px_-42px_hsl(215_40%_18%)] backdrop-blur-xl">
        <div className="sticky top-0 z-10 border-b border-border/70 bg-card/95 p-5 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-primary">Task reminder</p>
              <h2 className="mt-2 text-2xl font-semibold leading-tight tracking-normal break-words">{selectedTask.title}</h2>
              <p className="mt-1 text-sm font-medium text-muted-foreground">{selectedTask.assignee ?? "Unassigned"} · {displayDate(selectedTask.due_date)}</p>
            </div>
            <button type="button" className={SOP_CLOSE_BUTTON_CLASS} aria-label="Close task detail" onClick={() => setSelectedTask(null)}><X className="size-[18px]" /></button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge className={statusBadgeClass(selectedStatus)} variant="outline">{statusLabel(selectedStatus)}</Badge>
            <Badge variant="outline">{TASK_FREQUENCY_LABELS[frequencyFromRecurrence(selectedTask.recurrence)]}</Badge>
            <Badge className={statusBadgeClass(selectedTask.priority)} variant="outline">{statusLabel(selectedTask.priority ?? "normal")}</Badge>
            {sourceDocument ? <Badge variant="outline">{sourceDocument}</Badge> : null}
          </div>
        </div>
        <div className="space-y-5 p-5">
          {sourceSection ? <section className="rounded-xl border border-border/70 bg-background/65 p-3 text-sm font-medium text-muted-foreground">Source section: {sourceSection}</section> : null}
          <section className="rounded-xl border border-border/70 bg-background/65 p-4 text-sm font-medium text-muted-foreground">{selectedTask.description || "No notes yet."}</section>
          <section className="grid gap-2 rounded-xl border border-border/70 bg-background/65 p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-muted-foreground">Notify assignee</span>
              <Badge className={statusBadgeClass(notifyAssignee ? "active" : "skipped")} variant="outline">{notifyAssignee ? "On" : "Off"}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-muted-foreground">Notify owner on completion</span>
              <Badge className={statusBadgeClass(notifyOwner ? "active" : "skipped")} variant="outline">{notifyOwner ? "On" : "Off"}</Badge>
            </div>
            {assignmentSentAt ? <p className="text-xs font-medium text-muted-foreground">Assignment email sent {new Date(assignmentSentAt).toLocaleString()}</p> : null}
            {completionSentAt ? <p className="text-xs font-medium text-muted-foreground">Completion email sent {new Date(completionSentAt).toLocaleString()}</p> : null}
          </section>
          <div className="flex flex-wrap gap-2">
            <Button className={SOP_ACTION_BUTTON_CLASS} disabled={selectedStatus === "completed" || completingTaskId === selectedTask.id} onClick={() => completeTask(selectedTask)}><Check className="size-[18px]" /> {completingTaskId === selectedTask.id ? "Completing..." : "Mark completed"}</Button>
            <Button className={SOP_ACTION_BUTTON_CLASS} variant="outline" onClick={() => openTaskDraft(selectedTask)}><Edit3 className="size-[18px]" /> Edit</Button>
            <Button className={cn(SOP_ACTION_BUTTON_CLASS, "border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800")} variant="outline" disabled={deletingTaskId === selectedTask.id} onClick={() => deleteTask(selectedTask)}><Trash2 className="size-[18px]" /> Delete</Button>
          </div>
          <section>
            <h3 className="font-semibold">Activity log</h3>
            <div className="mt-3 grid gap-2">
              {taskActivity.length === 0 ? <p className={cn(SOP_EMPTY_CLASS, "p-3 text-left")}>No activity yet.</p> : null}
              {taskActivity.slice(0, 12).map((item) => {
                const rawReason = typeof item.details?.reason === "string" ? item.details.reason : null;
                const rawMessageText = typeof item.details?.message === "string" ? item.details.message : null;
                const reason = cleanNotificationReason(rawReason);
                const messageText = cleanNotificationReason(rawMessageText);
                return (
                  <div className={cn("rounded-xl border border-border/70 bg-background/65 p-3 text-sm", item.action === "notification_failed" ? "border-amber-200 bg-amber-50/70 text-amber-950" : "")} key={item.id}>
                    <strong className="block leading-snug">{actionLabel(item.action)}</strong>
                    {reason ? <p className="mt-1 text-xs font-semibold leading-relaxed text-current/75">{reason}</p> : null}
                    {messageText && !reason ? <p className="mt-1 text-xs font-medium leading-relaxed text-muted-foreground">{messageText}</p> : null}
                    <p className="mt-1 text-xs font-medium text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </aside>
    );
  }

  function renderAccountModal() {
    if (!accountDraft) return null;
    const totals = calculateResidentialHours(Number(accountDraft.scheduledHours) || 0, accountDraft.frequency);
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => savingAccount ? undefined : setAccountDraft(null)}>
        <form className={cn(PAYMENT_MODAL_PANEL_CLASS, "max-w-3xl")} onSubmit={saveAccount} onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold tracking-normal">{accountDraft.id ? "Edit residential account" : "Add residential account"}</h2>
              <p className="mt-1 text-sm font-medium text-muted-foreground">Recurring residential cleaning setup.</p>
            </div>
            <button className={SOP_CLOSE_BUTTON_CLASS} type="button" aria-label="Close account modal" disabled={savingAccount} onClick={() => setAccountDraft(null)}><X className="size-[18px]" /></button>
          </div>
          <div className="grid gap-4 p-5">
            <div className="grid gap-3 md:grid-cols-2">
              <label className={PAYMENT_LABEL_CLASS}>Account name<input className={PAYMENT_FIELD_CLASS} value={accountDraft.accountName} onChange={(event) => setAccountDraft({ ...accountDraft, accountName: event.target.value })} /></label>
              <label className={PAYMENT_LABEL_CLASS}>Scheduled hours<input className={PAYMENT_FIELD_CLASS} inputMode="decimal" value={accountDraft.scheduledHours} onChange={(event) => setAccountDraft({ ...accountDraft, scheduledHours: event.target.value })} /></label>
              <label className={PAYMENT_LABEL_CLASS}>Frequency<select className={PAYMENT_FIELD_CLASS} value={accountDraft.frequency} onChange={(event) => setAccountDraft({ ...accountDraft, frequency: event.target.value as ResidentialFrequency })}>
                {Object.entries(RESIDENTIAL_FREQUENCY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select></label>
              <label className={PAYMENT_LABEL_CLASS}>Frequency detail<input className={PAYMENT_FIELD_CLASS} value={accountDraft.frequencyDetail} onChange={(event) => setAccountDraft({ ...accountDraft, frequencyDetail: event.target.value })} placeholder="Every Wednesday" /></label>
              <label className={PAYMENT_LABEL_CLASS}>City<select className={PAYMENT_FIELD_CLASS} value={accountDraft.city} onChange={(event) => setAccountDraft({ ...accountDraft, city: event.target.value, customCity: event.target.value === OUTSIDE_OC_CITY ? accountDraft.customCity : "" })}>
                <option value="">Select city</option>
                {ORANGE_COUNTY_CITIES.map((city) => <option key={city} value={city}>{city}</option>)}
                <option value={OUTSIDE_OC_CITY}>{OUTSIDE_OC_CITY}</option>
              </select></label>
              {accountDraft.city === OUTSIDE_OC_CITY ? <label className={PAYMENT_LABEL_CLASS}>Custom city<input className={PAYMENT_FIELD_CLASS} value={accountDraft.customCity} onChange={(event) => setAccountDraft({ ...accountDraft, customCity: event.target.value })} /></label> : null}
              <label className={PAYMENT_LABEL_CLASS}>Assigned team<select className={PAYMENT_FIELD_CLASS} value={accountDraft.assignedTeamId} onChange={(event) => setAccountDraft({ ...accountDraft, assignedTeamId: event.target.value })}>
                <option value="">Unassigned</option>
                {activeResidentialTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select></label>
              <label className={PAYMENT_LABEL_CLASS}>Status<select className={PAYMENT_FIELD_CLASS} value={accountDraft.active ? "active" : "inactive"} onChange={(event) => setAccountDraft({ ...accountDraft, active: event.target.value === "active" })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select></label>
            </div>
            <label className={PAYMENT_LABEL_CLASS}>Notes<textarea className={cn(PAYMENT_FIELD_CLASS, "h-auto min-h-20 py-2 font-medium normal-case")} value={accountDraft.notes} onChange={(event) => setAccountDraft({ ...accountDraft, notes: event.target.value })} /></label>
            <div className="grid gap-2 rounded-xl border border-border/70 bg-background/65 p-3 text-sm md:grid-cols-3">
              <span className="font-semibold">{formatHours(totals.weekly)} hours/week</span>
              <span className="font-semibold">{formatHours(totals.biweekly)} hours/2 weeks</span>
              <span className="font-semibold">{formatHours(totals.monthly)} hours/month</span>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border/70 px-5 py-4">
            <Button className={SOP_ACTION_BUTTON_CLASS} type="button" variant="outline" disabled={savingAccount} onClick={() => setAccountDraft(null)}>Cancel</Button>
            <Button className={SOP_ACTION_BUTTON_CLASS} type="submit" disabled={savingAccount}><Save className="size-[18px]" /> {savingAccount ? "Saving..." : "Save account"}</Button>
          </div>
        </form>
      </div>
    );
  }

  function renderStaffModal() {
    if (!staffDraft) return null;
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => savingStaff ? undefined : setStaffDraft(null)}>
        <form className={cn(PAYMENT_MODAL_PANEL_CLASS, "max-w-xl")} onSubmit={saveStaff} onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold tracking-normal">{staffDraft.id ? "Edit cleaner" : "Add cleaner"}</h2>
              <p className="mt-1 text-sm font-medium text-muted-foreground">Cleaner profile, status, and payment setup.</p>
            </div>
            <button className={SOP_CLOSE_BUTTON_CLASS} type="button" aria-label="Close cleaner modal" disabled={savingStaff} onClick={() => setStaffDraft(null)}><X className="size-[18px]" /></button>
          </div>
          <div className="grid gap-4 p-5">
            <label className={PAYMENT_LABEL_CLASS}>Cleaner name<input className={PAYMENT_FIELD_CLASS} value={staffDraft.name} onChange={(event) => setStaffDraft({ ...staffDraft, name: event.target.value })} /></label>
            <label className={PAYMENT_LABEL_CLASS}>Email optional<input className={PAYMENT_FIELD_CLASS} type="email" value={staffDraft.email} onChange={(event) => setStaffDraft({ ...staffDraft, email: event.target.value })} /></label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className={PAYMENT_LABEL_CLASS}>Status<select className={PAYMENT_FIELD_CLASS} value={staffDraft.status} onChange={(event) => {
                const status = event.target.value as StaffPipelineStatus;
                setStaffDraft({ ...staffDraft, status, active: status === "Active" });
              }}>
                <option value="Active">Active</option>
                <option value="Potential">Potential</option>
                <option value="Inactive">Inactive</option>
              </select></label>
              <label className={PAYMENT_LABEL_CLASS}>Cleaner area<select className={PAYMENT_FIELD_CLASS} value={staffDraft.teamScope} onChange={(event) => {
                const teamScope = event.target.value as StaffTeamScope;
                const scopeRoles = ["Residential Cleaner / Team", "Commercial Cleaner", "Mixed Route Cleaner"];
                setStaffDraft({
                  ...staffDraft,
                  teamScope,
                  role: scopeRoles.includes(staffDraft.role) ? roleForStaffScope(teamScope) : staffDraft.role,
                  paymentMode: teamScope === "mixed" ? "mixed" : "residential_only",
                });
              }}>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="mixed">Mixed route</option>
              </select></label>
              <label className={PAYMENT_LABEL_CLASS}>Role<input className={PAYMENT_FIELD_CLASS} value={staffDraft.role} onChange={(event) => setStaffDraft({ ...staffDraft, role: event.target.value })} /></label>
              {staffDraft.teamScope !== "residential" ? <label className={PAYMENT_LABEL_CLASS}>Commercial hourly rate<input className={PAYMENT_FIELD_CLASS} inputMode="decimal" value={staffDraft.hourlyRate} onChange={(event) => setStaffDraft({ ...staffDraft, hourlyRate: event.target.value })} /></label> : null}
              {staffDraft.teamScope !== "commercial" ? (
                <label className={PAYMENT_LABEL_CLASS}>Payment mode<select className={PAYMENT_FIELD_CLASS} value={staffDraft.paymentMode} disabled={isJuanRomero(staffDraft.name)} onChange={(event) => setStaffDraft({ ...staffDraft, paymentMode: event.target.value as PaymentMode })}>
                  <option value="residential_only">Residential only</option>
                  <option value="mixed">Mixed pay</option>
                </select></label>
              ) : null}
              {staffDraft.teamScope !== "commercial" && isJuanRomero(staffDraft.name) ? <div className="self-end rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100">Juan Romero is always mixed pay.</div> : null}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border/70 px-5 py-4">
            <Button className={SOP_ACTION_BUTTON_CLASS} type="button" variant="outline" disabled={savingStaff} onClick={() => setStaffDraft(null)}>Cancel</Button>
            <Button className={SOP_ACTION_BUTTON_CLASS} type="submit" disabled={savingStaff}><Save className="size-[18px]" /> {savingStaff ? "Saving..." : "Save cleaner"}</Button>
          </div>
        </form>
      </div>
    );
  }
}
