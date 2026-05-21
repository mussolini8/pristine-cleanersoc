"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Edit3,
  FileSpreadsheet,
  FileText,
  Mail,
  PauseCircle,
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
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export type SimpleOperationsView = "dashboard" | "tasks" | "residential" | "staff" | "reports" | "settings";
type ResidentialTab = "accounts" | "work_logs" | "weekly_payments";
type TaskTab = "pending" | "completed" | "overdue" | "all";
type ReportKind = "tasks" | "hours" | "weekly_payments";
type WorkLogStatus = "pending" | "approved" | "paid";
type WeeklyPaymentStatus = "pending" | "paid";
type PaymentMode = "residential_only" | "mixed";
type MessageTone = "success" | "error" | "info";

type EnvStatus = {
  appBaseUrl: boolean;
  gmailUser: boolean;
  gmailPassword: boolean;
  ownerEmail: boolean;
  operationsManagerEmail: boolean;
};

type OperationTaskRow = {
  id: string;
  user_id?: string | null;
  title: string;
  description: string | null;
  priority: string | null;
  status: string | null;
  category: string | null;
  due_date: string | null;
  assignee: string | null;
  reminder?: boolean | null;
  recurrence?: string | null;
  custom_interval_days?: number | null;
  assigned_by?: string | null;
  panel?: string | null;
  business_unit?: string | null;
  completion_notes?: string | null;
  completed_at?: string | null;
  created_by?: string | null;
  completed_by?: string | null;
  deleted_at?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ActivityRow = {
  id: string;
  task_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

type ResidentialAccountRow = {
  id: string;
  user_id?: string | null;
  account_name: string;
  scheduled_hours: number | string | null;
  frequency: ResidentialFrequency | string | null;
  frequency_detail: string | null;
  day_of_week: string | null;
  assigned_team_id: string | null;
  assigned_team_name: string | null;
  active: boolean | null;
  notes: string | null;
  deleted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ResidentialWorkLogRow = {
  id: string;
  user_id?: string | null;
  account_id: string | null;
  account_name: string;
  team_id: string | null;
  team_name: string;
  work_date: string;
  hours_worked: number | string | null;
  notes: string | null;
  status: WorkLogStatus | string | null;
  deleted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ResidentialWeeklyPaymentRow = {
  id: string;
  user_id?: string | null;
  team_id: string | null;
  team_name: string;
  week_start: string;
  week_end: string;
  total_hours: number | string | null;
  hourly_rate: number | string | null;
  total_payment: number | string | null;
  status: WeeklyPaymentStatus | string | null;
  paid_at: string | null;
  notes: string | null;
  deleted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ResidentialWeeklyPaymentLineRow = {
  id: string;
  user_id?: string | null;
  cleaner_id: string | null;
  cleaner_name: string;
  work_date: string;
  city: string | null;
  payment_amount: number | string | null;
  residential_amount: number | string | null;
  commercial_amount: number | string | null;
  payment_type: "residential" | "commercial" | "mixed" | string | null;
  payment_mode?: PaymentMode | string | null;
  week_start: string;
  week_end: string;
  status: WeeklyPaymentStatus | string | null;
  notes: string | null;
  deleted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type StaffMemberRow = {
  id: string;
  user_id?: string | null;
  name: string;
  email: string | null;
  role: string | null;
  status: string | null;
  hourly_rate?: number | string | null;
  payment_mode?: PaymentMode | string | null;
  active?: boolean | null;
  deleted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type TaskDraft = {
  id?: string;
  title: string;
  description: string;
  assignee: ResidentialAssignee;
  dueDate: string;
  frequency: TaskReminderFrequency;
  customIntervalDays: string;
  priority: "low" | "normal" | "high" | "urgent";
  notifyAssignee: boolean;
  notifyOwnerOnCompletion: boolean;
};

type AccountDraft = {
  id?: string;
  accountName: string;
  scheduledHours: string;
  frequency: ResidentialFrequency;
  frequencyDetail: string;
  dayOfWeek: string;
  assignedTeamId: string;
  assignedTeamName: string;
  active: boolean;
  notes: string;
};

type WorkLogDraft = {
  accountId: string;
  teamId: string;
  workDate: string;
  hoursWorked: string;
  notes: string;
  status: WorkLogStatus;
};

type StaffDraft = {
  id?: string;
  name: string;
  email: string;
  role: string;
  hourlyRate: string;
  paymentMode: PaymentMode;
  active: boolean;
};

type PaymentRowDraft = {
  id?: string;
  cleanerId: string;
  cleanerName: string;
  workDate: string;
  city: string;
  paymentAmount: string;
  residentialAmount: string;
  commercialAmount: string;
  notes: string;
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
  hourlyRate: "",
  paymentMode: "residential_only",
  active: true,
};

const EMPTY_PAYMENT_ROW_DRAFT: PaymentRowDraft = {
  cleanerId: "",
  cleanerName: "",
  workDate: todayKey(),
  city: "",
  paymentAmount: "",
  residentialAmount: "",
  commercialAmount: "",
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

function taskIsOperationsReminder(task: OperationTaskRow) {
  const panel = String(task.panel ?? "").toLowerCase();
  const unit = String(task.business_unit ?? "").toLowerCase();
  return panel !== "seo" && panel !== "commercial" && unit !== "seo" && unit !== "commercial" && !task.deleted_at;
}

function staffIsActive(person: StaffMemberRow) {
  return person.active !== false && person.status !== "Inactive" && !person.deleted_at;
}

function isJuanRomero(name: string | null | undefined) {
  return String(name ?? "").trim().toLowerCase() === "juan romero";
}

function normalizePaymentMode(value: string | null | undefined, name: string | null | undefined): PaymentMode {
  if (value === "mixed" || isJuanRomero(name)) return "mixed";
  return "residential_only";
}

function isMixedPayCleaner(person: StaffMemberRow | null | undefined) {
  return normalizePaymentMode(person?.payment_mode, person?.name) === "mixed";
}

function isMixedPaySummary(summary: { team?: StaffMemberRow; teamName: string }) {
  return normalizePaymentMode(summary.team?.payment_mode, summary.teamName) === "mixed";
}

function teamKey(teamId: string | null | undefined, teamName: string) {
  return teamId || teamName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function makeTeamEmail(name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "") || "team";
  return `${slug}@pristine.local`;
}

function messageClass(tone: MessageTone) {
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50";
  if (tone === "error") return "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50";
  return "border-border bg-muted/35 text-foreground";
}

function actionLabel(action: string) {
  if (action === "task_assigned") return "Task assigned";
  if (action === "task_completed") return "Task completed";
  if (action === "task_deleted") return "Task deleted";
  if (action === "notification_sent") return "Notification sent";
  if (action === "notification_failed") return "Notification failed";
  if (action === "notification_skipped") return "Notification skipped";
  return action.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function dateRangeLabel(start: string, end: string) {
  return `${displayDate(start)} - ${displayDate(end)}`;
}

function paymentLineTotal(row: Pick<ResidentialWeeklyPaymentLineRow, "payment_amount" | "residential_amount" | "commercial_amount">) {
  return toNumber(row.payment_amount) + toNumber(row.residential_amount) + toNumber(row.commercial_amount);
}

function paymentSummaryStatus(summary: { rows: ResidentialWeeklyPaymentLineRow[]; payment?: ResidentialWeeklyPaymentRow }) {
  if (summary.rows.length > 0) return summary.rows.every((row) => row.status === "paid") ? "paid" : "pending";
  return summary.payment?.status === "paid" ? "paid" : "pending";
}

function isMissingSchemaTableError(error: { message?: string; code?: string } | null | undefined) {
  const message = String(error?.message ?? "").toLowerCase();
  return error?.code === "PGRST205" || (message.includes("schema cache") && message.includes("could not find the table"));
}

function MetricCard({
  icon: Icon,
  label,
  value,
  note,
  tone = "neutral",
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string | number;
  note?: string;
  tone?: "neutral" | "good" | "warn";
}) {
  return (
    <Card className={tone === "warn" ? "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/20" : tone === "good" ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20" : ""}>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-black leading-none">{value}</p>
          {note ? <p className="mt-2 text-xs font-semibold text-muted-foreground">{note}</p> : null}
        </div>
        <div className="grid size-9 shrink-0 place-items-center rounded-md border border-border/80 bg-background text-primary">
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  );
}

function PeriodSegment({ value, onChange }: { value: PeriodMode; onChange: (value: PeriodMode) => void }) {
  const options: { value: PeriodMode; label: string }[] = [
    { value: "week", label: "This week" },
    { value: "biweekly", label: "This biweekly" },
    { value: "month", label: "This month" },
  ];

  return (
    <div className="inline-flex rounded-md border border-border bg-background/80 p-1" aria-label="Calculation period">
      {options.map((option) => (
        <button
          type="button"
          className={cn(
            "rounded px-3 py-1.5 text-xs font-black text-muted-foreground transition hover:bg-accent hover:text-foreground",
            value === option.value && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
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

export function SimpleOperationsClient({
  view,
  envStatus,
  initialResidentialTab = "accounts",
}: {
  view: SimpleOperationsView;
  envStatus?: EnvStatus;
  initialResidentialTab?: ResidentialTab;
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
  const [staff, setStaff] = useState<StaffMemberRow[]>([]);
  const [taskTab, setTaskTab] = useState<TaskTab>("pending");
  const [taskSearch, setTaskSearch] = useState("");
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [selectedTask, setSelectedTask] = useState<OperationTaskRow | null>(null);
  const [savingTask, setSavingTask] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [residentialTab, setResidentialTab] = useState<ResidentialTab>(initialResidentialTab);
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
  const [savingPaymentKey, setSavingPaymentKey] = useState<string | null>(null);
  const [deletingPaymentRowId, setDeletingPaymentRowId] = useState<string | null>(null);
  const [showAllPaymentCleaners, setShowAllPaymentCleaners] = useState(true);
  const [reportKind, setReportKind] = useState<ReportKind>("tasks");

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    setUserId(user.id);
    setUserEmail(user.email ?? null);

    const [taskResult, activityResult, accountResult, workLogResult, weeklyPaymentResult, weeklyPaymentRowResult, staffResult] = await Promise.all([
      supabase.from("operation_tasks").select("*").order("due_date", { ascending: true, nullsFirst: false }).limit(1000),
      supabase.from("operation_task_audit_log").select("*").order("created_at", { ascending: false }).limit(1200),
      supabase.from("residential_recurring_cleaning_accounts").select("*").order("account_name").limit(1000),
      supabase.from("residential_work_logs").select("*").order("work_date", { ascending: false }).limit(1500),
      supabase.from("residential_weekly_payments").select("*").order("week_start", { ascending: false }).limit(800),
      supabase.from("residential_weekly_payment_rows").select("*").order("work_date", { ascending: true }).order("created_at", { ascending: true }).limit(2000),
      supabase.from("staff_members").select("*").order("name").limit(700),
    ]);

    const requiredErrors = [taskResult.error, activityResult.error, staffResult.error].filter(Boolean);
    const residentialTableErrors = [accountResult.error, workLogResult.error, weeklyPaymentResult.error, weeklyPaymentRowResult.error].filter(Boolean);
    const nonSetupResidentialErrors = residentialTableErrors.filter((error) => !isMissingSchemaTableError(error));
    const errors = [...requiredErrors, ...nonSetupResidentialErrors].map((error) => error?.message).filter(Boolean);
    const setupPending = residentialTableErrors.some(isMissingSchemaTableError);

    if (errors.length) {
      setMessage({
        tone: "error",
        text: `Some operations data could not load: ${errors.join(" | ")}`,
      });
    } else if (setupPending) {
      setMessage({
        tone: "info",
        text: "Residential payments database setup is pending. Apply the additive Supabase schema for residential accounts, work logs, weekly payments, and payment rows.",
      });
    }

    setTasks(((taskResult.data ?? []) as OperationTaskRow[]).filter(taskIsOperationsReminder));
    setActivity((activityResult.data ?? []) as ActivityRow[]);
    setAccounts(isMissingSchemaTableError(accountResult.error) ? [] : ((accountResult.data ?? []) as ResidentialAccountRow[]).filter((account) => !account.deleted_at));
    setWorkLogs(isMissingSchemaTableError(workLogResult.error) ? [] : ((workLogResult.data ?? []) as ResidentialWorkLogRow[]).filter((log) => !log.deleted_at));
    setWeeklyPayments(isMissingSchemaTableError(weeklyPaymentResult.error) ? [] : ((weeklyPaymentResult.data ?? []) as ResidentialWeeklyPaymentRow[]).filter((payment) => !payment.deleted_at));
    setWeeklyPaymentRows(isMissingSchemaTableError(weeklyPaymentRowResult.error) ? [] : ((weeklyPaymentRowResult.data ?? []) as ResidentialWeeklyPaymentLineRow[]).filter((row) => !row.deleted_at));
    setStaff((staffResult.data ?? []) as StaffMemberRow[]);
    setLoading(false);
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

  const filteredTasks = useMemo(() => {
    const search = taskSearch.trim().toLowerCase();
    return tasks.filter((task) => {
      const status = normalizeTaskStatus(task.status);
      const overdue = status === "pending" && Boolean(task.due_date && dateKeyFromValue(task.due_date) < today);
      if (taskTab === "pending" && (status !== "pending" || overdue)) return false;
      if (taskTab === "completed" && status !== "completed") return false;
      if (taskTab === "overdue" && !overdue) return false;
      if (search) {
        const haystack = [task.title, task.description, task.assignee, task.priority, task.recurrence].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [taskSearch, taskTab, tasks, today]);

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
  const weekRange = weekRangeFromStart(paymentWeekStart);
  const logsInPaymentWeek = useMemo(() => workLogs.filter((log) => isDateInRange(log.work_date, weekRange.start, weekRange.end)), [weekRange.end, weekRange.start, workLogs]);
  const paymentRowsInWeek = useMemo(() => weeklyPaymentRows.filter((row) => row.week_start === weekRange.start && row.week_end === weekRange.end), [weekRange.end, weekRange.start, weeklyPaymentRows]);

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
      const team = activeTeams.find((item) => item.id === teamId || item.name === teamName) ?? teamByKey.get(key) ?? teamByKey.get(teamName.toLowerCase());
      const current = map.get(key) ?? {
        key,
        teamId,
        teamName,
        totalHours: 0,
        accounts: new Set<string>(),
        logs: [],
        rows: [],
        residentialTotal: 0,
        commercialTotal: 0,
        paymentTotal: 0,
        team,
      };
      map.set(key, current);
      return current;
    }

    for (const team of activeTeams) {
      ensureSummary(team.id, team.name);
    }

    for (const log of logsInPaymentWeek) {
      const current = ensureSummary(log.team_id, log.team_name);
      current.totalHours = roundHours(current.totalHours + toNumber(log.hours_worked));
      current.accounts.add(log.account_name);
      current.logs.push(log);
    }

    for (const row of paymentRowsInWeek) {
      const current = ensureSummary(row.cleaner_id, row.cleaner_name);
      current.rows.push(row);
      current.residentialTotal = roundHours(current.residentialTotal + toNumber(row.residential_amount) + toNumber(row.payment_amount));
      current.commercialTotal = roundHours(current.commercialTotal + toNumber(row.commercial_amount));
      current.paymentTotal = roundHours(current.paymentTotal + paymentLineTotal(row));
    }

    for (const payment of weeklyPayments.filter((item) => item.week_start === weekRange.start)) {
      const current = ensureSummary(payment.team_id, payment.team_name);
      if (!current.totalHours) current.totalHours = toNumber(payment.total_hours);
      current.payment = payment;
    }

    return Array.from(map.values()).sort((a, b) => a.teamName.localeCompare(b.teamName));
  }, [activeTeams, logsInPaymentWeek, paymentRowsInWeek, teamByKey, weekRange.start, weeklyPayments]);

  const pendingPaymentTotal = useMemo(() => weeklyPaymentSummaries.reduce((sum, item) => {
    return paymentSummaryStatus(item) === "paid" ? sum : sum + item.paymentTotal;
  }, 0), [weeklyPaymentSummaries]);

  async function writeTaskAudit(taskId: string, action: string, details: Record<string, unknown>) {
    const { error } = await supabase.from("operation_task_audit_log").insert({
      task_id: taskId,
      action,
      details,
    });
    if (error) console.warn("Task audit write failed", error.message);
  }

  async function notifyTask(
    event: "task_assigned" | "task_completed",
    task: OperationTaskRow,
    enabled: boolean,
    actorName = "Pristine Operations",
  ) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12000);
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
          },
        }),
      });
      const data = await response.json().catch(() => null) as { notification?: { sent?: boolean; reason?: string; skipped?: boolean } } | null;
      if (!response.ok) return { sent: false, reason: `Notification request failed with HTTP ${response.status}` };
      return data?.notification ?? { sent: false, reason: "Notification service returned no status." };
    } catch (error) {
      const reason = error instanceof Error && error.name === "AbortError" ? "Notification request timed out." : error instanceof Error ? error.message : "Notification request failed.";
      await writeTaskAudit(task.id, "notification_failed", { event, reason });
      return { sent: false, reason };
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  function openTaskDraft(task?: OperationTaskRow) {
    if (!task) {
      setTaskDraft(EMPTY_TASK_DRAFT);
      return;
    }
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
    if (!taskDraft.title.trim()) {
      setMessage({ tone: "error", text: "Task could not be saved: title is required." });
      return;
    }

    setSavingTask(true);
    const now = new Date().toISOString();
    const previousTask = taskDraft.id ? tasks.find((task) => task.id === taskDraft.id) : null;
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
        task_scope: "residential_operations",
        frequency: taskDraft.frequency,
        notify_assignee_on_assignment: taskDraft.notifyAssignee,
        notify_owner_on_completed: taskDraft.notifyOwnerOnCompletion,
      },
      created_by: userId,
      updated_at: now,
    };

    try {
      const result = taskDraft.id
        ? await supabase.from("operation_tasks").update(payload).eq("id", taskDraft.id).select("*").single()
        : await supabase.from("operation_tasks").insert({ ...payload, created_at: now }).select("*").single();

      if (result.error) throw new Error(result.error.message);
      const savedTask = result.data as OperationTaskRow;
      const assigneeChanged = !previousTask || normalizeAssignee(previousTask.assignee) !== taskDraft.assignee;

      let feedback = "Task saved.";
      if (assigneeChanged) {
        const notification = await notifyTask("task_assigned", savedTask, taskDraft.notifyAssignee);
        if (taskDraft.notifyAssignee && notification.sent) feedback = "Task saved. Notification sent.";
        if (taskDraft.notifyAssignee && !notification.sent) feedback = `Task saved. Notification failed - ${notification.reason ?? "unknown reason"}`;
        if (!taskDraft.notifyAssignee) feedback = "Task saved. Notification skipped.";
      }

      setTaskDraft(null);
      setMessage({ tone: feedback.includes("failed") ? "error" : "success", text: feedback });
      await loadData();
    } catch (error) {
      setMessage({ tone: "error", text: `Task could not be saved: ${error instanceof Error ? error.message : "unexpected error"}` });
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
      const notification = await notifyTask("task_completed", completedTask, notifyOwner, actorName);
      const notificationText = notifyOwner && !notification.sent ? ` Notification failed - ${notification.reason ?? "unknown reason"}` : "";
      setMessage({ tone: notifyOwner && !notification.sent ? "error" : "success", text: `Task completed.${notificationText}` });
      await loadData();
    } catch (error) {
      setMessage({ tone: "error", text: `Task could not be completed: ${error instanceof Error ? error.message : "unexpected error"}` });
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
      setMessage({ tone: "error", text: `Task could not be deleted: ${error instanceof Error ? error.message : "unexpected error"}` });
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
    const selectedTeam = activeTeams.find((team) => team.id === accountDraft.assignedTeamId);
    const now = new Date().toISOString();
    const payload = {
      user_id: userId,
      account_name: accountDraft.accountName.trim(),
      scheduled_hours: Number(accountDraft.scheduledHours) || 0,
      frequency: accountDraft.frequency,
      frequency_detail: accountDraft.frequencyDetail.trim() || null,
      day_of_week: accountDraft.dayOfWeek || null,
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
      setAccountDraft(null);
      setMessage({ tone: "success", text: "Residential account saved." });
      await loadData();
    } catch (error) {
      setMessage({ tone: "error", text: `Residential account could not be saved: ${error instanceof Error ? error.message : "unexpected error"}` });
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
      setMessage({ tone: "error", text: `Account status could not be updated: ${error.message}` });
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
      setMessage({ tone: "error", text: `Residential account could not be deleted: ${error.message}` });
      return;
    }
    setMessage({ tone: "success", text: "Residential account deleted." });
    await loadData();
  }

  async function saveWorkLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || savingWorkLog) return;
    const account = accounts.find((item) => item.id === workLogDraft.accountId);
    const team = activeTeams.find((item) => item.id === workLogDraft.teamId);
    if (!account || !team || !workLogDraft.workDate || !Number(workLogDraft.hoursWorked)) {
      setMessage({ tone: "error", text: "Hours could not be saved: account, team, date, and hours are required." });
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
      setWorkLogDraft({ ...EMPTY_WORK_LOG_DRAFT, workDate: workLogDraft.workDate });
      setMessage({ tone: "success", text: "Hours saved." });
      await loadData();
    } catch (error) {
      setMessage({ tone: "error", text: `Hours could not be saved: ${error instanceof Error ? error.message : "unexpected error"}` });
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
      role: person.role ?? "Residential Cleaner / Team",
      hourlyRate: String(person.hourly_rate ?? ""),
      paymentMode: normalizePaymentMode(person.payment_mode, person.name),
      active: staffIsActive(person),
    });
  }

  async function saveStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!staffDraft || !userId || savingStaff) return;
    if (!staffDraft.name.trim()) {
      setMessage({ tone: "error", text: "Team could not be saved: name is required." });
      return;
    }
    const now = new Date().toISOString();
    const payload = {
      user_id: userId,
      name: staffDraft.name.trim(),
      email: staffDraft.email.trim() || makeTeamEmail(staffDraft.name),
      role: staffDraft.role.trim() || "Residential Cleaner / Team",
      display_role: staffDraft.role.trim() || "Residential Cleaner / Team",
      team_scope: "residential",
      hourly_rate: Number(staffDraft.hourlyRate) || null,
      payment_mode: isJuanRomero(staffDraft.name) ? "mixed" : staffDraft.paymentMode,
      active: staffDraft.active,
      status: staffDraft.active ? "Active" : "Inactive",
      commercial_payroll_eligible: false,
      updated_at: now,
    };
    setSavingStaff(true);
    try {
      const result = staffDraft.id
        ? await supabase.from("staff_members").update(payload).eq("id", staffDraft.id)
        : await supabase.from("staff_members").insert({ ...payload, created_at: now });
      if (result.error) throw new Error(result.error.message);
      setStaffDraft(null);
      setMessage({ tone: "success", text: "Team saved." });
      await loadData();
    } catch (error) {
      setMessage({ tone: "error", text: `Team could not be saved: ${error instanceof Error ? error.message : "unexpected error"}` });
    } finally {
      setSavingStaff(false);
    }
  }

  async function saveWeeklyPayment(summary: (typeof weeklyPaymentSummaries)[number], status: WeeklyPaymentStatus) {
    if (!userId || savingPaymentKey) return;
    const key = summary.key;
    const total = roundHours(summary.paymentTotal);
    const now = new Date().toISOString();
    setSavingPaymentKey(key);

    try {
      const payload = {
        user_id: userId,
        team_id: summary.teamId,
        team_name: summary.teamName,
        week_start: weekRange.start,
        week_end: weekRange.end,
        total_hours: summary.totalHours,
        hourly_rate: toNumber(summary.team?.hourly_rate),
        total_payment: total,
        status,
        paid_at: status === "paid" ? now : null,
        notes: summary.payment?.notes || null,
        updated_at: now,
      };
      const result = summary.payment
        ? await supabase.from("residential_weekly_payments").update(payload).eq("id", summary.payment.id)
        : await supabase.from("residential_weekly_payments").insert({ ...payload, created_at: now });
      if (result.error) throw new Error(result.error.message);

      if (summary.logs.length) {
        await supabase.from("residential_work_logs").update({ status, updated_at: now }).in("id", summary.logs.map((log) => log.id));
      }
      if (summary.rows.length) {
        await supabase.from("residential_weekly_payment_rows").update({ status, updated_at: now }).in("id", summary.rows.map((row) => row.id));
      }

      setMessage({ tone: "success", text: status === "paid" ? "Weekly payment marked as paid." : "Weekly payment marked as pending." });
      await loadData();
    } catch (error) {
      setMessage({ tone: "error", text: `Weekly payment could not be saved: ${error instanceof Error ? error.message : "unexpected error"}` });
    } finally {
      setSavingPaymentKey(null);
    }
  }

  function paymentDraftForSummary(summary: (typeof weeklyPaymentSummaries)[number]) {
    return paymentRowDrafts[summary.key] ?? {
      ...EMPTY_PAYMENT_ROW_DRAFT,
      cleanerId: summary.teamId ?? "",
      cleanerName: summary.teamName,
      workDate: weekRange.start,
    };
  }

  function setPaymentDraftForSummary(summary: (typeof weeklyPaymentSummaries)[number], draft: PaymentRowDraft) {
    setPaymentRowDrafts((current) => ({ ...current, [summary.key]: draft }));
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
        paymentAmount: row.payment_amount ? String(row.payment_amount) : "",
        residentialAmount: row.residential_amount ? String(row.residential_amount) : "",
        commercialAmount: row.commercial_amount ? String(row.commercial_amount) : "",
        notes: row.notes ?? "",
      },
    }));
  }

  async function savePaymentRow(summary: (typeof weeklyPaymentSummaries)[number]) {
    if (!userId || savingPaymentKey) return;
    const draft = paymentDraftForSummary(summary);
    const cleaner = summary.team ?? teamByKey.get(summary.key) ?? null;
    const mixed = normalizePaymentMode(cleaner?.payment_mode, summary.teamName) === "mixed";
    const paymentAmount = toNumber(draft.paymentAmount);
    const residentialAmount = toNumber(draft.residentialAmount);
    const commercialAmount = toNumber(draft.commercialAmount);

    if (!draft.workDate) {
      setMessage({ tone: "error", text: "Payment row could not be saved: date is required." });
      return;
    }
    if (!draft.city.trim()) {
      setMessage({ tone: "error", text: "Payment row could not be saved: city is required." });
      return;
    }
    if (paymentAmount < 0 || residentialAmount < 0 || commercialAmount < 0) {
      setMessage({ tone: "error", text: "Payment row could not be saved: amounts cannot be negative." });
      return;
    }
    if (!mixed && paymentAmount < 0) {
      setMessage({ tone: "error", text: "Payment row could not be saved: payment cannot be negative." });
      return;
    }
    if (mixed && residentialAmount === 0 && commercialAmount === 0) {
      setMessage({ tone: "error", text: "Juan's mixed pay row needs a residential or commercial amount." });
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
        payment_amount: mixed ? 0 : paymentAmount,
        residential_amount: mixed ? residentialAmount : 0,
        commercial_amount: mixed ? commercialAmount : 0,
        payment_type: mixed ? "mixed" : "residential",
        payment_mode: mixed ? "mixed" : "residential_only",
        week_start: weekRange.start,
        week_end: weekRange.end,
        status: "pending",
        notes: draft.notes.trim() || null,
        updated_at: now,
      };
      let result = draft.id
        ? await supabase.from("residential_weekly_payment_rows").update(payload).eq("id", draft.id)
        : await supabase.from("residential_weekly_payment_rows").insert({ ...payload, created_at: now });
      if (result.error && result.error.message.toLowerCase().includes("payment_mode")) {
        const { payment_mode: paymentModeSnapshot, ...fallbackPayload } = payload;
        void paymentModeSnapshot;
        result = draft.id
          ? await supabase.from("residential_weekly_payment_rows").update(fallbackPayload).eq("id", draft.id)
          : await supabase.from("residential_weekly_payment_rows").insert({ ...fallbackPayload, created_at: now });
      }
      if (result.error) throw new Error(result.error.message);
      setPaymentRowDrafts((current) => ({ ...current, [summary.key]: { ...EMPTY_PAYMENT_ROW_DRAFT, cleanerId: summary.teamId ?? "", cleanerName: summary.teamName, workDate: weekRange.start } }));
      setMessage({ tone: "success", text: "Payment row saved." });
      await loadData();
    } catch (error) {
      setMessage({ tone: "error", text: `Payment row could not be saved: ${error instanceof Error ? error.message : "unexpected error"}` });
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
      setWeeklyPaymentRows((current) => current.filter((item) => item.id !== row.id));
      setMessage({ tone: "success", text: "Payment row deleted." });
      await loadData();
    } catch (error) {
      setMessage({ tone: "error", text: `Payment row could not be deleted: ${error instanceof Error ? error.message : "unexpected error"}` });
    } finally {
      setDeletingPaymentRowId(null);
    }
  }

  async function exportRows(filename: string, rows: Record<string, string | number | null | undefined>[]) {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(workbook, filename);
  }

  async function exportWorkbook(filename: string, sheets: { name: string; rows: Record<string, string | number | null | undefined>[] }[]) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    for (const sheet of sheets) {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheet.rows), sheet.name);
    }
    XLSX.writeFile(workbook, filename);
  }

  async function exportCurrentReport() {
    await exportRows(`pristine-${reportKind}-${todayKey()}.xlsx`, getReportRows());
  }

  async function exportWeeklyPayments() {
    const residentialPaymentsTotal = weeklyPaymentSummaries.reduce((sum, summary) => {
      return sum + (isMixedPaySummary(summary) ? summary.residentialTotal : summary.paymentTotal);
    }, 0);
    const juanCommercialAddOn = weeklyPaymentSummaries.reduce((sum, summary) => {
      return isMixedPaySummary(summary) ? sum + summary.commercialTotal : sum;
    }, 0);
    const grandTotal = residentialPaymentsTotal + juanCommercialAddOn;
    const paidTotal = weeklyPaymentSummaries
      .filter((summary) => paymentSummaryStatus(summary) === "paid")
      .reduce((sum, summary) => sum + summary.paymentTotal, 0);
    const pendingTotal = grandTotal - paidTotal;
    const summaryRows = [
      { metric: "Week range", value: dateRangeLabel(weekRange.start, weekRange.end) },
      { metric: "Residential payments total", value: residentialPaymentsTotal },
      { metric: "Juan commercial add-on", value: juanCommercialAddOn },
      { metric: "Grand total", value: grandTotal },
      { metric: "Pending total", value: pendingTotal },
      { metric: "Paid total", value: paidTotal },
    ];
    const paymentRows = weeklyPaymentSummaries.flatMap((summary) => {
      const mixed = isMixedPaySummary(summary);
      if (summary.rows.length === 0) {
        return [{
          Cleaner: summary.teamName,
          Date: "",
          City: "",
          Payment: mixed ? "" : 0,
          Residential: mixed ? 0 : "",
          Commercial: mixed ? 0 : "",
          Total: 0,
          Status: summary.payment?.status ?? "pending",
        }];
      }
      return summary.rows.map((row) => ({
        Cleaner: summary.teamName,
        Date: row.work_date,
        City: row.city,
        Payment: mixed ? "" : toNumber(row.payment_amount),
        Residential: mixed ? toNumber(row.residential_amount) : "",
        Commercial: mixed ? toNumber(row.commercial_amount) : "",
        Total: paymentLineTotal(row),
        Status: row.status ?? summary.payment?.status ?? "pending",
      }));
    });
    await exportWorkbook(`weekly-residential-payments-${weekRange.start}.xlsx`, [
      { name: "Weekly Summary", rows: summaryRows },
      { name: "Payments by Cleaner", rows: paymentRows },
    ]);
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
          <div className={cn("flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm font-bold", messageClass(message.tone))}>
            <span>{message.text}</span>
            <button type="button" aria-label="Dismiss message" onClick={() => setMessage(null)}><X className="size-4" /></button>
          </div>
        ) : null}
        {loading ? <Card><CardContent className="p-8 text-center text-sm font-bold text-muted-foreground">Loading operations tracker...</CardContent></Card> : null}
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
    </DashboardShell>
  );

  function renderHeader() {
    const headers: Record<SimpleOperationsView, { title: string; sub: string; icon: typeof CheckCircle2 }> = {
      dashboard: { title: "Operations Dashboard", sub: "Reminders, residential hours, and weekly payments.", icon: CheckCircle2 },
      tasks: { title: "Task Reminders", sub: "Simple reminders for Jake Ivan-Pal and Carlos Lopez.", icon: Clock },
      residential: { title: "Residential Hours / Payments", sub: "Recurring cleanings, work logs, and weekly team payments.", icon: WalletCards },
      staff: { title: "Staff / Teams", sub: "Residential teams, rates, hours, and payment status.", icon: Users },
      reports: { title: "Reports", sub: "Task, hours, and residential weekly payment exports.", icon: FileText },
      settings: { title: "Settings", sub: "Notification configuration and residential operations defaults.", icon: Settings2 },
    };
    const meta = headers[view];
    const Icon = meta.icon;
    return (
      <section className="rounded-lg border border-border/80 bg-card p-5 shadow-[0_22px_60px_-52px_hsl(210_40%_20%)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-normal text-primary"><Icon className="size-4" /> Pristine Cleaners</p>
            <h1 className="mt-3 text-3xl font-black tracking-normal">{meta.title}</h1>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">{meta.sub}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {view === "tasks" ? <Button onClick={() => openTaskDraft()}><Plus className="size-4" /> Create task</Button> : null}
            {view === "residential" ? <Button onClick={() => openAccountDraft()}><Plus className="size-4" /> Add account</Button> : null}
            {view === "staff" ? <Button onClick={() => openStaffDraft()}><Plus className="size-4" /> Create team</Button> : null}
          </div>
        </div>
      </section>
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

    return (
      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Clock} label="Tasks due today" value={taskStats.dueToday.length} note={taskStats.dueToday.length ? "Needs attention today" : "No reminders due today."} tone={taskStats.dueToday.length ? "warn" : "good"} />
          <MetricCard icon={AlertTriangle} label="Overdue tasks" value={taskStats.overdue.length} note="Pending past due date" tone={taskStats.overdue.length ? "warn" : "good"} />
          <MetricCard icon={CheckCircle2} label="Completed this week" value={taskStats.completedThisWeek.length} note="Closed reminders" tone="good" />
          <MetricCard icon={BadgeCheck} label="Residential accounts active" value={activeAccounts.length} note="Recurring cleaning accounts" />
          <MetricCard icon={CalendarDays} label="Weekly scheduled hours" value={formatHours(accountTotals.weekly)} note="Approximate recurring hours" />
          <MetricCard icon={CalendarDays} label="Monthly scheduled hours" value={formatHours(accountTotals.monthly)} note="Uses 4.33 weeks/month" />
          <MetricCard icon={Users} label="This week worked hours" value={formatHours(workedThisWeek)} note={dateRangeLabel(currentWeek.start, currentWeek.end)} />
          <MetricCard icon={WalletCards} label="Pending residential payments" value={formatMoney(pendingPaymentTotal)} note="Open weekly payments" tone={pendingPaymentTotal ? "warn" : "good"} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Today&apos;s reminders</CardTitle>
              <Button asChild variant="outline" size="sm"><Link href="/tasks">Open reminders</Link></Button>
            </CardHeader>
            <CardContent className="grid gap-2">
              {taskStats.dueToday.length === 0 ? <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">No reminders due today.</div> : null}
              {taskStats.dueToday.slice(0, 6).map((task) => renderCompactTaskRow(task))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>This week residential hours</CardTitle>
              <Button asChild variant="outline" size="sm"><Link href="/residential">Open tracker</Link></Button>
            </CardHeader>
            <CardContent className="grid gap-2">
              {teamHours.length === 0 ? <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">No work hours logged in this period.</div> : null}
              {teamHours.slice(0, 5).map((team) => (
                <div className="flex items-center justify-between rounded-lg border border-border bg-background/70 p-3" key={team.key}>
                  <div>
                    <p className="font-black">{team.teamName}</p>
                    <p className="text-xs font-bold text-muted-foreground">{team.accounts.size} accounts worked</p>
                  </div>
                  <p className="text-lg font-black text-primary">{formatHours(team.totalHours)}h</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pending payments</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {weeklyPaymentSummaries.filter((summary) => summary.paymentTotal > 0 && summary.payment?.status !== "paid").length === 0 ? <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">No pending residential payments for the selected week.</div> : null}
              {weeklyPaymentSummaries.filter((summary) => summary.paymentTotal > 0 && summary.payment?.status !== "paid").slice(0, 5).map((summary) => {
                return (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-background/70 p-3" key={summary.key}>
                    <div>
                      <p className="font-black">{summary.teamName}</p>
                      <p className="text-xs font-bold text-muted-foreground">{summary.rows.length} payment rows</p>
                    </div>
                    <p className="font-black text-primary">{formatMoney(summary.paymentTotal)}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent completed tasks</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {recentCompleted.length === 0 ? <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">No completed reminders this week.</div> : null}
              {recentCompleted.map((task) => renderCompactTaskRow(task))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  function renderCompactTaskRow(task: OperationTaskRow) {
    return (
      <button
        type="button"
        className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background/70 p-3 text-left transition hover:border-primary/30 hover:bg-accent/25"
        key={task.id}
        onClick={() => setSelectedTask(task)}
      >
        <div className="min-w-0">
          <p className="truncate font-black">{task.title}</p>
          <p className="text-xs font-bold text-muted-foreground">{task.assignee ?? "Unassigned"} · {displayDate(task.due_date)}</p>
        </div>
        <Badge variant="outline">{normalizeTaskStatus(task.status)}</Badge>
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

    return (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard icon={Clock} label="Pending" value={taskStats.pending.length} />
          <MetricCard icon={AlertTriangle} label="Overdue" value={taskStats.overdue.length} tone={taskStats.overdue.length ? "warn" : "good"} />
          <MetricCard icon={CheckCircle2} label="Completed" value={taskStats.completed.length} tone="good" />
          <MetricCard icon={Mail} label="Assignees" value="Jake / Carlos" note="No commercial or SEO task fields" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
          <div className="inline-flex rounded-md border border-border bg-background/80 p-1">
            {(["pending", "overdue", "completed", "all"] as TaskTab[]).map((tab) => (
              <button
                type="button"
                className={cn("rounded px-3 py-1.5 text-xs font-black text-muted-foreground hover:bg-accent hover:text-foreground", taskTab === tab && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground")}
                key={tab}
                onClick={() => setTaskTab(tab)}
              >
                {tab.replace("_", " ")} ({tabCounts[tab]})
              </button>
            ))}
          </div>
          <div className="flex min-w-64 flex-1 justify-end gap-2">
            <input className="h-10 w-full max-w-md rounded-md border bg-background px-3 text-sm font-bold" placeholder="Search reminders" value={taskSearch} onChange={(event) => setTaskSearch(event.target.value)} />
            <Button variant="outline" onClick={() => { setTaskSearch(""); setTaskTab("pending"); }}><RotateCcw className="size-4" /> Clear</Button>
          </div>
        </div>

        <Card>
          <CardContent className="overflow-auto p-0">
            <table className="w-full min-w-[940px] text-sm">
              <thead>
                <tr className="border-b bg-muted/35 text-left text-xs font-black uppercase text-muted-foreground">
                  <th className="px-4 py-3">Task</th>
                  <th>Assigned to</th>
                  <th>Due date</th>
                  <th>Frequency</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th className="text-right pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 ? <tr><td className="px-4 py-8 text-center font-bold text-muted-foreground" colSpan={7}>No reminders match this view.</td></tr> : null}
                {filteredTasks.map((task) => {
                  const status = normalizeTaskStatus(task.status);
                  const overdue = status === "pending" && Boolean(task.due_date && dateKeyFromValue(task.due_date) < today);
                  return (
                    <tr className="border-b border-border/70" key={task.id}>
                      <td className="px-4 py-3">
                        <button type="button" className="text-left font-black hover:text-primary" onClick={() => setSelectedTask(task)}>{task.title}</button>
                        {task.description ? <p className="mt-1 line-clamp-1 text-xs font-semibold text-muted-foreground">{task.description}</p> : null}
                      </td>
                      <td className="font-bold">{task.assignee ?? "Unassigned"}</td>
                      <td>{displayDate(task.due_date)}</td>
                      <td>{TASK_FREQUENCY_LABELS[frequencyFromRecurrence(task.recurrence)]}</td>
                      <td><Badge className={overdue ? "border-amber-200 bg-amber-50 text-amber-900" : status === "completed" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : ""} variant="outline">{overdue ? "overdue" : status}</Badge></td>
                      <td>{task.priority ?? "normal"}</td>
                      <td className="pr-4">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" disabled={status === "completed" || completingTaskId === task.id} onClick={() => completeTask(task)}><Check className="size-4" /> {completingTaskId === task.id ? "Completing..." : "Complete"}</Button>
                          <Button size="icon" variant="outline" aria-label="Edit task" onClick={() => openTaskDraft(task)}><Edit3 className="size-4" /></Button>
                          <Button size="icon" variant="outline" aria-label="Delete task" disabled={deletingTaskId === task.id} onClick={() => deleteTask(task)}><Trash2 className="size-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reminder calendar</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-3">
            {["overdue", "today", "upcoming"].map((bucket) => {
              const rows = bucket === "overdue"
                ? taskStats.overdue
                : bucket === "today"
                  ? taskStats.dueToday
                  : taskStats.pending.filter((task) => task.due_date && dateKeyFromValue(task.due_date) > today).slice(0, 6);
              return (
                <section className="rounded-lg border border-border bg-background/60 p-3" key={bucket}>
                  <h3 className="text-sm font-black capitalize">{bucket}</h3>
                  <div className="mt-3 grid gap-2">
                    {rows.length === 0 ? <p className="rounded-md border border-dashed border-border p-3 text-xs font-bold text-muted-foreground">No reminders here.</p> : null}
                    {rows.slice(0, 6).map((task) => renderCompactTaskRow(task))}
                  </div>
                </section>
              );
            })}
          </CardContent>
        </Card>
      </div>
    );
  }

  function renderResidential() {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
          <div className="inline-flex rounded-md border border-border bg-background/80 p-1">
            {([
              ["accounts", "Scheduled accounts"],
              ["work_logs", "Work logs"],
              ["weekly_payments", "Weekly payments"],
            ] as [ResidentialTab, string][]).map(([tab, label]) => (
              <button
                type="button"
                className={cn("rounded px-3 py-1.5 text-xs font-black text-muted-foreground hover:bg-accent hover:text-foreground", residentialTab === tab && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground")}
                key={tab}
                onClick={() => setResidentialTab(tab)}
              >
                {label}
              </button>
            ))}
          </div>
          <PeriodSegment value={periodMode} onChange={setPeriodMode} />
        </div>
        {residentialTab === "accounts" ? renderAccounts() : null}
        {residentialTab === "work_logs" ? renderWorkLogs() : null}
        {residentialTab === "weekly_payments" ? renderWeeklyPayments() : null}
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
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Residential recurring cleaning accounts</CardTitle>
            <Badge variant="outline">{formatHours(selectedTotal)} hours in selected period</Badge>
          </CardHeader>
          <CardContent className="overflow-auto p-0">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="border-b bg-muted/35 text-left text-xs font-black uppercase text-muted-foreground">
                  <th className="px-4 py-3">Account name</th>
                  <th>Scheduled hours</th>
                  <th>Frequency</th>
                  <th>Total hours / week</th>
                  <th>Total hours / 2 weeks</th>
                  <th>Total hours / month</th>
                  <th>Assigned team</th>
                  <th>Status</th>
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
                        <p className="font-black">{account.account_name}</p>
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">This account contributes {formatHours(totals.monthly)} hours/month.</p>
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
                      <td><Badge variant="outline">{account.active === false ? "inactive" : "active"}</Badge></td>
                      <td className="pr-4">
                        <div className="flex justify-end gap-2">
                          <Button size="icon" variant="outline" aria-label="Edit account" onClick={() => openAccountDraft(account)}><Edit3 className="size-4" /></Button>
                          <Button size="icon" variant="outline" aria-label="Toggle account active" onClick={() => toggleAccount(account)}>{account.active === false ? <CheckCircle2 className="size-4" /> : <PauseCircle className="size-4" />}</Button>
                          <Button size="icon" variant="outline" aria-label="Delete account" onClick={() => deleteAccount(account)}><Trash2 className="size-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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

        <Card>
          <CardHeader>
            <CardTitle>Add work hours</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-5" onSubmit={saveWorkLog}>
              <label className="grid gap-1 text-sm font-bold">Account<select className="h-10 rounded-md border bg-background px-3" value={workLogDraft.accountId} onChange={(event) => setWorkLogDraft((current) => ({ ...current, accountId: event.target.value }))}>
                <option value="">Select account</option>
                {activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.account_name}</option>)}
              </select></label>
              <label className="grid gap-1 text-sm font-bold">Team<select className="h-10 rounded-md border bg-background px-3" value={workLogDraft.teamId} onChange={(event) => setWorkLogDraft((current) => ({ ...current, teamId: event.target.value }))}>
                <option value="">Select team</option>
                {activeTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select></label>
              <label className="grid gap-1 text-sm font-bold">Date<input className="h-10 rounded-md border bg-background px-3" type="date" value={workLogDraft.workDate} onChange={(event) => setWorkLogDraft((current) => ({ ...current, workDate: event.target.value }))} /></label>
              <label className="grid gap-1 text-sm font-bold">Hours worked<input className="h-10 rounded-md border bg-background px-3" inputMode="decimal" value={workLogDraft.hoursWorked} onChange={(event) => setWorkLogDraft((current) => ({ ...current, hoursWorked: event.target.value }))} /></label>
              <div className="flex items-end"><Button className="w-full" type="submit" disabled={savingWorkLog}><Save className="size-4" /> {savingWorkLog ? "Saving..." : "Save"}</Button></div>
              <label className="grid gap-1 text-sm font-bold md:col-span-4">Notes<input className="h-10 rounded-md border bg-background px-3" value={workLogDraft.notes} onChange={(event) => setWorkLogDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
              <label className="grid gap-1 text-sm font-bold">Status<select className="h-10 rounded-md border bg-background px-3" value={workLogDraft.status} onChange={(event) => setWorkLogDraft((current) => ({ ...current, status: event.target.value as WorkLogStatus }))}>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
              </select></label>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
          <Card>
            <CardHeader>
              <CardTitle>Total by team</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {teamHours.length === 0 ? <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">No team hours in this period.</div> : null}
              {teamHours.map((team) => (
                <div className="rounded-lg border border-border bg-background/70 p-3" key={team.key}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-black">{team.teamName}</p>
                      <p className="text-xs font-bold text-muted-foreground">{team.accounts.size} accounts worked</p>
                    </div>
                    <p className="text-lg font-black text-primary">{formatHours(team.totalHours)}h</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Work log entries</CardTitle>
            </CardHeader>
            <CardContent className="overflow-auto p-0">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/35 text-left text-xs font-black uppercase text-muted-foreground">
                    <th className="px-4 py-3">Date</th>
                    <th>Account</th>
                    <th>Team</th>
                    <th>Hours</th>
                    <th>Status</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {logsInPeriod.length === 0 ? <tr><td className="px-4 py-8 text-center font-bold text-muted-foreground" colSpan={6}>No work logs in this period.</td></tr> : null}
                  {logsInPeriod.map((log) => (
                    <tr className="border-b border-border/70" key={log.id}>
                      <td className="px-4 py-3">{displayDate(log.work_date)}</td>
                      <td className="font-bold">{log.account_name}</td>
                      <td>{log.team_name}</td>
                      <td>{formatHours(toNumber(log.hours_worked))}</td>
                      <td><Badge variant="outline">{log.status ?? "pending"}</Badge></td>
                      <td className="max-w-64 truncate text-muted-foreground">{log.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  function renderWeeklyPayments() {
    const weekStartDate = parseDateKey(paymentWeekStart) ?? startOfWeek(new Date());
    const residentialOnlyTotal = weeklyPaymentSummaries
      .filter((summary) => !isMixedPaySummary(summary))
      .reduce((sum, summary) => sum + summary.paymentTotal, 0);
    const juanResidentialTotal = weeklyPaymentSummaries
      .filter((summary) => isMixedPaySummary(summary))
      .reduce((sum, summary) => sum + summary.residentialTotal, 0);
    const juanCommercialTotal = weeklyPaymentSummaries
      .filter((summary) => isMixedPaySummary(summary))
      .reduce((sum, summary) => sum + summary.commercialTotal, 0);
    const weekTotal = residentialOnlyTotal + juanResidentialTotal + juanCommercialTotal;
    const paidTotal = weeklyPaymentSummaries
      .filter((summary) => paymentSummaryStatus(summary) === "paid")
      .reduce((sum, summary) => sum + summary.paymentTotal, 0);
    const pendingTotal = weekTotal - paidTotal;
    const displayedSummaries = showAllPaymentCleaners ? weeklyPaymentSummaries : weeklyPaymentSummaries.filter((summary) => summary.rows.length > 0);
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black tracking-normal">Weekly payments</h2>
              <p className="mt-1 text-sm font-bold text-muted-foreground">{dateRangeLabel(weekRange.start, weekRange.end)}</p>
            </div>
            <Button variant="outline" onClick={exportWeeklyPayments}><FileSpreadsheet className="size-4" /> Export weekly payments</Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="icon" variant="outline" aria-label="Previous week" onClick={() => setPaymentWeekStart(formatDateKey(addDays(weekStartDate, -7)))}><ChevronLeft className="size-4" /></Button>
            <div className="min-w-64 text-center text-sm font-black">{dateRangeLabel(weekRange.start, weekRange.end)}</div>
            <Button size="icon" variant="outline" aria-label="Next week" onClick={() => setPaymentWeekStart(formatDateKey(addDays(weekStartDate, 7)))}><ChevronRight className="size-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setPaymentWeekStart(formatDateKey(startOfWeek(new Date())))}>Current week</Button>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-5">
          <MetricCard icon={WalletCards} label="Residential payments" value={formatMoney(residentialOnlyTotal + juanResidentialTotal)} note="Normal cleaners plus Juan residential" />
          <MetricCard icon={WalletCards} label="Juan commercial add-on" value={formatMoney(juanCommercialTotal)} note="Simple mixed pay only" />
          <MetricCard icon={BadgeCheck} label="Grand total weekly payments" value={formatMoney(weekTotal)} />
          <MetricCard icon={Clock} label="Pending total" value={formatMoney(pendingTotal)} tone={pendingTotal ? "warn" : "good"} />
          <MetricCard icon={CheckCircle2} label="Paid total" value={formatMoney(paidTotal)} tone="good" />
        </div>

        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
            <div>
              <h3 className="text-xl font-black tracking-normal">Payment sheets by cleaner</h3>
              <p className="mt-1 text-sm font-bold text-muted-foreground">Each cleaner has a weekly spreadsheet. Only Juan Romero has Residential and Commercial columns.</p>
            </div>
            <label className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-black">
              <input type="checkbox" checked={showAllPaymentCleaners} onChange={(event) => setShowAllPaymentCleaners(event.target.checked)} />
              Show all cleaners
            </label>
          </div>
          {displayedSummaries.map((summary) => {
            const draft = paymentDraftForSummary(summary);
            const mixed = isMixedPaySummary(summary);
            const isPaid = paymentSummaryStatus(summary) === "paid";
            return (
              <Card className={cn("overflow-hidden rounded-md", mixed ? "border-amber-300 bg-amber-50/35 dark:border-amber-900 dark:bg-amber-950/15" : "border-border")} key={summary.key}>
                <CardHeader className="border-b border-border bg-background/80">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 items-stretch gap-4">
                      <div className={cn("grid min-h-32 w-28 shrink-0 place-items-center border text-center", mixed ? "border-amber-300 bg-amber-100 text-amber-950" : "border-border bg-card")}>
                        <span className="[writing-mode:vertical-rl] rotate-180 text-2xl font-black tracking-normal">{summary.teamName}</span>
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-3xl tracking-normal">{summary.teamName}</CardTitle>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge className={mixed ? "border-amber-300 bg-amber-100 text-amber-950" : ""} variant="outline">{mixed ? "Mixed pay: Residential + Commercial" : "Residential pay"}</Badge>
                          <Badge variant="outline">{isPaid ? "paid" : "pending"}</Badge>
                          <Badge variant="outline">{summary.rows.length} jobs</Badge>
                          {summary.totalHours ? <Badge variant="outline">{formatHours(summary.totalHours)} logged hours</Badge> : null}
                        </div>
                        {mixed ? <p className="mt-3 text-sm font-black text-amber-950 dark:text-amber-100">Juan Romero = Mixed pay: Residential + Commercial</p> : null}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black uppercase text-muted-foreground">Sheet total</p>
                      <p className="mt-1 text-3xl font-black text-primary">{formatMoney(summary.paymentTotal)}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 p-0">
                  <div className="overflow-auto">
                    <table className={cn("w-full border-collapse text-sm", mixed ? "min-w-[840px]" : "min-w-[680px]")}>
                      <thead>
                        <tr className="border-b border-border bg-muted/45 text-left text-xs font-black uppercase text-muted-foreground">
                          <th className="border-r border-border px-4 py-3">Date</th>
                          <th className="border-r border-border px-4 py-3">City</th>
                          {mixed ? (
                            <>
                              <th className="border-r border-border px-4 py-3 text-right">Residential</th>
                              <th className="border-r border-border px-4 py-3 text-right">Commercial</th>
                            </>
                          ) : (
                            <th className="border-r border-border px-4 py-3 text-right">Payment</th>
                          )}
                          <th className="w-32 px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.rows.length === 0 ? <tr><td className="px-4 py-8 text-center font-bold text-muted-foreground" colSpan={mixed ? 5 : 4}>No payments yet for this week.</td></tr> : null}
                        {summary.rows.map((row) => (
                          <tr className="border-b border-border/80" key={row.id}>
                            <td className="border-r border-border/70 px-4 py-3 font-bold">{displayDate(row.work_date)}</td>
                            <td className="border-r border-border/70 px-4 py-3">
                              <p className="font-bold">{row.city}</p>
                              {row.notes ? <p className="mt-1 max-w-80 truncate text-xs font-semibold text-muted-foreground">{row.notes}</p> : null}
                            </td>
                            {mixed ? (
                              <>
                                <td className="border-r border-border/70 px-4 py-3 text-right font-black">{formatMoney(toNumber(row.residential_amount))}</td>
                                <td className="border-r border-border/70 px-4 py-3 text-right font-black">{formatMoney(toNumber(row.commercial_amount))}</td>
                              </>
                            ) : (
                              <td className="border-r border-border/70 px-4 py-3 text-right font-black">{formatMoney(toNumber(row.payment_amount))}</td>
                            )}
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-2">
                                <Button size="icon" variant="outline" aria-label="Edit payment row" onClick={() => editPaymentRow(row)}><Edit3 className="size-4" /></Button>
                                <Button size="icon" variant="outline" aria-label="Delete payment row" disabled={deletingPaymentRowId === row.id} onClick={() => deletePaymentRow(row)}><Trash2 className="size-4" /></Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        {mixed ? (
                          <>
                            <tr className="border-t-2 border-border bg-yellow-100 text-base font-black text-yellow-950">
                              <td className="border-r border-yellow-300 px-4 py-3">TOTAL</td>
                              <td className="border-r border-yellow-300 px-4 py-3">{summary.rows.length} jobs</td>
                              <td className="border-r border-yellow-300 px-4 py-3 text-right">{formatMoney(summary.residentialTotal)}</td>
                              <td className="border-r border-yellow-300 px-4 py-3 text-right">{formatMoney(summary.commercialTotal)}</td>
                              <td className="px-4 py-3 text-right">{formatMoney(summary.paymentTotal)}</td>
                            </tr>
                          </>
                        ) : (
                          <tr className="border-t-2 border-border bg-yellow-100 text-base font-black text-yellow-950">
                            <td className="border-r border-yellow-300 px-4 py-3">TOTAL</td>
                            <td className="border-r border-yellow-300 px-4 py-3">{summary.rows.length} jobs</td>
                            <td className="border-r border-yellow-300 px-4 py-3 text-right">{formatMoney(summary.paymentTotal)}</td>
                            <td className="px-4 py-3" />
                          </tr>
                        )}
                      </tfoot>
                    </table>
                  </div>

                  <div className={cn("mx-4 grid gap-3 rounded-md border border-border bg-background/70 p-3", mixed ? "md:grid-cols-[1fr_1fr_1fr_1fr_auto]" : "md:grid-cols-[1fr_1fr_1fr_1fr_auto]")}>
                    <label className="grid gap-1 text-sm font-bold">Date<input className="h-10 rounded-md border bg-background px-3" type="date" value={draft.workDate} onChange={(event) => setPaymentDraftForSummary(summary, { ...draft, workDate: event.target.value })} /></label>
                    <label className="grid gap-1 text-sm font-bold">City<input className="h-10 rounded-md border bg-background px-3" value={draft.city} onChange={(event) => setPaymentDraftForSummary(summary, { ...draft, city: event.target.value })} /></label>
                    {mixed ? (
                      <>
                        <label className="grid gap-1 text-sm font-bold">Residential<input className="h-10 rounded-md border bg-background px-3" inputMode="decimal" min="0" type="number" value={draft.residentialAmount} onChange={(event) => setPaymentDraftForSummary(summary, { ...draft, residentialAmount: event.target.value })} /></label>
                        <label className="grid gap-1 text-sm font-bold">Commercial<input className="h-10 rounded-md border bg-background px-3" inputMode="decimal" min="0" type="number" value={draft.commercialAmount} onChange={(event) => setPaymentDraftForSummary(summary, { ...draft, commercialAmount: event.target.value })} /></label>
                      </>
                    ) : (
                      <label className="grid gap-1 text-sm font-bold">Payment<input className="h-10 rounded-md border bg-background px-3" inputMode="decimal" min="0" type="number" value={draft.paymentAmount} onChange={(event) => setPaymentDraftForSummary(summary, { ...draft, paymentAmount: event.target.value })} /></label>
                    )}
                    <div className="flex items-end gap-2">
                      <Button className="w-full" disabled={savingPaymentKey === summary.key} onClick={() => savePaymentRow(summary)}><Save className="size-4" /> {draft.id ? "Update row" : "Add payment row"}</Button>
                    </div>
                    <label className={cn("grid gap-1 text-sm font-bold", mixed ? "md:col-span-4" : "md:col-span-3")}>Notes<input className="h-10 rounded-md border bg-background px-3" value={draft.notes} onChange={(event) => setPaymentDraftForSummary(summary, { ...draft, notes: event.target.value })} /></label>
                    {draft.id ? <Button className="self-end" variant="outline" onClick={() => setPaymentDraftForSummary(summary, { ...EMPTY_PAYMENT_ROW_DRAFT, cleanerId: summary.teamId ?? "", cleanerName: summary.teamName, workDate: weekRange.start })}>Cancel edit</Button> : null}
                  </div>

                  {mixed ? (
                    <div className="mx-4 grid gap-2 rounded-md border border-amber-200 bg-amber-50/80 p-3 text-sm font-black text-amber-950 md:grid-cols-3">
                      <span>Total Residential: {formatMoney(summary.residentialTotal)}</span>
                      <span>Total Commercial: {formatMoney(summary.commercialTotal)}</span>
                      <span>Grand Total: {formatMoney(summary.paymentTotal)}</span>
                    </div>
                  ) : (
                    <div className="mx-4 rounded-md border border-border bg-background/70 p-3 text-sm font-black">Total: {formatMoney(summary.paymentTotal)}</div>
                  )}

                  <div className="flex flex-wrap justify-end gap-2 px-4 pb-4">
                    <Button disabled={savingPaymentKey === summary.key} onClick={() => saveWeeklyPayment(summary, "paid")}><CheckCircle2 className="size-4" /> Mark paid</Button>
                    <Button disabled={savingPaymentKey === summary.key} variant="outline" onClick={() => saveWeeklyPayment(summary, "pending")}>Mark pending</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  function renderStaff() {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard icon={UserRoundCheck} label="Operations leads" value={operationsLeads.length} />
          <MetricCard icon={Users} label="Residential teams" value={activeTeams.length} />
          <MetricCard icon={Clock} label="Logged hours" value={formatHours(workLogs.reduce((sum, log) => sum + toNumber(log.hours_worked), 0))} />
          <MetricCard icon={WalletCards} label="Paid weekly payments" value={weeklyPayments.filter((payment) => payment.status === "paid").length} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Jake and Carlos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {operationsLeads.map((person) => (
              <article className="rounded-lg border border-border bg-background/70 p-4" key={person.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black">{person.name}</h3>
                    <p className="mt-1 text-sm font-bold text-muted-foreground">{person.role}</p>
                  </div>
                  <Badge variant="outline">{person.status ?? "Active"}</Badge>
                </div>
              </article>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Residential teams / cleaners</CardTitle>
            <Button onClick={() => openStaffDraft()}><Plus className="size-4" /> Create team</Button>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {activeTeams.length === 0 ? <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground md:col-span-2 xl:col-span-3">No residential teams yet.</div> : null}
            {activeTeams.map((team) => {
              const hours = workLogs.filter((log) => log.team_id === team.id || log.team_name === team.name).reduce((sum, log) => sum + toNumber(log.hours_worked), 0);
              const paid = weeklyPaymentRows.filter((payment) => (payment.cleaner_id === team.id || payment.cleaner_name === team.name) && payment.status === "paid").reduce((sum, payment) => sum + paymentLineTotal(payment), 0);
              return (
                <article className="rounded-lg border border-border bg-background/70 p-4" key={team.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black">{team.name}</h3>
                      <p className="mt-1 text-xs font-bold text-muted-foreground">{team.email || "No email"}</p>
                    </div>
                    <Badge variant="outline">{team.status ?? "Active"}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-bold">
                    <span>{formatMoney(toNumber(team.hourly_rate))}/hr</span>
                    <span>{formatHours(hours)} hours</span>
                    <span>{formatMoney(paid)} paid</span>
                    <span>{isMixedPayCleaner(team) ? "Mixed pay" : "Residential only"}</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openStaffDraft(team)}><Edit3 className="size-4" /> Edit</Button>
                  </div>
                </article>
              );
            })}
          </CardContent>
        </Card>
      </div>
    );
  }

  function renderReports() {
    const rows = getReportRows();
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="flex flex-wrap items-end justify-between gap-3 p-4">
            <div className="flex flex-wrap gap-2">
              <select className="h-10 rounded-md border bg-background px-3 text-sm font-bold" value={reportKind} onChange={(event) => setReportKind(event.target.value as ReportKind)}>
                <option value="tasks">Task report</option>
                <option value="hours">Hours report</option>
                <option value="weekly_payments">Weekly payment report</option>
              </select>
              <PeriodSegment value={periodMode} onChange={setPeriodMode} />
            </div>
            <Button onClick={exportCurrentReport}><FileSpreadsheet className="size-4" /> Export XLSX</Button>
          </CardContent>
        </Card>
        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard icon={FileText} label="Rows" value={rows.length} />
          <MetricCard icon={CalendarDays} label="Period" value={periodRange.label} note={dateRangeLabel(periodRange.start, periodRange.end)} />
          <MetricCard icon={Download} label="Format" value="XLSX" />
          <MetricCard icon={WalletCards} label="Payment week" value={dateRangeLabel(weekRange.start, weekRange.end)} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-black uppercase text-muted-foreground">
                  {Object.keys(rows[0] ?? { report: "No rows" }).slice(0, 7).map((key) => <th className="py-2" key={key}>{key.replace(/_/g, " ")}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? <tr><td className="py-8 text-center font-bold text-muted-foreground">No report rows for the current filters.</td></tr> : null}
                {rows.slice(0, 20).map((row, index) => (
                  <tr className="border-b border-border/70" key={index}>
                    {Object.values(row).slice(0, 7).map((value, valueIndex) => <td className="py-2 pr-3" key={valueIndex}>{String(value ?? "")}</td>)}
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
    const rows = [
      { label: "Owner email", configured: Boolean(envStatus?.ownerEmail), env: "OWNER_EMAIL" },
      { label: "Operations Manager email", configured: Boolean(envStatus?.operationsManagerEmail), env: "OPERATIONS_MANAGER_EMAIL" },
      { label: "Gmail user", configured: Boolean(envStatus?.gmailUser), env: "GMAIL_USER" },
      { label: "Gmail app password", configured: Boolean(envStatus?.gmailPassword), env: "GMAIL_APP_PASSWORD" },
      { label: "App base URL", configured: Boolean(envStatus?.appBaseUrl), env: "APP_BASE_URL" },
    ];
    return (
      <div className="grid gap-4 xl:grid-cols-[1fr_.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Notification configuration</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {rows.map((row) => (
              <div className="flex items-center justify-between rounded-md border border-border bg-background/70 px-3 py-2" key={row.env}>
                <div>
                  <p className="text-sm font-black">{row.label}</p>
                  <p className="text-xs font-bold text-muted-foreground">{row.env}</p>
                </div>
                <Badge className={row.configured ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}>{row.configured ? "Configured" : "Missing"}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Residential operations defaults</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {[
                "Task assignees: Jake Ivan-Pal and Carlos Lopez",
                "Default task frequency: One-time",
                "Default completion notification: owner notified",
                "Hours calculation: weekly, biweekly, monthly approximation",
                "Soft-delete/archive behavior: enabled for tasks, accounts, logs, and payments",
                "Default hourly rate: managed per team in Staff / Teams",
                "Payment mode: Residential only by default; Juan Romero is mixed pay",
              ].map((row) => <div className="rounded-md border border-border bg-background/70 px-3 py-2 text-sm font-bold text-muted-foreground" key={row}>{row}</div>)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Legacy scope</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm font-bold text-muted-foreground">
              <div className="rounded-md border border-border bg-background/70 px-3 py-2">Commercial and SEO modules are hidden from navigation.</div>
              <div className="rounded-md border border-border bg-background/70 px-3 py-2">Old routes redirect to the dashboard where safe.</div>
              <div className="rounded-md border border-border bg-background/70 px-3 py-2">No secrets are displayed in this settings view.</div>
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
        <form className="grid w-full max-w-2xl gap-3 rounded-lg border border-border bg-card p-5 shadow-2xl" onSubmit={saveTask} onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black">{taskDraft.id ? "Edit task" : "Create task"}</h2>
            <button type="button" aria-label="Close task modal" disabled={savingTask} onClick={() => setTaskDraft(null)}><X className="size-5" /></button>
          </div>
          <label className="grid gap-1 text-sm font-bold">Title<input className="h-10 rounded-md border bg-background px-3" value={taskDraft.title} onChange={(event) => setTaskDraft({ ...taskDraft, title: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-bold">Notes<textarea className="min-h-24 rounded-md border bg-background p-3" value={taskDraft.description} onChange={(event) => setTaskDraft({ ...taskDraft, description: event.target.value })} /></label>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-sm font-bold">Assigned to<select className="h-10 rounded-md border bg-background px-3" value={taskDraft.assignee} onChange={(event) => setTaskDraft({ ...taskDraft, assignee: event.target.value as ResidentialAssignee })}>
              {RESIDENTIAL_ASSIGNEES.map((assignee) => <option key={assignee} value={assignee}>{assignee}</option>)}
            </select></label>
            <label className="grid gap-1 text-sm font-bold">Due date<input className="h-10 rounded-md border bg-background px-3" type="date" value={taskDraft.dueDate} onChange={(event) => setTaskDraft({ ...taskDraft, dueDate: event.target.value })} /></label>
            <label className="grid gap-1 text-sm font-bold">Priority<select className="h-10 rounded-md border bg-background px-3" value={taskDraft.priority} onChange={(event) => setTaskDraft({ ...taskDraft, priority: event.target.value as TaskDraft["priority"] })}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select></label>
            <label className="grid gap-1 text-sm font-bold">Frequency<select className="h-10 rounded-md border bg-background px-3" value={taskDraft.frequency} onChange={(event) => setTaskDraft({ ...taskDraft, frequency: event.target.value as TaskReminderFrequency })}>
              {Object.entries(TASK_FREQUENCY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            {taskDraft.frequency === "custom" ? <label className="grid gap-1 text-sm font-bold">Custom days<input className="h-10 rounded-md border bg-background px-3" inputMode="numeric" value={taskDraft.customIntervalDays} onChange={(event) => setTaskDraft({ ...taskDraft, customIntervalDays: event.target.value })} /></label> : null}
          </div>
          <div className="flex flex-wrap gap-3 text-sm font-bold">
            <label className="flex items-center gap-2"><input type="checkbox" checked={taskDraft.notifyAssignee} onChange={(event) => setTaskDraft({ ...taskDraft, notifyAssignee: event.target.checked })} /> Notify assignee</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={taskDraft.notifyOwnerOnCompletion} onChange={(event) => setTaskDraft({ ...taskDraft, notifyOwnerOnCompletion: event.target.checked })} /> Notify owner on completion</label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={savingTask} onClick={() => setTaskDraft(null)}>Cancel</Button>
            <Button type="submit" disabled={savingTask}><Save className="size-4" /> {savingTask ? "Saving..." : "Save task"}</Button>
          </div>
        </form>
      </div>
    );
  }

  function renderTaskDetail() {
    if (!selectedTask) return null;
    const taskActivity = activity.filter((item) => item.task_id === selectedTask.id);
    return (
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-auto border-l border-border bg-card shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-border bg-card/95 p-5 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-primary">Task reminder</p>
              <h2 className="mt-2 text-2xl font-black">{selectedTask.title}</h2>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">{selectedTask.assignee ?? "Unassigned"} · {displayDate(selectedTask.due_date)}</p>
            </div>
            <button type="button" className="grid size-9 place-items-center rounded-md border border-border bg-background" aria-label="Close task detail" onClick={() => setSelectedTask(null)}><X className="size-5" /></button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="outline">{normalizeTaskStatus(selectedTask.status)}</Badge>
            <Badge variant="outline">{TASK_FREQUENCY_LABELS[frequencyFromRecurrence(selectedTask.recurrence)]}</Badge>
            <Badge variant="outline">{selectedTask.priority ?? "normal"}</Badge>
          </div>
        </div>
        <div className="space-y-5 p-5">
          <section className="rounded-lg border border-border bg-background/70 p-4 text-sm font-semibold text-muted-foreground">{selectedTask.description || "No notes yet."}</section>
          <div className="flex flex-wrap gap-2">
            <Button disabled={normalizeTaskStatus(selectedTask.status) === "completed" || completingTaskId === selectedTask.id} onClick={() => completeTask(selectedTask)}><Check className="size-4" /> {completingTaskId === selectedTask.id ? "Completing..." : "Complete"}</Button>
            <Button variant="outline" onClick={() => openTaskDraft(selectedTask)}><Edit3 className="size-4" /> Edit</Button>
            <Button variant="outline" disabled={deletingTaskId === selectedTask.id} onClick={() => deleteTask(selectedTask)}><Trash2 className="size-4" /> Delete</Button>
          </div>
          <section>
            <h3 className="font-black">Activity log</h3>
            <div className="mt-3 grid gap-2">
              {taskActivity.length === 0 ? <p className="rounded-md border border-dashed border-border p-3 text-sm font-bold text-muted-foreground">No activity yet.</p> : null}
              {taskActivity.slice(0, 12).map((item) => {
                const reason = typeof item.details?.reason === "string" ? item.details.reason : null;
                const messageText = typeof item.details?.message === "string" ? item.details.message : null;
                return (
                  <div className="rounded-md border border-border bg-background/70 p-3 text-sm" key={item.id}>
                    <strong>{actionLabel(item.action)}{reason ? ` - ${reason}` : ""}</strong>
                    {messageText && !reason ? <p className="mt-1 text-xs font-bold text-muted-foreground">{messageText}</p> : null}
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

  function renderAccountModal() {
    if (!accountDraft) return null;
    const totals = calculateResidentialHours(Number(accountDraft.scheduledHours) || 0, accountDraft.frequency);
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 backdrop-blur-sm" onClick={() => savingAccount ? undefined : setAccountDraft(null)}>
        <form className="grid w-full max-w-3xl gap-3 rounded-lg border border-border bg-card p-5 shadow-2xl" onSubmit={saveAccount} onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black">{accountDraft.id ? "Edit residential account" : "Add residential account"}</h2>
            <button type="button" aria-label="Close account modal" disabled={savingAccount} onClick={() => setAccountDraft(null)}><X className="size-5" /></button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-bold">Account name<input className="h-10 rounded-md border bg-background px-3" value={accountDraft.accountName} onChange={(event) => setAccountDraft({ ...accountDraft, accountName: event.target.value })} /></label>
            <label className="grid gap-1 text-sm font-bold">Scheduled hours<input className="h-10 rounded-md border bg-background px-3" inputMode="decimal" value={accountDraft.scheduledHours} onChange={(event) => setAccountDraft({ ...accountDraft, scheduledHours: event.target.value })} /></label>
            <label className="grid gap-1 text-sm font-bold">Frequency<select className="h-10 rounded-md border bg-background px-3" value={accountDraft.frequency} onChange={(event) => setAccountDraft({ ...accountDraft, frequency: event.target.value as ResidentialFrequency })}>
              {Object.entries(RESIDENTIAL_FREQUENCY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <label className="grid gap-1 text-sm font-bold">Frequency detail<input className="h-10 rounded-md border bg-background px-3" value={accountDraft.frequencyDetail} onChange={(event) => setAccountDraft({ ...accountDraft, frequencyDetail: event.target.value })} placeholder="Every Wednesday" /></label>
            <label className="grid gap-1 text-sm font-bold">Assigned team<select className="h-10 rounded-md border bg-background px-3" value={accountDraft.assignedTeamId} onChange={(event) => setAccountDraft({ ...accountDraft, assignedTeamId: event.target.value })}>
              <option value="">Unassigned</option>
              {activeTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select></label>
            <label className="grid gap-1 text-sm font-bold">Status<select className="h-10 rounded-md border bg-background px-3" value={accountDraft.active ? "active" : "inactive"} onChange={(event) => setAccountDraft({ ...accountDraft, active: event.target.value === "active" })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select></label>
          </div>
          <label className="grid gap-1 text-sm font-bold">Notes<textarea className="min-h-20 rounded-md border bg-background p-3" value={accountDraft.notes} onChange={(event) => setAccountDraft({ ...accountDraft, notes: event.target.value })} /></label>
          <div className="grid gap-2 rounded-lg border border-border bg-background/70 p-3 text-sm font-bold md:grid-cols-3">
            <span>{formatHours(totals.weekly)} hours/week</span>
            <span>{formatHours(totals.biweekly)} hours/2 weeks</span>
            <span>{formatHours(totals.monthly)} hours/month</span>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={savingAccount} onClick={() => setAccountDraft(null)}>Cancel</Button>
            <Button type="submit" disabled={savingAccount}><Save className="size-4" /> {savingAccount ? "Saving..." : "Save account"}</Button>
          </div>
        </form>
      </div>
    );
  }

  function renderStaffModal() {
    if (!staffDraft) return null;
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 backdrop-blur-sm" onClick={() => savingStaff ? undefined : setStaffDraft(null)}>
        <form className="grid w-full max-w-xl gap-3 rounded-lg border border-border bg-card p-5 shadow-2xl" onSubmit={saveStaff} onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black">{staffDraft.id ? "Edit team" : "Create team"}</h2>
            <button type="button" aria-label="Close team modal" disabled={savingStaff} onClick={() => setStaffDraft(null)}><X className="size-5" /></button>
          </div>
          <label className="grid gap-1 text-sm font-bold">Team name<input className="h-10 rounded-md border bg-background px-3" value={staffDraft.name} onChange={(event) => setStaffDraft({ ...staffDraft, name: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-bold">Email optional<input className="h-10 rounded-md border bg-background px-3" type="email" value={staffDraft.email} onChange={(event) => setStaffDraft({ ...staffDraft, email: event.target.value })} /></label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-bold">Role<input className="h-10 rounded-md border bg-background px-3" value={staffDraft.role} onChange={(event) => setStaffDraft({ ...staffDraft, role: event.target.value })} /></label>
            <label className="grid gap-1 text-sm font-bold">Hourly rate<input className="h-10 rounded-md border bg-background px-3" inputMode="decimal" value={staffDraft.hourlyRate} onChange={(event) => setStaffDraft({ ...staffDraft, hourlyRate: event.target.value })} /></label>
            <label className="grid gap-1 text-sm font-bold">Payment mode<select className="h-10 rounded-md border bg-background px-3" value={staffDraft.paymentMode} disabled={isJuanRomero(staffDraft.name)} onChange={(event) => setStaffDraft({ ...staffDraft, paymentMode: event.target.value as PaymentMode })}>
              <option value="residential_only">Residential only</option>
              <option value="mixed">Mixed pay</option>
            </select></label>
            {isJuanRomero(staffDraft.name) ? <div className="self-end rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-950">Juan Romero is always mixed pay.</div> : null}
          </div>
          <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={staffDraft.active} onChange={(event) => setStaffDraft({ ...staffDraft, active: event.target.checked })} /> Active</label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={savingStaff} onClick={() => setStaffDraft(null)}>Cancel</Button>
            <Button type="submit" disabled={savingStaff}><Save className="size-4" /> {savingStaff ? "Saving..." : "Save team"}</Button>
          </div>
        </form>
      </div>
    );
  }
}
