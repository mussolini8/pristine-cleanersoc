"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Download,
  FileDown,
  FileSpreadsheet,
  FileText,
  Filter,
  LockKeyhole,
  MessageSquare,
  Paperclip,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Upload,
  UserRoundCheck,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { displayDate } from "@/lib/dates/periods";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { normalizeAppRole, type AppRole } from "@/lib/access-control";
import {
  BUSINESS_UNIT_LABELS,
  businessUnitBadgeTone,
  businessUnitLabel,
  canManageUnit,
  getBusinessUnitFilter,
  getUserAllowedUnits,
  normalizeBusinessUnit,
  type BusinessUnit,
  type BusinessUnitFilter,
} from "@/lib/business-units";
import {
  markUnifiedPaymentPaid,
  normalizeCommercialPayrollEntry,
  normalizePaymentEntry,
  normalizePaymentExtra,
  type LegacyPaymentEntryRow,
  type PaymentExtraUnifiedRow,
  type UnifiedPayment,
} from "@/lib/payments/unified";
import { getStaffRoleDefinition } from "@/lib/staff-rules";
import type { PayrollEntryRow, PayrollPeriodRow } from "@/lib/payroll/types";
import { cn } from "@/lib/utils";
import {
  mapPaymentToCalendarEvent,
  mapSopTemplateToCalendarEvents,
  mapTaskToCalendarEvent,
  sopOccurrenceKey,
  type NormalizedCalendarEvent,
} from "@/lib/calendar-events";

type UnifiedView = "dashboard" | "tasks" | "calendar" | "payments" | "staff" | "reports" | "settings";
type DatePreset = "today" | "week" | "month" | "custom";
type CalendarView = "month" | "week" | "day" | "agenda";
type TaskViewMode = "kanban" | "calendar" | "list";
type PaymentViewMode = "calendar" | "list";
type TaskStatus = "backlog" | "todo" | "in_progress" | "waiting_review" | "completed";
type Priority = "urgent" | "high" | "normal" | "low";
type ReportType =
  | "task_completion"
  | "overdue_tasks"
  | "payments"
  | "commercial_payroll"
  | "residential_payments"
  | "staff_activity"
  | "cleaner_performance"
  | "monthly_sop"
  | "needs_review"
  | "revenue_summary";

type EnvStatus = {
  appBaseUrl: boolean;
  gmailUser: boolean;
  gmailPassword: boolean;
  ownerEmail: boolean;
  operationsManagerEmail: boolean;
  seoUserEmail: boolean;
  ownerGmailUser?: boolean;
  ownerGmailPassword?: boolean;
};

type OperationTaskRow = {
  id: string;
  user_id?: string | null;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  category: string;
  due_date: string | null;
  assignee: string | null;
  assigned_by?: string | null;
  assigned_to?: string | null;
  account_name?: string | null;
  property_address?: string | null;
  panel?: string | null;
  business_unit?: string | null;
  recurrence?: string | null;
  custom_interval_days?: number | null;
  completion_notes?: string | null;
  completed_at?: string | null;
  reminder?: boolean | null;
  metadata?: Record<string, unknown> | null;
  created_by?: string | null;
  completed_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type UnifiedTask = OperationTaskRow & {
  unit: BusinessUnit | "seo";
  normalizedStatus: TaskStatus;
  normalizedPriority: Priority;
  commentsCount: number;
  attachmentsCount: number;
  notifyOwnerOnCompleted: boolean;
  notifyAssigneeOnAssigned: boolean;
};

type SopTemplateRow = {
  id: string;
  natural_key: string;
  title: string;
  description: string | null;
  category: string;
  frequency: string;
  schedule_label: string;
  preferred_due_timing: string | null;
  week_scope: string;
  week_of_month: number | null;
  day_of_week: string | null;
  assigned_to: string;
  assigned_role?: string | null;
  status: string;
  priority: string;
  panel?: string | null;
  business_unit?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown> | null;
};

type StaffRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
};

type CommercialAccountRow = {
  id: string;
  name: string;
  cleaner_name?: string | null;
  city?: string | null;
  pricing_model?: string | null;
  hours?: number | string | null;
  frequency?: string | null;
  revenue?: number | null;
  cost?: number | null;
  cleaner_pay_type?: string | null;
  cleaner_hourly_rate?: number | null;
  cleaner_flat_rate?: number | null;
  payment_method?: string | null;
  contract_start?: string | null;
  contract_end?: string | null;
  last_qcc_date?: string | null;
  last_contact_date?: string | null;
  has_supplies?: boolean | null;
  has_keys?: boolean | null;
  supply_delivery_date?: string | null;
  estimated_fill_date?: string | null;
  supplies_notes?: string | null;
  source_sheet?: string | null;
};

type CommentRow = {
  id: string;
  task_id: string;
  author_name: string;
  body: string;
  created_at: string;
};

type AttachmentRow = {
  id: string;
  task_id: string;
  file_name: string;
  file_url: string | null;
  file_path: string;
  uploaded_by: string;
  created_at: string;
};

type ActivityRow = {
  id: string;
  task_id: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
};

type SopOccurrence = {
  id: string;
  templateId: string;
  naturalKey: string;
  title: string;
  description: string | null;
  category: string;
  priority: Priority;
  assignedTo: string;
  assignedRole: string;
  occurrenceDate: string;
  scheduleSummary: string;
  frequency: string;
  weekScope: string;
  weekOfMonth: number | null;
  dayOfWeek: string | null;
  source: "sop_template";
  completionEmailEnabled: boolean;
  assignmentEmailEnabled: boolean;
};

type TaskNotificationResult = {
  ok?: boolean;
  sent: boolean;
  skipped?: boolean;
  reason?: string;
  code?: string;
  messageId?: string;
};

type TaskDraft = {
  id?: string;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  status: TaskStatus;
  unit: BusinessUnit | "seo";
  assignee: string;
  dueDate: string;
  notifyOwnerOnCompleted: boolean;
  notifyAssigneeOnAssigned: boolean;
};

type PaymentFilters = {
  status: string;
  cleaner: string;
  account: string;
  source: string;
  needsReview: boolean;
  search: string;
  commercialOnly: boolean;
};

type TaskFilters = {
  status: string;
  priority: string;
  category: string;
  assignee: string;
  search: string;
};

type ReportFilters = {
  type: ReportType;
  status: string;
  staff: string;
  category: string;
  account: string;
};

const COLUMNS: { id: TaskStatus; label: string; helper: string }[] = [
  { id: "backlog", label: "Backlog", helper: "Captured, not scheduled" },
  { id: "todo", label: "To Do", helper: "Ready for action" },
  { id: "in_progress", label: "In Progress", helper: "Currently moving" },
  { id: "waiting_review", label: "Waiting Review", helper: "Needs owner eyes" },
  { id: "completed", label: "Completed", helper: "Closed this cycle" },
];

const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: "Urgent",
  high: "High",
  normal: "Standard",
  low: "Low",
};

const REPORT_LABELS: Record<ReportType, string> = {
  task_completion: "Task completion report",
  overdue_tasks: "Overdue tasks report",
  payments: "Payments report",
  commercial_payroll: "Commercial payroll report",
  residential_payments: "Residential payments report",
  staff_activity: "Staff activity report",
  cleaner_performance: "Cleaner performance report",
  monthly_sop: "Monthly SOP completion report",
  needs_review: "Needs review report",
  revenue_summary: "Revenue / payment summary",
};

const DEFAULT_TASK_DRAFT: TaskDraft = {
  title: "",
  description: "",
  category: "Operations",
  priority: "normal",
  status: "todo",
  unit: "residential",
  assignee: "Carlos Lopez",
  dueDate: "",
  notifyOwnerOnCompleted: true,
  notifyAssigneeOnAssigned: true,
};

function todayKey() {
  return formatDateKey(new Date());
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const [datePart] = value.split("T");
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const monthMatch = datePart.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) return new Date(Number(monthMatch[1]), Number(monthMatch[2]) - 1, 1);
  return null;
}

function dateKeyFromValue(value: string | null | undefined) {
  const date = parseDate(value);
  return date ? formatDateKey(date) : "";
}

// displayDate is imported from periods utility

function money(value: number | null | undefined) {
  return `$${Number(value ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function getCalendarRange(viewMode: CalendarView, anchor: Date) {
  if (viewMode === "day") {
    const key = formatDateKey(anchor);
    return { start: key, end: key };
  }

  if (viewMode === "week") {
    const start = startOfWeek(anchor);
    return { start: formatDateKey(start), end: formatDateKey(addDays(start, 6)) };
  }

  return {
    start: formatDateKey(new Date(anchor.getFullYear(), anchor.getMonth(), 1)),
    end: formatDateKey(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)),
  };
}

function getCalendarLabel(viewMode: CalendarView, anchor: Date) {
  if (viewMode === "day") return anchor.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  if (viewMode === "week") {
    const start = startOfWeek(anchor);
    const end = addDays(start, 6);
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  }
  return anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function getDateWindow(preset: DatePreset, customStart: string, customEnd: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === "today") return { start: todayKey(), end: todayKey(), label: "Today" };
  if (preset === "week") {
    const start = startOfWeek(today);
    return { start: formatDateKey(start), end: formatDateKey(addDays(start, 6)), label: "This week" };
  }
  if (preset === "month") {
    return {
      start: formatDateKey(new Date(today.getFullYear(), today.getMonth(), 1)),
      end: formatDateKey(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
      label: "This month",
    };
  }
  return {
    start: customStart || todayKey(),
    end: customEnd || customStart || todayKey(),
    label: customStart ? `${displayDate(customStart)} - ${displayDate(customEnd || customStart)}` : "Custom",
  };
}

function isWithinWindow(value: string | null | undefined, start: string, end: string) {
  const key = dateKeyFromValue(value);
  if (!key) return false;
  return key >= start && key <= end;
}

function normalizePriority(value: string | null | undefined): Priority {
  if (value === "urgent" || value === "high" || value === "low") return value;
  return "normal";
}

function normalizePersonName(value: string | null | undefined) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeTaskStatus(status: string | null | undefined): TaskStatus {
  if (status === "backlog") return "backlog";
  if (status === "in_progress") return "in_progress";
  if (status === "waiting_review" || status === "approved") return "waiting_review";
  if (status === "done" || status === "completed") return "completed";
  return "todo";
}

function dbStatusFromTaskStatus(status: TaskStatus, unit: BusinessUnit | "seo") {
  if (status === "completed") return unit === "seo" ? "completed" : "done";
  return status;
}

function taskBusinessUnit(row: OperationTaskRow): BusinessUnit | "seo" {
  if (String(row.panel ?? "").toLowerCase() === "seo" || String(row.business_unit ?? "").toLowerCase() === "seo") return "seo";
  return normalizeBusinessUnit(row.business_unit) ?? normalizeBusinessUnit(row.panel) ?? "residential";
}

function mapTask(row: OperationTaskRow, commentsCount = 0, attachmentsCount = 0): UnifiedTask {
  const metadata = row.metadata ?? {};
  return {
    ...row,
    unit: taskBusinessUnit(row),
    normalizedStatus: normalizeTaskStatus(row.status),
    normalizedPriority: normalizePriority(row.priority),
    commentsCount,
    attachmentsCount,
    notifyOwnerOnCompleted: metadata.notify_owner_on_completed !== false,
    notifyAssigneeOnAssigned: metadata.notify_assignee_on_assignment !== false,
  };
}

function taskSopOccurrenceKey(task: OperationTaskRow) {
  const metadata = task.metadata ?? {};
  const templateId = typeof metadata.template_id === "string" ? metadata.template_id : null;
  const occurrenceDate = typeof metadata.occurrence_date === "string" ? metadata.occurrence_date : task.due_date;
  return templateId && occurrenceDate ? sopOccurrenceKey(templateId, occurrenceDate) : null;
}

function normalizedOccurrenceTitleKey(title: string | null | undefined, occurrenceDate: string | null | undefined, assignee: string | null | undefined) {
  if (!title || !occurrenceDate) return null;
  return [
    "sop",
    title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    occurrenceDate,
    normalizePersonName(assignee || "Unassigned").toLowerCase(),
    "residential",
  ].join(":");
}

function sourceLabelForTask(task: UnifiedTask) {
  const metadata = task.metadata ?? {};
  const source = typeof metadata.source === "string" ? metadata.source : null;
  if (source === "recurring_instance") return "Recurring task";
  if (source === "sop_template") return "SOP template";
  return task.recurrence && task.recurrence !== "none" ? "Recurring task" : "Manual task";
}

function getActivityDetail(details: Record<string, unknown>, key: string) {
  const value = details[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function activityTitle(item: ActivityRow) {
  const reason = getActivityDetail(item.details, "reason");
  const message = getActivityDetail(item.details, "message");
  if (item.action === "notification_failed" && reason) return `Notification Failed - ${reason}`;
  if (item.action === "notification_sent" && message) return `Notification Sent - ${message}`;
  if (item.action === "notification_skipped" && reason) return `Notification Skipped - ${reason}`;
  return statusLabel(item.action);
}

function activityMeta(item: ActivityRow) {
  const parts = [
    getActivityDetail(item.details, "notificationType"),
    getActivityDetail(item.details, "recipient"),
    getActivityDetail(item.details, "code"),
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function paymentUnit(payment: UnifiedPayment): BusinessUnit {
  if (payment.category === "commercial" || payment.sourceType === "commercial_payroll" || payment.sourceType === "commercial_adjustment") return "commercial";
  return "residential";
}

function paymentDate(payment: UnifiedPayment) {
  return payment.serviceDate ?? payment.periodStart ?? payment.createdAt ?? "";
}

function staffUnit(person: StaffRow): BusinessUnit | "both" | "operations" {
  const definition = getStaffRoleDefinition(person.name, person.role);
  if (definition.teamScope === "global") return "operations";
  if (definition.teamScope === "mixed") return "both";
  return definition.teamScope;
}

function staffMatchesUnit(person: StaffRow, filter: BusinessUnitFilter) {
  const unit = staffUnit(person);
  if (filter === "both") return true;
  return unit === filter || unit === "both" || unit === "operations";
}

function statusLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function fileDateStamp() {
  return todayKey().replace(/-/g, "");
}

function sourceLabel(payment: UnifiedPayment) {
  if (payment.sourceType === "commercial_payroll") return "Commercial payroll";
  if (payment.sourceType === "commercial_adjustment") return "Adjustment";
  if (payment.sourceType === "manual_extra") return "Manual extra";
  return "Legacy / manual";
}

function getPaymentReviewReason(payment: UnifiedPayment) {
  if (payment.notes) return payment.notes;
  if (payment.finalAmount === 0) return "Amount is $0.00 or missing payable data";
  if (payment.requiresReview) return "Needs review";
  return "Clear";
}

function UnitBadge({ unit }: { unit: BusinessUnit | "seo" }) {
  return <Badge className={businessUnitBadgeTone(unit)}>{businessUnitLabel(unit)}</Badge>;
}

function UnitSegment({
  value,
  role,
  onChange,
}: {
  value: BusinessUnitFilter;
  role: AppRole;
  onChange: (unit: BusinessUnitFilter) => void;
}) {
  const allowedUnits = getUserAllowedUnits(role);
  const options: BusinessUnitFilter[] = allowedUnits.length > 1 ? ["residential", "commercial", "both"] : allowedUnits;

  return (
    <div className="inline-flex flex-wrap rounded-md border border-border bg-background/80 p-1 shadow-sm" aria-label="Business unit filter">
      {options.map((unit) => (
        <button
          type="button"
          key={unit}
          className={cn(
            "rounded px-3 py-1.5 text-sm font-black text-muted-foreground transition hover:bg-accent hover:text-foreground",
            value === unit && "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground",
          )}
          aria-pressed={value === unit}
          onClick={() => onChange(unit)}
        >
          {BUSINESS_UNIT_LABELS[unit]}
        </button>
      ))}
    </div>
  );
}

function DateRangeControl({
  preset,
  customStart,
  customEnd,
  onPresetChange,
  onCustomStartChange,
  onCustomEndChange,
}: {
  preset: DatePreset;
  customStart: string;
  customEnd: string;
  onPresetChange: (preset: DatePreset) => void;
  onCustomStartChange: (date: string) => void;
  onCustomEndChange: (date: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-md border border-border bg-background/80 p-1">
        {(["today", "week", "month", "custom"] as DatePreset[]).map((option) => (
          <button
            type="button"
            key={option}
            className={cn(
              "rounded px-2.5 py-1.5 text-xs font-black text-muted-foreground transition hover:bg-accent hover:text-foreground",
              preset === option && "bg-foreground text-background hover:bg-foreground hover:text-background",
            )}
            onClick={() => onPresetChange(option)}
          >
            {option === "today" ? "Today" : option === "week" ? "This week" : option === "month" ? "This month" : "Custom"}
          </button>
        ))}
      </div>
      {preset === "custom" ? (
        <div className="flex flex-wrap items-center gap-2">
          <input className="h-9 rounded-md border bg-background px-2 text-sm font-bold" type="date" value={customStart} onChange={(event) => onCustomStartChange(event.target.value)} aria-label="Custom start date" />
          <input className="h-9 rounded-md border bg-background px-2 text-sm font-bold" type="date" value={customEnd} min={customStart || undefined} onChange={(event) => onCustomEndChange(event.target.value)} aria-label="Custom end date" />
        </div>
      ) : null}
    </div>
  );
}

function PageHeader({
  view,
  unit,
  role,
  datePreset,
  customStart,
  customEnd,
  onUnitChange,
  onDatePresetChange,
  onCustomStartChange,
  onCustomEndChange,
}: {
  view: UnifiedView;
  unit: BusinessUnitFilter;
  role: AppRole;
  datePreset: DatePreset;
  customStart: string;
  customEnd: string;
  onUnitChange: (unit: BusinessUnitFilter) => void;
  onDatePresetChange: (preset: DatePreset) => void;
  onCustomStartChange: (date: string) => void;
  onCustomEndChange: (date: string) => void;
}) {
  const titles: Record<UnifiedView, { title: string; sub: string; Icon: typeof CalendarDays }> = {
    dashboard: { title: "Operations Dashboard", sub: "Residential and commercial work in one command center.", Icon: ClipboardCheck },
    tasks: { title: "Tasks", sub: "Kanban, assignments, evidence, comments, and SOP work.", Icon: CheckSquare },
    calendar: { title: "Calendar", sub: "Tasks, cleanings, payments, SOP rhythm, and review events.", Icon: CalendarDays },
    payments: { title: "Payments", sub: "Calendar-first review for residential payments and commercial payroll.", Icon: WalletCards },
    staff: { title: "Staff", sub: "Team roster separated by residential, commercial, and operations context.", Icon: Users },
    reports: { title: "Reports", sub: "Operational exports with clean XLSX and PDF outputs.", Icon: FileText },
    settings: { title: "Settings", sub: "Company defaults, notifications, permissions, and safe configuration status.", Icon: Settings2 },
  };
  const meta = titles[view];
  const Icon = meta.Icon;

  return (
    <section className="rounded-lg border border-border/80 bg-card p-5 shadow-[0_22px_60px_-52px_hsl(210_40%_20%)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-primary"><Icon className="size-4" /> Pristine Cleaners</p>
          <h1 className="mt-3 text-3xl font-black tracking-normal">{meta.title}</h1>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">{meta.sub}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <UnitSegment value={unit} role={role} onChange={onUnitChange} />
          {view !== "settings" && view !== "staff" ? (
            <DateRangeControl
              preset={datePreset}
              customStart={customStart}
              customEnd={customEnd}
              onPresetChange={onDatePresetChange}
              onCustomStartChange={onCustomStartChange}
              onCustomEndChange={onCustomEndChange}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function MetricCard({ label, value, note, icon: Icon, tone = "neutral" }: { label: string; value: string | number; note?: string; icon: typeof CheckSquare; tone?: "neutral" | "good" | "warn" }) {
  return (
    <Card className={tone === "warn" ? "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/20" : tone === "good" ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20" : ""}>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div>
          <p className="text-[11px] font-black uppercase text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-black leading-none">{value}</p>
          {note ? <p className="mt-2 text-xs font-semibold text-muted-foreground">{note}</p> : null}
        </div>
        <div className="rounded-md border border-border/80 bg-background p-2 text-primary">
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  );
}

function TaskCard({
  task,
  onSelect,
  onComplete,
}: {
  task: UnifiedTask;
  onSelect: (task: UnifiedTask) => void;
  onComplete: (task: UnifiedTask) => void;
}) {
  return (
    <article className="rounded-lg border border-border/80 bg-card p-3 shadow-sm transition hover:border-primary/30 hover:bg-accent/20">
      <div className="flex items-start justify-between gap-3">
        <button type="button" className="min-w-0 text-left" onClick={() => onSelect(task)}>
          <h3 className="line-clamp-2 text-sm font-black leading-snug">{task.title || "Untitled task"}</h3>
        </button>
        <button
          type="button"
          aria-label={`Complete ${task.title}`}
          className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-background text-muted-foreground transition hover:border-emerald-400 hover:text-emerald-600"
          onClick={() => onComplete(task)}
        >
          <Check className="size-4" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <UnitBadge unit={task.unit} />
        <Badge variant="outline">{task.category}</Badge>
        <Badge variant="outline">{PRIORITY_LABELS[task.normalizedPriority]}</Badge>
        <Badge variant="outline">{statusLabel(task.normalizedStatus)}</Badge>
      </div>
      <div className="mt-3 grid gap-1 text-xs font-semibold text-muted-foreground">
        <span>Assigned to {task.assignee || "Unassigned"}</span>
        <span>{displayDate(task.due_date)}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-bold text-muted-foreground">
        <span className="flex items-center gap-1"><Bell className="size-3.5" /> {task.notifyOwnerOnCompleted || task.notifyAssigneeOnAssigned ? "Notify" : "Muted"}</span>
        <span className="flex items-center gap-1"><MessageSquare className="size-3.5" /> {task.commentsCount}</span>
        <span className="flex items-center gap-1"><Paperclip className="size-3.5" /> {task.attachmentsCount}</span>
      </div>
    </article>
  );
}

function ViewToggle<TValue extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: TValue;
  options: { value: TValue; label: string }[];
  onChange: (value: TValue) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-border bg-background/80 p-1" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className={cn(
            "rounded px-3 py-1.5 text-xs font-black text-muted-foreground transition hover:bg-accent hover:text-foreground",
            value === option.value && "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground",
          )}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function CalendarToolbar({
  viewMode,
  anchor,
  onViewModeChange,
  onNavigate,
  onToday,
}: {
  viewMode: CalendarView;
  anchor: Date;
  onViewModeChange: (viewMode: CalendarView) => void;
  onNavigate: (direction: -1 | 1) => void;
  onToday: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/80 bg-card p-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Previous calendar period" onClick={() => onNavigate(-1)}><ChevronLeft className="size-4" /></Button>
        <div className="min-w-56 text-center text-sm font-black">{getCalendarLabel(viewMode, anchor)}</div>
        <Button variant="outline" size="icon" aria-label="Next calendar period" onClick={() => onNavigate(1)}><ChevronRight className="size-4" /></Button>
        <Button variant="outline" size="sm" onClick={onToday}>Today</Button>
      </div>
      <ViewToggle
        label="Calendar view"
        value={viewMode}
        onChange={onViewModeChange}
        options={[
          { value: "month", label: "Month" },
          { value: "week", label: "Week" },
          { value: "day", label: "Day" },
          { value: "agenda", label: "Agenda" },
        ]}
      />
    </div>
  );
}

function CalendarEventPill({
  event,
  dense = false,
  onSelect,
}: {
  event: NormalizedCalendarEvent;
  dense?: boolean;
  onSelect: (event: NormalizedCalendarEvent) => void;
}) {
  const isCompletedTask = event.type === "task" && (event.status === "completed" || event.status === "done");
  return (
    <button
      type="button"
      className={cn(
        "group flex w-full min-w-0 items-start gap-2 rounded-md border px-2 py-1.5 text-left shadow-sm transition hover:-translate-y-px hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        event.color.eventClass,
        dense && "px-2 py-1",
      )}
      onClick={() => onSelect(event)}
    >
      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", event.color.dotClass)} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1">
          <span className={cn("truncate font-black leading-tight", dense ? "text-[11px]" : "text-xs")}>{event.title}</span>
          {isCompletedTask ? <Check className="size-3 shrink-0" /> : null}
        </span>
        <span className={cn("block truncate font-bold opacity-75", dense ? "text-[10px]" : "text-[11px]")}>{event.summary || statusLabel(event.status)}</span>
      </span>
    </button>
  );
}

function OperationsCalendar({
  events,
  viewMode,
  anchor,
  emptyMessage,
  onEventSelect,
}: {
  events: NormalizedCalendarEvent[];
  viewMode: CalendarView;
  anchor: Date;
  emptyMessage: string;
  onEventSelect: (event: NormalizedCalendarEvent) => void;
}) {
  const today = todayKey();
  const sortedEvents = [...events].sort((a, b) => `${a.start}-${a.title}`.localeCompare(`${b.start}-${b.title}`));

  if (viewMode === "agenda") {
    return (
      <Card>
        <CardContent className="grid gap-2 p-4">
          {sortedEvents.length === 0 ? <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm font-bold text-muted-foreground">{emptyMessage}</div> : null}
          {sortedEvents.map((event) => (
            <button
              type="button"
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/75 p-3 text-left transition hover:border-primary/30 hover:bg-accent/25"
              key={event.id}
              onClick={() => onEventSelect(event)}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={event.color.badgeClass}>{event.type === "booking" ? "Booking" : statusLabel(event.type)}</Badge>
                  <UnitBadge unit={event.businessUnit} />
                  <Badge variant="outline">{statusLabel(event.status)}</Badge>
                </div>
                <p className="mt-2 truncate font-black">{event.title}</p>
                <p className="text-xs font-bold text-muted-foreground">{event.summary}</p>
              </div>
              <div className="text-right text-sm font-black">{displayDate(event.start)}</div>
            </button>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (viewMode === "day") {
    const key = formatDateKey(anchor);
    const dayEvents = sortedEvents.filter((event) => event.start === key);
    return (
      <section className={cn("rounded-lg border border-border bg-card p-4", key === today && "border-primary/45 bg-primary/5")}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-black uppercase text-muted-foreground">{anchor.toLocaleDateString("en-US", { weekday: "long" })}</p>
            <h2 className="text-xl font-black">{anchor.toLocaleDateString("en-US", { month: "long", day: "numeric" })}</h2>
          </div>
          <Badge variant="outline">{dayEvents.length} items</Badge>
        </div>
        <div className="grid gap-2">
          {dayEvents.length === 0 ? <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm font-bold text-muted-foreground">{emptyMessage}</div> : null}
          {dayEvents.map((event) => <CalendarEventPill event={event} key={event.id} onSelect={onEventSelect} />)}
        </div>
      </section>
    );
  }

  if (viewMode === "week") {
    const start = startOfWeek(anchor);
    const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
    return (
      <div className="grid gap-3 lg:grid-cols-7">
        {days.map((day) => {
          const key = formatDateKey(day);
          const dayEvents = sortedEvents.filter((event) => event.start === key);
          return (
            <section className={cn("min-h-96 rounded-lg border border-border bg-card p-3", key === today && "border-primary/45 bg-primary/5")} key={key}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-black uppercase text-muted-foreground">{day.toLocaleDateString("en-US", { weekday: "short" })}</p>
                  <p className="text-sm font-black">{day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                </div>
                <Badge variant="outline">{dayEvents.length}</Badge>
              </div>
              <div className="space-y-2">
                {dayEvents.length === 0 ? <div className="rounded-md border border-dashed border-border p-3 text-center text-xs font-bold text-muted-foreground">Open day</div> : null}
                {dayEvents.map((event) => <CalendarEventPill event={event} dense key={event.id} onSelect={onEventSelect} />)}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(monthStart);
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));

  return (
    <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-border bg-card">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
        <div className="border-b border-border bg-muted/45 p-2 text-xs font-black text-muted-foreground" key={day}>{day}</div>
      ))}
      {days.map((day) => {
        const key = formatDateKey(day);
        const dayEvents = sortedEvents.filter((event) => event.start === key);
        const isOutside = day.getMonth() !== anchor.getMonth();
        return (
          <section className={cn("min-h-36 border-b border-r border-border p-2 transition", isOutside && "bg-muted/20 text-muted-foreground", key === today && "bg-primary/5 ring-1 ring-inset ring-primary/40")} key={key}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className={cn("grid size-7 place-items-center rounded-md text-xs font-black", key === today && "bg-primary text-primary-foreground")}>{day.getDate()}</span>
              {dayEvents.length ? <span className="text-[11px] font-black text-muted-foreground">{dayEvents.length}</span> : null}
            </div>
            <div className="space-y-1.5">
              {dayEvents.slice(0, 5).map((event) => <CalendarEventPill event={event} dense key={event.id} onSelect={onEventSelect} />)}
              {dayEvents.length > 5 ? <div className="rounded-md border border-dashed border-border px-2 py-1 text-[11px] font-bold text-muted-foreground">+{dayEvents.length - 5} more</div> : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="rounded-md border border-border bg-background/75 p-3">
      <p className="text-[11px] font-black uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-bold">{value}</p>
    </div>
  );
}

export function UnifiedOperationsClient({ view, envStatus }: { view: UnifiedView; envStatus?: EnvStatus }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [role, setRole] = useState<AppRole>("residential");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [tasks, setTasks] = useState<UnifiedTask[]>([]);
  const [sopTemplates, setSopTemplates] = useState<SopTemplateRow[]>([]);
  const [payments, setPayments] = useState<UnifiedPayment[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [accounts, setAccounts] = useState<CommercialAccountRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const [calendarAnchor, setCalendarAnchor] = useState(() => new Date());
  const [taskView, setTaskView] = useState<TaskViewMode>("calendar");
  const [paymentView, setPaymentView] = useState<PaymentViewMode>("calendar");
  const [selectedTask, setSelectedTask] = useState<UnifiedTask | null>(null);
  const [selectedSopOccurrence, setSelectedSopOccurrence] = useState<SopOccurrence | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<UnifiedPayment | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [taskModalError, setTaskModalError] = useState<string | null>(null);
  const [savingTask, setSavingTask] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [taskFilters, setTaskFilters] = useState<TaskFilters>({ status: "all", priority: "all", category: "all", assignee: "all", search: "" });
  const [paymentFilters, setPaymentFilters] = useState<PaymentFilters>({ status: "all", cleaner: "all", account: "all", source: "all", needsReview: false, search: "", commercialOnly: true });
  const [reportFilters, setReportFilters] = useState<ReportFilters>({ type: "payments", status: "all", staff: "all", category: "all", account: "all" });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const unit = getBusinessUnitFilter(searchParams.get("unit"), role);
  const dateWindow = getDateWindow(datePreset, customStart, customEnd);
  const allowedUnits = getUserAllowedUnits(role);

  function updateUnit(nextUnit: BusinessUnitFilter) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("unit", nextUnit);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function updateCalendarAnchorFromKey(value: string) {
    const nextAnchor = parseDate(value);
    if (nextAnchor) setCalendarAnchor(nextAnchor);
  }

  function changeDatePreset(nextPreset: DatePreset) {
    setDatePreset(nextPreset);
    const nextWindow = getDateWindow(nextPreset, customStart, customEnd);
    updateCalendarAnchorFromKey(nextWindow.start);
  }

  function changeCustomStart(date: string) {
    setCustomStart(date);
    if (date) updateCalendarAnchorFromKey(date);
  }

  function changeCustomEnd(date: string) {
    setCustomEnd(date);
  }

  useEffect(() => {
    if (view !== "payments" || searchParams.get("unit")) return;
    if (!getUserAllowedUnits(role).includes("commercial")) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("unit", "commercial");
    router.replace(`${pathname}?${params.toString()}`);
  }, [pathname, role, router, searchParams, view]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setMessage(null);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted || !user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const { data: profile } = await supabase.from("profiles").select("app_role").eq("id", user.id).maybeSingle();
      const nextRole = normalizeAppRole(profile?.app_role);
      setRole(nextRole);

      const [
        taskResult,
        templateResult,
        commentResult,
        attachmentResult,
        activityResult,
        paymentEntryResult,
        paymentExtraResult,
        payrollEntryResult,
        payrollPeriodResult,
        staffResult,
        accountResult,
      ] = await Promise.all([
        supabase.from("operation_tasks").select("*").order("due_date", { ascending: true, nullsFirst: false }).limit(800),
        supabase.from("operation_task_templates").select("*").order("week_of_month", { ascending: true, nullsFirst: true }).order("day_of_week").limit(300),
        supabase.from("operation_task_comments").select("*").order("created_at", { ascending: false }).limit(1000),
        supabase.from("operation_task_attachments").select("*").order("created_at", { ascending: false }).limit(1000),
        supabase.from("operation_task_audit_log").select("*").order("created_at", { ascending: false }).limit(1000),
        supabase.from("payment_entries").select("*").order("created_at", { ascending: false }).limit(800),
        supabase.from("payment_extras").select("*").order("created_at", { ascending: false }).limit(300),
        supabase.from("commercial_payroll_entries").select("*").order("service_date", { ascending: false, nullsFirst: false }).limit(800),
        supabase.from("commercial_pay_periods").select("*").order("start_date", { ascending: false }).limit(200),
        supabase.from("staff_members").select("*").order("name").limit(500),
        supabase.from("commercial_accounts").select("*").order("name").limit(500),
      ]);

      if (!mounted) return;
      const error = taskResult.error
        ?? templateResult.error
        ?? paymentEntryResult.error
        ?? paymentExtraResult.error
        ?? payrollEntryResult.error
        ?? payrollPeriodResult.error
        ?? staffResult.error
        ?? accountResult.error;
      if (error) setMessage(error.message);

      const commentRows = (commentResult.data ?? []) as CommentRow[];
      const attachmentRows = (attachmentResult.data ?? []) as AttachmentRow[];
      const commentCounts = new Map<string, number>();
      const attachmentCounts = new Map<string, number>();
      for (const row of commentRows) commentCounts.set(row.task_id, (commentCounts.get(row.task_id) ?? 0) + 1);
      for (const row of attachmentRows) attachmentCounts.set(row.task_id, (attachmentCounts.get(row.task_id) ?? 0) + 1);

      const periodMap = new Map(((payrollPeriodResult.data ?? []) as PayrollPeriodRow[]).map((period) => [period.id, period]));
      const paymentRows = ((paymentEntryResult.data ?? []) as LegacyPaymentEntryRow[]).map(normalizePaymentEntry);
      const syncedPayrollIds = new Set(paymentRows.map((payment) => payment.sourceId).filter(Boolean));
      const rawPayrollPayments = ((payrollEntryResult.data ?? []) as PayrollEntryRow[])
        .filter((entry) => !syncedPayrollIds.has(entry.id))
        .map((entry) => normalizeCommercialPayrollEntry(entry, periodMap.get(entry.pay_period_id)));

      setComments(commentRows);
      setAttachments(attachmentRows);
      setActivity((activityResult.data ?? []) as ActivityRow[]);
      const mappedTasks = ((taskResult.data ?? []) as OperationTaskRow[]).map((row) => mapTask(row, commentCounts.get(row.id) ?? 0, attachmentCounts.get(row.id) ?? 0));
      setTasks(mappedTasks);
      const requestedTaskId = searchParams.get("task");
      if (requestedTaskId) setSelectedTask(mappedTasks.find((task) => task.id === requestedTaskId) ?? null);
      setSopTemplates((templateResult.data ?? []) as SopTemplateRow[]);
      setPayments([
        ...paymentRows,
        ...((paymentExtraResult.data ?? []) as PaymentExtraUnifiedRow[]).map(normalizePaymentExtra),
        ...rawPayrollPayments,
      ]);
      setStaff((staffResult.data ?? []) as StaffRow[]);
      setAccounts((accountResult.data ?? []) as CommercialAccountRow[]);
      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [searchParams, supabase]);

  const scopedTasks = useMemo(() => tasks.filter((task) => {
    if (task.unit === "seo") return view === "tasks" && role === "seo";
    if (unit === "both") return allowedUnits.includes(task.unit);
    return task.unit === unit;
  }), [allowedUnits, role, tasks, unit, view]);

  const visibleTasks = useMemo(() => scopedTasks.filter((task) => {
    const shouldApplyDateWindow = !(datePreset === "custom" && !customStart && !customEnd);
    if (shouldApplyDateWindow && task.due_date && !isWithinWindow(task.due_date, dateWindow.start, dateWindow.end)) return false;
    if (taskFilters.status !== "all" && task.normalizedStatus !== taskFilters.status) return false;
    if (taskFilters.priority !== "all" && task.normalizedPriority !== taskFilters.priority) return false;
    if (taskFilters.category !== "all" && task.category !== taskFilters.category) return false;
    if (taskFilters.assignee !== "all" && (task.assignee ?? "Unassigned") !== taskFilters.assignee) return false;
    const search = taskFilters.search.trim().toLowerCase();
    if (search) {
      const haystack = [
        task.title,
        task.description,
        task.category,
        task.assignee,
        task.account_name,
        task.property_address,
        task.panel,
        task.business_unit,
      ].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  }), [customEnd, customStart, datePreset, dateWindow.end, dateWindow.start, scopedTasks, taskFilters]);

  const scopedPayments = useMemo(() => payments.filter((payment) => {
    const paymentBusinessUnit = paymentUnit(payment);
    if (unit === "both") return allowedUnits.includes(paymentBusinessUnit);
    return paymentBusinessUnit === unit;
  }), [allowedUnits, payments, unit]);

  const visiblePayments = useMemo(() => scopedPayments.filter((payment) => {
    if (!isWithinWindow(paymentDate(payment), dateWindow.start, dateWindow.end)) return false;
    if (paymentFilters.commercialOnly && unit !== "residential" && paymentUnit(payment) !== "commercial") return false;
    if (paymentFilters.status !== "all" && payment.status !== paymentFilters.status) return false;
    if (paymentFilters.cleaner !== "all" && payment.cleanerName !== paymentFilters.cleaner) return false;
    if (paymentFilters.account !== "all" && payment.accountName !== paymentFilters.account) return false;
    if (paymentFilters.source !== "all" && payment.sourceType !== paymentFilters.source) return false;
    if (paymentFilters.needsReview && !payment.requiresReview && payment.finalAmount !== 0) return false;
    const search = paymentFilters.search.trim().toLowerCase();
    if (search) {
      const haystack = [
        payment.cleanerName,
        payment.cleanerEmail,
        payment.cleanerType,
        payment.accountName,
        payment.sourceType,
        payment.paymentType,
        payment.status,
        payment.paymentMethod,
        payment.notes,
      ].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  }), [dateWindow.end, dateWindow.start, paymentFilters, scopedPayments, unit]);

  const scopedStaff = useMemo(() => staff.filter((person) => staffMatchesUnit(person, unit)), [staff, unit]);
  const scopedAccounts = useMemo(() => unit === "residential" ? [] : accounts.filter((account) => account.source_sheet !== "Team supplies"), [accounts, unit]);
  const scopedSopTemplates = useMemo(() => unit === "commercial" ? [] : sopTemplates.filter((template) => template.status !== "inactive"), [sopTemplates, unit]);

  async function reloadTasks() {
    const [taskResult, commentResult, attachmentResult, activityResult] = await Promise.all([
      supabase.from("operation_tasks").select("*").order("due_date", { ascending: true, nullsFirst: false }).limit(800),
      supabase.from("operation_task_comments").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("operation_task_attachments").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("operation_task_audit_log").select("*").order("created_at", { ascending: false }).limit(1000),
    ]);
    if (taskResult.error) {
      setMessage(`Tasks could not be refreshed: ${taskResult.error.message}`);
      return tasks;
    }
    const commentRows = (commentResult.data ?? []) as CommentRow[];
    const attachmentRows = (attachmentResult.data ?? []) as AttachmentRow[];
    const commentCounts = new Map<string, number>();
    const attachmentCounts = new Map<string, number>();
    for (const row of commentRows) commentCounts.set(row.task_id, (commentCounts.get(row.task_id) ?? 0) + 1);
    for (const row of attachmentRows) attachmentCounts.set(row.task_id, (attachmentCounts.get(row.task_id) ?? 0) + 1);
    setComments(commentRows);
    setAttachments(attachmentRows);
    setActivity((activityResult.data ?? []) as ActivityRow[]);
    const mappedTasks = ((taskResult.data ?? []) as OperationTaskRow[]).map((row) => mapTask(row, commentCounts.get(row.id) ?? 0, attachmentCounts.get(row.id) ?? 0));
    setTasks(mappedTasks);
    setSelectedTask((current) => current ? mappedTasks.find((task) => task.id === current.id) ?? current : null);
    return mappedTasks;
  }

  async function saveTaskDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!taskDraft || !userId || savingTask) return;
    setTaskModalError(null);
    if (!taskDraft.title.trim()) {
      setTaskModalError("Task could not be saved: title is required.");
      return;
    }
    setSavingTask(true);
    const unitForTask = taskDraft.unit === "seo" ? "seo" : taskDraft.unit;
    const normalizedAssignee = normalizePersonName(taskDraft.assignee);
    const payload = {
      user_id: userId,
      title: taskDraft.title.trim(),
      description: taskDraft.description.trim() || null,
      priority: taskDraft.priority,
      status: dbStatusFromTaskStatus(taskDraft.status, unitForTask),
      category: taskDraft.category.trim() || "Operations",
      due_date: taskDraft.dueDate || null,
      assignee: normalizedAssignee || null,
      assigned_by: "Pristine Operations",
      panel: unitForTask === "seo" ? "SEO" : businessUnitLabel(unitForTask),
      business_unit: unitForTask,
      metadata: {
        notify_owner_on_completed: taskDraft.notifyOwnerOnCompleted,
        notify_assignee_on_assignment: taskDraft.notifyAssigneeOnAssigned,
      },
      updated_at: new Date().toISOString(),
    };

    try {
      const previousAssignee = taskDraft.id ? normalizePersonName(tasks.find((task) => task.id === taskDraft.id)?.assignee) : null;
      const result = taskDraft.id
        ? await supabase.from("operation_tasks").update(payload).eq("id", taskDraft.id).select("*").single()
        : await supabase.from("operation_tasks").insert({ ...payload, created_at: new Date().toISOString() }).select("*").single();

      if (result.error) {
        const reason = result.error.message || "database insert failed";
        setTaskModalError(`Task could not be saved: ${reason}`);
        setMessage(`Task could not be saved: ${reason}`);
        return;
      }

      const savedTask = result.data as OperationTaskRow;
      const assigneeChanged = previousAssignee !== normalizedAssignee;
      let feedback = "Task saved.";

      if (!taskDraft.notifyAssigneeOnAssigned) {
        await notifyTask("task_assigned", savedTask, { enabled: false });
        feedback = "Task saved. Assignment email skipped.";
      } else if (assigneeChanged) {
        const notification = await notifyTask("task_assigned", savedTask, { enabled: true });
        feedback = notification.sent
          ? `Task saved and assignment email sent to ${normalizedAssignee || "the assignee"}.`
          : `Task saved, but assignment email was not sent: ${notification.reason ?? "unknown email error"}`;
      }

      setMessage(feedback);
      setTaskDraft(null);
      await reloadTasks();
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unexpected task save error";
      setTaskModalError(`Task could not be saved: ${reason}`);
      setMessage(`Task could not be saved: ${reason}`);
    } finally {
      setSavingTask(false);
    }
  }

  async function notifyTask(
    event: "task_assigned" | "task_completed",
    task: OperationTaskRow,
    options: { enabled: boolean } = { enabled: true },
  ): Promise<TaskNotificationResult> {
    try {
      const response = await fetch("/api/tasks/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event,
          enabled: options.enabled,
          actorName: "Pristine Operations",
          task: {
            id: task.id,
            title: task.title,
            category: task.category,
            priority: task.priority,
            dueDate: task.due_date,
            assignedBy: task.assigned_by,
            assignedTo: task.assignee,
            createdBy: task.assigned_by ?? "Pristine Operations",
            accountOrProperty: task.account_name || task.property_address || "Operations task",
            panel: task.panel,
            description: task.description,
            notes: task.description,
            status: task.status,
            completedAt: new Date().toISOString(),
            completionNotes: task.completion_notes || task.description,
            commentsCount: "commentsCount" in task && typeof task.commentsCount === "number" ? task.commentsCount : null,
            attachmentsCount: "attachmentsCount" in task && typeof task.attachmentsCount === "number" ? task.attachmentsCount : null,
            completionEmailEnabled: task.metadata?.notify_owner_on_completed !== false,
            assignmentEmailEnabled: task.metadata?.notify_assignee_on_assignment !== false,
          },
        }),
      });
      const data = await response.json().catch(() => null) as { notification?: TaskNotificationResult; error?: string } | null;
      if (!response.ok) {
        return { sent: false, reason: data?.error ?? `Notification request failed with HTTP ${response.status}` };
      }
      return data?.notification ?? { sent: false, reason: "Notification service returned no status." };
    } catch (error) {
      console.warn("Task notification request failed", error);
      return { sent: false, reason: error instanceof Error ? error.message : "Notification request failed." };
    }
  }

  async function completeTask(task: UnifiedTask) {
    if (task.normalizedStatus === "completed") return;
    setCompletingTaskId(task.id);
    const completedAt = new Date().toISOString();
    const nextStatus = task.unit === "seo" ? "completed" : "done";
    const { error } = await supabase
      .from("operation_tasks")
      .update({ status: nextStatus, completed_at: completedAt, updated_at: completedAt })
      .eq("id", task.id);
    if (error) {
      setMessage(`Task could not be completed: ${error.message}`);
      setCompletingTaskId(null);
      return;
    }
    const completedTask = { ...task, status: nextStatus, completed_at: completedAt };
    if (task.notifyOwnerOnCompleted) {
      const notification = await notifyTask("task_completed", completedTask);
      setMessage(notification.sent
        ? "Task completed and owner email sent."
        : `Task completed, but owner email was not sent: ${notification.reason ?? "unknown email error"}`);
    } else {
      await notifyTask("task_completed", completedTask, { enabled: false });
      setMessage("Task completed. Owner email skipped.");
    }
    await reloadTasks();
    setCompletingTaskId(null);
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTask || !userId || !commentDraft.trim()) return;
    const { error } = await supabase.from("operation_task_comments").insert({
      task_id: selectedTask.id,
      user_id: userId,
      author_name: "Pristine Operations",
      body: commentDraft.trim(),
      internal: true,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setCommentDraft("");
    await reloadTasks();
  }

  async function uploadAttachment(file: File | null) {
    if (!file || !selectedTask || !userId) return;
    setUploading(true);
    const path = `${selectedTask.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const upload = await supabase.storage.from("seo-task-attachments").upload(path, file, { upsert: false });
    if (upload.error) {
      setMessage(upload.error.message);
      setUploading(false);
      return;
    }
    const { data: publicUrl } = supabase.storage.from("seo-task-attachments").getPublicUrl(path);
    const { error } = await supabase.from("operation_task_attachments").insert({
      task_id: selectedTask.id,
      user_id: userId,
      file_name: file.name,
      file_path: path,
      file_url: publicUrl.publicUrl,
      file_type: file.type,
      file_size: file.size,
      uploaded_by: "Pristine Operations",
    });
    if (error) setMessage(error.message);
    setUploading(false);
    await reloadTasks();
  }

  async function markPaymentPaid(payment: UnifiedPayment) {
    if (payment.status === "paid" || payment.status === "locked") return;
    if (payment.sourceType === "commercial_payroll" && !payment.payPeriodId) return;
    try {
      await markUnifiedPaymentPaid(payment.id);
      setPayments((current) => current.map((item) => item.id === payment.id && item.sourceType === payment.sourceType ? { ...item, status: "paid", paidAt: new Date().toISOString() } : item));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not mark payment paid.");
    }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage(error.message);
      return;
    }
    setPassword("");
    setConfirmPassword("");
    setMessage("Password updated in Supabase Auth.");
  }

  function openTaskDraft(task?: UnifiedTask) {
    setTaskModalError(null);
    setTaskDraft(task ? {
      id: task.id,
      title: task.title,
      description: task.description ?? "",
      category: task.category,
      priority: task.normalizedPriority,
      status: task.normalizedStatus,
      unit: task.unit,
      assignee: task.assignee ?? "",
      dueDate: task.due_date ?? "",
      notifyOwnerOnCompleted: task.notifyOwnerOnCompleted,
      notifyAssigneeOnAssigned: task.notifyAssigneeOnAssigned,
    } : {
      ...DEFAULT_TASK_DRAFT,
      unit: unit === "both" ? (allowedUnits[0] ?? "residential") : unit,
    });
  }

  function applyCalendarWindow(nextView: CalendarView, nextAnchor: Date) {
    const range = getCalendarRange(nextView, nextAnchor);
    setDatePreset("custom");
    setCustomStart(range.start);
    setCustomEnd(range.end);
  }

  function changeCalendarView(nextView: CalendarView) {
    setCalendarView(nextView);
    applyCalendarWindow(nextView, calendarAnchor);
  }

  function navigateCalendar(direction: -1 | 1) {
    const nextAnchor = calendarView === "month" || calendarView === "agenda"
      ? addMonths(calendarAnchor, direction)
      : addDays(calendarAnchor, calendarView === "week" ? direction * 7 : direction);
    setCalendarAnchor(nextAnchor);
    applyCalendarWindow(calendarView, nextAnchor);
  }

  function jumpCalendarToday() {
    const today = new Date();
    setCalendarAnchor(today);
    applyCalendarWindow(calendarView, today);
  }

  const sopTemplateMatchesTaskFilters = useCallback((template: SopTemplateRow) => {
    const priority = normalizePriority(template.priority);
    if (taskFilters.status !== "all" && taskFilters.status !== "todo") return false;
    if (taskFilters.priority !== "all" && priority !== taskFilters.priority) return false;
    if (taskFilters.category !== "all" && template.category !== taskFilters.category) return false;
    if (taskFilters.assignee !== "all" && (template.assigned_to || "Unassigned") !== taskFilters.assignee) return false;
    const search = taskFilters.search.trim().toLowerCase();
    if (search) {
      const haystack = [
        template.title,
        template.description,
        template.category,
        template.assigned_to,
        template.schedule_label,
        template.frequency,
      ].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  }, [taskFilters]);

  const paymentCalendarEvents = useMemo(() => visiblePayments
    .map((payment) => mapPaymentToCalendarEvent(payment, {
      amountLabel: money(payment.finalAmount),
      sourceLabel: sourceLabel(payment),
      date: paymentDate(payment),
      businessUnit: paymentUnit(payment),
    }))
    .filter((event) => event.start), [visiblePayments]);

  const taskCalendarEvents = useMemo(() => visibleTasks
    .map((task) => mapTaskToCalendarEvent(task))
    .filter((event) => event.start), [visibleTasks]);

  const existingSopOccurrenceKeys = useMemo(() => new Set(tasks.map(taskSopOccurrenceKey).filter((key): key is string => Boolean(key))), [tasks]);
  const existingSopTitleOccurrenceKeys = useMemo(() => new Set(tasks
    .filter((task) => {
      const metadata = task.metadata ?? {};
      return metadata.source === "recurring_instance" || typeof metadata.template_id === "string";
    })
    .map((task) => normalizedOccurrenceTitleKey(task.title, task.due_date, task.assignee))
    .filter((key): key is string => Boolean(key))), [tasks]);

  const sopOccurrenceEvents = useMemo(() => {
    const range = getCalendarRange(calendarView, calendarAnchor);
    const generatedTitleKeys = new Set<string>();
    return scopedSopTemplates
      .filter(sopTemplateMatchesTaskFilters)
      .flatMap((template) => mapSopTemplateToCalendarEvents(template, {
        start: range.start,
        end: range.end,
        excludedOccurrenceKeys: existingSopOccurrenceKeys,
      }))
      .filter((event) => {
        const titleKey = normalizedOccurrenceTitleKey(event.title, event.start, String(event.meta.assignee ?? ""));
        if (!titleKey) return true;
        if (existingSopTitleOccurrenceKeys.has(titleKey) || generatedTitleKeys.has(titleKey)) return false;
        generatedTitleKeys.add(titleKey);
        return true;
      });
  }, [calendarAnchor, calendarView, existingSopOccurrenceKeys, existingSopTitleOccurrenceKeys, scopedSopTemplates, sopTemplateMatchesTaskFilters]);

  function sopOccurrenceFromEvent(event: NormalizedCalendarEvent): SopOccurrence | null {
    const template = sopTemplates.find((item) => item.id === event.sourceId);
    if (!template || !event.start) return null;
    return {
      id: event.id,
      templateId: template.id,
      naturalKey: template.natural_key,
      title: template.title,
      description: template.description,
      category: template.category,
      priority: normalizePriority(template.priority),
      assignedTo: template.assigned_to,
      assignedRole: template.assigned_role ?? "Operations Manager",
      occurrenceDate: event.start,
      scheduleSummary: template.schedule_label,
      frequency: template.frequency,
      weekScope: template.week_scope,
      weekOfMonth: template.week_of_month,
      dayOfWeek: template.day_of_week,
      source: "sop_template",
      completionEmailEnabled: template.metadata?.notify_owner_on_completed !== false,
      assignmentEmailEnabled: false,
    };
  }

  function findExistingSopOccurrenceTask(occurrence: SopOccurrence) {
    const key = sopOccurrenceKey(occurrence.templateId, occurrence.occurrenceDate);
    return tasks.find((task) => taskSopOccurrenceKey(task) === key);
  }

  function openCalendarEventDetail(event: NormalizedCalendarEvent) {
    if (event.type === "task") {
      const task = tasks.find((item) => item.id === event.sourceId);
      if (task) {
        setSelectedPayment(null);
        setSelectedSopOccurrence(null);
        setSelectedTask(task);
      }
      return;
    }

    if (event.type === "sop") {
      const occurrence = sopOccurrenceFromEvent(event);
      if (!occurrence) return;
      const existingTask = findExistingSopOccurrenceTask(occurrence);
      setSelectedPayment(null);
      if (existingTask) {
        setSelectedSopOccurrence(null);
        setSelectedTask(existingTask);
      } else {
        setSelectedTask(null);
        setSelectedSopOccurrence(occurrence);
      }
      return;
    }

    if (event.type === "booking" || event.type === "payment") {
      const sourceType = String(event.meta.sourceType ?? "");
      const payment = payments.find((item) => item.id === event.sourceId && item.sourceType === sourceType);
      if (payment) {
        setSelectedTask(null);
        setSelectedSopOccurrence(null);
        setSelectedPayment(payment);
      }
      return;
    }
  }

  async function ensureSopOccurrenceTask(occurrence: SopOccurrence) {
    if (!userId) {
      setMessage("Task could not be created from SOP occurrence: missing signed-in user.");
      return null;
    }

    const existing = findExistingSopOccurrenceTask(occurrence);
    if (existing) return existing;

    const existingResult = await supabase
      .from("operation_tasks")
      .select("*")
      .eq("due_date", occurrence.occurrenceDate)
      .contains("metadata", { template_id: occurrence.templateId, occurrence_date: occurrence.occurrenceDate })
      .limit(1);

    if (existingResult.error) {
      setMessage(`SOP occurrence could not be checked: ${existingResult.error.message}`);
      return null;
    }

    const existingRow = (existingResult.data?.[0] ?? null) as OperationTaskRow | null;
    if (existingRow) {
      const mapped = mapTask(existingRow);
      setTasks((current) => current.some((task) => task.id === mapped.id) ? current : [...current, mapped]);
      return mapped;
    }

    const now = new Date().toISOString();
    const insertResult = await supabase.from("operation_tasks").insert({
      user_id: userId,
      title: occurrence.title,
      description: occurrence.description,
      priority: occurrence.priority,
      status: "todo",
      category: occurrence.category,
      due_date: occurrence.occurrenceDate,
      assignee: occurrence.assignedTo || null,
      assigned_by: "Monthly SOP template",
      panel: "Residential",
      business_unit: "residential",
      recurrence: "none",
      metadata: {
        source: "recurring_instance",
        template_id: occurrence.templateId,
        template_natural_key: occurrence.naturalKey,
        occurrence_date: occurrence.occurrenceDate,
        schedule_label: occurrence.scheduleSummary,
        notify_owner_on_completed: occurrence.completionEmailEnabled,
        notify_assignee_on_assignment: false,
      },
      created_at: now,
      updated_at: now,
    }).select("*").single();

    if (insertResult.error) {
      setMessage(`SOP occurrence could not be created: ${insertResult.error.message}`);
      return null;
    }

    await supabase.from("operation_task_audit_log").insert({
      task_id: insertResult.data.id,
      action: "task_created_from_sop_template",
      details: {
        templateId: occurrence.templateId,
        naturalKey: occurrence.naturalKey,
        occurrenceDate: occurrence.occurrenceDate,
        scheduleSummary: occurrence.scheduleSummary,
      },
    });

    const reloaded = await reloadTasks();
    return reloaded.find((task) => task.id === insertResult.data.id) ?? mapTask(insertResult.data as OperationTaskRow);
  }

  async function completeSopOccurrence(occurrence: SopOccurrence) {
    setCompletingTaskId(occurrence.id);
    const task = await ensureSopOccurrenceTask(occurrence);
    if (!task) {
      setCompletingTaskId(null);
      return;
    }
    setSelectedSopOccurrence(null);
    setSelectedTask(task);
    await completeTask(task);
    setCompletingTaskId(null);
  }

  async function editSopOccurrence(occurrence: SopOccurrence) {
    const task = await ensureSopOccurrenceTask(occurrence);
    if (!task) return;
    setSelectedSopOccurrence(null);
    openTaskDraft(task);
  }

  async function openSopOccurrenceTask(occurrence: SopOccurrence) {
    const task = await ensureSopOccurrenceTask(occurrence);
    if (!task) return;
    setSelectedSopOccurrence(null);
    setSelectedTask(task);
    router.replace(`/tasks?task=${encodeURIComponent(task.id)}&unit=residential`);
  }

  const canCreateForCurrentUnit = unit === "both"
    ? allowedUnits.some((allowedUnit) => canManageUnit(role, allowedUnit))
    : canManageUnit(role, unit);

  return (
    <DashboardShell userEmail="pristinecleanersoc@gmail.com">
      <div className="space-y-5">
        <PageHeader
          view={view}
          unit={unit}
          role={role}
          datePreset={datePreset}
          customStart={customStart}
          customEnd={customEnd}
          onUnitChange={updateUnit}
          onDatePresetChange={changeDatePreset}
          onCustomStartChange={changeCustomStart}
          onCustomEndChange={changeCustomEnd}
        />

        {message ? (
          <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-muted/35 px-3 py-2 text-sm font-bold">
            <span>{message}</span>
            <button type="button" aria-label="Dismiss message" onClick={() => setMessage(null)}><X className="size-4" /></button>
          </div>
        ) : null}

        {loading ? (
          <Card><CardContent className="p-8 text-center text-sm font-bold text-muted-foreground">Loading operations workspace...</CardContent></Card>
        ) : null}

        {!loading && view === "dashboard" ? renderDashboard() : null}
        {!loading && view === "tasks" ? renderTasks() : null}
        {!loading && view === "calendar" ? renderCalendar() : null}
        {!loading && view === "payments" ? renderPayments() : null}
        {!loading && view === "staff" ? renderStaff() : null}
        {!loading && view === "reports" ? renderReports() : null}
        {!loading && view === "settings" ? renderSettings() : null}
      </div>

      {taskDraft ? renderTaskModal() : null}
      {selectedTask ? renderTaskDetail() : null}
      {selectedSopOccurrence ? renderSopOccurrenceDetail() : null}
      {selectedPayment ? renderPaymentDetail() : null}
    </DashboardShell>
  );

  function renderDashboard() {
    const today = todayKey();
    const dueToday = scopedTasks.filter((task) => task.due_date?.slice(0, 10) === today && task.normalizedStatus !== "completed");
    const overdue = scopedTasks.filter((task) => task.due_date && task.due_date.slice(0, 10) < today && task.normalizedStatus !== "completed");
    const completedWeek = scopedTasks.filter((task) => task.normalizedStatus === "completed" && isWithinWindow(task.completed_at ?? task.updated_at ?? task.due_date, dateWindow.start, dateWindow.end));
    const scheduledPayments = visiblePayments.filter((payment) => payment.status !== "paid" && payment.status !== "locked");
    const needsReview = visiblePayments.filter((payment) => payment.requiresReview || payment.finalAmount === 0);
    const activeStaff = scopedStaff.filter((person) => person.status !== "Inactive");
    const todayOps = [
      ...dueToday.slice(0, 5).map((task) => ({ id: `task-${task.id}`, title: task.title, meta: `${businessUnitLabel(task.unit)} task · ${task.assignee || "Unassigned"}`, tone: "task" })),
      ...scheduledPayments.slice(0, 5).map((payment) => ({ id: `payment-${payment.sourceType}-${payment.id}`, title: `${payment.cleanerName} · ${money(payment.finalAmount)}`, meta: `${businessUnitLabel(paymentUnit(payment))} payment · ${sourceLabel(payment)}`, tone: "payment" })),
      ...scopedSopTemplates.slice(0, 4).map((template) => ({ id: `sop-${template.id}`, title: template.title, meta: `SOP · ${template.schedule_label}`, tone: "sop" })),
    ];

    return (
      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Clock} label="Tasks due today" value={dueToday.length} note="Open work due now" tone={dueToday.length ? "warn" : "neutral"} />
          <MetricCard icon={AlertTriangle} label="Overdue tasks" value={overdue.length} note="Needs escalation" tone={overdue.length ? "warn" : "good"} />
          <MetricCard icon={CheckCircle2} label="Completed this week" value={completedWeek.length} note={dateWindow.label} tone="good" />
          <MetricCard icon={CalendarDays} label="Scheduled jobs this week" value={scopedAccounts.length + scopedSopTemplates.length} note="Accounts plus SOP rhythm" />
          <MetricCard icon={WalletCards} label="Pending payments" value={money(scheduledPayments.reduce((sum, payment) => sum + payment.finalAmount, 0))} note={`${scheduledPayments.length} visible items`} />
          <MetricCard icon={BadgeCheck} label="Needs review" value={needsReview.length} note="Payments or payroll exceptions" tone={needsReview.length ? "warn" : "good"} />
          <MetricCard icon={Users} label="Active staff" value={activeStaff.length} note={`${BUSINESS_UNIT_LABELS[unit]} roster`} />
          <MetricCard icon={ClipboardCheck} label="Upcoming cleanings" value={scopedAccounts.length} note={unit === "residential" ? "Residential calendar data not configured yet" : "Commercial account schedule"} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
              <CardTitle>Today&apos;s Operations</CardTitle>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">Tasks, payment alerts, SOP rhythm, and staff notes for the current filter.</p>
              </div>
              <Button asChild variant="outline"><Link href={`/calendar?unit=${unit}`}>Open calendar</Link></Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {todayOps.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">No urgent operating items in this window.</div>
              ) : todayOps.map((item) => (
                <div className="flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-background/70 p-3" key={item.id}>
                  <div>
                    <p className="font-black">{item.title}</p>
                    <p className="mt-1 text-xs font-bold text-muted-foreground">{item.meta}</p>
                  </div>
                  <Badge variant="outline">{item.tone}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button disabled={!canCreateForCurrentUnit} onClick={() => openTaskDraft()}><Plus className="size-4" /> New task</Button>
              <Button asChild variant="outline"><Link href={`/tasks?unit=${unit}`}>Review task board</Link></Button>
              <Button asChild variant="outline"><Link href={`/payments?unit=${unit}`}>Open payments calendar</Link></Button>
              {unit !== "residential" ? <Button asChild variant="outline"><Link href="/payments?unit=commercial">Commercial payroll review</Link></Button> : null}
              {unit !== "commercial" ? <Button asChild variant="outline"><Link href="/payments?unit=residential">Residential payments review</Link></Button> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  function renderTasks() {
    const categories = Array.from(new Set([...scopedTasks.map((task) => task.category), ...scopedSopTemplates.map((template) => template.category)].filter(Boolean))).sort();
    const assigneeOptions = Array.from(new Set([...scopedTasks.map((task) => task.assignee ?? "Unassigned"), ...scopedSopTemplates.map((template) => template.assigned_to || "Unassigned")])).sort();
    const scheduledTaskCount = visibleTasks.filter((task) => task.due_date).length;
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/80 bg-card p-3">
          <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-muted-foreground">
            <span>{visibleTasks.length} tasks</span>
            <span>{scheduledTaskCount} scheduled</span>
            <span>{categories.length} categories</span>
            <span>{scopedSopTemplates.length} SOP templates</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ViewToggle
              label="Task view"
              value={taskView}
              onChange={setTaskView}
              options={[
                { value: "kanban", label: "Kanban" },
                { value: "calendar", label: "Calendar" },
                { value: "list", label: "List" },
              ]}
            />
            <Button disabled={!canCreateForCurrentUnit} onClick={() => openTaskDraft()}><Plus className="size-4" /> Create task</Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-9 w-full rounded-md border bg-background px-9 text-sm font-bold"
              value={taskFilters.search}
              onChange={(event) => setTaskFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Search tasks"
              aria-label="Search tasks"
            />
          </div>
          <select className="h-9 rounded-md border bg-background px-2 text-sm font-bold" value={taskFilters.status} onChange={(event) => setTaskFilters((current) => ({ ...current, status: event.target.value }))} aria-label="Task status filter">
            <option value="all">All statuses</option>
            {COLUMNS.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}
          </select>
          <select className="h-9 rounded-md border bg-background px-2 text-sm font-bold" value={taskFilters.priority} onChange={(event) => setTaskFilters((current) => ({ ...current, priority: event.target.value }))} aria-label="Task priority filter">
            <option value="all">All priorities</option>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="h-9 rounded-md border bg-background px-2 text-sm font-bold" value={taskFilters.category} onChange={(event) => setTaskFilters((current) => ({ ...current, category: event.target.value }))} aria-label="Task category filter">
            <option value="all">All categories</option>
            {categories.map((category) => <option key={category}>{category}</option>)}
          </select>
          <select className="h-9 rounded-md border bg-background px-2 text-sm font-bold" value={taskFilters.assignee} onChange={(event) => setTaskFilters((current) => ({ ...current, assignee: event.target.value }))} aria-label="Task assignee filter">
            <option value="all">All assignees</option>
            {assigneeOptions.map((assignee) => <option key={assignee}>{assignee}</option>)}
          </select>
          <Button variant="outline" onClick={() => setTaskFilters({ status: "all", priority: "all", category: "all", assignee: "all", search: "" })}><RotateCcw className="size-4" /> Clear</Button>
        </div>

        {taskView === "calendar" ? (
          <div className="space-y-3">
            <CalendarToolbar viewMode={calendarView} anchor={calendarAnchor} onViewModeChange={changeCalendarView} onNavigate={navigateCalendar} onToday={jumpCalendarToday} />
            <OperationsCalendar events={[...taskCalendarEvents, ...sopOccurrenceEvents]} viewMode={calendarView} anchor={calendarAnchor} emptyMessage="No scheduled tasks match these filters." onEventSelect={openCalendarEventDetail} />
          </div>
        ) : null}

        {taskView === "kanban" ? (
          <div className="grid gap-3 xl:grid-cols-5">
            {COLUMNS.map((column) => {
              const columnTasks = visibleTasks.filter((task) => task.normalizedStatus === column.id);
              return (
                <section className="min-h-[340px] rounded-lg border border-border/80 bg-card/80 p-3" key={column.id}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-black">{column.label}</h2>
                      <p className="text-xs font-semibold text-muted-foreground">{column.helper}</p>
                    </div>
                    <Badge variant="outline">{columnTasks.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {columnTasks.length === 0 ? <div className="rounded-md border border-dashed border-border p-4 text-center text-xs font-bold text-muted-foreground">No tasks here.</div> : null}
                    {columnTasks.map((task) => (
                      <TaskCard task={task} key={task.id} onSelect={setSelectedTask} onComplete={completeTask} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : null}

        {taskView === "list" ? (
          <Card>
            <CardContent className="grid gap-2 p-4">
              {visibleTasks.length === 0 ? <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm font-bold text-muted-foreground">No tasks match these filters.</div> : null}
              {visibleTasks.map((task) => (
                <button
                  type="button"
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/75 p-3 text-left transition hover:border-primary/30 hover:bg-accent/25"
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <UnitBadge unit={task.unit} />
                      <Badge variant="outline">{statusLabel(task.normalizedStatus)}</Badge>
                      <Badge variant="outline">{PRIORITY_LABELS[task.normalizedPriority]}</Badge>
                      <Badge variant="outline">{task.category}</Badge>
                    </div>
                    <p className="mt-2 font-black">{task.title || "Untitled task"}</p>
                    <p className="text-xs font-bold text-muted-foreground">{task.assignee || "Unassigned"} · {displayDate(task.due_date)}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground">
                    <span className="flex items-center gap-1"><MessageSquare className="size-3.5" /> {task.commentsCount}</span>
                    <span className="flex items-center gap-1"><Paperclip className="size-3.5" /> {task.attachmentsCount}</span>
                    {task.normalizedStatus === "completed" ? <Check className="size-4 text-emerald-600" /> : null}
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {scopedSopTemplates.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Residential SOP Templates</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {scopedSopTemplates.slice(0, 12).map((template) => (
                <article className="rounded-lg border border-border/80 bg-background/70 p-3" key={template.id}>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 text-sm font-black">{template.title}</h3>
                    <UnitBadge unit="residential" />
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs font-semibold text-muted-foreground">{template.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge variant="outline">{template.schedule_label}</Badge>
                    <Badge variant="outline">{template.frequency}</Badge>
                    <Badge variant="outline">{template.assigned_to}</Badge>
                  </div>
                </article>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    );
  }

  function calendarEvents() {
    return [...taskCalendarEvents, ...paymentCalendarEvents, ...sopOccurrenceEvents];
  }

  function renderCalendar() {
    const events = calendarEvents();
    const categories = Array.from(new Set([...scopedTasks.map((task) => task.category), ...scopedSopTemplates.map((template) => template.category)].filter(Boolean))).sort();
    const assigneeOptions = Array.from(new Set([...scopedTasks.map((task) => task.assignee ?? "Unassigned"), ...scopedSopTemplates.map((template) => template.assigned_to || "Unassigned")])).sort();
    return (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard icon={CalendarDays} label="Calendar items" value={events.length} />
          <MetricCard icon={CheckSquare} label="Tasks" value={taskCalendarEvents.length} />
          <MetricCard icon={WalletCards} label="Payments" value={paymentCalendarEvents.length} />
          <MetricCard icon={ClipboardCheck} label="SOP occurrences" value={sopOccurrenceEvents.length} />
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-9 w-full rounded-md border bg-background px-9 text-sm font-bold"
              value={taskFilters.search}
              onChange={(event) => setTaskFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Search tasks and SOP"
              aria-label="Search calendar tasks and SOP"
            />
          </div>
          <select className="h-9 rounded-md border bg-background px-2 text-sm font-bold" value={taskFilters.status} onChange={(event) => setTaskFilters((current) => ({ ...current, status: event.target.value }))} aria-label="Calendar task status filter">
            <option value="all">All statuses</option>
            {COLUMNS.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}
          </select>
          <select className="h-9 rounded-md border bg-background px-2 text-sm font-bold" value={taskFilters.priority} onChange={(event) => setTaskFilters((current) => ({ ...current, priority: event.target.value }))} aria-label="Calendar priority filter">
            <option value="all">All priorities</option>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="h-9 rounded-md border bg-background px-2 text-sm font-bold" value={taskFilters.category} onChange={(event) => setTaskFilters((current) => ({ ...current, category: event.target.value }))} aria-label="Calendar category filter">
            <option value="all">All categories</option>
            {categories.map((category) => <option key={category}>{category}</option>)}
          </select>
          <select className="h-9 rounded-md border bg-background px-2 text-sm font-bold" value={taskFilters.assignee} onChange={(event) => setTaskFilters((current) => ({ ...current, assignee: event.target.value }))} aria-label="Calendar assignee filter">
            <option value="all">All assignees</option>
            {assigneeOptions.map((assignee) => <option key={assignee}>{assignee}</option>)}
          </select>
          <Button variant="outline" onClick={() => setTaskFilters({ status: "all", priority: "all", category: "all", assignee: "all", search: "" })}><RotateCcw className="size-4" /> Clear filters</Button>
        </div>
        <CalendarToolbar viewMode={calendarView} anchor={calendarAnchor} onViewModeChange={changeCalendarView} onNavigate={navigateCalendar} onToday={jumpCalendarToday} />
        <OperationsCalendar events={events} viewMode={calendarView} anchor={calendarAnchor} emptyMessage="No calendar items match this period." onEventSelect={openCalendarEventDetail} />
      </div>
    );
  }

  function renderPayments() {
    const cleanerOptions = Array.from(new Set(scopedPayments.map((payment) => payment.cleanerName).filter(Boolean))).sort();
    const accountOptions = Array.from(new Set(scopedPayments.map((payment) => payment.accountName).filter(Boolean) as string[])).sort();
    const sourceOptions = Array.from(new Set(scopedPayments.map((payment) => payment.sourceType))).sort();
    const commercialOnlyActive = paymentFilters.commercialOnly && unit !== "residential";
    const resetPaymentFilters = () => setPaymentFilters({ status: "all", cleaner: "all", account: "all", source: "all", needsReview: false, search: "", commercialOnly: true });

    return (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard icon={WalletCards} label="Visible payments" value={visiblePayments.length} />
          <MetricCard icon={BadgeCheck} label="Approved" value={visiblePayments.filter((payment) => payment.status === "approved").length} />
          <MetricCard icon={CheckCircle2} label="Paid / locked" value={visiblePayments.filter((payment) => payment.status === "paid" || payment.status === "locked").length} tone="good" />
          <MetricCard icon={AlertTriangle} label="Needs review" value={visiblePayments.filter((payment) => payment.requiresReview || payment.finalAmount === 0).length} tone="warn" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/80 bg-card p-3">
          <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-muted-foreground">
            <span>{paymentCalendarEvents.length} calendar items</span>
            <span>{visiblePayments.filter((payment) => paymentUnit(payment) === "commercial").length} commercial</span>
            <span>{dateWindow.label}</span>
          </div>
          <ViewToggle
            label="Payment view"
            value={paymentView}
            onChange={setPaymentView}
            options={[
              { value: "calendar", label: "Calendar" },
              { value: "list", label: "List" },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
          <div className="relative min-w-64 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-9 w-full rounded-md border bg-background px-9 text-sm font-bold"
              value={paymentFilters.search}
              onChange={(event) => setPaymentFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Search account, cleaner, source"
              aria-label="Search payments"
            />
          </div>
          <select className="h-9 rounded-md border bg-background px-2 text-sm font-bold" value={paymentFilters.status} onChange={(event) => setPaymentFilters((current) => ({ ...current, status: event.target.value }))} aria-label="Payment status filter">
            <option value="all">All statuses</option>
            {["draft", "needs_review", "approved", "paid", "locked", "legacy"].map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
          </select>
          <select className="h-9 rounded-md border bg-background px-2 text-sm font-bold" value={paymentFilters.cleaner} onChange={(event) => setPaymentFilters((current) => ({ ...current, cleaner: event.target.value }))} aria-label="Cleaner filter">
            <option value="all">All cleaners</option>
            {cleanerOptions.map((cleaner) => <option key={cleaner}>{cleaner}</option>)}
          </select>
          <select className="h-9 rounded-md border bg-background px-2 text-sm font-bold" value={paymentFilters.account} onChange={(event) => setPaymentFilters((current) => ({ ...current, account: event.target.value }))} aria-label="Account filter">
            <option value="all">All accounts</option>
            {accountOptions.map((account) => <option key={account}>{account}</option>)}
          </select>
          <select className="h-9 rounded-md border bg-background px-2 text-sm font-bold" value={paymentFilters.source} onChange={(event) => setPaymentFilters((current) => ({ ...current, source: event.target.value }))} aria-label="Payment source filter">
            <option value="all">All sources</option>
            {sourceOptions.map((source) => <option key={source} value={source}>{sourceLabel({ sourceType: source } as UnifiedPayment)}</option>)}
          </select>
          <button className={cn("h-9 rounded-md border px-3 text-sm font-black disabled:opacity-50", commercialOnlyActive ? "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/35 dark:text-sky-100" : "bg-background text-muted-foreground")} type="button" disabled={unit === "residential"} onClick={() => setPaymentFilters((current) => ({ ...current, commercialOnly: !current.commercialOnly }))}>Only commercial</button>
          <button className={cn("h-9 rounded-md border px-3 text-sm font-black", paymentFilters.needsReview ? "border-amber-300 bg-amber-50 text-amber-800" : "bg-background text-muted-foreground")} type="button" onClick={() => setPaymentFilters((current) => ({ ...current, needsReview: !current.needsReview }))}>Needs review</button>
          <Button variant="outline" onClick={resetPaymentFilters}><RotateCcw className="size-4" /> Clear</Button>
        </div>

        {paymentView === "calendar" ? (
          <div className="space-y-3">
            <CalendarToolbar viewMode={calendarView} anchor={calendarAnchor} onViewModeChange={changeCalendarView} onNavigate={navigateCalendar} onToday={jumpCalendarToday} />
            <OperationsCalendar events={paymentCalendarEvents} viewMode={calendarView} anchor={calendarAnchor} emptyMessage="No commercial payments or bookings match these filters." onEventSelect={openCalendarEventDetail} />
          </div>
        ) : null}

        {paymentView === "list" ? (
          <Card>
            <CardContent className="grid gap-2 p-4">
              {visiblePayments.length === 0 ? <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm font-bold text-muted-foreground">No payments match these filters.</div> : null}
              {visiblePayments.map((payment) => (
                <button
                  type="button"
                  className="rounded-lg border border-border bg-background/75 p-3 text-left transition hover:border-primary/30 hover:bg-accent/25"
                  key={`${payment.sourceType}-${payment.id}`}
                  onClick={() => setSelectedPayment(payment)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <UnitBadge unit={paymentUnit(payment)} />
                        <Badge variant="outline">{statusLabel(payment.status)}</Badge>
                        <Badge variant="outline">{sourceLabel(payment)}</Badge>
                        {payment.synced ? <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Synced</Badge> : null}
                        {(payment.requiresReview || payment.finalAmount === 0) ? <Badge className="border-rose-200 bg-rose-50 text-rose-800">Needs Review</Badge> : null}
                      </div>
                      <p className="mt-2 font-black">{payment.accountName ?? payment.cleanerName}</p>
                      <p className="text-xs font-bold text-muted-foreground">{payment.cleanerName} · {displayDate(paymentDate(payment))}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-primary">{money(payment.finalAmount)}</p>
                      <p className="text-xs font-bold text-muted-foreground">{payment.paymentMethod ?? "No method"}</p>
                    </div>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {paymentView === "calendar" && visiblePayments.length === 0 ? <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm font-bold text-muted-foreground">No payments scheduled for this period.</div> : null}
      </div>
    );
  }

  function renderStaff() {
    const groups = [
      { key: "residential", title: "Residential Team", people: scopedStaff.filter((person) => staffUnit(person) === "residential" || staffUnit(person) === "both") },
      { key: "commercial", title: "Commercial Team", people: scopedStaff.filter((person) => staffUnit(person) === "commercial" || staffUnit(person) === "both") },
      { key: "operations", title: "Operations / Admin", people: scopedStaff.filter((person) => staffUnit(person) === "operations") },
      { key: "seo", title: "SEO / Marketing", people: staff.filter((person) => person.role.toLowerCase().includes("seo")) },
    ].filter((group) => unit === "both" ? group.people.length > 0 : group.key === unit || group.key === "operations");

    return (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard icon={Users} label="Visible staff" value={scopedStaff.length} />
          <MetricCard icon={UserRoundCheck} label="Active" value={scopedStaff.filter((person) => person.status !== "Inactive").length} tone="good" />
          <MetricCard icon={ShieldCheck} label="Operations leads" value={scopedStaff.filter((person) => staffUnit(person) === "operations").length} />
          <MetricCard icon={CheckSquare} label="Assigned tasks" value={visibleTasks.filter((task) => task.assignee).length} />
        </div>
        {groups.map((group) => (
          <Card key={group.key}>
            <CardHeader>
              <CardTitle>{group.title}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {group.people.map((person) => {
                const definition = getStaffRoleDefinition(person.name, person.role);
                const assignedCount = scopedTasks.filter((task) => (task.assignee ?? "").toLowerCase() === person.name.toLowerCase()).length;
                const upcomingCount = scopedTasks.filter((task) => (task.assignee ?? "").toLowerCase() === person.name.toLowerCase() && task.normalizedStatus !== "completed").length;
                return (
                  <article className="rounded-lg border border-border bg-background/70 p-4" key={person.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-black">{person.name}</h3>
                        <p className="mt-1 text-xs font-bold text-muted-foreground">{person.email}</p>
                      </div>
                      <Badge variant="outline">{person.status}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Badge variant="outline">{definition.displayRole}</Badge>
                      {staffUnit(person) === "both" ? <Badge className="border-amber-200 bg-amber-50 text-amber-900">Both</Badge> : staffUnit(person) === "operations" ? <Badge variant="outline">Operations</Badge> : <UnitBadge unit={staffUnit(person) as BusinessUnit} />}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-muted-foreground">
                      <span>{assignedCount} assigned tasks</span>
                      <span>{upcomingCount} upcoming</span>
                      <span>{definition.commercialPayrollEligible ? "Payroll eligible" : "Payroll protected"}</span>
                      <span>{definition.note ?? "No notes"}</span>
                    </div>
                  </article>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  function getReportRows() {
    const base = [
      ...visibleTasks.map((task) => ({
        unit: businessUnitLabel(task.unit),
        type: "Task",
        title: task.title,
        status: statusLabel(task.normalizedStatus),
        staff: task.assignee ?? "Unassigned",
        account: task.account_name ?? task.property_address ?? "",
        category: task.category,
        amount: "",
        date: task.due_date ?? "",
        notes: task.completion_notes ?? task.description ?? "",
      })),
      ...visiblePayments.map((payment) => ({
        unit: businessUnitLabel(paymentUnit(payment)),
        type: "Payment",
        title: sourceLabel(payment),
        status: statusLabel(payment.status),
        staff: payment.cleanerName,
        account: payment.accountName ?? "",
        category: payment.sourceType,
        amount: payment.finalAmount,
        date: paymentDate(payment),
        notes: getPaymentReviewReason(payment),
      })),
      ...scopedSopTemplates.map((template) => ({
        unit: "Residential",
        type: "SOP",
        title: template.title,
        status: template.status,
        staff: template.assigned_to,
        account: "",
        category: template.category,
        amount: "",
        date: template.schedule_label,
        notes: template.description ?? "",
      })),
    ];

    return base.filter((row) => {
      if (reportFilters.status !== "all" && row.status.toLowerCase() !== reportFilters.status.toLowerCase()) return false;
      if (reportFilters.staff !== "all" && row.staff !== reportFilters.staff) return false;
      if (reportFilters.category !== "all" && row.category !== reportFilters.category) return false;
      if (reportFilters.account !== "all" && row.account !== reportFilters.account) return false;
      if (reportFilters.type === "overdue_tasks") return row.type === "Task" && visibleTasks.some((task) => task.title === row.title && task.due_date && task.due_date < todayKey() && task.normalizedStatus !== "completed");
      if (reportFilters.type === "task_completion") return row.type === "Task";
      if (reportFilters.type === "commercial_payroll") return row.type === "Payment" && row.unit === "Commercial";
      if (reportFilters.type === "residential_payments") return row.type === "Payment" && row.unit === "Residential";
      if (reportFilters.type === "monthly_sop") return row.type === "SOP";
      if (reportFilters.type === "needs_review") return String(row.notes).toLowerCase().includes("review") || Number(row.amount) === 0;
      if (reportFilters.type === "staff_activity" || reportFilters.type === "cleaner_performance") return Boolean(row.staff);
      return true;
    });
  }

  async function exportReport(format: "xlsx" | "pdf") {
    const rows = getReportRows();
    const filenameBase = `pristine-report-${reportFilters.type}-${unit}-${fileDateStamp()}`;
    if (format === "xlsx") {
      const XLSX = await import("xlsx");
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
      XLSX.writeFile(workbook, `${filenameBase}.xlsx`);
      return;
    }

    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("Pristine Cleaners Operations Report", 14, 14);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Report: ${REPORT_LABELS[reportFilters.type]}`, 14, 22);
    doc.text(`Unit: ${BUSINESS_UNIT_LABELS[unit]} | Window: ${dateWindow.label} | Rows: ${rows.length}`, 14, 28);
    doc.setFont("helvetica", "bold");
    doc.text("Unit", 14, 40);
    doc.text("Type", 42, 40);
    doc.text("Title", 68, 40);
    doc.text("Status", 160, 40);
    doc.text("Staff", 198, 40);
    doc.text("Amount", 240, 40);
    let y = 48;
    doc.setFont("helvetica", "normal");
    for (const row of rows.slice(0, 32)) {
      if (y > 190) {
        doc.addPage();
        y = 18;
      }
      doc.text(String(row.unit).slice(0, 18), 14, y);
      doc.text(String(row.type).slice(0, 16), 42, y);
      doc.text(String(row.title).slice(0, 52), 68, y);
      doc.text(String(row.status).slice(0, 18), 160, y);
      doc.text(String(row.staff).slice(0, 24), 198, y);
      doc.text(typeof row.amount === "number" ? money(row.amount) : "-", 240, y);
      y += 7;
    }
    if (rows.length > 32) doc.text(`+ ${rows.length - 32} additional rows in XLSX export.`, 14, y + 4);
    doc.save(`${filenameBase}.pdf`);
  }

  function renderReports() {
    const rows = getReportRows();
    const staffOptions = Array.from(new Set([...tasks.map((task) => task.assignee ?? ""), ...payments.map((payment) => payment.cleanerName)].filter(Boolean))).sort();
    const accountOptions = Array.from(new Set([...tasks.map((task) => task.account_name ?? ""), ...payments.map((payment) => payment.accountName ?? "")].filter(Boolean))).sort();
    const categoryOptions = Array.from(new Set([...tasks.map((task) => task.category), ...payments.map((payment) => payment.sourceType)].filter(Boolean))).sort();

    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="flex flex-wrap items-end justify-between gap-3 p-4">
            <div className="flex flex-wrap gap-2">
              <select className="h-10 rounded-md border bg-background px-2 text-sm font-bold" value={reportFilters.type} onChange={(event) => setReportFilters((current) => ({ ...current, type: event.target.value as ReportType }))}>
                {Object.entries(REPORT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select className="h-10 rounded-md border bg-background px-2 text-sm font-bold" value={reportFilters.staff} onChange={(event) => setReportFilters((current) => ({ ...current, staff: event.target.value }))}>
                <option value="all">All staff</option>
                {staffOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
              <select className="h-10 rounded-md border bg-background px-2 text-sm font-bold" value={reportFilters.account} onChange={(event) => setReportFilters((current) => ({ ...current, account: event.target.value }))}>
                <option value="all">All accounts</option>
                {accountOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
              <select className="h-10 rounded-md border bg-background px-2 text-sm font-bold" value={reportFilters.category} onChange={(event) => setReportFilters((current) => ({ ...current, category: event.target.value }))}>
                <option value="all">All categories</option>
                {categoryOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => exportReport("xlsx")}><FileSpreadsheet className="size-4" /> XLSX</Button>
              <Button onClick={() => exportReport("pdf")}><FileDown className="size-4" /> PDF</Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard icon={FileText} label="Total rows" value={rows.length} />
          <MetricCard icon={CalendarDays} label="Date range" value={dateWindow.label} />
          <MetricCard icon={Filter} label="Unit" value={BUSINESS_UNIT_LABELS[unit]} />
          <MetricCard icon={Download} label="Exports" value="XLSX / PDF" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-black uppercase text-muted-foreground">
                  <th className="py-2">Unit</th><th>Type</th><th>Title</th><th>Status</th><th>Staff</th><th>Amount</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? <tr><td className="py-6 text-center font-bold text-muted-foreground" colSpan={7}>No report rows for the current filters.</td></tr> : null}
                {rows.slice(0, 20).map((row, index) => (
                  <tr className="border-b border-border/70" key={`${row.type}-${row.title}-${index}`}>
                    <td className="py-2">{row.unit}</td>
                    <td>{row.type}</td>
                    <td className="font-bold">{row.title}</td>
                    <td>{row.status}</td>
                    <td>{row.staff}</td>
                    <td>{typeof row.amount === "number" ? money(row.amount) : "-"}</td>
                    <td>{displayDate(String(row.date))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    );
  }

  function renderSettings() {
    const envRows = [
      { label: "APP_BASE_URL", configured: Boolean(envStatus?.appBaseUrl) },
      { label: "GMAIL_USER", configured: Boolean(envStatus?.gmailUser) },
      { label: "GMAIL_APP_PASSWORD", configured: Boolean(envStatus?.gmailPassword) },
      { label: "OWNER_GMAIL_USER", configured: Boolean(envStatus?.ownerGmailUser) },
      { label: "OWNER_GMAIL_APP_PASSWORD", configured: Boolean(envStatus?.ownerGmailPassword) },
      { label: "OWNER_EMAIL", configured: Boolean(envStatus?.ownerEmail) },
      { label: "OPERATIONS_MANAGER_EMAIL", configured: Boolean(envStatus?.operationsManagerEmail) },
      { label: "SEO_USER_EMAIL", configured: Boolean(envStatus?.seoUserEmail) },
    ];

    return (
      <div className="grid gap-4 xl:grid-cols-[1fr_.8fr]">
        <div className="space-y-4">
          {[
            { title: "General", rows: ["App/company basics", "Default business unit: Residential", "Date format: US", "Timezone: browser/local"] },
            { title: "Task Settings", rows: ["Categories stay module-owned", "Default priority: Standard", "Default notification controls live on each task", "Schedule settings use due dates and SOP templates"] },
            { title: "Staff Settings", rows: ["Roles: residential, commercial, mixed, operations", "Units: Residential / Commercial / Both", "Permissions respect Supabase role access"] },
            { title: "Payments Settings", rows: ["Residential weekly payments stay editable", "Commercial payroll approved/paid/locked rows are protected", "Lock and approval states are not recalculated here"] },
            { title: "Exports", rows: ["Report filename: pristine-report-{type}-{unit}-{date}", "XLSX for complete rows", "PDF for branded review summary"] },
            { title: "Security", rows: ["Route access is role gated", "Unit selector hides unavailable units", "Secrets show only configured/missing"] },
          ].map((section) => (
            <Card key={section.title}>
              <CardHeader><CardTitle>{section.title}</CardTitle></CardHeader>
              <CardContent className="grid gap-2">
                {section.rows.map((row) => <div className="rounded-md border border-border bg-background/70 px-3 py-2 text-sm font-bold text-muted-foreground" key={row}>{row}</div>)}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              {envRows.map((row) => (
                <div className="flex items-center justify-between rounded-md border border-border bg-background/70 px-3 py-2" key={row.label}>
                  <span className="text-sm font-black">{row.label}</span>
                  <Badge className={row.configured ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}>{row.configured ? "Configured" : "Missing"}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
            <CardContent>
              <form className="grid gap-3" onSubmit={updatePassword}>
                <label className="grid gap-1 text-sm font-bold">
                  New password
                  <input className="h-10 rounded-md border bg-background px-3" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
                </label>
                <label className="grid gap-1 text-sm font-bold">
                  Confirm password
                  <input className="h-10 rounded-md border bg-background px-3" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                </label>
                <Button type="submit"><LockKeyhole className="size-4" /> Update password</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  function renderTaskModal() {
    if (!taskDraft) return null;
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 backdrop-blur-sm" onClick={() => savingTask ? undefined : setTaskDraft(null)}>
        <form className="grid w-full max-w-2xl gap-3 rounded-lg border border-border bg-card p-5 shadow-2xl" onSubmit={saveTaskDraft} onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black">{taskDraft.id ? "Edit task" : "Create task"}</h2>
            <button type="button" aria-label="Close task modal" disabled={savingTask} onClick={() => setTaskDraft(null)}><X className="size-5" /></button>
          </div>
          {taskModalError ? <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">{taskModalError}</div> : null}
          <label className="grid gap-1 text-sm font-bold">Title<input className="h-10 rounded-md border bg-background px-3" value={taskDraft.title} onChange={(event) => setTaskDraft({ ...taskDraft, title: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-bold">Description<textarea className="min-h-24 rounded-md border bg-background p-3" value={taskDraft.description} onChange={(event) => setTaskDraft({ ...taskDraft, description: event.target.value })} /></label>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-sm font-bold">Unit<select className="h-10 rounded-md border bg-background px-3" value={taskDraft.unit} onChange={(event) => setTaskDraft({ ...taskDraft, unit: event.target.value as BusinessUnit })}>
              {allowedUnits.map((allowed) => <option key={allowed} value={allowed}>{BUSINESS_UNIT_LABELS[allowed]}</option>)}
              {role === "seo" ? <option value="seo">SEO</option> : null}
            </select></label>
            <label className="grid gap-1 text-sm font-bold">Status<select className="h-10 rounded-md border bg-background px-3" value={taskDraft.status} onChange={(event) => setTaskDraft({ ...taskDraft, status: event.target.value as TaskStatus })}>{COLUMNS.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-bold">Priority<select className="h-10 rounded-md border bg-background px-3" value={taskDraft.priority} onChange={(event) => setTaskDraft({ ...taskDraft, priority: event.target.value as Priority })}>{Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-bold">Category<input className="h-10 rounded-md border bg-background px-3" value={taskDraft.category} onChange={(event) => setTaskDraft({ ...taskDraft, category: event.target.value })} /></label>
            <label className="grid gap-1 text-sm font-bold">Assigned to<input className="h-10 rounded-md border bg-background px-3" value={taskDraft.assignee} onChange={(event) => setTaskDraft({ ...taskDraft, assignee: event.target.value })} /></label>
            <label className="grid gap-1 text-sm font-bold">Due date<input className="h-10 rounded-md border bg-background px-3" type="date" value={taskDraft.dueDate} onChange={(event) => setTaskDraft({ ...taskDraft, dueDate: event.target.value })} /></label>
          </div>
          <div className="flex flex-wrap gap-3 text-sm font-bold">
            <label className="flex items-center gap-2"><input type="checkbox" checked={taskDraft.notifyOwnerOnCompleted} onChange={(event) => setTaskDraft({ ...taskDraft, notifyOwnerOnCompleted: event.target.checked })} /> Notify owner when completed</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={taskDraft.notifyAssigneeOnAssigned} onChange={(event) => setTaskDraft({ ...taskDraft, notifyAssigneeOnAssigned: event.target.checked })} /> Notify assignee when assigned</label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={savingTask} onClick={() => setTaskDraft(null)}>Cancel</Button>
            <Button type="submit" disabled={savingTask}><Check className="size-4" /> {savingTask ? "Saving..." : "Save task"}</Button>
          </div>
        </form>
      </div>
    );
  }

  function renderPaymentDetail() {
    if (!selectedPayment) return null;
    const account = accounts.find((item) => (selectedPayment.accountId && item.id === selectedPayment.accountId) || (selectedPayment.accountName && item.name === selectedPayment.accountName));
    const isProtected = selectedPayment.status === "approved" || selectedPayment.status === "paid" || selectedPayment.status === "locked";
    const canMarkPaid = selectedPayment.sourceType === "legacy_payment" && selectedPayment.status !== "paid" && selectedPayment.status !== "locked";
    const title = selectedPayment.sourceType === "commercial_payroll" ? "Booking / Payment summary" : "Payment summary";
    const accountName = selectedPayment.accountName ?? account?.name ?? "Commercial account";
    const initial = (accountName || selectedPayment.cleanerName || "P").trim().charAt(0).toUpperCase();
    const hours = selectedPayment.adjustedHours ?? selectedPayment.baseHours ?? account?.hours;
    const protectedCopy = selectedPayment.sourceType === "commercial_payroll"
      ? "Commercial payroll entries are managed from the payroll period. Approved, paid, and locked payroll states stay protected here."
      : "Protected payment states are shown here and are not recalculated from the calendar.";

    function confirmMarkPaid() {
      if (!selectedPayment || !canMarkPaid) return;
      if (!window.confirm("Mark this payment as paid? This updates the payment status and paid date.")) return;
      markPaymentPaid(selectedPayment);
    }

    return (
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-auto border-l border-border bg-card shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-border bg-card/95 p-5 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-primary">{title}</p>
              <h2 className="mt-2 text-2xl font-black">{accountName}</h2>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">{selectedPayment.cleanerName} · {money(selectedPayment.finalAmount)}</p>
            </div>
            <button type="button" className="grid size-9 place-items-center rounded-md border border-border bg-background" aria-label="Close payment detail" onClick={() => setSelectedPayment(null)}><X className="size-5" /></button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <UnitBadge unit={paymentUnit(selectedPayment)} />
            <Badge variant="outline">{statusLabel(selectedPayment.status)}</Badge>
            <Badge variant="outline">{sourceLabel(selectedPayment)}</Badge>
            {selectedPayment.requiresReview || selectedPayment.finalAmount === 0 ? <Badge className="border-rose-200 bg-rose-50 text-rose-800">Needs Review</Badge> : null}
            {selectedPayment.status === "approved" ? <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Approved</Badge> : null}
            {selectedPayment.status === "paid" ? <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Paid</Badge> : null}
            {selectedPayment.status === "locked" ? <Badge className="border-slate-300 bg-slate-100 text-slate-800">Locked</Badge> : null}
            {selectedPayment.synced ? <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Synced</Badge> : null}
            {paymentUnit(selectedPayment) === "commercial" && selectedPayment.sourceType !== "commercial_payroll" ? <Badge className="border-sky-200 bg-sky-50 text-sky-800">Manual Commercial</Badge> : null}
          </div>
        </div>

        <div className="space-y-5 p-5">
          <section className="rounded-lg border border-border bg-background/60 p-4">
            <div className="flex items-start gap-3">
              <div className="grid size-14 shrink-0 place-items-center rounded-lg border border-border bg-card text-xl font-black text-primary">{initial}</div>
              <div className="min-w-0">
                <h3 className="font-black">{accountName}</h3>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">{account?.city ?? "Address not recorded"}</p>
                <div className="mt-3 grid gap-2 text-sm font-bold text-muted-foreground sm:grid-cols-2">
                  <span>Cleaner/team: {account?.cleaner_name ?? selectedPayment.cleanerName}</span>
                  <span>Payment method: {selectedPayment.paymentMethod ?? account?.payment_method ?? "Not recorded"}</span>
                  {selectedPayment.cleanerEmail ? <span>Cleaner email: {selectedPayment.cleanerEmail}</span> : null}
                  {account?.last_contact_date ? <span>Last contact: {displayDate(account.last_contact_date)}</span> : null}
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-3 font-black">Booking / payment details</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailField label="Payment ID" value={selectedPayment.id} />
              <DetailField label="Booking / source ID" value={selectedPayment.sourceId} />
              <DetailField label="Pay period" value={selectedPayment.periodStart || selectedPayment.periodEnd ? `${displayDate(selectedPayment.periodStart)} - ${displayDate(selectedPayment.periodEnd ?? selectedPayment.periodStart)}` : null} />
              <DetailField label="Service date" value={displayDate(paymentDate(selectedPayment))} />
              <DetailField label="Service" value={selectedPayment.paymentType ? statusLabel(selectedPayment.paymentType) : account?.pricing_model} />
              <DetailField label="Frequency" value={account?.frequency} />
              <DetailField label="Length / duration" value={hours ? `${hours} hours` : null} />
              <DetailField label="Professionals count" value={selectedPayment.cleanerName ? 1 : null} />
              <DetailField label="Assigned to" value={account?.cleaner_name ?? selectedPayment.cleanerName} />
              <DetailField label="Provider payment / amount" value={money(selectedPayment.finalAmount)} />
              <DetailField label="Final amount" value={money(selectedPayment.finalAmount)} />
              <DetailField label="Status" value={statusLabel(selectedPayment.status)} />
              <DetailField label="Source" value={sourceLabel(selectedPayment)} />
              <DetailField label="Payment method" value={selectedPayment.paymentMethod ?? account?.payment_method} />
              <DetailField label="Approved at" value={selectedPayment.approvedAt ? new Date(selectedPayment.approvedAt).toLocaleString() : null} />
              <DetailField label="Paid at" value={selectedPayment.paidAt ? new Date(selectedPayment.paidAt).toLocaleString() : null} />
            </div>
          </section>

          <section className="grid gap-3">
            {(selectedPayment.requiresReview || selectedPayment.finalAmount === 0 || selectedPayment.notes) ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 text-sm font-bold text-amber-950 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100">
                <p className="text-xs font-black uppercase">Review reason / notes</p>
                <p className="mt-2">{getPaymentReviewReason(selectedPayment)}</p>
              </div>
            ) : null}
            {isProtected || selectedPayment.sourceType === "commercial_payroll" ? (
              <div className="rounded-lg border border-slate-300 bg-slate-100 p-4 text-sm font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100">{protectedCopy}</div>
            ) : null}
          </section>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {selectedPayment.payPeriodId ? <Button asChild variant="outline"><Link href={`/commercial/payroll/${selectedPayment.payPeriodId}`}>Open full detail</Link></Button> : <Button asChild variant="outline"><Link href="/payments?unit=commercial">Open payments</Link></Button>}
            <Button disabled={!canMarkPaid} onClick={confirmMarkPaid}><CheckCircle2 className="size-4" /> Mark paid</Button>
            <Button variant="outline" onClick={() => setSelectedPayment(null)}>Close</Button>
          </div>
        </div>
      </aside>
    );
  }

  function renderSopOccurrenceDetail() {
    if (!selectedSopOccurrence) return null;
    const isCompleting = completingTaskId === selectedSopOccurrence.id;
    return (
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-auto border-l border-border bg-card shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-border bg-card/95 p-5 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-primary">Task summary</p>
              <div className="mt-2 flex items-start gap-3">
                <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-md border border-border bg-background text-muted-foreground">
                  <ClipboardCheck className="size-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-2xl font-black leading-tight">{selectedSopOccurrence.title}</h2>
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">{selectedSopOccurrence.description || "No description yet."}</p>
                </div>
              </div>
            </div>
            <button type="button" className="grid size-9 place-items-center rounded-md border border-border bg-background" aria-label="Close SOP occurrence detail" onClick={() => setSelectedSopOccurrence(null)}><X className="size-5" /></button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <UnitBadge unit="residential" />
            <Badge variant="outline">To Do</Badge>
            <Badge variant="outline">{PRIORITY_LABELS[selectedSopOccurrence.priority]}</Badge>
            <Badge variant="outline">{selectedSopOccurrence.category}</Badge>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <section>
            <h3 className="mb-3 font-black">Task info</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailField label="Template ID" value={selectedSopOccurrence.templateId} />
              <DetailField label="Business unit" value="Residential" />
              <DetailField label="Category" value={selectedSopOccurrence.category} />
              <DetailField label="Assigned to" value={selectedSopOccurrence.assignedTo || "Unassigned"} />
              <DetailField label="Due date / occurrence date" value={displayDate(selectedSopOccurrence.occurrenceDate)} />
              <DetailField label="Schedule summary" value={selectedSopOccurrence.scheduleSummary} />
              <DetailField label="Source" value="SOP template occurrence" />
              <DetailField label="Frequency" value={statusLabel(selectedSopOccurrence.frequency)} />
              <DetailField label="Notify owner when completed" value={selectedSopOccurrence.completionEmailEnabled ? "On" : "Off"} />
              <DetailField label="Notify assignee when assigned" value="Off" />
              <DetailField label="Comments count" value={0} />
              <DetailField label="Attachments count" value={0} />
            </div>
          </section>

          <section className="grid gap-3">
            <h3 className="font-black">Description / notes</h3>
            <div className="rounded-lg border border-border bg-background/75 p-4 text-sm font-semibold text-muted-foreground">{selectedSopOccurrence.description || "No description yet."}</div>
          </section>

          <section>
            <h3 className="font-black">Activity log</h3>
            <div className="mt-3 rounded-md border border-border bg-background/70 p-3 text-sm">
              <strong>Template Occurrence</strong>
              <p className="mt-1 text-xs font-bold text-muted-foreground">{selectedSopOccurrence.scheduleSummary} · {displayDate(selectedSopOccurrence.occurrenceDate)}</p>
            </div>
          </section>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button disabled={isCompleting} onClick={() => completeSopOccurrence(selectedSopOccurrence)}><Check className="size-4" /> {isCompleting ? "Completing..." : "Mark completed"}</Button>
            <Button variant="outline" onClick={() => editSopOccurrence(selectedSopOccurrence)}>Edit</Button>
            <Button variant="outline" onClick={() => openSopOccurrenceTask(selectedSopOccurrence)}>Open full task detail</Button>
            <Button variant="outline" onClick={() => setSelectedSopOccurrence(null)}>Close</Button>
          </div>
        </div>
      </aside>
    );
  }

  function renderTaskDetail() {
    if (!selectedTask) return null;
    const taskComments = comments.filter((comment) => comment.task_id === selectedTask.id);
    const taskAttachments = attachments.filter((attachment) => attachment.task_id === selectedTask.id);
    const taskActivity = activity.filter((item) => item.task_id === selectedTask.id);
    const isCompleted = selectedTask.normalizedStatus === "completed";
    const recurrence = selectedTask.recurrence && selectedTask.recurrence !== "none"
      ? selectedTask.recurrence === "custom" && selectedTask.custom_interval_days
        ? `Every ${selectedTask.custom_interval_days} day(s)`
        : statusLabel(selectedTask.recurrence)
      : "None";
    const metadata = selectedTask.metadata ?? {};
    const occurrenceDate = typeof metadata.occurrence_date === "string" ? metadata.occurrence_date : null;
    const scheduleSummary = typeof metadata.schedule_label === "string" ? metadata.schedule_label : selectedTask.due_date ? `Due ${displayDate(selectedTask.due_date)}` : "No due date";
    return (
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-auto border-l border-border bg-card shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-border bg-card/95 p-5 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-primary">Task summary</p>
              <div className="mt-2 flex items-start gap-3">
                <span className={cn("mt-1 grid size-8 shrink-0 place-items-center rounded-md border", isCompleted ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-border bg-background text-muted-foreground")}>
                  {isCompleted ? <Check className="size-4" /> : <CheckSquare className="size-4" />}
                </span>
                <div className="min-w-0">
                  <h2 className="text-2xl font-black leading-tight">{selectedTask.title}</h2>
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">{selectedTask.description || "No description yet."}</p>
                </div>
              </div>
            </div>
            <button type="button" className="grid size-9 place-items-center rounded-md border border-border bg-background" aria-label="Close task detail" onClick={() => setSelectedTask(null)}><X className="size-5" /></button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <UnitBadge unit={selectedTask.unit} />
            <Badge variant="outline">{statusLabel(selectedTask.normalizedStatus)}</Badge>
            <Badge variant="outline">{PRIORITY_LABELS[selectedTask.normalizedPriority]}</Badge>
            <Badge variant="outline">{selectedTask.category}</Badge>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <section>
            <h3 className="mb-3 font-black">Task info</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailField label="Task ID" value={selectedTask.id} />
              <DetailField label="Business unit" value={businessUnitLabel(selectedTask.unit)} />
              <DetailField label="Category" value={selectedTask.category} />
              <DetailField label="Assigned to" value={selectedTask.assignee || "Unassigned"} />
              <DetailField label="Created by" value={selectedTask.assigned_by ?? selectedTask.created_by} />
              <DetailField label="Due date" value={displayDate(selectedTask.due_date)} />
              <DetailField label="Occurrence date" value={occurrenceDate ? displayDate(occurrenceDate) : null} />
              <DetailField label="Schedule summary" value={scheduleSummary} />
              <DetailField label="Source" value={sourceLabelForTask(selectedTask)} />
              <DetailField label="Recurrence" value={recurrence} />
              <DetailField label="Notify owner when completed" value={selectedTask.notifyOwnerOnCompleted ? "On" : "Off"} />
              <DetailField label="Notify assignee when assigned" value={selectedTask.notifyAssigneeOnAssigned ? "On" : "Off"} />
              <DetailField label="Completed at" value={selectedTask.completed_at ? new Date(selectedTask.completed_at).toLocaleString() : null} />
              <DetailField label="Account / property" value={selectedTask.account_name ?? selectedTask.property_address} />
            </div>
          </section>

          <section className="grid gap-3">
            <h3 className="font-black">Description / notes</h3>
            <div className="rounded-lg border border-border bg-background/75 p-4 text-sm font-semibold text-muted-foreground">{selectedTask.description || "No description yet."}</div>
            {selectedTask.completion_notes ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-4 text-sm font-bold text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-100">
                <p className="text-xs font-black uppercase">Completion notes</p>
                <p className="mt-2">{selectedTask.completion_notes}</p>
              </div>
            ) : null}
          </section>

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard icon={MessageSquare} label="Comments" value={taskComments.length} />
            <MetricCard icon={Paperclip} label="Attachments" value={taskAttachments.length} />
            <MetricCard icon={Clock} label="Activity" value={taskActivity.length} />
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button disabled={isCompleted || completingTaskId === selectedTask.id} onClick={() => completeTask(selectedTask)}><Check className="size-4" /> {completingTaskId === selectedTask.id ? "Completing..." : "Mark completed"}</Button>
            <Button variant="outline" onClick={() => openTaskDraft(selectedTask)}>Edit</Button>
            <Button variant="outline" onClick={() => openTaskDraft(selectedTask)}>Reassign</Button>
            <Button asChild variant="outline"><Link href={`/tasks/${selectedTask.id}`}>Open full task detail</Link></Button>
            <Button variant="outline" onClick={() => setSelectedTask(null)}>Close</Button>
          </div>

          <section>
            <h3 className="font-black">Comments</h3>
            <form className="mt-2 flex gap-2" onSubmit={addComment}>
              <input className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm font-bold" value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="Add an operational note" />
              <Button type="submit">Post</Button>
            </form>
            <div className="mt-3 space-y-2">
              {taskComments.length === 0 ? <p className="rounded-md border border-dashed border-border p-3 text-sm font-bold text-muted-foreground">No comments yet.</p> : null}
              {taskComments.slice(0, 5).map((comment) => (
                <div className="rounded-md border border-border bg-background/70 p-3 text-sm" key={comment.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>{comment.author_name}</strong>
                    <span className="text-xs font-bold text-muted-foreground">{new Date(comment.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{comment.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="font-black">Attachments / evidence</h3>
            <label className="mt-2 inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-black">
              <Upload className="size-4" /> {uploading ? "Uploading..." : "Upload photo/evidence"}
              <input className="hidden" type="file" accept="image/*,application/pdf" disabled={uploading} onChange={(event) => uploadAttachment(event.target.files?.[0] ?? null)} />
            </label>
            <div className="mt-3 space-y-2">
              {taskAttachments.length === 0 ? <p className="rounded-md border border-dashed border-border p-3 text-sm font-bold text-muted-foreground">No evidence uploaded.</p> : null}
              {taskAttachments.map((attachment) => <a className="flex items-center justify-between rounded-md border border-border bg-background/70 p-3 text-sm font-bold" href={attachment.file_url ?? "#"} target="_blank" rel="noreferrer" key={attachment.id}><span>{attachment.file_name}</span><Paperclip className="size-4" /></a>)}
            </div>
          </section>

          <section>
            <h3 className="font-black">Activity log</h3>
            <div className="mt-3 space-y-2">
              {taskActivity.length === 0 ? <p className="rounded-md border border-dashed border-border p-3 text-sm font-bold text-muted-foreground">No activity yet.</p> : null}
              {taskActivity.slice(0, 8).map((item) => {
                const meta = activityMeta(item);
                return (
                  <div className="rounded-md border border-border bg-background/70 p-3 text-sm" key={item.id}>
                    <strong>{activityTitle(item)}</strong>
                    {meta ? <p className="mt-1 text-xs font-bold text-muted-foreground">{meta}</p> : null}
                    <p className="mt-1 text-xs font-bold text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </aside>
    );
  }
}
