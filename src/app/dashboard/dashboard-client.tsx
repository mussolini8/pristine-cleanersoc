"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { createClient } from "@/lib/supabase/client";
import { getResidentialServices } from "@/data/service-types";
import {
  Plus, X, Edit2, Check, AlertTriangle, Clock, CheckCircle2,
  Circle, ArrowRight, Bell, Repeat2, GripVertical, CalendarDays, Filter,
  ChevronDown, CalendarRange, RotateCcw, Zap, ListChecks, ClipboardList,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────
type Priority = "urgent" | "high" | "normal" | "low";
type Status   = "todo" | "in_progress" | "done";
type Recurrence = "none" | "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly" | "custom";
type DayOfWeek = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
type ScheduleQuickPreset = "all" | "today" | "tomorrow" | "this_week" | "next_week" | "this_month" | "next_month";
type ScheduleWeekValue = "all" | "week_1" | "week_2" | "week_3" | "week_4" | "last";
type ScheduleFrequencyValue = "all" | "weekly" | "monthly" | "one-time" | "custom";
type SchedulePatternValue =
  | "all"
  | "every_friday"
  | "third_wednesday"
  | "last_friday"
  | "week_1_tuesday"
  | "week_2_wednesday"
  | "week_3_wednesday"
  | "week_4_friday";

type SopScheduleFilter = {
  quick: ScheduleQuickPreset;
  week: ScheduleWeekValue;
  day: "all" | DayOfWeek;
  frequency: ScheduleFrequencyValue;
  pattern: SchedulePatternValue;
  rangeStart: string;
  rangeEnd: string;
};

type Task = {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: Status;
  category: string;
  due_date: string;
  assignee: string;
  assigned_by: string;
  account_name: string;
  property_address: string;
  panel: "Residential" | "Commercial";
  completion_notes: string;
  reminder: boolean;
  recurrence: Recurrence;
  custom_interval_days: string;
};

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  category: string;
  due_date: string | null;
  assignee: string | null;
  assigned_by?: string | null;
  account_name?: string | null;
  property_address?: string | null;
  panel?: string | null;
  completion_notes?: string | null;
  reminder: boolean;
  recurrence: string;
  custom_interval_days: number | null;
};

type AuditLogRow = {
  id: string;
  action: string;
  actor: string | null;
  note: string | null;
  details: {
    reason?: string;
    actor?: string;
  } | null;
  created_at: string;
};

type CalendarDay =
  | { empty: true; key: string }
  | { empty: false; key: string; date: string; day: number; tasks: Task[] };

type SopTaskSeed = {
  natural_key: string;
  title: string;
  description: string;
  category: string;
  frequency: string;
  schedule_label: string;
  preferred_due_timing: string;
  week_scope: string;
  week_of_month: number | null;
  day_of_week: string | null;
  due_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  schedule_summary?: string | null;
  recurrence_rule_json?: unknown;
  ordinal_week?: number | string | null;
  priority: Priority;
};

type SopTaskTemplate = SopTaskSeed & {
  id: string;
  assigned_to: string;
  assigned_role: string;
  panel: "Residential";
  business_unit: string;
  status: "active" | "inactive";
  source: "monthly_sop";
};

type SopTaskTemplateRow = SopTaskTemplate & {
  priority: string;
  status: string;
  source: string;
  panel: string;
};

type SopFilters = {
  schedule: SopScheduleFilter;
  category: string;
  assignedTo: string;
  status: string;
};

const CATEGORIES = ["Billing", "Billing / Reporting", "Client Follow-Up", "Cleaner Coordination", "Quality Control", "Inventory", "Marketing", "Reporting", "Admin / CRM"];
const ASSIGNEES = ["Unassigned", "Carlos Lopez"];
const PRIORITIES: Priority[] = ["urgent", "high", "normal", "low"];
const DAY_OPTIONS: DayOfWeek[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SOP_SCHEDULE_DEFAULT: SopScheduleFilter = {
  quick: "all",
  week: "all",
  day: "all",
  frequency: "all",
  pattern: "all",
  rangeStart: "",
  rangeEnd: "",
};
const SOP_FILTERS_DEFAULT: SopFilters = {
  schedule: SOP_SCHEDULE_DEFAULT,
  category: "all",
  assignedTo: "all",
  status: "active",
};
const SOP_QUICK_OPTIONS: { value: ScheduleQuickPreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "this_week", label: "This week" },
  { value: "next_week", label: "Next week" },
  { value: "this_month", label: "This month" },
  { value: "next_month", label: "Next month" },
];
const SOP_WEEK_OPTIONS: { value: Exclude<ScheduleWeekValue, "all">; label: string }[] = [
  { value: "week_1", label: "Week 1" },
  { value: "week_2", label: "Week 2" },
  { value: "week_3", label: "Week 3" },
  { value: "week_4", label: "Week 4" },
  { value: "last", label: "Last week" },
];
const SOP_FREQUENCY_OPTIONS: { value: Exclude<ScheduleFrequencyValue, "all">; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "one-time", label: "One-time" },
  { value: "custom", label: "Custom" },
];
const SOP_PATTERN_OPTIONS: { value: Exclude<SchedulePatternValue, "all">; label: string }[] = [
  { value: "every_friday", label: "Every Friday" },
  { value: "third_wednesday", label: "3rd Wednesday" },
  { value: "last_friday", label: "Last Friday" },
  { value: "week_1_tuesday", label: "Week 1 Tuesday" },
  { value: "week_2_wednesday", label: "Week 2 Wednesday" },
  { value: "week_3_wednesday", label: "Week 3 Wednesday" },
  { value: "week_4_friday", label: "Week 4 Friday" },
];
const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: "One-time",
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
  custom: "Custom days",
};

const PRIORITY_META: Record<Priority, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  urgent: { label: "Same-day attention", color: "#ef4444", bg: "hsl(0 84% 60%/.12)", icon: <AlertTriangle size={11} /> },
  high:   { label: "Priority",          color: "#f97316", bg: "hsl(25 95% 55%/.12)", icon: <ArrowRight size={11} /> },
  normal: { label: "Standard",          color: "#437d65", bg: "hsl(168 76% 34%/.12)", icon: <Circle size={11} /> },
  low:    { label: "Monitor",           color: "#64748b", bg: "hsl(215 16% 47%/.12)", icon: <Circle size={11} /> },
};

const COLUMNS: { id: Status; label: string; icon: React.ReactNode }[] = [
  { id: "todo",        label: "Scheduled",   icon: <Circle size={14} /> },
  { id: "in_progress", label: "In Service",  icon: <Clock size={14} /> },
  { id: "done",        label: "Completed",   icon: <CheckCircle2 size={14} /> },
];

function emptyTask(): Task {
  return {
    id: crypto.randomUUID(), title: "", description: "", priority: "normal",
    status: "todo", category: "Residential", due_date: "", assignee: "Unassigned", reminder: false,
    assigned_by: "Pristine Operations", account_name: "", property_address: "", panel: "Residential", completion_notes: "",
    recurrence: "none", custom_interval_days: "",
  };
}

function normalizeTask(task: Task): Task {
  return {
    ...task,
    assignee: ASSIGNEES.includes(task.assignee) ? task.assignee : "Unassigned",
    panel: "Residential",
    recurrence: task.recurrence ?? "none",
    custom_interval_days: task.custom_interval_days ?? "",
  };
}

function fromTaskRow(row: TaskRow): Task {
  return normalizeTask({
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    priority: (PRIORITIES.includes(row.priority as Priority) ? row.priority : "normal") as Priority,
    status: (["todo", "in_progress", "done"].includes(row.status) ? row.status : "todo") as Status,
    category: row.category,
    due_date: row.due_date ?? "",
    assignee: row.assignee ?? "Admin",
    assigned_by: row.assigned_by ?? "Pristine Operations",
    account_name: row.account_name ?? "",
    property_address: row.property_address ?? "",
    panel: row.panel === "Commercial" ? "Commercial" : "Residential",
    completion_notes: row.completion_notes ?? "",
    reminder: row.reminder,
    recurrence: (Object.keys(RECURRENCE_LABELS).includes(row.recurrence) ? row.recurrence : "none") as Recurrence,
    custom_interval_days: row.custom_interval_days ? String(row.custom_interval_days) : "",
  });
}

function toTaskPayload(task: Task, userId: string) {
  return {
    id: task.id,
    user_id: userId,
    title: task.title,
    description: task.description || null,
    priority: task.priority,
    status: task.status,
    category: task.category,
    due_date: task.due_date || null,
    assignee: task.assignee || null,
    assigned_by: task.assigned_by || null,
    account_name: task.account_name || null,
    property_address: task.property_address || null,
    panel: task.panel,
    completion_notes: task.completion_notes || null,
    reminder: task.reminder,
    recurrence: task.recurrence,
    custom_interval_days: task.custom_interval_days ? Number(task.custom_interval_days) : null,
  };
}

function fromSopTemplateRow(row: SopTaskTemplateRow): SopTaskTemplate {
  return {
    id: row.id,
    natural_key: row.natural_key,
    title: row.title,
    description: row.description,
    category: row.category,
    frequency: row.frequency,
    schedule_label: row.schedule_label,
    preferred_due_timing: row.preferred_due_timing,
    week_scope: row.week_scope,
    week_of_month: row.week_of_month,
    day_of_week: row.day_of_week,
    due_date: row.due_date,
    start_date: row.start_date,
    end_date: row.end_date,
    schedule_summary: row.schedule_summary,
    recurrence_rule_json: row.recurrence_rule_json,
    ordinal_week: row.ordinal_week,
    assigned_to: row.assigned_to,
    assigned_role: row.assigned_role,
    panel: "Residential",
    business_unit: row.business_unit,
    priority: (PRIORITIES.includes(row.priority as Priority) ? row.priority : "normal") as Priority,
    status: row.status === "inactive" ? "inactive" : "active",
    source: "monthly_sop",
  };
}

function weekLabel(value: string | null | undefined) {
  if (!value || value === "general") return "General";
  return value.replace("week_", "Week ");
}

function priorityLabel(priority: Priority) {
  return priority === "high" ? "High" : priority === "urgent" ? "Urgent" : priority === "low" ? "Low" : "Medium";
}

function normalizeSearchText(value: string | null | undefined) {
  return (value ?? "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeFrequencyValue(value: string | null | undefined): ScheduleFrequencyValue {
  const normalized = normalizeSearchText(value).replace(/\s+/g, "-");
  if (normalized === "weekly") return "weekly";
  if (normalized === "monthly") return "monthly";
  if (normalized === "custom") return "custom";
  if (normalized === "one-time" || normalized === "one-off" || normalized === "none") return "one-time";
  return "custom";
}

function normalizeDay(value: string | null | undefined): DayOfWeek | null {
  const normalized = normalizeSearchText(value);
  return DAY_OPTIONS.find((day) => day.toLowerCase() === normalized) ?? null;
}

function parseDayFromText(text: string): DayOfWeek | null {
  return DAY_OPTIONS.find((day) => text.includes(day.toLowerCase())) ?? null;
}

function parseWeekFromText(text: string): number | "last" | null {
  if (text.includes("last week")) return "last";
  if (text.includes("week 4") || text.includes("4th")) return 4;
  if (text.includes("week 3") || text.includes("3rd") || text.includes("third")) return 3;
  if (text.includes("week 2") || text.includes("2nd") || text.includes("second")) return 2;
  if (text.includes("week 1") || text.includes("1st") || text.includes("first")) return 1;
  return null;
}

function getJsonRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function getJsonString(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) return "";
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

function getJsonNumber(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = parseInt(value, 10);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return null;
}

function getSopScheduleText(task: SopTaskTemplate) {
  const recurrenceRule = getJsonRecord(task.recurrence_rule_json);
  return normalizeSearchText([
    task.schedule_label,
    task.preferred_due_timing,
    task.schedule_summary,
    getJsonString(recurrenceRule, ["schedule_summary", "summary", "label", "description"]),
    task.natural_key,
  ].filter(Boolean).join(" "));
}

function getSopOrdinalWeek(task: SopTaskTemplate, text: string, recurrenceRule: Record<string, unknown> | null) {
  const jsonWeek = getJsonNumber(recurrenceRule, ["week_of_month", "weekOfMonth", "ordinal_week", "ordinalWeek"]);
  if (jsonWeek) return jsonWeek;
  if (typeof task.ordinal_week === "number") return task.ordinal_week;
  if (typeof task.ordinal_week === "string") {
    const parsed = parseInt(task.ordinal_week, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  if (typeof task.week_of_month === "number") return task.week_of_month;
  const parsed = parseWeekFromText(text);
  return typeof parsed === "number" ? parsed : null;
}

function getSopScheduleRule(task: SopTaskTemplate) {
  const recurrenceRule = getJsonRecord(task.recurrence_rule_json);
  const text = getSopScheduleText(task);
  const dayOfWeek = normalizeDay(task.day_of_week)
    ?? normalizeDay(getJsonString(recurrenceRule, ["day_of_week", "dayOfWeek", "weekday", "day"]))
    ?? parseDayFromText(text);
  const weekFromText = parseWeekFromText(text);
  const weekOfMonth = getSopOrdinalWeek(task, text, recurrenceRule);
  const explicitStart = toDateKey(
    task.start_date
    ?? task.due_date
    ?? getJsonString(recurrenceRule, ["start_date", "startDate", "due_date", "dueDate"])
  );
  const explicitEnd = toDateKey(
    task.end_date
    ?? task.due_date
    ?? getJsonString(recurrenceRule, ["end_date", "endDate", "due_date", "dueDate"])
  );
  const frequency = task.frequency || getJsonString(recurrenceRule, ["frequency", "freq", "recurrence"]);

  return {
    text,
    dayOfWeek,
    weekOfMonth,
    weekFromText,
    frequency: normalizeFrequencyValue(frequency),
    isEveryFriday: text.includes("every friday"),
    isLastFriday: text.includes("last friday"),
    isLastWeek: text.includes("last week") || weekFromText === "last",
    explicitStart,
    explicitEnd,
  };
}

function toDateKey(value: string | null | undefined) {
  if (!value) return "";
  const [datePart] = value.split("T");
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : "";
}

function parseDateKey(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function formatLocalDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatFriendlyDate(value: string) {
  const date = parseDateKey(value);
  if (!date) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date) {
  const start = startOfLocalDay(date);
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  return start;
}

function endOfWeek(date: Date) {
  const end = startOfWeek(date);
  end.setDate(end.getDate() + 6);
  return end;
}

function getQuickDateRange(preset: ScheduleQuickPreset) {
  const today = startOfLocalDay(new Date());
  if (preset === "today") return { start: today, end: today };
  if (preset === "tomorrow") {
    const tomorrow = addDays(today, 1);
    return { start: tomorrow, end: tomorrow };
  }
  if (preset === "this_week") return { start: startOfWeek(today), end: endOfWeek(today) };
  if (preset === "next_week") {
    const nextWeek = addDays(startOfWeek(today), 7);
    return { start: nextWeek, end: addDays(nextWeek, 6) };
  }
  if (preset === "this_month") {
    return {
      start: new Date(today.getFullYear(), today.getMonth(), 1),
      end: new Date(today.getFullYear(), today.getMonth() + 1, 0),
    };
  }
  if (preset === "next_month") {
    return {
      start: new Date(today.getFullYear(), today.getMonth() + 1, 1),
      end: new Date(today.getFullYear(), today.getMonth() + 2, 0),
    };
  }
  return null;
}

function getDayName(date: Date): DayOfWeek {
  const names: ("Sunday" | DayOfWeek)[] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return names[date.getDay()] === "Sunday" ? "Sunday" : names[date.getDay()];
}

function getWeekOfMonth(date: Date) {
  return Math.min(4, Math.ceil(date.getDate() / 7));
}

function getWeekdayOccurrenceInMonth(date: Date) {
  return Math.floor((date.getDate() - 1) / 7) + 1;
}

function isLastWeekOfMonth(date: Date) {
  return addDays(date, 7).getMonth() !== date.getMonth();
}

function isLastWeekdayOfMonth(date: Date) {
  return addDays(date, 7).getMonth() !== date.getMonth();
}

function datesOverlap(startA: string, endA: string, startB: string, endB: string) {
  return startA <= endB && startB <= endA;
}

function taskMatchesDate(task: SopTaskTemplate, date: Date) {
  const rule = getSopScheduleRule(task);
  const dateKey = formatLocalDateKey(date);

  if (rule.explicitStart && rule.explicitEnd && datesOverlap(rule.explicitStart, rule.explicitEnd, dateKey, dateKey)) {
    return true;
  }

  if (!rule.dayOfWeek || getDayName(date) !== rule.dayOfWeek) return false;
  if (rule.frequency === "weekly" || rule.isEveryFriday) return true;

  if (rule.isLastFriday && rule.dayOfWeek === "Friday") {
    return isLastWeekdayOfMonth(date) || getWeekdayOccurrenceInMonth(date) === 4;
  }

  if (rule.isLastWeek) return isLastWeekOfMonth(date) || getWeekOfMonth(date) === 4;
  if (rule.weekOfMonth) return getWeekdayOccurrenceInMonth(date) === rule.weekOfMonth;

  return true;
}

function taskMatchesDateRange(task: SopTaskTemplate, startKey: string, endKey: string) {
  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  if (!start || !end || start > end) return true;

  const rule = getSopScheduleRule(task);
  if (rule.explicitStart && rule.explicitEnd && datesOverlap(rule.explicitStart, rule.explicitEnd, startKey, endKey)) {
    return true;
  }

  const cursor = new Date(start);
  let checkedDays = 0;
  while (cursor <= end && checkedDays <= 370) {
    if (taskMatchesDate(task, cursor)) return true;
    cursor.setDate(cursor.getDate() + 1);
    checkedDays += 1;
  }

  return false;
}

function taskMatchesWeek(task: SopTaskTemplate, week: ScheduleWeekValue) {
  if (week === "all") return true;
  const rule = getSopScheduleRule(task);
  if (week === "last") {
    return rule.isLastWeek || rule.isLastFriday || rule.weekFromText === "last" || rule.weekOfMonth === 4 || task.week_scope === "week_4";
  }
  const weekNumber = Number(week.replace("week_", ""));
  return task.week_scope === week || rule.weekOfMonth === weekNumber || rule.text.includes(`week ${weekNumber}`);
}

function taskMatchesDay(task: SopTaskTemplate, day: "all" | DayOfWeek) {
  if (day === "all") return true;
  return getSopScheduleRule(task).dayOfWeek === day;
}

function taskMatchesFrequency(task: SopTaskTemplate, frequency: ScheduleFrequencyValue) {
  if (frequency === "all") return true;
  return getSopScheduleRule(task).frequency === frequency;
}

function taskMatchesPattern(task: SopTaskTemplate, pattern: SchedulePatternValue) {
  if (pattern === "all") return true;
  const rule = getSopScheduleRule(task);

  if (pattern === "every_friday") return rule.dayOfWeek === "Friday" && (rule.frequency === "weekly" || rule.isEveryFriday);
  if (pattern === "third_wednesday") return rule.dayOfWeek === "Wednesday" && rule.weekOfMonth === 3;
  if (pattern === "last_friday") {
    return rule.dayOfWeek === "Friday" && (rule.isLastFriday || rule.isLastWeek || rule.weekOfMonth === 4);
  }

  const patternParts: Record<Exclude<SchedulePatternValue, "all" | "every_friday" | "third_wednesday" | "last_friday">, { week: ScheduleWeekValue; day: DayOfWeek }> = {
    week_1_tuesday: { week: "week_1", day: "Tuesday" },
    week_2_wednesday: { week: "week_2", day: "Wednesday" },
    week_3_wednesday: { week: "week_3", day: "Wednesday" },
    week_4_friday: { week: "week_4", day: "Friday" },
  };
  const parts = patternParts[pattern];
  return taskMatchesWeek(task, parts.week) && taskMatchesDay(task, parts.day);
}

function getScheduleRange(filter: SopScheduleFilter) {
  const start = toDateKey(filter.rangeStart);
  const end = toDateKey(filter.rangeEnd || filter.rangeStart);
  return start ? { start, end: end || start } : null;
}

function isScheduleFilterActive(filter: SopScheduleFilter) {
  return (
    filter.quick !== "all" ||
    filter.week !== "all" ||
    filter.day !== "all" ||
    filter.frequency !== "all" ||
    filter.pattern !== "all" ||
    Boolean(getScheduleRange(filter))
  );
}

function taskMatchesScheduleFilter(task: SopTaskTemplate, filter: SopScheduleFilter) {
  if (!isScheduleFilterActive(filter)) return true;

  const quickRange = getQuickDateRange(filter.quick);
  if (quickRange) {
    const start = formatLocalDateKey(quickRange.start);
    const end = formatLocalDateKey(quickRange.end);
    if (!taskMatchesDateRange(task, start, end)) return false;
  }

  const customRange = getScheduleRange(filter);
  if (customRange && !taskMatchesDateRange(task, customRange.start, customRange.end)) return false;
  if (!taskMatchesWeek(task, filter.week)) return false;
  if (!taskMatchesDay(task, filter.day)) return false;
  if (!taskMatchesFrequency(task, filter.frequency)) return false;
  if (!taskMatchesPattern(task, filter.pattern)) return false;

  return true;
}

function scheduleSummary(filter: SopScheduleFilter) {
  const parts: string[] = [];
  const quickLabel = SOP_QUICK_OPTIONS.find((option) => option.value === filter.quick)?.label;
  const range = getScheduleRange(filter);
  const weekLabelText = SOP_WEEK_OPTIONS.find((option) => option.value === filter.week)?.label;
  const patternLabel = SOP_PATTERN_OPTIONS.find((option) => option.value === filter.pattern)?.label;
  const frequencyLabelText = SOP_FREQUENCY_OPTIONS.find((option) => option.value === filter.frequency)?.label;

  if (quickLabel) parts.push(quickLabel);
  if (range) parts.push(range.start === range.end ? formatFriendlyDate(range.start) : `${formatFriendlyDate(range.start)} - ${formatFriendlyDate(range.end)}`);
  if (weekLabelText) parts.push(weekLabelText);
  if (filter.day !== "all") parts.push(filter.day);
  if (patternLabel) parts.push(patternLabel === "3rd Wednesday" ? "3rd Wednesday of every month" : patternLabel);
  if (frequencyLabelText) parts.push(frequencyLabelText);

  return parts.length > 0 ? parts.join(" · ") : "All scheduled tasks";
}

function setScheduleQuick(filter: SopScheduleFilter, quick: ScheduleQuickPreset): SopScheduleFilter {
  return { ...filter, quick };
}

function setSchedulePattern(filter: SopScheduleFilter, pattern: SchedulePatternValue): SopScheduleFilter {
  return {
    ...filter,
    pattern,
    ...(pattern !== "all"
      ? {
          quick: "all" as ScheduleQuickPreset,
          week: "all" as ScheduleWeekValue,
          day: "all" as const,
          frequency: "all" as ScheduleFrequencyValue,
          rangeStart: "",
          rangeEnd: "",
        }
      : {}),
  };
}

function frequencyLabel(value: string) {
  const normalized = normalizeFrequencyValue(value);
  if (normalized === "weekly") return "Weekly";
  if (normalized === "monthly") return "Monthly";
  if (normalized === "one-time") return "One-time";
  if (normalized === "custom") return "Custom";
  return value;
}

function accountOrProperty(task: Task) {
  return task.account_name || task.property_address || "Operations task";
}

function ScheduleFilterPopover({
  value,
  onChange,
}: {
  value: SopScheduleFilter;
  onChange: (filter: SopScheduleFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SopScheduleFilter>(value);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const popoverId = "residential-sop-schedule-filter";
  const appliedSummary = scheduleSummary(value);
  const draftHasSchedule = isScheduleFilterActive(draft);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideInteraction(event: MouseEvent) {
      if (!popoverRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideInteraction);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideInteraction);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function applyDraft() {
    onChange(draft);
    setOpen(false);
  }

  function clearSchedule() {
    setDraft(SOP_SCHEDULE_DEFAULT);
    onChange(SOP_SCHEDULE_DEFAULT);
    setOpen(false);
  }

  function selectWeek(week: Exclude<ScheduleWeekValue, "all">) {
    setDraft((current) => ({
      ...current,
      quick: "all",
      pattern: "all",
      rangeStart: "",
      rangeEnd: "",
      week: current.week === week ? "all" : week,
    }));
  }

  function selectDay(day: DayOfWeek) {
    setDraft((current) => ({
      ...current,
      quick: "all",
      pattern: "all",
      rangeStart: "",
      rangeEnd: "",
      day: current.day === day ? "all" : day,
    }));
  }

  function selectFrequency(frequency: Exclude<ScheduleFrequencyValue, "all">) {
    setDraft((current) => ({
      ...current,
      quick: "all",
      pattern: "all",
      rangeStart: "",
      rangeEnd: "",
      frequency: current.frequency === frequency ? "all" : frequency,
    }));
  }

  function selectRange(field: "rangeStart" | "rangeEnd", date: string) {
    setDraft((current) => ({
      ...current,
      quick: "all",
      week: "all",
      day: "all",
      frequency: "all",
      pattern: "all",
      [field]: date,
    }));
  }

  return (
    <div className="schedule-filter" ref={popoverRef}>
      <button
        type="button"
        className={`schedule-trigger ${isScheduleFilterActive(value) ? "active" : ""}`}
        aria-label={`Schedule filter: ${appliedSummary}`}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => {
          if (!open) setDraft(value);
          setOpen((current) => !current);
        }}
      >
        <CalendarRange size={15} />
        <span className="schedule-trigger-copy">
          <span>Schedule</span>
          <strong>{appliedSummary}</strong>
        </span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {open ? (
        <div className="schedule-popover" id={popoverId} role="dialog" aria-label="Schedule filter">
          <div className="schedule-popover-head">
            <div>
              <span>Schedule</span>
              <strong>{scheduleSummary(draft)}</strong>
            </div>
            <button type="button" className="schedule-icon-btn" aria-label="Clear schedule" onClick={() => setDraft(SOP_SCHEDULE_DEFAULT)}>
              <RotateCcw size={14} />
            </button>
          </div>

          <div className="schedule-section">
            <p>Quick views</p>
            <div className="schedule-chip-grid quick">
              <button
                type="button"
                className={`schedule-chip ${!draftHasSchedule ? "selected" : ""}`}
                aria-pressed={!draftHasSchedule}
                onClick={() => setDraft(SOP_SCHEDULE_DEFAULT)}
              >
                All scheduled tasks
              </button>
              {SOP_QUICK_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={`schedule-chip ${draft.quick === option.value ? "selected" : ""}`}
                  aria-pressed={draft.quick === option.value}
                  onClick={() => setDraft((current) => setScheduleQuick({
                    ...current,
                    week: "all",
                    day: "all",
                    frequency: "all",
                    pattern: "all",
                    rangeStart: "",
                    rangeEnd: "",
                  }, option.value))}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="schedule-section two-col">
            <div>
              <p>SOP week</p>
              <div className="schedule-chip-grid compact">
                {SOP_WEEK_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    className={`schedule-chip ${draft.week === option.value ? "selected" : ""}`}
                    aria-pressed={draft.week === option.value}
                    onClick={() => selectWeek(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p>Day</p>
              <div className="schedule-chip-grid compact">
                {DAY_OPTIONS.map((day) => (
                  <button
                    type="button"
                    key={day}
                    className={`schedule-chip ${draft.day === day ? "selected" : ""}`}
                    aria-pressed={draft.day === day}
                    onClick={() => selectDay(day)}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="schedule-section">
            <p>Recurring patterns</p>
            <div className="schedule-chip-grid patterns">
              {SOP_PATTERN_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={`schedule-chip ${draft.pattern === option.value ? "selected" : ""}`}
                  aria-pressed={draft.pattern === option.value}
                  onClick={() => setDraft((current) => setSchedulePattern(current, current.pattern === option.value ? "all" : option.value))}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="schedule-section two-col">
            <div>
              <p>Frequency</p>
              <div className="schedule-chip-grid compact">
                {SOP_FREQUENCY_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    className={`schedule-chip ${draft.frequency === option.value ? "selected" : ""}`}
                    aria-pressed={draft.frequency === option.value}
                    onClick={() => selectFrequency(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p>Calendar</p>
              <div className="schedule-date-grid">
                <label>
                  <span>Start</span>
                  <input
                    type="date"
                    value={draft.rangeStart}
                    aria-label="Schedule range start"
                    onChange={(event) => selectRange("rangeStart", event.target.value)}
                  />
                </label>
                <label>
                  <span>End</span>
                  <input
                    type="date"
                    value={draft.rangeEnd}
                    min={draft.rangeStart || undefined}
                    aria-label="Schedule range end"
                    onChange={(event) => selectRange("rangeEnd", event.target.value)}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="schedule-popover-footer">
            <button type="button" className="schedule-clear" onClick={clearSchedule}>Clear</button>
            <button type="button" className="schedule-apply" onClick={applyDraft}>Apply</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

async function notifyTaskEvent(event: "task_assigned" | "task_completed", task: Task, actorName = "Pristine Operations") {
  try {
    await fetch("/api/tasks/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        actorName,
        task: {
          id: task.id,
          title: task.title,
          category: task.category,
          priority: task.priority,
          dueDate: task.due_date,
          assignedBy: task.assigned_by,
          assignedTo: task.assignee,
          accountOrProperty: accountOrProperty(task),
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

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatAmericanDate(value: string | null) {
  if (!value) return "";
  const [datePart] = value.split("T");
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${month}/${day}/${year}`;
}

function getNextDueDate(task: Task) {
  if (!task.due_date || task.recurrence === "none") return "";

  const date = new Date(`${task.due_date}T00:00:00`);
  const customDays = Math.max(1, parseInt(task.custom_interval_days) || 1);
  const next =
    task.recurrence === "daily" ? addDays(date, 1) :
    task.recurrence === "weekly" ? addDays(date, 7) :
    task.recurrence === "biweekly" ? addDays(date, 14) :
    task.recurrence === "monthly" ? addMonths(date, 1) :
    task.recurrence === "quarterly" ? addMonths(date, 3) :
    task.recurrence === "yearly" ? addMonths(date, 12) :
    addDays(date, customDays);

  return formatDateInput(next);
}

// ─── Task card component ─────────────────────────────────────────────
function TaskCard({
  task, onEdit, onDelete, onMove, onDragStart, isDragging,
}: {
  task: Task;
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, status: Status) => void;
  onDragStart: (id: string) => void;
  isDragging: boolean;
}) {
  const pm = PRIORITY_META[task.priority];
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";
  const recurrence = task.recurrence ?? "none";

  return (
    <div
      className={`task-card ${task.status === "done" ? "task-done" : ""} ${isDragging ? "dragging" : ""}`}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", task.id);
        onDragStart(task.id);
      }}
      onDragEnd={() => onDragStart("")}
    >
      {/* Priority stripe */}
      <div className="task-stripe" style={{ background: pm.color }} />

      <div className="task-body">
        <div className="task-top">
          <span className="task-category"><GripVertical size={12} /> {task.category}</span>
          <div className="task-actions">
            {task.status !== "done" && (
              <button className="task-btn" title="Mark done"
                onClick={() => onMove(task.id, task.status === "todo" ? "in_progress" : "done")}>
                <ArrowRight size={12} />
              </button>
            )}
            {task.status === "done" && (
              <button className="task-btn" title="Reopen" onClick={() => onMove(task.id, "todo")}>
                <Circle size={12} />
              </button>
            )}
            <button className="task-btn" onClick={() => onEdit(task)}><Edit2 size={12} /></button>
            <button className="task-btn task-btn-del" onClick={() => onDelete(task.id)}><X size={12} /></button>
          </div>
        </div>

        <p className="task-title">{task.title || "Untitled operation"}</p>
        {task.description && <p className="task-desc">{task.description}</p>}
        <div className="task-details">
          <span className="task-detail-label">Assigned to</span>
          <span>{task.assignee || "Unassigned"}</span>
        </div>

        <div className="task-meta">
          <span className="priority-badge" style={{ background: pm.bg, color: pm.color }}>
            {pm.icon} {pm.label}
          </span>
          {task.due_date && (
            <span className={`due-badge ${isOverdue ? "overdue" : ""}`}>
              <Clock size={10} /> {formatAmericanDate(task.due_date)}
            </span>
          )}
          {task.reminder && (
            <span className="reminder-badge"><Bell size={10} /> Reminder</span>
          )}
          {recurrence !== "none" && (
            <span className="repeat-badge"><Repeat2 size={10} /> {RECURRENCE_LABELS[recurrence]}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskModal({
  initial, onSave, onClose,
}: {
  initial: Task;
  onSave: (t: Task) => void | Promise<void>;
  onClose: () => void;
}) {
  const [t, setT] = useState<Task>(() => normalizeTask(initial));
  const [activeTab, setActiveTab] = useState<"edit" | "log">("edit");
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    if (activeTab !== "log" || !initial.id) return;
    let cancelled = false;
    const loadLogs = async () => {
      setLoadingLogs(true);
      const { data } = await createClient()
        .from("operation_task_audit_log")
        .select("id, action, actor, note, details, created_at")
        .eq("task_id", initial.id)
        .order("created_at", { ascending: false });
      if (!cancelled) {
        setLogs(data ?? []);
        setLoadingLogs(false);
      }
    };
    void loadLogs();
    return () => {
      cancelled = true;
    };
  }, [activeTab, initial.id]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: "flex", gap: "15px" }}>
            <span className={`modal-title ${activeTab === "edit" ? "" : "text-muted-foreground"}`} style={{ cursor: "pointer" }} onClick={() => setActiveTab("edit")}>{initial.id && initial.title ? "Edit Operation" : "New Operation"}</span>
            {initial.id && initial.title && (
              <span className={`modal-title ${activeTab === "log" ? "" : "text-muted-foreground"}`} style={{ cursor: "pointer" }} onClick={() => setActiveTab("log")}>Activity Log</span>
            )}
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        {activeTab === "edit" ? (
          <div className="modal-body">
            <label className="field-label">Operation title *</label>
            <input className="field-input" placeholder="e.g. Check team supplies, Follow up with client…" value={t.title}
              onChange={(e) => setT({ ...t, title: e.target.value })} />

            <label className="field-label">Details</label>
            <textarea className="field-input field-textarea" placeholder="Context, instructions, priority notes…" value={t.description}
              onChange={(e) => setT({ ...t, description: e.target.value })} />

            <div className="field-row">
              <div style={{ flex: 1 }}>
                <label className="field-label">Priority</label>
                <select className="field-input" value={t.priority}
                  onChange={(e) => setT({ ...t, priority: e.target.value as Priority })}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="field-label">Status</label>
                <select className="field-input" value={t.status}
                  onChange={(e) => setT({ ...t, status: e.target.value as Status })}>
                  {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div className="field-row">
              <div style={{ flex: 1 }}>
                <label className="field-label">Category</label>
                <select className="field-input" value={t.category}
                  onChange={(e) => setT({ ...t, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="field-label">Due Date</label>
                <input className="field-input" type="date" value={t.due_date}
                  onChange={(e) => setT({ ...t, due_date: e.target.value })} />
              </div>
            </div>

            <div className="field-row">
              <div style={{ flex: 1 }}>
                <label className="field-label">Assigned to</label>
                <select className="field-input" value={t.assignee}
                  onChange={(e) => setT({ ...t, assignee: e.target.value })}>
                  {ASSIGNEES.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="field-label">Panel</label>
                <select className="field-input" value={t.panel}
                  onChange={(e) => setT({ ...t, panel: e.target.value as Task["panel"] })}>
                  <option>Residential</option>
                </select>
              </div>
            </div>

            <label className="field-label">Completion notes</label>
            <textarea className="field-input field-textarea" placeholder="Completion notes for owner review…" value={t.completion_notes}
              onChange={(e) => setT({ ...t, completion_notes: e.target.value })} />

            <div className="field-row">
              <div style={{ flex: 1 }}>
                <label className="field-label">Frequency</label>
                <select className="field-input" value={t.recurrence}
                  onChange={(e) => setT({ ...t, recurrence: e.target.value as Recurrence })}>
                  {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              {t.recurrence === "custom" && (
                <div style={{ flex: 1 }}>
                  <label className="field-label">Every N Days</label>
                  <input className="field-input" min="1" type="number" value={t.custom_interval_days}
                    onChange={(e) => setT({ ...t, custom_interval_days: e.target.value })} />
                </div>
              )}
            </div>

            <label className="checkbox-row">
              <input type="checkbox" checked={t.reminder}
                onChange={(e) => setT({ ...t, reminder: e.target.checked })} />
              <span>Activate reminder</span>
            </label>
          </div>
        ) : (
          <div className="modal-body" style={{ maxHeight: "400px", overflowY: "auto" }}>
            {loadingLogs ? <p className="text-sm text-muted-foreground text-center py-4">Loading activity...</p> : logs.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No activity logged.</p> : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {logs.map((log) => (
                  <div key={log.id} style={{ padding: "10px", background: "hsl(var(--muted)/.2)", borderRadius: "6px", fontSize: "0.75rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <strong style={{ color: "hsl(var(--foreground))", textTransform: "capitalize" }}>{log.action.replace(/_/g, ' ')}</strong>
                      <span style={{ color: "hsl(var(--muted-foreground))" }}>{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    {log.details?.reason && <p style={{ color: "hsl(0 84% 50%)", margin: "2px 0", fontWeight: "bold" }}>{log.details.reason}</p>}
                    {log.details?.actor && <p style={{ color: "hsl(var(--muted-foreground))", margin: "0" }}>Actor: {log.details.actor}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Discard</button>
          <button className="btn-save" onClick={() => { if (t.title.trim()) { onSave(t); onClose(); } }}>
            <Check size={14} /> Save Operation
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Arc Chart SVG ──────────────────────────────────────────────────
const ARC_PALETTE = [
  "hsl(158 38% 30%)",      // forest green (primary)
  "hsl(38 88% 52%)",       // amber
  "hsl(210 72% 52%)",      // steel blue
  "hsl(276 60% 58%)",      // violet
  "hsl(0 72% 54%)",        // red-rose
  "hsl(170 55% 40%)",      // teal
  "hsl(30 80% 55%)",       // warm orange
  "hsl(240 50% 60%)",      // indigo
];

interface ArcSegment {
  label: string;
  count: number;
  color: string;
}

function ArcDonutChart({ segments }: { segments: ArcSegment[] }) {
  const total = segments.reduce((s, x) => s + x.count, 0);
  if (total === 0) return (
    <div style={{ textAlign: "center", padding: "24px 0", fontSize: "0.78rem", color: "hsl(var(--muted-foreground))" }}>
      No task data yet
    </div>
  );

  const size = 110;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 46;
  const innerR = 30;
  const gap = 0.04; // radians gap between segments

  let angle = -Math.PI / 2;
  const paths: { d: string; color: string }[] = [];

  for (const seg of segments) {
    const frac = seg.count / total;
    const sweep = frac * 2 * Math.PI - gap;
    if (sweep <= 0) { angle += frac * 2 * Math.PI; continue; }
    const startAngle = angle + gap / 2;
    const endAngle = startAngle + sweep;

    const x1o = cx + outerR * Math.cos(startAngle);
    const y1o = cy + outerR * Math.sin(startAngle);
    const x2o = cx + outerR * Math.cos(endAngle);
    const y2o = cy + outerR * Math.sin(endAngle);
    const x1i = cx + innerR * Math.cos(endAngle);
    const y1i = cy + innerR * Math.sin(endAngle);
    const x2i = cx + innerR * Math.cos(startAngle);
    const y2i = cy + innerR * Math.sin(startAngle);
    const large = sweep > Math.PI ? 1 : 0;

    const d = [
      `M ${x1o} ${y1o}`,
      `A ${outerR} ${outerR} 0 ${large} 1 ${x2o} ${y2o}`,
      `L ${x1i} ${y1i}`,
      `A ${innerR} ${innerR} 0 ${large} 0 ${x2i} ${y2i}`,
      "Z",
    ].join(" ");

    paths.push({ d, color: seg.color });
    angle += frac * 2 * Math.PI;
  }

  return (
    <div className="arc-chart-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0, overflow: "visible" }}>
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill={p.color} opacity={0.88} style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.12))" }} />
        ))}
        {/* Center label */}
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize="14" fontWeight="800" fill="hsl(var(--foreground))" fontFamily="Outfit, sans-serif">{total}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="7.5" fontWeight="700" fill="hsl(var(--muted-foreground))" fontFamily="Outfit, sans-serif" textLength={32} lengthAdjust="spacing">TASKS</text>
      </svg>
      <div className="arc-legend">
        {segments.slice(0, 6).map((seg) => (
          <div key={seg.label} className="arc-legend-item">
            <div className="arc-legend-dot" style={{ background: seg.color }} />
            <span className="arc-legend-label">{seg.label}</span>
            <span className="arc-legend-val">{seg.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Mini Calendar ───────────────────────────────────────────────────
function MiniCalendar({ tasksByDate, todayStr }: { tasksByDate: Record<string, number>; todayStr: string }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const monthName = today.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ day: number | null; dateKey: string }> = [];

  for (let i = 0; i < firstDow; i++) cells.push({ day: null, dateKey: "" });
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    cells.push({ day: d, dateKey: `${year}-${mm}-${dd}` });
  }

  return (
    <div className="mini-cal-panel">
      <div className="mini-cal-head">
        <div>
          <div className="mini-cal-kicker">Calendar</div>
          <div className="mini-cal-month">{monthName}</div>
        </div>
      </div>
      <div className="mini-cal-grid">
        {["S","M","T","W","T","F","S"].map((d, i) => (
          <div key={i} className="mini-cal-daylabel">{d}</div>
        ))}
        {cells.map((cell, i) => {
          if (cell.day === null) return <div key={`e-${i}`} className="mini-cal-cell empty" />;
          const isToday = cell.dateKey === todayStr;
          const hasTasks = (tasksByDate[cell.dateKey] ?? 0) > 0;
          return (
            <div
              key={cell.dateKey}
              className={`mini-cal-cell${isToday ? " today" : ""}${hasTasks ? " has-tasks" : ""}`}
            >
              {cell.day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Dashboard page ───────────────────────────────────────────────────
function getDefaultTasks(): Task[] {
  return [
    { id: crypto.randomUUID(), title: "Confirm supply run for field crews", description: "Verify stock levels for disinfectants, microfiber cloths, and PPE before the morning dispatch.", priority: "urgent", status: "todo", category: "Inventory", due_date: new Date().toISOString().slice(0, 10), assignee: "Carlos Lopez", assigned_by: "Pristine Operations", account_name: "", property_address: "", panel: "Residential", completion_notes: "", reminder: true, recurrence: "daily", custom_interval_days: "" },
    { id: crypto.randomUUID(), title: "Inspect move-in service follow-up", description: "Review checklist status and confirm final photos are complete.", priority: "high", status: "todo", category: "Quality Control", due_date: "", assignee: "Carlos Lopez", assigned_by: "Pristine Operations", account_name: "", property_address: "", panel: "Residential", completion_notes: "", reminder: false, recurrence: "none", custom_interval_days: "" },
  ];
}

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [tasks, setTasks]   = useState<Task[]>([]);
  const [sopTemplates, setSopTemplates] = useState<SopTaskTemplate[]>([]);
  const [sopFilters, setSopFilters] = useState<SopFilters>(SOP_FILTERS_DEFAULT);
  const [modal, setModal]   = useState<Task | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [view, setView] = useState<"board" | "calendar">("board");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<Status | null>(null);
  const [generatingSop, setGeneratingSop] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadSupabaseTasks() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted || !user) return;
      setUserId(user.id);

      const { data, error } = await supabase
        .from("operation_tasks")
        .select("*")
        .eq("panel", "Residential")
        .order("created_at", { ascending: true });

      if (!mounted) return;

      if (error) {
        setLoadError(error.message);
        return;
      }

      if (data && data.length > 0) setTasks((data as TaskRow[]).map(fromTaskRow));

      if (!data || data.length === 0) {
        const seeded = getDefaultTasks().filter((task) => task.panel === "Residential");
        const { data: created, error: seedError } = await supabase
          .from("operation_tasks")
          .insert(seeded.map((task) => toTaskPayload(task, user.id)))
          .select("*");

        if (!mounted) return;
        if (seedError) {
          setLoadError(seedError.message);
          setTasks([]);
          return;
        }

        setTasks(((created ?? []) as TaskRow[]).map(fromTaskRow));
      }

      const seedResponse = await fetch("/api/residential-sop/seed", { method: "POST" });
      if (!mounted) return;
      if (!seedResponse.ok) {
        const result = await seedResponse.json().catch(() => null);
        setLoadError(result?.error ?? "Could not seed residential SOP templates.");
        return;
      }

      const { data: templates, error: templateError } = await supabase
        .from("operation_task_templates")
        .select("*")
        .eq("panel", "Residential")
        .eq("source", "monthly_sop")
        .order("week_of_month", { ascending: true, nullsFirst: true })
        .order("day_of_week", { ascending: true })
        .order("title", { ascending: true });

      if (!mounted) return;
      if (templateError) {
        setLoadError(templateError.message);
        return;
      }

      setSopTemplates(((templates ?? []) as SopTaskTemplateRow[]).map(fromSopTemplateRow));
    }

    loadSupabaseTasks();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function saveTask(t: Task) {
    if (!userId) return;
    const normalized = normalizeTask(t);
    const previous = tasks;
    const exists = previous.some((x) => x.id === normalized.id);
    setTasks((prev) => {
      return exists ? prev.map((x) => (x.id === t.id ? normalized : x)) : [...prev, normalized];
    });

    const { error } = exists
      ? await supabase.from("operation_tasks").update(toTaskPayload(normalized, userId)).eq("id", normalized.id)
      : await supabase.from("operation_tasks").insert(toTaskPayload(normalized, userId));

    if (error) {
      setLoadError(error.message);
      setTasks(previous);
      return;
    }
    if (!exists || previous.find((task) => task.id === normalized.id)?.assignee !== normalized.assignee) {
      notifyTaskEvent("task_assigned", normalized); // fire and forget
    }
  }

  async function deleteTask(id: string) {
    const previous = tasks;
    setTasks((prev) => prev.filter((x) => x.id !== id));
    const { error } = await supabase.from("operation_tasks").delete().eq("id", id);
    if (error) {
      setLoadError(error.message);
      setTasks(previous);
    }
  }

  async function moveTask(id: string, status: Status) {
    if (!userId) return;
    const current = tasks.find((x) => x.id === id);
    if (!current) return;

    const previous = tasks;
    const moved = { ...current, status };
    const normalized = normalizeTask(current);
    const nextDueDate = status === "done" ? getNextDueDate(normalized) : "";
    const nextTask = nextDueDate
      ? { ...normalized, id: crypto.randomUUID(), status: "todo" as Status, due_date: nextDueDate }
      : null;

    setTasks((prev) => [
      ...prev.map((x) => (x.id === id ? moved : x)),
      ...(nextTask ? [nextTask] : []),
    ]);

    const { error: updateError } = await supabase
      .from("operation_tasks")
      .update(toTaskPayload(moved, userId))
      .eq("id", id);
    const { error: insertError } = nextTask
      ? await supabase.from("operation_tasks").insert(toTaskPayload(nextTask, userId))
      : { error: null };

    if (updateError || insertError) {
      setLoadError(updateError?.message ?? insertError?.message ?? "Could not update task.");
      setTasks(previous);
      return;
    }
    if (status === "done" && current.status !== "done") {
      notifyTaskEvent("task_completed", moved, "Carlos Lopez"); // fire and forget
    }
  }

  async function generateMonthlySop() {
    setGeneratingSop(true);
    try {
      const res = await fetch("/api/residential-sop/generate", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to generate");
      alert(`SOP Generated!\nExpected: ${data.expected}\nCreated: ${data.created}\nExisting: ${data.existing}\nSkipped: ${data.skipped}`);
      window.location.reload();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      alert("Error generating SOP: " + message);
    } finally {
      setGeneratingSop(false);
    }
  }

  function handleDrop(status: Status, taskId: string) {
    setDropTarget(null);
    setDraggingTaskId(null);
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.status === status) return;
    moveTask(taskId, status);
  }

  const filtered = filter === "all" ? tasks : tasks.filter((t) => t.category === filter);
  const sopFilterOptions = useMemo(() => ({
    categories: Array.from(new Set(sopTemplates.map((task) => task.category))).sort(),
    assignees: Array.from(new Set(sopTemplates.map((task) => task.assigned_to))).sort(),
    statuses: Array.from(new Set(sopTemplates.map((task) => task.status))).sort(),
  }), [sopTemplates]);
  const filteredSopTemplates = useMemo(() => sopTemplates.filter((task) => {
    const matchesSchedule = taskMatchesScheduleFilter(task, sopFilters.schedule);
    const matchesCategory = sopFilters.category === "all" || task.category === sopFilters.category;
    const matchesAssignee = sopFilters.assignedTo === "all" || task.assigned_to === sopFilters.assignedTo;
    const matchesStatus = sopFilters.status === "all" || task.status === sopFilters.status;
    return matchesSchedule && matchesCategory && matchesAssignee && matchesStatus;
  }), [sopFilters, sopTemplates]);
  const hasScheduleFilter = isScheduleFilterActive(sopFilters.schedule);
  const urgentCount = tasks.filter((t) => t.priority === "urgent" && t.status !== "done").length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = tasks.filter((t) => t.due_date === todayStr && t.status !== "done").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const activeSopCount = sopTemplates.filter((task) => task.status === "active").length;

  // Arc chart: tasks by category
  const arcSegments = useMemo<ArcSegment[]>(() => {
    const catMap: Record<string, number> = {};
    for (const t of tasks) {
      if (!catMap[t.category]) catMap[t.category] = 0;
      catMap[t.category]++;
    }
    return Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count], i) => ({ label, count, color: ARC_PALETTE[i % ARC_PALETTE.length] }));
  }, [tasks]);

  // Mini calendar: tasks by date
  const tasksByDate = useMemo(() => {
    const byDate: Record<string, number> = {};
    for (const t of tasks) {
      if (!t.due_date) continue;
      const key = t.due_date.slice(0, 10);
      byDate[key] = (byDate[key] ?? 0) + 1;
    }
    return byDate;
  }, [tasks]);

  // Operating queue: sort by urgency / due date, take top 10
  const queueTasks = useMemo(() => {
    const priorityOrder: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
    return [...tasks]
      .filter((t) => t.status !== "done")
      .sort((a, b) => {
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pDiff !== 0) return pDiff;
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return 0;
      })
      .slice(0, 10);
  }, [tasks]);

  function clearSopScheduleFilter() {
    setSopFilters((current) => ({ ...current, schedule: SOP_SCHEDULE_DEFAULT }));
  }

  function clearAllSopFilters() {
    setSopFilters(SOP_FILTERS_DEFAULT);
  }

  const calendarDays = useMemo<CalendarDay[]>(() => {
    if (view !== "calendar") return [];
    const byDate: Record<string, Task[]> = {};
    for (const t of filtered) {
      if (!t.due_date) continue;
      if (!byDate[t.due_date]) byDate[t.due_date] = [];
      byDate[t.due_date].push(t);
    }
    const days: CalendarDay[] = [];
    const start = new Date();
    start.setDate(1);
    const year = start.getFullYear();
    const month = start.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = start.getDay();
    
    // Add blank days for calendar alignment
    for (let i = 0; i < firstDay; i++) {
       days.push({ empty: true, key: `empty-start-${i}` });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const iso = formatDateInput(d);
      days.push({ empty: false, key: iso, date: iso, day: i, tasks: byDate[iso] || [] });
    }
    return days;
  }, [filtered, view]);

  return (
    <DashboardShell userEmail="pristinecleanersoc@gmail.com">
      <style>{`
        /* ── Page ── */
        .dash-page { display:flex; flex-direction:column; gap:20px; }
        .dash-header { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:14px; border:1px solid hsl(var(--border)/.7); border-radius:16px; padding:20px 24px; background:hsl(var(--card)); box-shadow:0 1px 3px hsl(215 30% 15%/.04), 0 8px 28px -12px hsl(215 30% 15%/.07); }
        .dash-title { font-size:1.55rem; font-weight:700; color:hsl(var(--foreground)); line-height:1.1; letter-spacing:-.015em; }
        .dash-sub { font-size:0.82rem; color:hsl(var(--muted-foreground)); margin-top:4px; font-weight:500; }

        /* ── KPI bar ── */
        .kpi-bar { display:grid; grid-template-columns:repeat(5, minmax(0, 1fr)); gap:12px; }
        .kpi {
          position:relative; min-width:0; padding:18px 20px 16px;
          border-radius:14px; overflow:hidden;
          background:hsl(var(--card)/.98);
          border:1px solid hsl(var(--border)/.7);
          box-shadow:0 4px 24px -8px hsl(215 40% 20%/.08), 0 1px 3px hsl(215 40% 20%/.06);
          transition:transform .2s ease, box-shadow .2s ease, border-color .2s ease;
          cursor:default;
        }
        .kpi:hover {
          transform:translateY(-2px);
          box-shadow:0 12px 36px -10px hsl(215 40% 20%/.14), 0 4px 8px hsl(215 40% 20%/.06);
          border-color:hsl(var(--border));
        }
        .kpi-glow {
          position:absolute; inset:0; opacity:.06;
          pointer-events:none;
        }
        .kpi-icon-wrap {
          width:38px; height:38px; border-radius:10px;
          display:flex; align-items:center; justify-content:center;
          margin-bottom:14px; flex-shrink:0;
          transition:transform .2s ease;
        }
        .kpi:hover .kpi-icon-wrap { transform:scale(1.08); }
        .kpi-content { display:flex; flex-direction:column; gap:2px; }
        .kpi-label {
          font-size:0.67rem; font-weight:700; text-transform:uppercase;
          letter-spacing:.07em; color:hsl(var(--muted-foreground));
          line-height:1;
        }
        .kpi-val {
          font-size:1.9rem; font-weight:800; line-height:1.1;
          color:hsl(var(--foreground)); letter-spacing:-.02em;
          margin-top:2px;
        }
        .kpi-sub {
          font-size:0.7rem; font-weight:600; margin-top:4px;
          color:hsl(var(--muted-foreground)); line-height:1.2;
        }
        .service-grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:12px; margin-top:12px; }
        @media (max-width:960px) { .service-grid { grid-template-columns:1fr; } }
        .service-card { padding:16px 18px; border-radius:14px; background:hsl(var(--card)); border:1px solid hsl(var(--border)/.7); box-shadow:0 1px 3px hsl(215 30% 15%/.04), 0 6px 20px -8px hsl(215 30% 15%/.07); transition:box-shadow .2s ease, border-color .2s ease; }
        .service-card:hover { box-shadow:0 4px 24px -6px hsl(215 30% 15%/.1); border-color:hsl(var(--border)); }
        .service-card-header { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; }
        .service-type { font-size:.66rem; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:hsl(var(--muted-foreground)); }
        .service-card p { margin:0 0 10px; font-size:.85rem; line-height:1.55; color:hsl(var(--muted-foreground)); }
        .service-badges { display:flex; flex-wrap:wrap; gap:6px; }
        .service-badges span { padding:4px 10px; border-radius:999px; font-size:.66rem; font-weight:700; background:hsl(var(--primary)/.08); color:hsl(var(--primary)); border:1px solid hsl(var(--primary)/.12); }
        .sop-section { border:1px solid hsl(var(--border)/.7); border-radius:16px; background:hsl(var(--card)); overflow:hidden; box-shadow:0 1px 3px hsl(215 30% 15%/.04), 0 8px 28px -12px hsl(215 30% 15%/.07); }
        .sop-head { display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:12px; padding:18px 20px; border-bottom:1px solid hsl(var(--border)/.6); }
        .sop-kicker { display:flex; align-items:center; gap:6px; font-size:.66rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:hsl(var(--primary)); }
        .sop-title { margin-top:5px; font-size:1rem; font-weight:700; color:hsl(var(--foreground)); letter-spacing:-.01em; }
        .sop-sub { margin-top:3px; color:hsl(var(--muted-foreground)); font-size:.78rem; font-weight:500; line-height:1.4; }
        .sop-count { border-radius:10px; background:hsl(var(--primary)/.09); color:hsl(var(--primary)); padding:8px 12px; font-size:.75rem; font-weight:700; white-space:nowrap; border:1px solid hsl(var(--primary)/.12); }
        .sop-filters { position:relative; display:flex; flex-wrap:wrap; align-items:flex-end; gap:8px; padding:10px 16px; border-bottom:1px solid hsl(var(--border)/.6); background:hsl(var(--muted)/.25); }
        .sop-select-field { display:flex; flex-direction:column; gap:5px; min-width:145px; flex:1 1 145px; }
        .sop-select-field span { font-size:.62rem; font-weight:950; text-transform:uppercase; color:hsl(var(--muted-foreground)); }
        .sop-select-field select { height:38px; border:1px solid hsl(var(--border)); border-radius:8px; background:hsl(var(--background)); color:hsl(var(--foreground)); padding:0 9px; font-size:.75rem; font-weight:850; min-width:0; outline:none; transition:border-color .15s, box-shadow .15s; }
        .sop-select-field select:focus-visible { border-color:hsl(var(--primary)); box-shadow:0 0 0 3px hsl(var(--primary)/.12); }
        .sop-clear-filters { height:38px; display:inline-flex; align-items:center; justify-content:center; gap:6px; border:1px solid hsl(var(--border)); border-radius:8px; background:hsl(var(--background)); color:hsl(var(--muted-foreground)); padding:0 12px; font-size:.75rem; font-weight:900; cursor:pointer; transition:all .15s ease; }
        .sop-clear-filters:hover { border-color:hsl(var(--primary)/.35); color:hsl(var(--primary)); background:hsl(var(--primary)/.06); }
        .sop-clear-filters:focus-visible { outline:3px solid hsl(var(--primary)/.18); outline-offset:2px; }
        .schedule-filter { position:relative; flex:2 1 250px; min-width:230px; }
        .schedule-trigger { width:100%; min-height:38px; display:flex; align-items:center; gap:8px; border:1px solid hsl(var(--border)); border-radius:8px; background:hsl(var(--background)); color:hsl(var(--foreground)); padding:7px 10px; cursor:pointer; text-align:left; transition:all .15s ease; }
        .schedule-trigger:hover, .schedule-trigger.active { border-color:hsl(var(--primary)/.36); background:hsl(var(--primary)/.055); }
        .schedule-trigger:focus-visible { outline:3px solid hsl(var(--primary)/.18); outline-offset:2px; }
        .schedule-trigger-copy { display:flex; flex-direction:column; min-width:0; flex:1; gap:1px; }
        .schedule-trigger-copy span { font-size:.6rem; line-height:1; font-weight:950; letter-spacing:.04em; text-transform:uppercase; color:hsl(var(--muted-foreground)); }
        .schedule-trigger-copy strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:.76rem; line-height:1.15; font-weight:950; color:hsl(var(--foreground)); }
        .schedule-popover { position:absolute; z-index:40; top:calc(100% + 8px); left:0; width:min(680px, calc(100vw - 32px)); max-height:min(78vh, 680px); overflow:auto; border:1px solid hsl(var(--border)); border-radius:8px; background:hsl(var(--card)); box-shadow:0 28px 90px -34px rgba(15,23,42,.38); padding:12px; }
        .schedule-popover-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:4px 4px 10px; border-bottom:1px solid hsl(var(--border)); }
        .schedule-popover-head div { display:flex; flex-direction:column; gap:3px; min-width:0; }
        .schedule-popover-head span, .schedule-section p, .schedule-date-grid span { margin:0; font-size:.62rem; line-height:1.1; font-weight:950; letter-spacing:.05em; text-transform:uppercase; color:hsl(var(--muted-foreground)); }
        .schedule-popover-head strong { font-size:.9rem; line-height:1.25; font-weight:950; color:hsl(var(--foreground)); }
        .schedule-icon-btn { width:30px; height:30px; display:inline-flex; align-items:center; justify-content:center; border:1px solid hsl(var(--border)); border-radius:8px; background:hsl(var(--background)); color:hsl(var(--muted-foreground)); cursor:pointer; }
        .schedule-icon-btn:hover { color:hsl(var(--primary)); border-color:hsl(var(--primary)/.35); }
        .schedule-icon-btn:focus-visible, .schedule-chip:focus-visible, .schedule-date-grid input:focus-visible, .schedule-clear:focus-visible, .schedule-apply:focus-visible { outline:3px solid hsl(var(--primary)/.18); outline-offset:2px; }
        .schedule-section { padding:12px 4px 0; }
        .schedule-section.two-col { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        .schedule-chip-grid { display:flex; flex-wrap:wrap; gap:7px; margin-top:8px; }
        .schedule-chip-grid.quick .schedule-chip { flex:1 1 138px; }
        .schedule-chip-grid.compact .schedule-chip { flex:1 1 70px; }
        .schedule-chip-grid.patterns .schedule-chip { flex:1 1 150px; }
        .schedule-chip { min-height:32px; border:1px solid hsl(var(--border)); border-radius:8px; background:hsl(var(--background)); color:hsl(var(--foreground)); padding:6px 9px; font-size:.74rem; font-weight:850; cursor:pointer; transition:all .15s ease; }
        .schedule-chip:hover { border-color:hsl(var(--primary)/.35); background:hsl(var(--primary)/.055); }
        .schedule-chip.selected { border-color:hsl(var(--primary)/.55); background:hsl(var(--primary)/.11); color:hsl(var(--primary)); box-shadow:inset 0 0 0 1px hsl(var(--primary)/.08); }
        .schedule-date-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:8px; }
        .schedule-date-grid label { display:flex; flex-direction:column; gap:5px; min-width:0; }
        .schedule-date-grid input { width:100%; height:34px; border:1px solid hsl(var(--border)); border-radius:8px; background:hsl(var(--background)); color:hsl(var(--foreground)); padding:0 8px; font-size:.74rem; font-weight:800; font-family:inherit; box-sizing:border-box; }
        .schedule-popover-footer { display:flex; justify-content:flex-end; gap:8px; padding:12px 4px 2px; margin-top:2px; border-top:1px solid hsl(var(--border)); }
        .schedule-clear, .schedule-apply { height:34px; border-radius:8px; padding:0 13px; font-size:.75rem; font-weight:950; cursor:pointer; }
        .schedule-clear { border:1px solid hsl(var(--border)); background:transparent; color:hsl(var(--muted-foreground)); }
        .schedule-apply { border:1px solid hsl(var(--primary)); background:hsl(var(--primary)); color:hsl(var(--primary-foreground)); }
        .sop-list { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); }
        .sop-item { display:flex; flex-direction:column; gap:9px; padding:13px 14px; border-bottom:1px solid hsl(var(--border)); min-width:0; }
        .sop-item:nth-child(odd) { border-right:1px solid hsl(var(--border)); }
        .sop-item-top { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
        .sop-item h3 { margin:0; font-size:.86rem; font-weight:950; line-height:1.25; color:hsl(var(--foreground)); }
        .sop-description { margin:0; color:hsl(var(--muted-foreground)); font-size:.74rem; line-height:1.45; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .sop-badges { display:flex; flex-wrap:wrap; gap:5px; }
        .sop-badge { display:inline-flex; align-items:center; gap:4px; border-radius:999px; background:hsl(var(--muted)/.5); color:hsl(var(--muted-foreground)); padding:3px 7px; font-size:.65rem; font-weight:900; }
        .sop-badge.high { background:hsl(25 95% 55%/.12); color:#f97316; }
        .sop-empty { grid-column:1 / -1; padding:34px 18px; text-align:center; color:hsl(var(--muted-foreground)); font-size:.82rem; font-weight:800; }
        .sop-empty-card { max-width:360px; margin:0 auto; display:flex; flex-direction:column; align-items:center; gap:8px; }
        .sop-empty-card h3 { margin:0; color:hsl(var(--foreground)); font-size:.98rem; font-weight:950; }
        .sop-empty-card p { margin:0; line-height:1.45; }
        .sop-empty-card button { margin-top:4px; height:34px; border:1px solid hsl(var(--border)); border-radius:8px; background:hsl(var(--background)); color:hsl(var(--primary)); padding:0 12px; font-size:.75rem; font-weight:950; cursor:pointer; }
        .sop-empty-card button:focus-visible { outline:3px solid hsl(var(--primary)/.18); outline-offset:2px; }
        @media (max-width:760px) {
          .sop-list { grid-template-columns:1fr; }
          .sop-item:nth-child(odd) { border-right:none; }
          .sop-filters { align-items:stretch; }
          .schedule-filter, .sop-select-field, .sop-clear-filters { flex-basis:100%; min-width:0; }
          .schedule-popover { position:fixed; inset:auto 12px 12px; width:auto; max-height:86vh; }
          .schedule-section.two-col { grid-template-columns:1fr; }
        }
        @media (max-width:520px) { .schedule-date-grid { grid-template-columns:1fr; } }
        @media (max-width:1080px) { .kpi-bar { grid-template-columns:repeat(3, minmax(0, 1fr)); } }
        @media (max-width:760px) { .kpi-bar { grid-template-columns:repeat(2, minmax(0, 1fr)); } }
        @media (max-width:480px) { .kpi-bar { grid-template-columns:1fr; } }

        /* ── Filter bar ── */
        .filter-bar { display:flex; flex-wrap:wrap; gap:6px; align-items:center; border:1px solid hsl(var(--border)/.82); border-radius:8px; background:hsl(var(--card)/.72); padding:7px; }
        .filter-btn { padding:6px 12px; border-radius:7px; border:1px solid transparent;
          background:transparent; font-size:0.78rem; font-weight:700; cursor:pointer;
          color:hsl(var(--muted-foreground)); transition:all .18s ease; }
        .filter-btn:hover { background:hsl(var(--accent)); color:hsl(var(--accent-foreground)); }
        .filter-btn.active { background:hsl(var(--primary)); color:hsl(var(--primary-foreground)); border-color:hsl(var(--primary)); box-shadow:0 10px 22px -18px hsl(var(--primary)); }

        /* ── Add task button ── */
        .add-btn { display:flex; align-items:center; gap:6px; padding:9px 16px;
          border-radius:8px; background:hsl(var(--primary)); color:hsl(var(--primary-foreground));
          font-size:0.83rem; font-weight:700; border:none; cursor:pointer;
          box-shadow:0 14px 28px -22px hsl(var(--primary)); transition:all .18s ease; }
        .add-btn:hover:not(:disabled) { transform:translateY(-1px); filter:saturate(1.05); }
        .add-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        /* ── Trello board & Calendar ── */
        .board { display:grid; grid-template-columns:repeat(3, minmax(310px, 1fr)); gap:14px; align-items:start; overflow-x:auto; padding-bottom:4px; }
        .calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
        .calendar-day { background: hsl(var(--card)/.68); border: 1px solid hsl(var(--border)/.72); border-radius: 8px; padding: 10px; min-height: 120px; box-shadow: 0 10px 30px -25px hsl(215 40% 20%); }
        .calendar-date { font-size: 0.8rem; font-weight: 800; color: hsl(var(--muted-foreground)); margin-bottom: 8px; text-align: right; }
        .calendar-task { background: hsl(var(--background)); border: 1px solid hsl(var(--border)); border-radius: 4px; padding: 4px 6px; font-size: 0.7rem; margin-bottom: 4px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; color: hsl(var(--foreground)); transition: border-color .2s; }
        .calendar-task:hover { border-color: hsl(var(--primary)/.4); }
        .calendar-more { font-size: 0.65rem; color: hsl(var(--primary)); font-weight: 700; cursor: pointer; text-align: center; margin-top: 4px; }
        
        @media (max-width:800px) { .board { grid-template-columns:1fr; } .calendar-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width:640px) { .calendar-grid { grid-template-columns: 1fr; } }

        .column { background:hsl(var(--card)/.68); border:1px solid hsl(var(--border)/.72); border-radius:8px; padding:12px; min-height:360px; transition:border-color .16s ease, background .16s ease, box-shadow .16s ease; box-shadow:0 18px 55px -50px hsl(215 40% 20%); }
        .column.drop-active { border-color:hsl(var(--primary)/.45); background:hsl(var(--primary)/.06); box-shadow:inset 0 0 0 1px hsl(var(--primary)/.16); }
        .col-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
        .col-title { display:flex; align-items:center; gap:7px; font-size:0.85rem; font-weight:700;
          color:hsl(var(--foreground)); }
        .col-count { font-size:0.72rem; font-weight:700; padding:2px 8px; border-radius:99px;
          background:hsl(var(--muted)); color:hsl(var(--muted-foreground)); }
        .col-add { display:flex; align-items:center; justify-content:center; width:26px; height:26px;
          border-radius:7px; border:1px dashed hsl(var(--border)); background:transparent;
          cursor:pointer; color:hsl(var(--muted-foreground)); transition:all .12s; }
        .col-add:hover { background:hsl(var(--primary)/.08); color:hsl(var(--primary)); border-color:hsl(var(--primary)/.4); }

        .tasks-list { display:flex; flex-direction:column; gap:8px; min-height:280px; }

        /* ── Task card ── */
        .task-card { background:hsl(var(--card)); border:1px solid hsl(var(--border)/.7);
          border-radius:12px; overflow:hidden; display:flex;
          transition:box-shadow .18s, transform .18s, opacity .2s, border-color .18s; cursor:grab;
          box-shadow:0 1px 2px hsl(215 30% 15%/.03); }
        .task-card:active { cursor:grabbing; }
        .task-card:hover { border-color:hsl(var(--primary)/.22); box-shadow:0 4px 18px -6px hsl(215 30% 15%/.1); transform:translateY(-1px); }
        .task-card.dragging { opacity:.4; border-color:hsl(var(--primary)/.5); }
        .task-done { opacity:.5; }
        .task-stripe { width:3px; flex-shrink:0; }
        .task-body { padding:10px 13px; flex:1; min-width:0; }
        .task-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:5px; }
        .task-category { display:flex; align-items:center; gap:4px; font-size:0.62rem; font-weight:700; text-transform:uppercase;
          letter-spacing:.05em; color:hsl(var(--muted-foreground)/.8); }
        .task-actions { display:flex; gap:2px; opacity:0; transition:opacity .15s; }
        .task-card:hover .task-actions { opacity:1; }
        .task-btn { display:flex; align-items:center; justify-content:center; width:22px; height:22px;
          border-radius:6px; border:none; background:transparent; cursor:pointer;
          color:hsl(var(--muted-foreground)); transition:all .12s; }
        .task-btn:hover { background:hsl(var(--accent)); color:hsl(var(--accent-foreground)); }
        .task-btn-del:hover { background:hsl(0 84% 60%/.1); color:hsl(0 72% 48%); }
        .task-title { font-size:0.82rem; font-weight:600; color:hsl(var(--foreground));
          line-height:1.3; margin-bottom:4px; }
        .task-desc { font-size:0.73rem; color:hsl(var(--muted-foreground)); line-height:1.45;
          margin-bottom:6px; overflow:hidden; display:-webkit-box;
          -webkit-line-clamp:2; -webkit-box-orient:vertical; }
        .task-details { display:flex; justify-content:space-between; gap:10px; font-size:0.72rem; color:hsl(var(--muted-foreground)); margin-bottom:7px; }
        .task-detail-label { font-weight:700; text-transform:uppercase; letter-spacing:.05em; font-size:.62rem; }
        .task-meta { display:flex; flex-wrap:wrap; gap:4px; align-items:center; }
        .priority-badge { display:flex; align-items:center; gap:3px; font-size:0.63rem;
          font-weight:700; padding:2px 7px; border-radius:99px; }
        .due-badge { display:flex; align-items:center; gap:3px; font-size:0.63rem; font-weight:600;
          padding:2px 7px; border-radius:99px;
          background:hsl(var(--muted)/.7); color:hsl(var(--muted-foreground)); }
        .due-badge.overdue { background:hsl(0 80% 55%/.1); color:hsl(0 72% 48%); }
        .reminder-badge { display:flex; align-items:center; gap:3px; font-size:0.63rem; font-weight:600;
          padding:2px 7px; border-radius:99px;
          background:hsl(38 90% 50%/.1); color:hsl(32 80% 38%); }
        .repeat-badge { display:flex; align-items:center; gap:3px; font-size:0.63rem; font-weight:600;
          padding:2px 7px; border-radius:99px;
          background:hsl(158 40% 30%/.1); color:hsl(158 38% 28%); }

        /* ── Modal ── */
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:100;
          display:flex; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(4px); }
        .modal-box { background:hsl(var(--card)); border:1px solid hsl(var(--border)); border-radius:8px;
          width:100%; max-width:480px; box-shadow:0 24px 80px -20px rgba(0,0,0,.4);
          animation:slideUp .2s ease; }
        @keyframes slideUp { from { transform:translateY(20px); opacity:0; } to { transform:none; opacity:1; } }
        .modal-header { display:flex; align-items:center; justify-content:space-between;
          padding:18px 22px; border-bottom:1px solid hsl(var(--border)); }
        .modal-title { font-size:1rem; font-weight:700; color:hsl(var(--foreground)); }
        .modal-close { display:flex; align-items:center; justify-content:center; width:28px; height:28px;
          border-radius:8px; border:none; background:hsl(var(--muted)); cursor:pointer;
          color:hsl(var(--muted-foreground)); }
        .modal-body { padding:18px 22px; display:flex; flex-direction:column; gap:12px; }
        .modal-footer { display:flex; justify-content:flex-end; gap:8px;
          padding:14px 22px; border-top:1px solid hsl(var(--border)); }
        .field-label { font-size:0.72rem; font-weight:700; color:hsl(var(--muted-foreground));
          text-transform:uppercase; letter-spacing:.05em; display:block; margin-bottom:4px; }
        .field-input { width:100%; background:hsl(var(--background)); border:1px solid hsl(var(--border));
          border-radius:8px; padding:8px 10px; font-size:0.84rem; color:hsl(var(--foreground));
          font-family:inherit; outline:none; transition:border-color .15s, box-shadow .15s; box-sizing:border-box; }
        .field-input:focus { border-color:hsl(var(--primary)); box-shadow:0 0 0 3px hsl(var(--primary)/.1); }
        .field-textarea { min-height:70px; resize:vertical; }
        .field-row { display:flex; gap:12px; }
        .checkbox-row { display:flex; align-items:center; gap:8px; font-size:0.82rem;
          font-weight:500; color:hsl(var(--foreground)); cursor:pointer; }
        .btn-cancel { padding:8px 18px; border-radius:9px; border:1px solid hsl(var(--border));
          background:transparent; font-size:0.83rem; font-weight:600; cursor:pointer;
          color:hsl(var(--muted-foreground)); }
        .btn-save { display:flex; align-items:center; gap:6px; padding:8px 20px; border-radius:9px;
          background:hsl(var(--primary)); color:hsl(var(--primary-foreground));
          font-size:0.83rem; font-weight:700; border:none; cursor:pointer; }
      `}</style>

      {modal && (
        <TaskModal initial={modal} onSave={saveTask} onClose={() => setModal(null)} />
      )}

      <div className="dash-page">
        {/* Header */}
        <div className="dash-header">
          <div>
            <h1 className="dash-title">Cleaning Operations Center</h1>
            <p className="dash-sub">Pristine Cleaners — Residential Operations Center</p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button className="add-btn" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))", boxShadow: "none" }} onClick={() => setView(view === "board" ? "calendar" : "board")}>
              <CalendarDays size={15} /> {view === "board" ? "Calendar View" : "Board View"}
            </button>
            <button className="add-btn" onClick={() => setModal(emptyTask())}>
              <Plus size={15} /> Add Operation
            </button>
          </div>
        </div>

        {loadError ? (
          <p className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive">{loadError}</p>
        ) : null}

        {/* KPI Metric Strip */}
        <div className="metric-strip" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
          {/* Tasks Today */}
          <div className="metric-strip-item">
            <span className="metric-strip-label">Tasks Today</span>
            <span className="metric-strip-value" style={todayCount > 0 ? { color: "hsl(var(--primary))" } : undefined}>
              {todayCount}
            </span>
            <span className="metric-strip-note">Due for today</span>
          </div>

          {/* Urgent */}
          <div className="metric-strip-item">
            <span className="metric-strip-label">Urgent</span>
            <span className="metric-strip-value" style={urgentCount > 0 ? { color: "hsl(0 72% 48%)" } : undefined}>
              {urgentCount}
            </span>
            <span className="metric-strip-note">Urgent priority tasks</span>
          </div>

          {/* Completed */}
          <div className="metric-strip-item">
            <span className="metric-strip-label">Completed</span>
            <span className="metric-strip-value" style={doneCount > 0 ? { color: "hsl(142 60% 36%)" } : undefined}>
              {doneCount}
            </span>
            <span className="metric-strip-note">Completed operations</span>
          </div>

          {/* Pending Payments */}
          <div className="metric-strip-item">
            <span className="metric-strip-label">Pending Payments</span>
            <span className="metric-strip-value">$1,240</span>
            <span className="metric-strip-note">5 invoices pending</span>
          </div>

          {/* Active Teams */}
          <div className="metric-strip-item">
            <span className="metric-strip-label">Active Teams</span>
            <span className="metric-strip-value">4</span>
            <span className="metric-strip-note">Teams in operations</span>
          </div>
        </div>

        {/* 2-Column Grid: Operating Queue (Left) & Mini-Calendar + Team Distribution (Right) */}
        <div className="dash-overview-grid">
          {/* Left Column: Operating Queue */}
          <div className="queue-panel">
            <div className="queue-panel-head">
              <div>
                <div className="queue-panel-kicker">Operations Queue</div>
                <div className="queue-panel-title">Today's Priority Dispatch</div>
              </div>
              <span className="queue-panel-count">{queueTasks.length} pending</span>
            </div>
            <div className="queue-body">
              {queueTasks.length === 0 ? (
                <div style={{ padding: "20px 0", textAlign: "center", fontSize: "0.75rem", color: "hsl(var(--muted-foreground))" }}>
                  All clear! No pending tasks today.
                </div>
              ) : (
                queueTasks.slice(0, 8).map((t) => {
                  const isOverdue = t.due_date && t.due_date < todayStr && t.status !== "done";
                  const dotClass = t.status === "done" ? "done" : t.status === "in_progress" ? "progress" : isOverdue ? "overdue" : "pending";
                  return (
                    <div key={t.id} className="queue-row" onClick={() => setModal(t)} style={{ cursor: "pointer" }}>
                      <span className={`queue-dot ${dotClass}`} />
                      <span className="queue-row-title">{t.title}</span>
                      <div className="queue-row-meta">
                        <span className="queue-row-cat">{t.category}</span>
                        <span className={`queue-row-due ${isOverdue ? "overdue" : ""}`}>
                          {t.due_date ? formatAmericanDate(t.due_date) : "No due date"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Mini-Calendar + Team Distribution */}
          <div className="right-col">
            <MiniCalendar tasksByDate={tasksByDate} todayStr={todayStr} />
            <div className="arc-panel">
              <div className="arc-panel-head">
                <div className="arc-panel-kicker">Analytics</div>
                <div className="arc-panel-title">Tasks by Category</div>
              </div>
              <ArcDonutChart segments={arcSegments} />
            </div>
          </div>
        </div>

        {/* Bottom Section: Condensed Operations Table */}
        <div className="ops-section">
          <div className="ops-section-head">
            <div>
              <div className="ops-section-kicker">All Operations</div>
              <div className="ops-section-title">Task Log &amp; Status</div>
            </div>
            <span className="queue-panel-count">{tasks.length} total</span>
          </div>
          <div className="ops-table-wrap">
            <table className="sop-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: "16px", textAlign: "left" }}>Task</th>
                  <th style={{ textAlign: "left" }}>Assignee</th>
                  <th style={{ textAlign: "left" }}>Category</th>
                  <th style={{ textAlign: "left" }}>Priority</th>
                  <th style={{ textAlign: "left" }}>Due Date</th>
                  <th style={{ textAlign: "left" }}>Status</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "hsl(var(--muted-foreground))", fontSize: "0.8rem" }}>
                      No operations yet — add your first task.
                    </td>
                  </tr>
                ) : tasks.slice().sort((a, b) => {
                  const order: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
                  return order[a.priority] - order[b.priority];
                }).map((t) => {
                  const pm = PRIORITY_META[t.priority];
                  const isOverdue = t.due_date && t.due_date < todayStr && t.status !== "done";
                  return (
                    <tr key={t.id}>
                      <td style={{ paddingLeft: "16px" }}>
                        <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "hsl(var(--foreground))", maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.title}>
                          {t.title || "Untitled"}
                        </div>
                      </td>
                      <td style={{ color: "hsl(var(--muted-foreground))", fontSize: "0.74rem" }}>{t.assignee || "—"}</td>
                      <td style={{ color: "hsl(var(--muted-foreground))", fontSize: "0.74rem", whiteSpace: "nowrap" }}>{t.category}</td>
                      <td>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.7rem", fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: pm.bg, color: pm.color, whiteSpace: "nowrap" }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: pm.color }} />
                          {pm.label}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.74rem", color: isOverdue ? "hsl(0 72% 48%)" : "hsl(var(--muted-foreground))", fontWeight: isOverdue ? 700 : 500, whiteSpace: "nowrap" }}>
                        {formatAmericanDate(t.due_date) || "—"}
                      </td>
                      <td>
                        <span className={`status-dot-badge ${t.status === "done" ? "dot-green" : t.status === "in_progress" ? "dot-slate" : isOverdue ? "dot-red" : "dot-amber"}`}>
                          {t.status === "done" ? "Completed" : t.status === "in_progress" ? "In Service" : isOverdue ? "Overdue" : "Scheduled"}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions" style={{ display: "flex", gap: 4, justifyContent: "flex-end", paddingRight: "16px" }}>
                          <button className="task-btn" title="Edit" onClick={() => setModal(t)}><Edit2 size={12} /></button>
                          <button className="task-btn task-btn-del" title="Delete" onClick={() => deleteTask(t.id)}><X size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Filter bar for board/calendar */}
        <div className="filter-bar">
          <button className={`filter-btn ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>All</button>
          {CATEGORIES.map((c) => (
            <button key={c} className={`filter-btn ${filter === c ? "active" : ""}`} onClick={() => setFilter(c)}>{c}</button>
          ))}
          {tasks.some((task) => task.category === "Janitorial") ? (
            <button className={`filter-btn ${filter === "Janitorial" ? "active" : ""}`} onClick={() => setFilter("Janitorial")}>Janitorial (legacy)</button>
          ) : null}
        </div>

        {/* SOP templates */}
        <section className="sop-section">
          <div className="sop-head">
            <div>
              <p className="sop-kicker"><CalendarDays size={14} /> Residential SOP Tasks</p>
              <h2 className="sop-title">June SOP Checklist</h2>
              <p className="sop-sub">Assigned to Carlos Lopez as Operations Manager. Templates do not send assignment emails until real task instances are created.</p>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <div className="sop-count">{filteredSopTemplates.length} shown / {activeSopCount} active</div>
              <button className="add-btn" onClick={generateMonthlySop} disabled={generatingSop}>
                {generatingSop ? "Generating..." : "Generate Monthly SOP"}
              </button>
            </div>
          </div>
          <div className="sop-filters">
            <ScheduleFilterPopover
              value={sopFilters.schedule}
              onChange={(schedule) => setSopFilters((current) => ({ ...current, schedule }))}
            />
            <label className="sop-select-field">
              <span>Category</span>
              <select value={sopFilters.category} onChange={(event) => setSopFilters((current) => ({ ...current, category: event.target.value }))}>
                <option value="all">All categories</option>
                {sopFilterOptions.categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label className="sop-select-field">
              <span>Assigned to</span>
              <select value={sopFilters.assignedTo} onChange={(event) => setSopFilters((current) => ({ ...current, assignedTo: event.target.value }))}>
                <option value="all">All owners</option>
                {sopFilterOptions.assignees.map((assignee) => <option key={assignee} value={assignee}>{assignee}</option>)}
              </select>
            </label>
            <label className="sop-select-field">
              <span>Status</span>
              <select value={sopFilters.status} onChange={(event) => setSopFilters((current) => ({ ...current, status: event.target.value }))}>
                <option value="all">All statuses</option>
                {sopFilterOptions.statuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <button type="button" className="sop-clear-filters" aria-label="Clear Residential SOP filters" onClick={clearAllSopFilters}>
              <RotateCcw size={13} /> Clear filters
            </button>
          </div>
          <div className="sop-list">
            {filteredSopTemplates.length === 0 ? (
              <div className="sop-empty">
                <div className="sop-empty-card">
                  <Filter size={18} />
                  <h3>No SOP tasks match this schedule</h3>
                  <p>Try another week, day, or date range.</p>
                  <button type="button" onClick={hasScheduleFilter ? clearSopScheduleFilter : clearAllSopFilters}>
                    {hasScheduleFilter ? "Clear schedule filter" : "Clear filters"}
                  </button>
                </div>
              </div>
            ) : filteredSopTemplates.map((template) => (
              <article className="sop-item" key={template.natural_key}>
                <div className="sop-item-top">
                  <h3>{template.title}</h3>
                  <span className={`sop-badge ${template.priority === "high" ? "high" : ""}`}>{priorityLabel(template.priority)}</span>
                </div>
                <p className="sop-description">{template.description}</p>
                <div className="sop-badges">
                  <span className="sop-badge"><Repeat2 size={10} /> {frequencyLabel(template.frequency)}</span>
                  <span className="sop-badge">{template.schedule_label}</span>
                  <span className="sop-badge">{weekLabel(template.week_scope)}</span>
                  {template.day_of_week ? <span className="sop-badge">{template.day_of_week}</span> : null}
                  <span className="sop-badge">{template.category}</span>
                  <span className="sop-badge">{template.assigned_to}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Calendar or Board */}
        {view === "calendar" ? (
          <div className="calendar-grid">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: "0.7rem", fontWeight: "bold", color: "hsl(var(--muted-foreground))" }}>{d}</div>
            ))}
            {calendarDays.map((d) => (
              d.empty ? <div key={d.key} /> : (
                <div key={d.key} className="calendar-day">
                  <div className="calendar-date" style={d.date === todayStr ? { color: "hsl(var(--primary))" } : {}}>{d.day}</div>
                  {d.tasks.slice(0, 3).map((t: Task) => (
                    <div key={t.id} className="calendar-task" onClick={() => setModal(t)} style={{ borderLeft: `3px solid ${PRIORITY_META[t.priority].color}` }}>
                      {t.title}
                    </div>
                  ))}
                  {d.tasks.length > 3 && (
                    <div className="calendar-more" onClick={() => { setFilter(filter); /* would ideally open a daily popover */ }}>+ {d.tasks.length - 3} more</div>
                  )}
                </div>
              )
            ))}
          </div>
        ) : (
          <div className="board">
            {COLUMNS.map((col) => {
              const colTasks = filtered.filter((t) => t.status === col.id);
              return (
                <div
                  key={col.id}
                  className={`column ${dropTarget === col.id ? "drop-active" : ""}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDropTarget(col.id);
                  }}
                  onDragLeave={() => setDropTarget((current) => current === col.id ? null : current)}
                  onDrop={(event) => {
                    event.preventDefault();
                    handleDrop(col.id, event.dataTransfer.getData("text/plain"));
                  }}
                >
                  <div className="col-header">
                    <div className="col-title">
                      {col.icon} {col.label}
                      <span className="col-count">{colTasks.length}</span>
                    </div>
                    <button className="col-add" onClick={() => setModal({ ...emptyTask(), status: col.id })}>
                      <Plus size={13} />
                    </button>
                  </div>
                  <div className="tasks-list">
                    {colTasks.length === 0 && (
                      <div style={{ fontSize: "0.78rem", color: "hsl(var(--muted-foreground))",
                        textAlign: "center", padding: "20px 0", opacity: .6 }}>
                        {col.id === "todo" ? "No operations scheduled." : col.id === "in_progress" ? "Nothing in service right now." : "No completed operations yet."}
                      </div>
                    )}
                    {colTasks.map((t) => (
                      <TaskCard key={t.id} task={t}
                        onEdit={(x) => setModal(x)}
                        onDelete={deleteTask}
                        onMove={moveTask}
                        onDragStart={setDraggingTaskId}
                        isDragging={draggingTaskId === t.id}
                      />
                    ))}
                    {draggingTaskId && dropTarget === col.id ? (
                      <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 text-center text-xs font-bold text-primary">
                        Drop here
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
