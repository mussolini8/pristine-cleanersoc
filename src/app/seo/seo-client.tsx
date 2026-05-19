"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileImage,
  Filter,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  Send,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type SeoStatus = "backlog" | "todo" | "in_progress" | "waiting_review" | "approved" | "completed";
type Priority = "urgent" | "high" | "normal" | "low";
type SeoView = "dashboard" | "kanban" | "tasks" | "detail";

type TaskRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  assignee: string | null;
  assigned_by: string | null;
  assigned_to: string | null;
  created_by: string | null;
  completed_by: string | null;
  due_date: string | null;
  panel: string | null;
  business_unit: string | null;
  completion_notes: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type SeoTask = TaskRow & {
  priority: Priority;
  status: SeoStatus;
  comments_count: number;
  attachments_count: number;
};

type CommentRow = {
  id: string;
  task_id: string;
  user_id: string | null;
  author_name: string;
  body: string;
  internal: boolean;
  created_at: string;
};

type AttachmentRow = {
  id: string;
  task_id: string;
  user_id: string | null;
  file_name: string;
  file_path: string;
  file_url: string | null;
  file_type: string | null;
  file_size: number | null;
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

type Filters = {
  status: string;
  priority: string;
  category: string;
  assignee: string;
  due: string;
  search: string;
};

type DraftTask = {
  title: string;
  description: string;
  category: string;
  priority: Priority;
  status: SeoStatus;
  due_date: string;
  assignee: string;
};

const SEO_ASSIGNEE = "Pristine SEO";
const OWNER_NAME = "Pristine Operations";
const ATTACHMENT_BUCKET = "seo-task-attachments";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const STATUSES: { id: SeoStatus; label: string; tone: string }[] = [
  { id: "backlog", label: "Backlog", tone: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-200" },
  { id: "todo", label: "To Do", tone: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200" },
  { id: "in_progress", label: "In Progress", tone: "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-200" },
  { id: "waiting_review", label: "Waiting Review", tone: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200" },
  { id: "approved", label: "Approved", tone: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200" },
  { id: "completed", label: "Completed", tone: "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-200" },
];

const CATEGORIES = [
  "Google Business Profile",
  "Website SEO",
  "Local SEO",
  "Content",
  "Photos / Media",
  "Reviews",
  "Blog",
  "Social Media",
  "Reporting",
  "Technical SEO",
  "Client Communication",
  "Admin",
];

const PRIORITIES: { id: Priority; label: string; className: string }[] = [
  { id: "urgent", label: "Urgent", className: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200" },
  { id: "high", label: "High", className: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-200" },
  { id: "normal", label: "Standard", className: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200" },
  { id: "low", label: "Low", className: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-200" },
];

const DEFAULT_FILTERS: Filters = { status: "all", priority: "all", category: "all", assignee: "all", due: "all", search: "" };
const DEFAULT_DRAFT: DraftTask = { title: "", description: "", category: "Google Business Profile", priority: "normal", status: "todo", due_date: "", assignee: SEO_ASSIGNEE };

function normalizeStatus(value: string | null | undefined): SeoStatus {
  return STATUSES.some((status) => status.id === value) ? value as SeoStatus : "backlog";
}

function normalizePriority(value: string | null | undefined): Priority {
  return PRIORITIES.some((priority) => priority.id === value) ? value as Priority : "normal";
}

function statusMeta(status: SeoStatus) {
  return STATUSES.find((item) => item.id === status) ?? STATUSES[0];
}

function priorityMeta(priority: Priority) {
  return PRIORITIES.find((item) => item.id === priority) ?? PRIORITIES[2];
}

function formatDate(value: string | null | undefined) {
  if (!value) return "No date";
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function isOverdue(task: SeoTask) {
  if (!task.due_date || task.status === "completed") return false;
  return new Date(`${task.due_date}T23:59:59`) < new Date();
}

function mapTask(row: TaskRow, commentsCount = 0, attachmentsCount = 0): SeoTask {
  return {
    ...row,
    priority: normalizePriority(row.priority),
    status: normalizeStatus(row.status),
    comments_count: commentsCount,
    attachments_count: attachmentsCount,
  };
}

function nextStatus(status: SeoStatus): SeoStatus {
  const index = STATUSES.findIndex((item) => item.id === status);
  return STATUSES[Math.min(STATUSES.length - 1, index + 1)]?.id ?? status;
}

async function notifySeoTask(event: "task_assigned" | "task_completed", task: SeoTask, actorName: string) {
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
          accountOrProperty: "SEO operations",
          panel: "SEO",
          description: task.description,
          notes: task.description,
          status: task.status,
          completedAt: task.completed_at,
          completionNotes: task.completion_notes,
          commentsCount: task.comments_count,
          attachmentsCount: task.attachments_count,
        },
      }),
    });
  } catch (error) {
    console.warn("SEO notification request failed", error);
  }
}

function StatusBadge({ status }: { status: SeoStatus }) {
  const meta = statusMeta(status);
  return <Badge className={cn("capitalize", meta.tone)}>{meta.label}</Badge>;
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const meta = priorityMeta(priority);
  return <Badge className={meta.className}>{meta.label}</Badge>;
}

function MetricCard({ label, value, note, icon: Icon }: { label: string; value: string | number; note?: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">{label}</p>
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

function TaskCard({ task, onStatus }: { task: SeoTask; onStatus: (task: SeoTask, status: SeoStatus) => void }) {
  return (
    <Card className="group overflow-hidden">
      <div className={cn("h-1", task.priority === "urgent" ? "bg-red-500" : task.priority === "high" ? "bg-orange-500" : task.priority === "low" ? "bg-slate-400" : "bg-emerald-600")} />
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <Badge variant="outline" className="bg-background text-[11px]">{task.category}</Badge>
          <Button className="size-8 opacity-80 group-hover:opacity-100" size="icon" variant="ghost" onClick={() => onStatus(task, nextStatus(task.status))} title="Move task forward">
            <ArrowRight className="size-4" />
          </Button>
        </div>
        <Link className="mt-3 block text-sm font-black leading-snug hover:text-primary" href={`/seo/tasks/${task.id}`}>{task.title}</Link>
        {task.description ? <p className="mt-2 line-clamp-2 text-xs font-medium leading-5 text-muted-foreground">{task.description}</p> : null}
        <div className="mt-4 grid gap-2 text-xs font-semibold text-muted-foreground">
          <span className="flex items-center gap-2"><CalendarDays className="size-3.5" /> {formatDate(task.due_date)}</span>
          <span className="flex items-center gap-2"><Clock className="size-3.5" /> Updated {formatDateTime(task.updated_at)}</span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <PriorityBadge priority={task.priority} />
          <StatusBadge status={task.status} />
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3 text-xs font-bold text-muted-foreground">
          <span>{task.assignee ?? SEO_ASSIGNEE}</span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1"><MessageSquare className="size-3.5" /> {task.comments_count}</span>
            <span className="flex items-center gap-1"><Paperclip className="size-3.5" /> {task.attachments_count}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskForm({ onCreate, saving }: { onCreate: (draft: DraftTask) => Promise<void>; saving: boolean }) {
  const [draft, setDraft] = useState<DraftTask>(DEFAULT_DRAFT);

  async function submit() {
    if (!draft.title.trim()) return;
    await onCreate(draft);
    setDraft(DEFAULT_DRAFT);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Plus className="size-4" /> New SEO task</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Input placeholder="Task title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        <textarea className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Brief, acceptance notes, links, local SEO context..." value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold shadow-sm" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
            {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
          </select>
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold shadow-sm" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as Priority })}>
            {PRIORITIES.map((priority) => <option key={priority.id} value={priority.id}>{priority.label}</option>)}
          </select>
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold shadow-sm" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as SeoStatus })}>
            {STATUSES.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
          </select>
          <Input type="date" value={draft.due_date} onChange={(event) => setDraft({ ...draft, due_date: event.target.value })} />
        </div>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold shadow-sm" value={draft.assignee} onChange={(event) => setDraft({ ...draft, assignee: event.target.value })}>
          <option>{SEO_ASSIGNEE}</option>
          <option>Unassigned</option>
        </select>
        <Button disabled={saving || !draft.title.trim()} onClick={submit}>
          <Plus className="size-4" />
          Create task
        </Button>
      </CardContent>
    </Card>
  );
}

function FiltersBar({ filters, setFilters }: { filters: Filters; setFilters: (filters: Filters) => void }) {
  return (
    <Card>
      <CardContent className="grid gap-3 p-4 lg:grid-cols-[1.6fr_repeat(5,minmax(0,1fr))_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search SEO tasks" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
        </div>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold shadow-sm" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
          <option value="all">All statuses</option>
          {STATUSES.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
        </select>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold shadow-sm" value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}>
          <option value="all">All priorities</option>
          {PRIORITIES.map((priority) => <option key={priority.id} value={priority.id}>{priority.label}</option>)}
        </select>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold shadow-sm" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}>
          <option value="all">All categories</option>
          {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
        </select>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold shadow-sm" value={filters.assignee} onChange={(event) => setFilters({ ...filters, assignee: event.target.value })}>
          <option value="all">All assignees</option>
          <option>{SEO_ASSIGNEE}</option>
          <option>Unassigned</option>
        </select>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold shadow-sm" value={filters.due} onChange={(event) => setFilters({ ...filters, due: event.target.value })}>
          <option value="all">Any due date</option>
          <option value="overdue">Overdue</option>
          <option value="week">Due this week</option>
        </select>
        <Button variant="outline" onClick={() => setFilters(DEFAULT_FILTERS)}>
          <Filter className="size-4" />
          Reset
        </Button>
      </CardContent>
    </Card>
  );
}

export function SeoClient({ view, taskId }: { view: SeoView; taskId?: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [tasks, setTasks] = useState<SeoTask[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [userId, setUserId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState(OWNER_NAME);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [today] = useState(() => new Date());

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const currentUserId = userData.user?.id ?? null;
    setUserId(currentUserId);
    if (currentUserId) {
      const { data: profile } = await supabase.from("profiles").select("full_name, username").eq("id", currentUserId).maybeSingle();
      const name = String(profile?.full_name ?? profile?.username ?? userData.user?.email ?? OWNER_NAME);
      setProfileName(name);
    }

    const { data: taskRows, error } = await supabase
      .from("operation_tasks")
      .select("*")
      .eq("panel", "SEO")
      .order("updated_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    const rows = (taskRows ?? []) as TaskRow[];
    const ids = rows.map((task) => task.id);
    const [{ data: commentRows }, { data: attachmentRows }, { data: activityRows }] = ids.length
      ? await Promise.all([
        supabase.from("operation_task_comments").select("*").in("task_id", ids).order("created_at", { ascending: false }),
        supabase.from("operation_task_attachments").select("*").in("task_id", ids).order("created_at", { ascending: false }),
        supabase.from("operation_task_audit_log").select("*").in("task_id", ids).order("created_at", { ascending: false }).limit(80),
      ])
      : [{ data: [] }, { data: [] }, { data: [] }];

    const commentList = (commentRows ?? []) as CommentRow[];
    const attachmentList = (attachmentRows ?? []) as AttachmentRow[];
    const commentCounts = new Map<string, number>();
    const attachmentCounts = new Map<string, number>();
    commentList.forEach((comment) => commentCounts.set(comment.task_id, (commentCounts.get(comment.task_id) ?? 0) + 1));
    attachmentList.forEach((attachment) => attachmentCounts.set(attachment.task_id, (attachmentCounts.get(attachment.task_id) ?? 0) + 1));

    setTasks(rows.map((row) => mapTask(row, commentCounts.get(row.id) ?? 0, attachmentCounts.get(row.id) ?? 0)));
    setComments(commentList);
    setAttachments(attachmentList);
    setActivity((activityRows ?? []) as ActivityRow[]);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const visibleTasks = useMemo(() => {
    const now = today;
    const endOfWeek = new Date(today);
    endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
    const query = filters.search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (filters.status !== "all" && task.status !== filters.status) return false;
      if (filters.priority !== "all" && task.priority !== filters.priority) return false;
      if (filters.category !== "all" && task.category !== filters.category) return false;
      if (filters.assignee !== "all" && (task.assignee ?? "Unassigned") !== filters.assignee) return false;
      if (filters.due === "overdue" && !isOverdue(task)) return false;
      if (filters.due === "week") {
        if (!task.due_date) return false;
        const due = new Date(`${task.due_date}T00:00:00`);
        if (due < now || due > endOfWeek) return false;
      }
      if (!query) return true;
      return [task.title, task.description, task.category, task.assignee, task.status, task.priority].some((value) => String(value ?? "").toLowerCase().includes(query));
    });
  }, [filters, tasks, today]);

  const currentTask = useMemo(() => tasks.find((task) => task.id === taskId) ?? null, [taskId, tasks]);
  const currentComments = currentTask ? comments.filter((comment) => comment.task_id === currentTask.id) : [];
  const currentAttachments = currentTask ? attachments.filter((attachment) => attachment.task_id === currentTask.id) : [];
  const currentActivity = currentTask ? activity.filter((item) => item.task_id === currentTask.id) : activity.slice(0, 8);

  async function writeActivity(taskIdValue: string, action: string, details: Record<string, unknown>) {
    await supabase.from("operation_task_audit_log").insert({ task_id: taskIdValue, action, details });
  }

  async function createTask(draft: DraftTask) {
    if (!userId) return;
    setSaving(true);
    setMessage(null);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("operation_tasks")
      .insert({
        user_id: userId,
        created_by: userId,
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        category: draft.category,
        priority: draft.priority,
        status: draft.status,
        due_date: draft.due_date || null,
        assignee: draft.assignee,
        assigned_by: profileName,
        panel: "SEO",
        business_unit: "Pristine Cleaners / SEO",
        reminder: false,
        recurrence: "none",
        updated_at: now,
      })
      .select("*")
      .single();
    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    const task = mapTask(data as TaskRow);
    await writeActivity(task.id, "task_assigned", { assignee: task.assignee, actor: profileName });
    await notifySeoTask("task_assigned", task, profileName);
    await load();
  }

  async function updateStatus(task: SeoTask, status: SeoStatus, notes?: string) {
    const completed = status === "completed";
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("operation_tasks")
      .update({
        status,
        completion_notes: notes ?? task.completion_notes,
        completed_at: completed ? now : task.completed_at,
        completed_by: completed ? userId : task.completed_by,
        updated_at: now,
      })
      .eq("id", task.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    const nextTask = { ...task, status, completion_notes: notes ?? task.completion_notes, completed_at: completed ? now : task.completed_at, updated_at: now };
    await writeActivity(task.id, completed ? "task_completed" : "status_changed", { from: task.status, to: status, actor: profileName });
    if (completed) await notifySeoTask("task_completed", nextTask, profileName);
    await load();
  }

  async function addComment() {
    if (!currentTask || !userId || !commentBody.trim()) return;
    const { error } = await supabase.from("operation_task_comments").insert({
      task_id: currentTask.id,
      user_id: userId,
      author_name: profileName,
      body: commentBody.trim(),
      internal: true,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    await writeActivity(currentTask.id, "comment_added", { actor: profileName });
    setCommentBody("");
    await load();
  }

  async function uploadFile(file: File) {
    if (!currentTask || !userId) return;
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setMessage("Allowed files: jpg, jpeg, png, webp, and pdf.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setMessage("File is too large. Maximum upload size is 10MB.");
      return;
    }
    setUploading(true);
    setMessage(null);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${currentTask.id}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(path, file, { upsert: false });
    if (uploadError) {
      setUploading(false);
      setMessage(uploadError.message);
      await writeActivity(currentTask.id, "notification_failed", { event: "attachment_uploaded", reason: uploadError.message });
      return;
    }
    const { data: urlData } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
    const { error } = await supabase.from("operation_task_attachments").insert({
      task_id: currentTask.id,
      user_id: userId,
      file_name: file.name,
      file_path: path,
      file_url: urlData?.signedUrl ?? null,
      file_type: file.type,
      file_size: file.size,
      uploaded_by: profileName,
    });
    setUploading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    await writeActivity(currentTask.id, "attachment_uploaded", { fileName: file.name, actor: profileName });
    await load();
  }

  async function deleteAttachment(attachment: AttachmentRow) {
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([attachment.file_path]);
    const { error } = await supabase.from("operation_task_attachments").delete().eq("id", attachment.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (currentTask) await writeActivity(currentTask.id, "attachment_deleted", { fileName: attachment.file_name, actor: profileName });
    await load();
  }

  const stats = {
    thisWeek: tasks.filter((task) => task.due_date && new Date(`${task.due_date}T00:00:00`) <= new Date(today.getTime() + 7 * 86400000)).length,
    inProgress: tasks.filter((task) => task.status === "in_progress").length,
    waiting: tasks.filter((task) => task.status === "waiting_review").length,
    completedMonth: tasks.filter((task) => task.completed_at && new Date(task.completed_at).getMonth() === today.getMonth()).length,
    overdue: tasks.filter(isOverdue).length,
    attachments: attachments.length,
  };

  return (
    <DashboardShell userEmail={profileName}>
      <div className="space-y-5">
        <div className="flex flex-col justify-between gap-4 rounded-lg border border-border/80 bg-card/95 p-5 shadow-[0_18px_55px_-45px_hsl(215_40%_20%)] lg:flex-row lg:items-center">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wide text-primary">SEO operations</p>
            <h1 className="mt-1 text-2xl font-black tracking-normal">Marketing execution board</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium text-muted-foreground">Google profile work, local search, content, reviews, photos, reporting, and review-ready evidence.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant={view === "dashboard" ? "default" : "outline"}><Link href="/seo"><LayoutDashboard className="size-4" />Dashboard</Link></Button>
            <Button asChild variant={view === "kanban" ? "default" : "outline"}><Link href="/seo/kanban"><ListChecks className="size-4" />Kanban</Link></Button>
            <Button asChild variant={view === "tasks" ? "default" : "outline"}><Link href="/seo/tasks"><Search className="size-4" />Tasks</Link></Button>
          </div>
        </div>

        {message ? (
          <div className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            <span>{message}</span>
            <button onClick={() => setMessage(null)} title="Dismiss"><X className="size-4" /></button>
          </div>
        ) : null}

        {view === "dashboard" ? (
          <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <MetricCard icon={CalendarDays} label="SEO tasks this week" value={stats.thisWeek} note="Due in the next 7 days" />
                <MetricCard icon={Clock} label="In progress" value={stats.inProgress} />
                <MetricCard icon={AlertTriangle} label="Waiting review" value={stats.waiting} />
                <MetricCard icon={CheckCircle2} label="Completed this month" value={stats.completedMonth} />
                <MetricCard icon={AlertTriangle} label="Overdue" value={stats.overdue} />
                <MetricCard icon={FileImage} label="Attachments uploaded" value={stats.attachments} />
              </div>
              <FiltersBar filters={filters} setFilters={setFilters} />
              <div className="grid gap-3 lg:grid-cols-2">
                {visibleTasks.slice(0, 6).map((task) => <TaskCard key={task.id} task={task} onStatus={updateStatus} />)}
                {visibleTasks.length === 0 ? <EmptyState title="No SEO tasks match this view" note="Create a task or clear filters to bring work back into focus." /> : null}
              </div>
            </div>
            <div className="space-y-5">
              <TaskForm onCreate={createTask} saving={saving} />
              <ActivityPanel activity={currentActivity} />
            </div>
          </div>
        ) : null}

        {view === "kanban" ? (
          <div className="space-y-5">
            <FiltersBar filters={filters} setFilters={setFilters} />
            <div className="grid gap-4 xl:grid-cols-6">
              {STATUSES.map((status) => {
                const columnTasks = visibleTasks.filter((task) => task.status === status.id);
                return (
                  <section key={status.id} className="min-h-80 rounded-lg border border-border/80 bg-muted/25 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <StatusBadge status={status.id} />
                      <span className="text-xs font-black text-muted-foreground">{columnTasks.length}</span>
                    </div>
                    <div className="space-y-3">
                      {columnTasks.map((task) => <TaskCard key={task.id} task={task} onStatus={updateStatus} />)}
                      {columnTasks.length === 0 ? <div className="rounded-md border border-dashed border-border bg-background/70 p-4 text-center text-xs font-semibold text-muted-foreground">No cards here.</div> : null}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        ) : null}

        {view === "tasks" ? (
          <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <div className="space-y-5">
              <FiltersBar filters={filters} setFilters={setFilters} />
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y divide-border/70">
                    {visibleTasks.map((task) => (
                      <Link className="grid gap-3 p-4 transition-colors hover:bg-accent/50 lg:grid-cols-[1fr_150px_150px_130px_120px]" href={`/seo/tasks/${task.id}`} key={task.id}>
                        <div>
                          <p className="font-black">{task.title}</p>
                          <p className="mt-1 text-xs font-semibold text-muted-foreground">{task.category} · {task.assignee ?? "Unassigned"}</p>
                        </div>
                        <StatusBadge status={task.status} />
                        <PriorityBadge priority={task.priority} />
                        <span className="text-sm font-semibold text-muted-foreground">{formatDate(task.due_date)}</span>
                        <span className="text-sm font-bold text-muted-foreground">{task.comments_count} comments</span>
                      </Link>
                    ))}
                  </div>
                  {visibleTasks.length === 0 ? <EmptyState title="No SEO tasks yet" note="Use the task composer to start the SEO workflow." /> : null}
                </CardContent>
              </Card>
            </div>
            <TaskForm onCreate={createTask} saving={saving} />
          </div>
        ) : null}

        {view === "detail" ? (
          currentTask ? (
            <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
              <div className="space-y-5">
                <Card>
                  <CardContent className="p-5">
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                      <div>
                        <Link className="text-sm font-bold text-primary hover:underline" href="/seo/kanban">Back to Kanban</Link>
                        <h2 className="mt-3 text-2xl font-black tracking-normal">{currentTask.title}</h2>
                        <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-muted-foreground">{currentTask.description || "No task brief has been added yet."}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge status={currentTask.status} />
                        <PriorityBadge priority={currentTask.priority} />
                      </div>
                    </div>
                    <div className="mt-5 grid gap-3 border-t border-border/70 pt-5 sm:grid-cols-2 lg:grid-cols-4">
                      <Info label="Category" value={currentTask.category} />
                      <Info label="Due date" value={formatDate(currentTask.due_date)} />
                      <Info label="Assigned to" value={currentTask.assignee ?? SEO_ASSIGNEE} />
                      <Info label="Last updated" value={formatDateTime(currentTask.updated_at)} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Comments</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input placeholder="Add an internal SEO comment" value={commentBody} onChange={(event) => setCommentBody(event.target.value)} />
                      <Button onClick={addComment} disabled={!commentBody.trim()}><Send className="size-4" />Add</Button>
                    </div>
                    <div className="space-y-3">
                      {currentComments.map((comment) => (
                        <div className="rounded-md border border-border/80 bg-background p-3" key={comment.id}>
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-black">{comment.author_name}</p>
                            <p className="text-xs font-semibold text-muted-foreground">{formatDateTime(comment.created_at)}</p>
                          </div>
                          <p className="mt-2 text-sm font-medium leading-6 text-muted-foreground">{comment.body}</p>
                        </div>
                      ))}
                      {currentComments.length === 0 ? <p className="text-sm font-semibold text-muted-foreground">No comments yet.</p> : null}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Completion</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <textarea className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Completion notes for Owner review" value={completionNotes || currentTask.completion_notes || ""} onChange={(event) => setCompletionNotes(event.target.value)} />
                    <Button onClick={() => updateStatus(currentTask, "completed", completionNotes || currentTask.completion_notes || "")}>
                      <CheckCircle2 className="size-4" />
                      Complete task
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-5">
                <Card>
                  <CardHeader><CardTitle>Evidence</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background px-4 py-5 text-sm font-bold text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary">
                      <Upload className="size-4" />
                      {uploading ? "Uploading..." : "Upload photo or PDF"}
                      <input className="sr-only" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" disabled={uploading} onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) uploadFile(file);
                        event.currentTarget.value = "";
                      }} />
                    </label>
                    <div className="space-y-2">
                      {currentAttachments.map((attachment) => (
                        <div className="flex items-center justify-between gap-3 rounded-md border border-border/80 bg-background p-3" key={attachment.id}>
                          <a className="min-w-0 text-sm font-bold text-primary hover:underline" href={attachment.file_url ?? "#"} target="_blank" rel="noreferrer">{attachment.file_name}</a>
                          <Button size="icon" variant="ghost" onClick={() => deleteAttachment(attachment)} title="Delete attachment"><X className="size-4" /></Button>
                        </div>
                      ))}
                      {currentAttachments.length === 0 ? <p className="text-sm font-semibold text-muted-foreground">No evidence uploaded.</p> : null}
                    </div>
                  </CardContent>
                </Card>
                <ActivityPanel activity={currentActivity} />
              </div>
            </div>
          ) : (
            <EmptyState title="Task not found" note="The task may have been archived or you may not have access." />
          )
        ) : null}
      </div>
    </DashboardShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/80 bg-background p-3">
      <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}

function EmptyState({ title, note }: { title: string; note: string }) {
  return (
    <Card>
      <CardContent className="grid min-h-48 place-items-center p-6 text-center">
        <div>
          <div className="mx-auto mb-3 grid size-10 place-items-center rounded-md border border-border bg-background text-primary">
            <Activity className="size-5" />
          </div>
          <p className="font-black">{title}</p>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">{note}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityPanel({ activity }: { activity: ActivityRow[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="size-4" /> Recent activity</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {activity.slice(0, 8).map((item) => (
          <div className="rounded-md border border-border/80 bg-background p-3" key={item.id}>
            <p className="text-sm font-black">{item.action.replaceAll("_", " ")}</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">{formatDateTime(item.created_at)}</p>
          </div>
        ))}
        {activity.length === 0 ? <p className="text-sm font-semibold text-muted-foreground">No activity recorded yet.</p> : null}
      </CardContent>
    </Card>
  );
}
