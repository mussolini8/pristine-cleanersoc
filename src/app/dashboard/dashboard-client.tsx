"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { createClient } from "@/lib/supabase/client";
import { getResidentialServices } from "@/data/service-types";
import {
  Plus, X, Edit2, Check, AlertTriangle, Clock, CheckCircle2,
  Circle, ArrowRight, Bell, Repeat2, GripVertical, CalendarDays, Filter,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────
type Priority = "urgent" | "high" | "normal" | "low";
type Status   = "todo" | "in_progress" | "done";
type Recurrence = "none" | "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly" | "custom";

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
  week: string;
  day: string;
  category: string;
  assignedTo: string;
  status: string;
  frequency: string;
};

const CATEGORIES = ["Billing", "Billing / Reporting", "Client Follow-Up", "Cleaner Coordination", "Quality Control", "Inventory", "Marketing", "Reporting", "Admin / CRM"];
const ASSIGNEES = ["Unassigned", "Carlos Lopez"];
const PRIORITIES: Priority[] = ["urgent", "high", "normal", "low"];
const SOP_FILTERS_DEFAULT: SopFilters = {
  week: "all",
  day: "all",
  category: "all",
  assignedTo: "all",
  status: "active",
  frequency: "all",
};
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

function frequencyLabel(value: string) {
  return value === "weekly" ? "Weekly" : value === "monthly" ? "Monthly" : value;
}

function accountOrProperty(task: Task) {
  return task.account_name || task.property_address || "Operations task";
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

// ─── Task Form Modal ─────────────────────────────────────────────────
function TaskModal({
  initial, onSave, onClose,
}: {
  initial: Task;
  onSave: (t: Task) => void | Promise<void>;
  onClose: () => void;
}) {
  const [t, setT] = useState<Task>(() => normalizeTask(initial));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{initial.id && initial.title ? "Edit Operation" : "New Operation"}</span>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<Status | null>(null);

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
      await notifyTaskEvent("task_assigned", normalized);
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
      await notifyTaskEvent("task_completed", moved, "Carlos Lopez");
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
    weeks: Array.from(new Set(sopTemplates.map((task) => task.week_scope))).sort(),
    days: Array.from(new Set(sopTemplates.map((task) => task.day_of_week).filter(Boolean) as string[])),
    categories: Array.from(new Set(sopTemplates.map((task) => task.category))).sort(),
    assignees: Array.from(new Set(sopTemplates.map((task) => task.assigned_to))).sort(),
    statuses: Array.from(new Set(sopTemplates.map((task) => task.status))).sort(),
    frequencies: Array.from(new Set(sopTemplates.map((task) => task.frequency))).sort(),
  }), [sopTemplates]);
  const filteredSopTemplates = useMemo(() => sopTemplates.filter((task) => {
    const matchesWeek = sopFilters.week === "all" || task.week_scope === sopFilters.week;
    const matchesDay = sopFilters.day === "all" || task.day_of_week === sopFilters.day;
    const matchesCategory = sopFilters.category === "all" || task.category === sopFilters.category;
    const matchesAssignee = sopFilters.assignedTo === "all" || task.assigned_to === sopFilters.assignedTo;
    const matchesStatus = sopFilters.status === "all" || task.status === sopFilters.status;
    const matchesFrequency = sopFilters.frequency === "all" || task.frequency === sopFilters.frequency;
    return matchesWeek && matchesDay && matchesCategory && matchesAssignee && matchesStatus && matchesFrequency;
  }), [sopFilters, sopTemplates]);
  const urgentCount = tasks.filter((t) => t.priority === "urgent" && t.status !== "done").length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = tasks.filter((t) => t.due_date === todayStr && t.status !== "done").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const activeSopCount = sopTemplates.filter((task) => task.status === "active").length;

  return (
    <DashboardShell userEmail="pristinecleanersoc@gmail.com">
      <style>{`
        /* ── Page ── */
        .dash-page { display:flex; flex-direction:column; gap:18px; }
        .dash-header { display:flex; flex-wrap:wrap; align-items:flex-end; justify-content:space-between; gap:14px; border:1px solid hsl(var(--border)/.82); border-radius:8px; padding:18px; background:linear-gradient(135deg,hsl(var(--card)/.96),hsl(var(--primary)/.08)); box-shadow:0 22px 60px -52px hsl(215 40% 20%); }
        .dash-title { font-size:1.7rem; font-weight:800; color:hsl(var(--foreground)); line-height:1.05; }
        .dash-sub { font-size:0.88rem; color:hsl(var(--muted-foreground)); margin-top:6px; font-weight:500; }

        /* ── KPI bar ── */
        .kpi-bar { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:10px; }
        .kpi { min-width:0; padding:15px 16px; border-radius:8px;
          background:hsl(var(--card)/.96); border:1px solid hsl(var(--border)/.82); box-shadow:0 16px 44px -42px hsl(215 40% 20%); }
        .service-grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:12px; margin-top:12px; }
        @media (max-width:960px) { .service-grid { grid-template-columns:1fr; } }
        .service-card { padding:14px 16px; border-radius:12px; background:hsl(var(--card)/.95); border:1px solid hsl(var(--border)/.82); box-shadow:0 18px 50px -46px hsl(215 40% 20%); }
        .service-card-header { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; }
        .service-type { font-size:.7rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:hsl(var(--muted-foreground)); }
        .service-card p { margin:0 0 10px; font-size:.88rem; line-height:1.5; color:hsl(var(--foreground)); }
        .service-badges { display:flex; flex-wrap:wrap; gap:8px; }
        .service-badges span { padding:5px 9px; border-radius:999px; font-size:.68rem; font-weight:700; background:hsl(var(--muted)/.12); color:hsl(var(--muted-foreground)); }
        .sop-section { border:1px solid hsl(var(--border)/.82); border-radius:8px; background:hsl(var(--card)/.96); overflow:hidden; box-shadow:0 18px 55px -48px hsl(215 40% 20%); }
        .sop-head { display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:12px; padding:16px; border-bottom:1px solid hsl(var(--border)); }
        .sop-kicker { display:flex; align-items:center; gap:7px; font-size:.68rem; font-weight:950; letter-spacing:.1em; text-transform:uppercase; color:hsl(var(--primary)); }
        .sop-title { margin-top:6px; font-size:1.05rem; font-weight:950; color:hsl(var(--foreground)); }
        .sop-sub { margin-top:4px; color:hsl(var(--muted-foreground)); font-size:.82rem; font-weight:650; }
        .sop-count { border-radius:8px; background:hsl(var(--primary)/.1); color:hsl(var(--primary)); padding:9px 11px; font-size:.8rem; font-weight:950; white-space:nowrap; }
        .sop-filters { display:grid; grid-template-columns:repeat(6, minmax(120px, 1fr)); gap:8px; padding:12px 16px; border-bottom:1px solid hsl(var(--border)); background:hsl(var(--muted)/.18); }
        .sop-filters label { display:flex; flex-direction:column; gap:5px; min-width:0; }
        .sop-filters span { font-size:.62rem; font-weight:950; text-transform:uppercase; color:hsl(var(--muted-foreground)); }
        .sop-filters select { height:34px; border:1px solid hsl(var(--border)); border-radius:8px; background:hsl(var(--background)); color:hsl(var(--foreground)); padding:0 8px; font-size:.75rem; font-weight:800; min-width:0; }
        .sop-list { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); }
        .sop-item { display:flex; flex-direction:column; gap:9px; padding:13px 14px; border-bottom:1px solid hsl(var(--border)); min-width:0; }
        .sop-item:nth-child(odd) { border-right:1px solid hsl(var(--border)); }
        .sop-item-top { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
        .sop-item h3 { margin:0; font-size:.86rem; font-weight:950; line-height:1.25; color:hsl(var(--foreground)); }
        .sop-description { margin:0; color:hsl(var(--muted-foreground)); font-size:.74rem; line-height:1.45; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .sop-badges { display:flex; flex-wrap:wrap; gap:5px; }
        .sop-badge { display:inline-flex; align-items:center; gap:4px; border-radius:999px; background:hsl(var(--muted)/.5); color:hsl(var(--muted-foreground)); padding:3px 7px; font-size:.65rem; font-weight:900; }
        .sop-badge.high { background:hsl(25 95% 55%/.12); color:#f97316; }
        .sop-empty { padding:24px; text-align:center; color:hsl(var(--muted-foreground)); font-size:.82rem; font-weight:800; }
        @media (max-width:1080px) { .sop-filters { grid-template-columns:repeat(3, minmax(0, 1fr)); } }
        @media (max-width:760px) { .sop-list { grid-template-columns:1fr; } .sop-item:nth-child(odd) { border-right:none; } .sop-filters { grid-template-columns:1fr 1fr; } }
        @media (max-width:520px) { .sop-filters { grid-template-columns:1fr; } }
        .kpi.urgent { box-shadow:inset 3px 0 0 #ef4444, 0 16px 44px -42px hsl(215 40% 20%); }
        .kpi.today  { box-shadow:inset 3px 0 0 #f97316, 0 16px 44px -42px hsl(215 40% 20%); }
        .kpi.done   { box-shadow:inset 3px 0 0 hsl(var(--primary)), 0 16px 44px -42px hsl(215 40% 20%); }
        .kpi-label { font-size:0.68rem; font-weight:700; text-transform:uppercase;
          letter-spacing:.06em; color:hsl(var(--muted-foreground)); }
        .kpi-val { font-size:1.65rem; font-weight:800; margin-top:4px; color:hsl(var(--foreground)); }

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
        .add-btn:hover { transform:translateY(-1px); filter:saturate(1.05); }

        /* ── Trello board ── */
        .board { display:grid; grid-template-columns:repeat(3, minmax(310px, 1fr)); gap:14px; align-items:start; overflow-x:auto; padding-bottom:4px; }
        @media (max-width:800px) { .board { grid-template-columns:1fr; } }
        @media (max-width:1080px) { .kpi-bar { grid-template-columns:repeat(2, minmax(0, 1fr)); } }
        @media (max-width:640px) { .kpi-bar { grid-template-columns:1fr; } }

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

        .tasks-list { display:flex; flex-direction:column; gap:10px; min-height:280px; }

        /* ── Task card ── */
        .task-card { background:hsl(var(--card)); border:1px solid hsl(var(--border)/.86);
          border-radius:8px; overflow:hidden; display:flex;
          transition:box-shadow .2s, transform .2s, opacity .2s, border-color .2s; cursor:grab; }
        .task-card:active { cursor:grabbing; }
        .task-card:hover { border-color:hsl(var(--primary)/.28); box-shadow:0 16px 34px -30px hsl(215 40% 20%); transform:translateY(-1px); }
        .task-card.dragging { opacity:.48; border-color:hsl(var(--primary)); }
        .task-done { opacity:.55; }
        .task-stripe { width:4px; flex-shrink:0; }
        .task-body { padding:10px 12px; flex:1; min-width:0; }
        .task-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:5px; }
        .task-category { display:flex; align-items:center; gap:4px; font-size:0.64rem; font-weight:700; text-transform:uppercase;
          letter-spacing:.05em; color:hsl(var(--muted-foreground)); }
        .task-actions { display:flex; gap:3px; }
        .task-btn { display:flex; align-items:center; justify-content:center; width:22px; height:22px;
          border-radius:6px; border:none; background:transparent; cursor:pointer;
          color:hsl(var(--muted-foreground)); transition:all .12s; }
        .task-btn:hover { background:hsl(var(--accent)); color:hsl(var(--accent-foreground)); }
        .task-btn-del:hover { background:hsl(0 84% 60%/.1); color:hsl(0 84% 50%); }
        .task-title { font-size:0.83rem; font-weight:600; color:hsl(var(--foreground));
          line-height:1.3; margin-bottom:4px; }
        .task-desc { font-size:0.74rem; color:hsl(var(--muted-foreground)); line-height:1.4;
          margin-bottom:6px; overflow:hidden; display:-webkit-box;
          -webkit-line-clamp:2; -webkit-box-orient:vertical; }
        .task-details { display:flex; justify-content:space-between; gap:10px; font-size:0.75rem; color:hsl(var(--muted-foreground)); margin-bottom:8px; }
        .task-detail-label { font-weight:700; text-transform:uppercase; letter-spacing:.05em; }
        .task-meta { display:flex; flex-wrap:wrap; gap:5px; align-items:center; }
        .priority-badge { display:flex; align-items:center; gap:3px; font-size:0.65rem;
          font-weight:700; padding:2px 7px; border-radius:99px; }
        .due-badge { display:flex; align-items:center; gap:3px; font-size:0.65rem; font-weight:600;
          padding:2px 7px; border-radius:99px;
          background:hsl(var(--muted)); color:hsl(var(--muted-foreground)); }
        .due-badge.overdue { background:hsl(0 84% 60%/.12); color:hsl(0 84% 50%); }
        .reminder-badge { display:flex; align-items:center; gap:3px; font-size:0.65rem; font-weight:600;
          padding:2px 7px; border-radius:99px;
          background:hsl(45 90% 45%/.12); color:hsl(35 80% 35%); }
        .repeat-badge { display:flex; align-items:center; gap:3px; font-size:0.65rem; font-weight:600;
          padding:2px 7px; border-radius:99px;
          background:hsl(168 76% 34%/.12); color:hsl(168 76% 28%); }

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
          <button className="add-btn" onClick={() => setModal(emptyTask())}>
            <Plus size={15} /> Add Operation
          </button>
        </div>

        {loadError ? (
          <p className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive">{loadError}</p>
        ) : null}

        {/* KPI */}
        <div className="kpi-bar">
          <div className="kpi urgent">
            <div className="kpi-label">Urgent</div>
            <div className="kpi-val">{urgentCount}</div>
          </div>
          <div className="kpi today">
            <div className="kpi-label">Due Today</div>
            <div className="kpi-val">{todayCount}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Active Operations</div>
            <div className="kpi-val">{tasks.length}</div>
          </div>
          <div className="kpi done">
            <div className="kpi-label">Completed</div>
            <div className="kpi-val">{doneCount}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Monthly SOP</div>
            <div className="kpi-val">{activeSopCount}</div>
          </div>
        </div>

        {/* Filter */}
        <div className="filter-bar">
          <button className={`filter-btn ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>All</button>
          {CATEGORIES.map((c) => (
            <button key={c} className={`filter-btn ${filter === c ? "active" : ""}`} onClick={() => setFilter(c)}>{c}</button>
          ))}
          {tasks.some((task) => task.category === "Janitorial") ? (
            <button className={`filter-btn ${filter === "Janitorial" ? "active" : ""}`} onClick={() => setFilter("Janitorial")}>Janitorial (legacy)</button>
          ) : null}
        </div>

        <section className="sop-section">
          <div className="sop-head">
            <div>
              <p className="sop-kicker"><CalendarDays size={14} /> Residential SOP Tasks</p>
              <h2 className="sop-title">Monthly recurring operations templates</h2>
              <p className="sop-sub">Assigned to Carlos Lopez as Operations Manager. Templates do not send assignment emails until real task instances are created.</p>
            </div>
            <div className="sop-count">{filteredSopTemplates.length} shown / {activeSopCount} active</div>
          </div>
          <div className="sop-filters">
            <label>
              <span>Week</span>
              <select value={sopFilters.week} onChange={(event) => setSopFilters((current) => ({ ...current, week: event.target.value }))}>
                <option value="all">All weeks</option>
                {sopFilterOptions.weeks.map((week) => <option key={week} value={week}>{weekLabel(week)}</option>)}
              </select>
            </label>
            <label>
              <span>Day</span>
              <select value={sopFilters.day} onChange={(event) => setSopFilters((current) => ({ ...current, day: event.target.value }))}>
                <option value="all">All days</option>
                {sopFilterOptions.days.map((day) => <option key={day} value={day}>{day}</option>)}
              </select>
            </label>
            <label>
              <span>Category</span>
              <select value={sopFilters.category} onChange={(event) => setSopFilters((current) => ({ ...current, category: event.target.value }))}>
                <option value="all">All categories</option>
                {sopFilterOptions.categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label>
              <span>Assigned to</span>
              <select value={sopFilters.assignedTo} onChange={(event) => setSopFilters((current) => ({ ...current, assignedTo: event.target.value }))}>
                <option value="all">All owners</option>
                {sopFilterOptions.assignees.map((assignee) => <option key={assignee} value={assignee}>{assignee}</option>)}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select value={sopFilters.status} onChange={(event) => setSopFilters((current) => ({ ...current, status: event.target.value }))}>
                <option value="all">All statuses</option>
                {sopFilterOptions.statuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label>
              <span>Frequency</span>
              <select value={sopFilters.frequency} onChange={(event) => setSopFilters((current) => ({ ...current, frequency: event.target.value }))}>
                <option value="all">All frequencies</option>
                {sopFilterOptions.frequencies.map((frequency) => <option key={frequency} value={frequency}>{frequencyLabel(frequency)}</option>)}
              </select>
            </label>
          </div>
          <div className="sop-list">
            {filteredSopTemplates.length === 0 ? (
              <div className="sop-empty"><Filter size={18} className="mx-auto mb-2" /> No SOP templates match these filters.</div>
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

        {/* Service type quick reference */}
        <div className="service-grid">
          {getResidentialServices().slice(0, 4).map((service) => (
            <div key={service.id} className="service-card">
              <div className="service-card-header">
                <span className="service-type">Residential</span>
                <strong>{service.label}</strong>
              </div>
              <p>{service.description}</p>
              <div className="service-badges">
                <span>{service.estimatedDuration}</span>
                <span>{service.checklistRequired ? "Checklist" : "Standard"}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Trello Board */}
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
      </div>
    </DashboardShell>
  );
}
