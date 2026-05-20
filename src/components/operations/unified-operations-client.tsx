"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
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
  Settings2,
  ShieldCheck,
  Upload,
  UserRoundCheck,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
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

type UnifiedView = "dashboard" | "tasks" | "calendar" | "payments" | "staff" | "reports" | "settings";
type DatePreset = "today" | "week" | "month" | "custom";
type CalendarView = "month" | "week" | "day" | "agenda";
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
  gmailUser: boolean;
  ownerEmail: boolean;
  operationsManagerEmail: boolean;
  seoUserEmail: boolean;
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
  completion_notes?: string | null;
  completed_at?: string | null;
  reminder?: boolean | null;
  metadata?: Record<string, unknown> | null;
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
  status: string;
  priority: string;
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
  frequency?: string | null;
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
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function displayDate(value: string | null | undefined) {
  const date = parseDate(value);
  if (!date) return "No date";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

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
  if (!value) return false;
  const key = value.slice(0, 10);
  return key >= start && key <= end;
}

function normalizePriority(value: string | null | undefined): Priority {
  if (value === "urgent" || value === "high" || value === "low") return value;
  return "normal";
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
  const [datePreset, setDatePreset] = useState<DatePreset>("week");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const [calendarAnchor, setCalendarAnchor] = useState(() => new Date());
  const [selectedTask, setSelectedTask] = useState<UnifiedTask | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [paymentFilters, setPaymentFilters] = useState<PaymentFilters>({ status: "all", cleaner: "all", account: "all", source: "all", needsReview: false });
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
    if (datePreset === "custom" && !customStart && !customEnd) return true;
    return !task.due_date || isWithinWindow(task.due_date, dateWindow.start, dateWindow.end);
  }), [customEnd, customStart, datePreset, dateWindow.end, dateWindow.start, scopedTasks]);

  const scopedPayments = useMemo(() => payments.filter((payment) => {
    const paymentBusinessUnit = paymentUnit(payment);
    if (unit === "both") return allowedUnits.includes(paymentBusinessUnit);
    return paymentBusinessUnit === unit;
  }), [allowedUnits, payments, unit]);

  const visiblePayments = useMemo(() => scopedPayments.filter((payment) => {
    if (!isWithinWindow(paymentDate(payment), dateWindow.start, dateWindow.end)) return false;
    if (paymentFilters.status !== "all" && payment.status !== paymentFilters.status) return false;
    if (paymentFilters.cleaner !== "all" && payment.cleanerName !== paymentFilters.cleaner) return false;
    if (paymentFilters.account !== "all" && payment.accountName !== paymentFilters.account) return false;
    if (paymentFilters.source !== "all" && payment.sourceType !== paymentFilters.source) return false;
    if (paymentFilters.needsReview && !payment.requiresReview && payment.finalAmount !== 0) return false;
    return true;
  }), [dateWindow.end, dateWindow.start, paymentFilters, scopedPayments]);

  const scopedStaff = useMemo(() => staff.filter((person) => staffMatchesUnit(person, unit)), [staff, unit]);
  const scopedAccounts = useMemo(() => unit === "residential" ? [] : accounts.filter((account) => account.source_sheet !== "Team supplies"), [accounts, unit]);
  const scopedSopTemplates = useMemo(() => unit === "commercial" ? [] : sopTemplates.filter((template) => template.status !== "inactive"), [sopTemplates, unit]);

  async function reloadTasks() {
    const [taskResult, commentResult, attachmentResult] = await Promise.all([
      supabase.from("operation_tasks").select("*").order("due_date", { ascending: true, nullsFirst: false }).limit(800),
      supabase.from("operation_task_comments").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("operation_task_attachments").select("*").order("created_at", { ascending: false }).limit(1000),
    ]);
    const commentRows = (commentResult.data ?? []) as CommentRow[];
    const attachmentRows = (attachmentResult.data ?? []) as AttachmentRow[];
    const commentCounts = new Map<string, number>();
    const attachmentCounts = new Map<string, number>();
    for (const row of commentRows) commentCounts.set(row.task_id, (commentCounts.get(row.task_id) ?? 0) + 1);
    for (const row of attachmentRows) attachmentCounts.set(row.task_id, (attachmentCounts.get(row.task_id) ?? 0) + 1);
    setComments(commentRows);
    setAttachments(attachmentRows);
    setTasks(((taskResult.data ?? []) as OperationTaskRow[]).map((row) => mapTask(row, commentCounts.get(row.id) ?? 0, attachmentCounts.get(row.id) ?? 0)));
  }

  async function saveTaskDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!taskDraft || !userId || !taskDraft.title.trim()) return;
    const unitForTask = taskDraft.unit === "seo" ? "seo" : taskDraft.unit;
    const payload = {
      user_id: userId,
      title: taskDraft.title.trim(),
      description: taskDraft.description.trim() || null,
      priority: taskDraft.priority,
      status: dbStatusFromTaskStatus(taskDraft.status, unitForTask),
      category: taskDraft.category.trim() || "Operations",
      due_date: taskDraft.dueDate || null,
      assignee: taskDraft.assignee.trim() || null,
      assigned_by: "Pristine Operations",
      panel: unitForTask === "seo" ? "SEO" : businessUnitLabel(unitForTask),
      business_unit: unitForTask,
      metadata: {
        notify_owner_on_completed: taskDraft.notifyOwnerOnCompleted,
        notify_assignee_on_assignment: taskDraft.notifyAssigneeOnAssigned,
      },
      updated_at: new Date().toISOString(),
    };
    const previousAssignee = taskDraft.id ? tasks.find((task) => task.id === taskDraft.id)?.assignee : null;
    const result = taskDraft.id
      ? await supabase.from("operation_tasks").update(payload).eq("id", taskDraft.id).select("*").single()
      : await supabase.from("operation_tasks").insert({ ...payload, created_at: new Date().toISOString() }).select("*").single();

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (taskDraft.notifyAssigneeOnAssigned && previousAssignee !== taskDraft.assignee) {
      await notifyTask("task_assigned", result.data as OperationTaskRow);
    }

    setTaskDraft(null);
    await reloadTasks();
  }

  async function notifyTask(event: "task_assigned" | "task_completed", task: OperationTaskRow) {
    try {
      await fetch("/api/tasks/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event,
          actorName: "Pristine Operations",
          task: {
            id: task.id,
            title: task.title,
            category: task.category,
            priority: task.priority,
            dueDate: task.due_date,
            assignedBy: task.assigned_by,
            assignedTo: task.assignee,
            accountOrProperty: task.account_name || task.property_address || "Operations task",
            panel: task.panel,
            description: task.description,
            notes: task.description,
            status: task.status,
            completedAt: new Date().toISOString(),
            completionNotes: task.completion_notes || task.description,
          },
        }),
      });
    } catch (error) {
      console.warn("Task notification request failed", error);
    }
  }

  async function completeTask(task: UnifiedTask) {
    if (task.normalizedStatus === "completed") return;
    const completedAt = new Date().toISOString();
    const nextStatus = task.unit === "seo" ? "completed" : "done";
    const { error } = await supabase
      .from("operation_tasks")
      .update({ status: nextStatus, completed_at: completedAt, updated_at: completedAt })
      .eq("id", task.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (task.notifyOwnerOnCompleted) await notifyTask("task_completed", { ...task, status: nextStatus, completed_at: completedAt });
    await reloadTasks();
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
          onDatePresetChange={setDatePreset}
          onCustomStartChange={setCustomStart}
          onCustomEndChange={setCustomEnd}
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
    const categories = Array.from(new Set(scopedTasks.map((task) => task.category).filter(Boolean))).sort();
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/80 bg-card p-3">
          <div className="flex flex-wrap gap-2 text-sm font-bold text-muted-foreground">
            <span>{visibleTasks.length} tasks</span>
            <span>{categories.length} categories</span>
            <span>{scopedSopTemplates.length} SOP templates</span>
          </div>
          <Button disabled={!canCreateForCurrentUnit} onClick={() => openTaskDraft()}><Plus className="size-4" /> Create task</Button>
        </div>

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
    const taskEvents = scopedTasks.map((task) => ({
      id: `task-${task.id}`,
      date: task.due_date?.slice(0, 10) ?? "",
      title: task.title,
      type: "Task",
      unit: task.unit,
      status: task.normalizedStatus,
      assigned: task.assignee ?? "Unassigned",
      detail: task.account_name || task.property_address || task.category,
    }));
    const paymentEvents = scopedPayments.map((payment) => ({
      id: `payment-${payment.sourceType}-${payment.id}`,
      date: paymentDate(payment).slice(0, 10),
      title: `${payment.cleanerName} · ${money(payment.finalAmount)}`,
      type: "Payment",
      unit: paymentUnit(payment),
      status: payment.status,
      assigned: payment.cleanerName,
      detail: payment.accountName ?? sourceLabel(payment),
    }));
    const sopEvents = scopedSopTemplates.map((template) => ({
      id: `sop-${template.id}`,
      date: "",
      title: template.title,
      type: "SOP",
      unit: "residential" as const,
      status: template.frequency,
      assigned: template.assigned_to,
      detail: template.schedule_label,
    }));
    return [...taskEvents, ...paymentEvents, ...sopEvents].filter((event) => event.date ? isWithinWindow(event.date, dateWindow.start, dateWindow.end) : calendarView === "agenda");
  }

  function renderCalendar() {
    const events = calendarEvents();
    const monthStart = new Date(calendarAnchor.getFullYear(), calendarAnchor.getMonth(), 1);
    const gridStart = startOfWeek(monthStart);
    const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
    const anchorLabel = calendarAnchor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const viewEvents = calendarView === "agenda" ? events : events.filter((event) => event.date);

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/80 bg-card p-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => setCalendarAnchor(new Date(calendarAnchor.getFullYear(), calendarAnchor.getMonth() - 1, 1))}><ChevronLeft className="size-4" /></Button>
            <div className="min-w-44 text-center text-sm font-black">{anchorLabel}</div>
            <Button variant="outline" size="icon" aria-label="Next month" onClick={() => setCalendarAnchor(new Date(calendarAnchor.getFullYear(), calendarAnchor.getMonth() + 1, 1))}><ChevronRight className="size-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-1 rounded-md border border-border bg-background p-1">
            {(["month", "week", "day", "agenda"] as CalendarView[]).map((option) => (
              <button className={cn("rounded px-3 py-1.5 text-xs font-black capitalize text-muted-foreground", calendarView === option && "bg-primary text-primary-foreground")} key={option} type="button" onClick={() => setCalendarView(option)}>{option}</button>
            ))}
          </div>
        </div>

        {calendarView === "month" ? (
          <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-border bg-card">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div className="border-b border-border bg-muted/40 p-2 text-xs font-black text-muted-foreground" key={day}>{day}</div>)}
            {days.map((day) => {
              const key = formatDateKey(day);
              const dayEvents = viewEvents.filter((event) => event.date === key);
              return (
                <div className={cn("min-h-32 border-b border-r border-border p-2", day.getMonth() !== calendarAnchor.getMonth() && "bg-muted/20 text-muted-foreground")} key={key}>
                  <div className="text-xs font-black">{day.getDate()}</div>
                  <div className="mt-2 space-y-1">
                    {dayEvents.slice(0, 4).map((event) => (
                      <div className="truncate rounded border border-border bg-background px-2 py-1 text-[11px] font-bold" key={event.id}>
                        <span className="mr-1 text-primary">{event.type}</span>{event.title}
                      </div>
                    ))}
                    {dayEvents.length > 4 ? <div className="text-[11px] font-bold text-muted-foreground">+{dayEvents.length - 4} more</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{calendarView === "agenda" ? "Agenda" : `${statusLabel(calendarView)} view`}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {viewEvents.length === 0 ? <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm font-bold text-muted-foreground">No calendar items for this period.</div> : null}
              {viewEvents.map((event) => (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/70 p-3" key={event.id}>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{event.type}</Badge>
                      <UnitBadge unit={event.unit} />
                      <Badge variant="outline">{String(event.status).replace("_", " ")}</Badge>
                    </div>
                    <p className="mt-2 font-black">{event.title}</p>
                    <p className="text-xs font-bold text-muted-foreground">{event.assigned} · {event.detail}</p>
                  </div>
                  <div className="text-right text-sm font-black">{event.date ? displayDate(event.date) : event.detail}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  function renderPayments() {
    const cleanerOptions = Array.from(new Set(scopedPayments.map((payment) => payment.cleanerName).filter(Boolean))).sort();
    const accountOptions = Array.from(new Set(scopedPayments.map((payment) => payment.accountName).filter(Boolean) as string[])).sort();
    const sourceOptions = Array.from(new Set(scopedPayments.map((payment) => payment.sourceType))).sort();
    const byDate = new Map<string, UnifiedPayment[]>();
    for (const payment of visiblePayments) {
      const date = paymentDate(payment).slice(0, 10) || todayKey();
      byDate.set(date, [...(byDate.get(date) ?? []), payment]);
    }
    const start = parseDate(dateWindow.start) ?? new Date();
    const days = Array.from({ length: datePreset === "today" ? 1 : datePreset === "week" ? 7 : 35 }, (_, index) => addDays(start, index));

    return (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard icon={WalletCards} label="Visible payments" value={visiblePayments.length} />
          <MetricCard icon={BadgeCheck} label="Approved" value={visiblePayments.filter((payment) => payment.status === "approved").length} />
          <MetricCard icon={CheckCircle2} label="Paid / locked" value={visiblePayments.filter((payment) => payment.status === "paid" || payment.status === "locked").length} tone="good" />
          <MetricCard icon={AlertTriangle} label="Needs review" value={visiblePayments.filter((payment) => payment.requiresReview || payment.finalAmount === 0).length} tone="warn" />
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
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
          <button className={cn("h-9 rounded-md border px-3 text-sm font-black", paymentFilters.needsReview ? "border-amber-300 bg-amber-50 text-amber-800" : "bg-background text-muted-foreground")} type="button" onClick={() => setPaymentFilters((current) => ({ ...current, needsReview: !current.needsReview }))}>Needs review</button>
          <Button variant="outline" onClick={() => setPaymentFilters({ status: "all", cleaner: "all", account: "all", source: "all", needsReview: false })}><RotateCcw className="size-4" /> Clear</Button>
        </div>

        <div className="grid gap-3 lg:grid-cols-7">
          {days.map((day) => {
            const key = formatDateKey(day);
            const dayPayments = byDate.get(key) ?? [];
            return (
              <section className="min-h-44 rounded-lg border border-border bg-card p-3" key={key}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-black text-muted-foreground">{day.toLocaleDateString("en-US", { weekday: "short" })}</p>
                    <p className="text-sm font-black">{day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                  </div>
                  <Badge variant="outline">{dayPayments.length}</Badge>
                </div>
                <div className="space-y-2">
                  {dayPayments.map((payment) => (
                    <article className="rounded-md border border-border bg-background/75 p-2" key={`${payment.sourceType}-${payment.id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-black">{payment.cleanerName}</p>
                          <p className="text-[11px] font-bold text-muted-foreground">{payment.accountName ?? sourceLabel(payment)}</p>
                        </div>
                        <strong className="text-xs text-primary">{money(payment.finalAmount)}</strong>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <UnitBadge unit={paymentUnit(payment)} />
                        <Badge variant="outline">{statusLabel(payment.status)}</Badge>
                        <Badge variant="outline">{sourceLabel(payment)}</Badge>
                      </div>
                      {(payment.requiresReview || payment.finalAmount === 0) ? <p className="mt-2 text-[11px] font-bold text-amber-700">{getPaymentReviewReason(payment)}</p> : null}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {payment.payPeriodId ? <Button asChild size="sm" variant="outline"><Link href={`/commercial/payroll/${payment.payPeriodId}`}>Open</Link></Button> : null}
                        <Button size="sm" variant="outline" disabled={payment.status === "paid" || payment.status === "locked" || payment.sourceType === "commercial_payroll"} onClick={() => markPaymentPaid(payment)}>Mark paid</Button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
        {visiblePayments.length === 0 ? <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm font-bold text-muted-foreground">No payments scheduled for this period.</div> : null}
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
      { label: "GMAIL_USER", configured: Boolean(envStatus?.gmailUser) },
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
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 backdrop-blur-sm" onClick={() => setTaskDraft(null)}>
        <form className="grid w-full max-w-2xl gap-3 rounded-lg border border-border bg-card p-5 shadow-2xl" onSubmit={saveTaskDraft} onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black">{taskDraft.id ? "Edit task" : "Create task"}</h2>
            <button type="button" aria-label="Close task modal" onClick={() => setTaskDraft(null)}><X className="size-5" /></button>
          </div>
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
            <Button type="button" variant="outline" onClick={() => setTaskDraft(null)}>Cancel</Button>
            <Button type="submit"><Check className="size-4" /> Save task</Button>
          </div>
        </form>
      </div>
    );
  }

  function renderTaskDetail() {
    if (!selectedTask) return null;
    const taskComments = comments.filter((comment) => comment.task_id === selectedTask.id);
    const taskAttachments = attachments.filter((attachment) => attachment.task_id === selectedTask.id);
    const taskActivity = activity.filter((item) => item.task_id === selectedTask.id);
    return (
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-auto border-l border-border bg-card p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap gap-2"><UnitBadge unit={selectedTask.unit} /><Badge variant="outline">{statusLabel(selectedTask.normalizedStatus)}</Badge></div>
            <h2 className="mt-3 text-xl font-black">{selectedTask.title}</h2>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">{selectedTask.description || "No description yet."}</p>
          </div>
          <button type="button" aria-label="Close task detail" onClick={() => setSelectedTask(null)}><X className="size-5" /></button>
        </div>
        <div className="mt-4 grid gap-2 rounded-lg border border-border bg-background/70 p-3 text-sm font-bold">
          <span>Assigned to: {selectedTask.assignee || "Unassigned"}</span>
          <span>Schedule: {displayDate(selectedTask.due_date)}</span>
          <span>Category: {selectedTask.category}</span>
          <span>Notify owner: {selectedTask.notifyOwnerOnCompleted ? "On" : "Off"}</span>
          <span>Notify assignee: {selectedTask.notifyAssigneeOnAssigned ? "On" : "Off"}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => completeTask(selectedTask)}><Check className="size-4" /> Complete</Button>
          <Button variant="outline" onClick={() => openTaskDraft(selectedTask)}>Edit</Button>
        </div>
        <section className="mt-5">
          <h3 className="font-black">Comments</h3>
          <form className="mt-2 flex gap-2" onSubmit={addComment}>
            <input className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm font-bold" value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="Add an operational note" />
            <Button type="submit">Post</Button>
          </form>
          <div className="mt-3 space-y-2">
            {taskComments.map((comment) => <div className="rounded-md border border-border bg-background/70 p-3 text-sm" key={comment.id}><strong>{comment.author_name}</strong><p className="mt-1 text-muted-foreground">{comment.body}</p></div>)}
          </div>
        </section>
        <section className="mt-5">
          <h3 className="font-black">Attachments</h3>
          <label className="mt-2 inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-black">
            <Upload className="size-4" /> {uploading ? "Uploading..." : "Upload evidence"}
            <input className="hidden" type="file" accept="image/*,application/pdf" disabled={uploading} onChange={(event) => uploadAttachment(event.target.files?.[0] ?? null)} />
          </label>
          <div className="mt-3 space-y-2">
            {taskAttachments.map((attachment) => <a className="flex items-center justify-between rounded-md border border-border bg-background/70 p-3 text-sm font-bold" href={attachment.file_url ?? "#"} target="_blank" rel="noreferrer" key={attachment.id}><span>{attachment.file_name}</span><Paperclip className="size-4" /></a>)}
          </div>
        </section>
        <section className="mt-5">
          <h3 className="font-black">Activity log</h3>
          <div className="mt-3 space-y-2">
            {taskActivity.length === 0 ? <p className="rounded-md border border-dashed border-border p-3 text-sm font-bold text-muted-foreground">No activity yet.</p> : null}
            {taskActivity.slice(0, 8).map((item) => <div className="rounded-md border border-border bg-background/70 p-3 text-sm" key={item.id}><strong>{statusLabel(item.action)}</strong><p className="mt-1 text-xs font-bold text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p></div>)}
          </div>
        </section>
      </aside>
    );
  }
}
