"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { createClient } from "@/lib/supabase/client";
import {
  Plus, X, Edit2, Check, AlertTriangle, Clock, CheckCircle2,
  Circle, ArrowRight, Bell, Repeat2, GripVertical,
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
  reminder: boolean;
  recurrence: string;
  custom_interval_days: number | null;
};

const CATEGORIES = ["Operations", "Finance", "Clients", "Teams", "Admin", "Other"];
const PRIORITIES: Priority[] = ["urgent", "high", "normal", "low"];
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
  urgent: { label: "Urgent",  color: "#ef4444", bg: "hsl(0 84% 60%/.12)",  icon: <AlertTriangle size={11} /> },
  high:   { label: "High",    color: "#f97316", bg: "hsl(25 95% 55%/.12)", icon: <ArrowRight size={11} /> },
  normal: { label: "Normal",  color: "#437d65", bg: "hsl(168 76% 34%/.12)",icon: <Circle size={11} /> },
  low:    { label: "Low",     color: "#64748b", bg: "hsl(215 16% 47%/.12)",icon: <Circle size={11} /> },
};

const COLUMNS: { id: Status; label: string; icon: React.ReactNode }[] = [
  { id: "todo",        label: "To Do",       icon: <Circle size={14} /> },
  { id: "in_progress", label: "In Progress", icon: <Clock size={14} /> },
  { id: "done",        label: "Done",        icon: <CheckCircle2 size={14} /> },
];

function emptyTask(): Task {
  return {
    id: crypto.randomUUID(), title: "", description: "", priority: "normal",
    status: "todo", category: "Operations", due_date: "", assignee: "Admin", reminder: false,
    recurrence: "none", custom_interval_days: "",
  };
}

function normalizeTask(task: Task): Task {
  return {
    ...task,
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
    reminder: task.reminder,
    recurrence: task.recurrence,
    custom_interval_days: task.custom_interval_days ? Number(task.custom_interval_days) : null,
  };
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

        <p className="task-title">{task.title || "Untitled task"}</p>
        {task.description && <p className="task-desc">{task.description}</p>}

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
  const [t, setT] = useState<Task>(initial);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{initial.id && initial.title ? "Edit Task" : "New Task"}</span>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          <label className="field-label">Title *</label>
          <input className="field-input" placeholder="Task title…" value={t.title}
            onChange={(e) => setT({ ...t, title: e.target.value })} />

          <label className="field-label">Description</label>
          <textarea className="field-input field-textarea" placeholder="Details, context…" value={t.description}
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

          <label className="field-label">Assignee</label>
          <input className="field-input" placeholder="Admin" value={t.assignee}
            onChange={(e) => setT({ ...t, assignee: e.target.value })} />

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
            <span>Set reminder / notification</span>
          </label>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-save" onClick={() => { if (t.title.trim()) { onSave(t); onClose(); } }}>
            <Check size={14} /> Save Task
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard page ───────────────────────────────────────────────────
function getDefaultTasks(): Task[] {
  return [
    { id: crypto.randomUUID(), title: "Check supplies with all teams", description: "Call each cleaner to confirm supply levels before the week starts.", priority: "urgent", status: "todo", category: "Teams", due_date: new Date().toISOString().slice(0, 10), assignee: "Admin", reminder: true, recurrence: "weekly", custom_interval_days: "" },
    { id: crypto.randomUUID(), title: "Follow up with recurring clients", description: "Reach out to ILG, Field AI, and Steripax for satisfaction check.", priority: "high", status: "todo", category: "Clients", due_date: "", assignee: "Admin", reminder: false, recurrence: "monthly", custom_interval_days: "" },
    { id: crypto.randomUUID(), title: "Review weekly payments", description: "Process residential cleaner payroll for the week.", priority: "normal", status: "in_progress", category: "Finance", due_date: "", assignee: "Admin", reminder: false, recurrence: "weekly", custom_interval_days: "" },
    { id: crypto.randomUUID(), title: "Generate weekly report for supervisor", description: "", priority: "normal", status: "todo", category: "Admin", due_date: "", assignee: "Admin", reminder: true, recurrence: "weekly", custom_interval_days: "" },
  ];
}

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [tasks, setTasks]   = useState<Task[]>([]);
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
        .order("created_at", { ascending: true });

      if (!mounted) return;

      if (error) {
        setLoadError(error.message);
        return;
      }

      if (data && data.length > 0) {
        setTasks((data as TaskRow[]).map(fromTaskRow));
        return;
      }

      const seeded = getDefaultTasks();
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
  const urgentCount = tasks.filter((t) => t.priority === "urgent" && t.status !== "done").length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = tasks.filter((t) => t.due_date === todayStr && t.status !== "done").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;

  return (
    <DashboardShell userEmail="pristinecleanersoc@gmail.com">
      <style>{`
        /* ── Page ── */
        .dash-page { display:flex; flex-direction:column; gap:22px; }
        .dash-header { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; }
        .dash-title { font-size:1.5rem; font-weight:700; color:hsl(var(--foreground)); }
        .dash-sub { font-size:0.83rem; color:hsl(var(--muted-foreground)); margin-top:3px; }

        /* ── KPI bar ── */
        .kpi-bar { display:flex; flex-wrap:wrap; gap:12px; }
        .kpi { flex:1; min-width:120px; padding:14px 18px; border-radius:12px;
          background:hsl(var(--card)); border:1px solid hsl(var(--border)); }
        .kpi.urgent { border-left:3px solid #ef4444; }
        .kpi.today  { border-left:3px solid #f97316; }
        .kpi.done   { border-left:3px solid #437d65; }
        .kpi-label { font-size:0.68rem; font-weight:700; text-transform:uppercase;
          letter-spacing:.06em; color:hsl(var(--muted-foreground)); }
        .kpi-val { font-size:1.5rem; font-weight:800; margin-top:4px; color:hsl(var(--foreground)); }

        /* ── Filter bar ── */
        .filter-bar { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
        .filter-btn { padding:5px 14px; border-radius:99px; border:1px solid hsl(var(--border));
          background:transparent; font-size:0.78rem; font-weight:600; cursor:pointer;
          color:hsl(var(--muted-foreground)); transition:all .15s; }
        .filter-btn:hover { background:hsl(var(--accent)); color:hsl(var(--accent-foreground)); }
        .filter-btn.active { background:hsl(var(--primary)); color:hsl(var(--primary-foreground)); border-color:hsl(var(--primary)); }

        /* ── Add task button ── */
        .add-btn { display:flex; align-items:center; gap:6px; padding:8px 18px;
          border-radius:10px; background:hsl(var(--primary)); color:hsl(var(--primary-foreground));
          font-size:0.83rem; font-weight:700; border:none; cursor:pointer;
          box-shadow:0 4px 14px -4px hsl(var(--primary)/.5); transition:opacity .15s; }
        .add-btn:hover { opacity:.85; }

        /* ── Trello board ── */
        .board { display:grid; grid-template-columns:repeat(3, minmax(310px, 1fr)); gap:16px; align-items:start; overflow-x:auto; padding-bottom:4px; }
        @media (max-width:800px) { .board { grid-template-columns:1fr; } }

        .column { background:hsl(var(--muted)/.36); border:1px solid transparent; border-radius:14px; padding:14px; min-height:360px; transition:border-color .16s ease, background .16s ease, box-shadow .16s ease; }
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
        .task-card { background:hsl(var(--card)); border:1px solid hsl(var(--border));
          border-radius:11px; overflow:hidden; display:flex;
          transition:box-shadow .2s, transform .2s, opacity .2s, border-color .2s; cursor:grab; }
        .task-card:active { cursor:grabbing; }
        .task-card:hover { box-shadow:0 4px 16px -4px hsl(0 0% 0%/.15); transform:translateY(-1px); }
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
        .modal-box { background:hsl(var(--card)); border:1px solid hsl(var(--border)); border-radius:18px;
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
        .field-input { width:100%; background:hsl(var(--input)); border:1px solid hsl(var(--border));
          border-radius:8px; padding:8px 10px; font-size:0.84rem; color:hsl(var(--foreground));
          font-family:inherit; outline:none; transition:border-color .15s; box-sizing:border-box; }
        .field-input:focus { border-color:hsl(var(--primary)); }
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
            <h1 className="dash-title">Operations Board</h1>
            <p className="dash-sub">Pristine Cleaners — Standard Operating Procedure</p>
          </div>
          <button className="add-btn" onClick={() => setModal(emptyTask())}>
            <Plus size={15} /> New Task
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
            <div className="kpi-label">Total Tasks</div>
            <div className="kpi-val">{tasks.length}</div>
          </div>
          <div className="kpi done">
            <div className="kpi-label">Completed</div>
            <div className="kpi-val">{doneCount}</div>
          </div>
        </div>

        {/* Filter */}
        <div className="filter-bar">
          <button className={`filter-btn ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>All</button>
          {CATEGORIES.map((c) => (
            <button key={c} className={`filter-btn ${filter === c ? "active" : ""}`} onClick={() => setFilter(c)}>{c}</button>
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
                      No tasks here
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
