"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Edit2,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type QCInspector = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  color: string;
  avatar_url: string | null;
  status: "active" | "inactive";
  notes: string | null;
};

type QCScheduleRow = {
  id: string;
  inspector_id: string;
  commercial_account_id: string | null;
  account_name: string;
  frequency_type: string;
  days_of_week: number[] | null;
  frequency_interval: number | null;
  scheduled_time: string | null;
  duration_minutes: number | null;
  effective_start_date: string | null;
  effective_end_date: string | null;
  notes: string | null;
  active: boolean;
};

type CommercialAccountOption = {
  id: string;
  name: string;
  city: string | null;
};

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const PRESET_COLORS = [
  "#10b981", "#ec4899", "#f59e0b", "#6366f1",
  "#ef4444", "#06b6d4", "#8b5cf6", "#f97316",
  "#14b8a6", "#e11d48", "#0ea5e9", "#84cc16",
];

const FREQ_TYPES = ["weekly", "biweekly", "daily", "monthly", "one_off"] as const;
type FrequencyType = (typeof FREQ_TYPES)[number];

const FREQ_LABELS: Record<FrequencyType, string> = {
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  daily: "Daily",
  monthly: "Monthly",
  one_off: "One-off Date",
};

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatDaysOfWeek(days: number[] | null): string {
  if (!days || days.length === 0) return "—";
  return days.map((d) => DAYS_OF_WEEK[d]).join(", ");
}

// ─────────────────────────────────────────────
// Modal backdrop + container
// ─────────────────────────────────────────────

function Modal({
  open,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Card */}
      <div
        className={cn(
          "relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-border/70 bg-card shadow-2xl",
          wide ? "max-w-2xl" : "max-w-lg",
        )}
      >
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Color picker
// ─────────────────────────────────────────────

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            title={c}
            className="relative flex size-9 items-center justify-center rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            style={{
              backgroundColor: c,
              borderColor: value === c ? "white" : "transparent",
              boxShadow: value === c ? `0 0 0 2px ${c}` : undefined,
            }}
          >
            {value === c && <Check className="size-4 text-white drop-shadow" />}
          </button>
        ))}
      </div>
      {/* Custom hex input */}
      <div className="flex items-center gap-2">
        <span
          className="size-7 shrink-0 rounded-full border border-border/60"
          style={{ backgroundColor: value }}
        />
        <Input
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
          }}
          placeholder="#10b981"
          className="h-8 w-28 font-mono text-xs"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Inspector form modal (Add / Edit)
// ─────────────────────────────────────────────

type InspectorFormState = {
  name: string;
  email: string;
  phone: string;
  color: string;
  status: "active" | "inactive";
  notes: string;
};

const DEFAULT_FORM: InspectorFormState = {
  name: "",
  email: "",
  phone: "",
  color: PRESET_COLORS[0],
  status: "active",
  notes: "",
};

function InspectorModal({
  open,
  onClose,
  existing,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  existing: QCInspector | null;
  onSaved: (inspector: QCInspector) => void;
  onDeleted?: (id: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<InspectorFormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate form when editing
  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name,
        email: existing.email,
        phone: existing.phone ?? "",
        color: existing.color,
        status: existing.status,
        notes: existing.notes ?? "",
      });
    } else {
      setForm(DEFAULT_FORM);
    }
    setError(null);
  }, [existing, open]);

  function set(field: keyof InspectorFormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      setError("Name and email are required.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      color: form.color,
      status: form.status,
      notes: form.notes.trim() || null,
    };

    let data: QCInspector | null = null;
    let err: { message: string } | null = null;

    if (existing) {
      const res = await supabase
        .from("qc_inspectors")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();
      data = res.data as QCInspector | null;
      err = res.error;
    } else {
      const res = await supabase
        .from("qc_inspectors")
        .insert(payload)
        .select()
        .single();
      data = res.data as QCInspector | null;
      err = res.error;
    }

    setSaving(false);
    if (err || !data) {
      setError(err?.message ?? "Failed to save inspector.");
      return;
    }
    onSaved(data);
    onClose();
  }

  async function handleDelete() {
    if (!existing || !window.confirm(`Are you sure you want to delete ${existing.name}? This will also delete all their assignments.`)) return;
    setSaving(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from("qc_inspectors")
        .delete()
        .eq("id", existing.id);
        
      if (err) {
        setError(err.message ?? "Failed to delete inspector.");
        return;
      }
      
      onDeleted?.(existing.id);
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Error deleting inspector.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <form onSubmit={handleSave}>
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <h2 className="text-base font-bold text-foreground">
            {existing ? "Edit Inspector" : "Add Inspector"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Name *
            </label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Jane Smith"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Email *
            </label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="jane@example.com"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Phone
            </label>
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+1 (949) 555-0100"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Color
            </label>
            <ColorPicker
              value={form.color}
              onChange={(c) => set("color", c)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Status
            </label>
            <div className="flex gap-2">
              {(["active", "inactive"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set("status", s)}
                  className={cn(
                    "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold capitalize transition-colors",
                    form.status === s
                      ? s === "active"
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border bg-muted text-muted-foreground"
                      : "border-border/60 bg-card/60 text-muted-foreground hover:bg-muted/60",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Optional notes…"
              rows={3}
              className="flex w-full rounded-xl border border-input bg-card/80 px-3.5 py-2.5 text-sm font-medium ring-offset-background placeholder:text-muted-foreground focus-visible:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/15"
            />
          </div>

          <div className="flex gap-2">
            {existing && (
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive gap-2 cursor-pointer"
                onClick={handleDelete}
                disabled={saving}
              >
                <Trash2 className="size-4" /> Delete
              </Button>
            )}
            <Button type="submit" disabled={saving} className="flex-1 cursor-pointer">
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {saving ? "Saving…" : existing ? "Save Changes" : "Add Inspector"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// Schedule assignment form (inline inside schedule modal)
// ─────────────────────────────────────────────

type ScheduleFormState = {
  commercial_account_id: string;
  account_name: string;
  frequency_type: FrequencyType;
  days_of_week: number[];
  scheduled_time: string;
  duration_minutes: string;
  effective_start_date: string;
  effective_end_date: string;
  notes: string;
};

const DEFAULT_SCHED_FORM: ScheduleFormState = {
  commercial_account_id: "",
  account_name: "",
  frequency_type: "weekly",
  days_of_week: [],
  scheduled_time: "",
  duration_minutes: "",
  effective_start_date: "",
  effective_end_date: "",
  notes: "",
};

function ScheduleAssignForm({
  inspectorId,
  accounts,
  existing,
  onSaved,
  onCancel,
}: {
  inspectorId: string;
  accounts: CommercialAccountOption[];
  existing: QCScheduleRow | null;
  onSaved: (row: QCScheduleRow) => void;
  onCancel: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<ScheduleFormState>(DEFAULT_SCHED_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acctSearch, setAcctSearch] = useState("");
  const [showAcctList, setShowAcctList] = useState(false);
  const acctRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (existing) {
      // Find account name from the row
      setForm({
        commercial_account_id: existing.commercial_account_id ?? "",
        account_name: existing.account_name,
        frequency_type: (existing.frequency_type as FrequencyType) ?? "weekly",
        days_of_week: existing.days_of_week ?? [],
        scheduled_time: existing.scheduled_time ?? "",
        duration_minutes: existing.duration_minutes?.toString() ?? "",
        effective_start_date: existing.effective_start_date ?? "",
        effective_end_date: existing.effective_end_date ?? "",
        notes: existing.notes ?? "",
      });
      setAcctSearch(existing.account_name);
    } else {
      setForm(DEFAULT_SCHED_FORM);
      setAcctSearch("");
    }
    setError(null);
  }, [existing]);

  // Close account dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (acctRef.current && !acctRef.current.contains(e.target as Node)) {
        setShowAcctList(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filteredAccounts = accounts.filter((a) =>
    `${a.name} ${a.city ?? ""}`.toLowerCase().includes(acctSearch.toLowerCase()),
  );

  function toggleDay(dow: number) {
    setForm((f) => ({
      ...f,
      days_of_week: f.days_of_week.includes(dow)
        ? f.days_of_week.filter((d) => d !== dow)
        : [...f.days_of_week, dow].sort(),
    }));
  }

  const showDays =
    form.frequency_type === "weekly" || form.frequency_type === "biweekly";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.account_name.trim()) {
      setError("Please select an account.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      inspector_id: inspectorId,
      commercial_account_id: form.commercial_account_id || null,
      account_name: form.account_name,
      frequency_type: form.frequency_type,
      days_of_week: showDays ? form.days_of_week : null,
      frequency_interval: form.frequency_type === "biweekly" ? 2 : 1,
      scheduled_time: form.scheduled_time || null,
      duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
      effective_start_date: form.effective_start_date || null,
      effective_end_date: form.effective_end_date || null,
      notes: form.notes || null,
      active: true,
    };

    let data: QCScheduleRow | null = null;
    let err: { message: string } | null = null;

    if (existing) {
      const res = await supabase
        .from("qc_inspection_schedules")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();
      data = res.data as QCScheduleRow | null;
      err = res.error;
    } else {
      const res = await supabase
        .from("qc_inspection_schedules")
        .insert(payload)
        .select()
        .single();
      data = res.data as QCScheduleRow | null;
      err = res.error;
    }

    setSaving(false);
    if (err || !data) {
      setError(err?.message ?? "Failed to save schedule.");
      return;
    }
    onSaved(data);
  }

  return (
    <form
      onSubmit={handleSave}
      className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 p-4"
    >
      <p className="text-xs font-bold uppercase tracking-wider text-primary">
        {existing ? "Edit Assignment" : "New Assignment"}
      </p>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {/* Account selector */}
      <div className="flex flex-col gap-1.5" ref={acctRef}>
        <label className="text-xs font-semibold text-muted-foreground">
          Account *
        </label>
        <div className="relative">
          <Input
            value={acctSearch}
            onChange={(e) => {
              setAcctSearch(e.target.value);
              setShowAcctList(true);
              setForm((f) => ({
                ...f,
                account_name: e.target.value,
                commercial_account_id: "",
              }));
            }}
            onFocus={() => setShowAcctList(true)}
            placeholder="Search accounts…"
          />
          <ChevronDown className="pointer-events-none absolute right-3 top-3 size-4 text-muted-foreground" />
          {showAcctList && filteredAccounts.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-xl border border-border/70 bg-card shadow-lg">
              {filteredAccounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-accent/50"
                  onClick={() => {
                    setForm((f) => ({
                      ...f,
                      commercial_account_id: a.id,
                      account_name: a.name,
                    }));
                    setAcctSearch(a.name);
                    setShowAcctList(false);
                  }}
                >
                  <span className="font-semibold text-foreground">{a.name}</span>
                  {a.city && (
                    <span className="text-xs text-muted-foreground">{a.city}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Frequency type */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-muted-foreground">
          Frequency
        </label>
        <select
          value={form.frequency_type}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              frequency_type: e.target.value as FrequencyType,
            }))
          }
          className="flex h-11 w-full rounded-xl border border-input bg-card/80 px-3.5 py-2 text-sm font-medium focus-visible:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/15"
        >
          {FREQ_TYPES.map((ft) => (
            <option key={ft} value={ft}>
              {FREQ_LABELS[ft]}
            </option>
          ))}
        </select>
      </div>

      {/* Days of week (weekly / biweekly only) */}
      {showDays && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground">
            Days of Week
          </label>
          <div className="flex flex-wrap gap-1.5">
            {DAYS_OF_WEEK.map((label, dow) => (
              <button
                key={dow}
                type="button"
                onClick={() => toggleDay(dow)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors",
                  form.days_of_week.includes(dow)
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border/60 bg-card/60 text-muted-foreground hover:bg-muted/60",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Specific date for one_off */}
      {form.frequency_type === "one_off" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground">
            Date
          </label>
          <Input
            type="date"
            value={form.effective_start_date}
            onChange={(e) =>
              setForm((f) => ({ ...f, effective_start_date: e.target.value }))
            }
          />
        </div>
      )}

      {/* Time + duration */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground">
            Time
          </label>
          <Input
            type="time"
            value={form.scheduled_time}
            onChange={(e) =>
              setForm((f) => ({ ...f, scheduled_time: e.target.value }))
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground">
            Duration (min)
          </label>
          <Input
            type="number"
            min={1}
            value={form.duration_minutes}
            onChange={(e) =>
              setForm((f) => ({ ...f, duration_minutes: e.target.value }))
            }
            placeholder="60"
          />
        </div>
      </div>

      {/* Effective dates (non-one_off) */}
      {form.frequency_type !== "one_off" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Start Date
            </label>
            <Input
              type="date"
              value={form.effective_start_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, effective_start_date: e.target.value }))
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              End Date
            </label>
            <Input
              type="date"
              value={form.effective_end_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, effective_end_date: e.target.value }))
              }
            />
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-muted-foreground">
          Notes
        </label>
        <Input
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="Optional notes…"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving} className="flex-1">
          {saving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Check className="size-3.5" />
          )}
          {saving ? "Saving…" : "Save Assignment"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────
// Schedule management modal
// ─────────────────────────────────────────────

function ScheduleModal({
  open,
  onClose,
  inspector,
  accounts,
}: {
  open: boolean;
  onClose: () => void;
  inspector: QCInspector | null;
  accounts: CommercialAccountOption[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [schedules, setSchedules] = useState<QCScheduleRow[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [schedError, setSchedError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRow, setEditingRow] = useState<QCScheduleRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !inspector) return;
    setLoadingSchedules(true);
    setSchedError(null);
    setShowAddForm(false);
    setEditingRow(null);
    supabase
      .from("qc_inspection_schedules")
      .select("*")
      .eq("inspector_id", inspector.id)
      .order("account_name")
      .then(({ data, error }) => {
        setLoadingSchedules(false);
        if (error) {
          setSchedError(error.message);
          return;
        }
        setSchedules((data ?? []) as QCScheduleRow[]);
      });
  }, [open, inspector, supabase]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    const { error } = await supabase
      .from("qc_inspection_schedules")
      .delete()
      .eq("id", id);
    setDeletingId(null);
    if (!error) {
      setSchedules((rows) => rows.filter((r) => r.id !== id));
    }
  }

  function handleSaved(row: QCScheduleRow) {
    setSchedules((rows) => {
      const idx = rows.findIndex((r) => r.id === row.id);
      if (idx >= 0) {
        const next = [...rows];
        next[idx] = row;
        return next;
      }
      return [...rows, row];
    });
    setShowAddForm(false);
    setEditingRow(null);
  }

  if (!inspector) return null;

  return (
    <Modal open={open} onClose={onClose} wide>
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            Manage Schedule
          </p>
          <h2 className="text-base font-bold text-foreground">
            {inspector.name}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-4 p-5">
        {schedError && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {schedError}
          </p>
        )}

        {/* Existing schedule rows */}
        {loadingSchedules ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : schedules.length === 0 && !showAddForm ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No schedules assigned yet.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-border/50">
            {schedules.map((row) =>
              editingRow?.id === row.id ? (
                <div key={row.id} className="py-3">
                  <ScheduleAssignForm
                    inspectorId={inspector.id}
                    accounts={accounts}
                    existing={editingRow}
                    onSaved={handleSaved}
                    onCancel={() => setEditingRow(null)}
                  />
                </div>
              ) : (
                <div
                  key={row.id}
                  className="flex items-start justify-between gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      {row.account_name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {FREQ_LABELS[row.frequency_type as FrequencyType] ?? row.frequency_type}
                      {row.days_of_week && row.days_of_week.length > 0 && (
                        <> · {formatDaysOfWeek(row.days_of_week)}</>
                      )}
                      {row.scheduled_time && (
                        <> · {row.scheduled_time.slice(0, 5)}</>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => setEditingRow(row)}
                      className="flex size-8 items-center justify-center rounded-lg border border-border/60 bg-card/80 text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 className="size-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(row.id)}
                      disabled={deletingId === row.id}
                      className="flex size-8 items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10"
                    >
                      {deletingId === row.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        )}

        {/* Add form or button */}
        {showAddForm ? (
          <ScheduleAssignForm
            inspectorId={inspector.id}
            accounts={accounts}
            existing={null}
            onSaved={handleSaved}
            onCancel={() => setShowAddForm(false)}
          />
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="size-4" />
            Assign Account
          </Button>
        )}
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// Inspector card
// ─────────────────────────────────────────────

function InspectorCard({
  inspector,
  assignedCount,
  onEdit,
  onManageSchedule,
}: {
  inspector: QCInspector;
  assignedCount: number;
  onEdit: () => void;
  onManageSchedule: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
      {/* Top: color + name + status */}
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 size-9 shrink-0 rounded-full border-2 border-white shadow"
          style={{ backgroundColor: inspector.color }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-foreground">{inspector.name}</p>
          <p className="truncate text-xs text-muted-foreground">{inspector.email}</p>
        </div>
        <Badge
          className={cn(
            "shrink-0",
            inspector.status === "active"
              ? "border-primary/15 bg-primary/10 text-primary"
              : "border-border/60 bg-muted text-muted-foreground",
          )}
        >
          {inspector.status}
        </Badge>
      </div>

      {/* Assigned count */}
      <p className="text-xs text-muted-foreground">
        <span className="font-bold text-foreground">{assignedCount}</span>{" "}
        assigned account{assignedCount !== 1 ? "s" : ""}
      </p>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={onEdit}
        >
          <Edit2 className="size-3.5" />
          Edit
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={onManageSchedule}
        >
          Schedule
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main InspectorsPanel export
// ─────────────────────────────────────────────

interface InspectorsPanelProps {
  inspectors: QCInspector[];
  schedules: { inspector_id: string }[];
  onInspectorsChange: (inspectors: QCInspector[]) => void;
}

export function InspectorsPanel({
  inspectors,
  schedules,
  onInspectorsChange,
}: InspectorsPanelProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<QCInspector | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<QCInspector | null>(null);
  const [schedModalOpen, setSchedModalOpen] = useState(false);
  const [accounts, setAccounts] = useState<CommercialAccountOption[]>([]);

  const supabase = useMemo(() => createClient(), []);

  // Load accounts for schedule form
  useEffect(() => {
    supabase
      .from("commercial_accounts")
      .select("id, name, city")
      .order("name")
      .then(({ data }) => {
        if (data) setAccounts(data as CommercialAccountOption[]);
      });
  }, [supabase]);

  // Build assignment count per inspector
  const assignedCounts = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const s of schedules) {
      if (!map.has(s.inspector_id)) map.set(s.inspector_id, new Set());
    }
    return map;
  }, [schedules]);

  // Count distinct accounts per inspector
  const accountCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of schedules) {
      map.set(s.inspector_id, (map.get(s.inspector_id) ?? 0) + 1);
    }
    return map;
  }, [schedules]);

  function openAdd() {
    setEditTarget(null);
    setModalOpen(true);
  }

  function openEdit(inspector: QCInspector) {
    setEditTarget(inspector);
    setModalOpen(true);
  }

  function openSchedule(inspector: QCInspector) {
    setScheduleTarget(inspector);
    setSchedModalOpen(true);
  }

  function handleInspectorSaved(saved: QCInspector) {
    const exists = inspectors.find((i) => i.id === saved.id);
    if (exists) {
      onInspectorsChange(inspectors.map((i) => (i.id === saved.id ? saved : i)));
    } else {
      onInspectorsChange([...inspectors, saved]);
    }
  }

  function handleInspectorDeleted(id: string) {
    onInspectorsChange(inspectors.filter((i) => i.id !== id));
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Inspectors</h2>
          <p className="text-sm text-muted-foreground">
            {inspectors.length} inspector{inspectors.length !== 1 ? "s" : ""} on team
          </p>
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus className="size-4" />
          Add Inspector
        </Button>
      </div>

      {/* Grid */}
      {inspectors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 py-16 text-center">
          <p className="text-sm font-semibold text-muted-foreground">
            No inspectors yet. Add your first inspector to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {inspectors.map((inspector) => (
            <InspectorCard
              key={inspector.id}
              inspector={inspector}
              assignedCount={accountCounts.get(inspector.id) ?? 0}
              onEdit={() => openEdit(inspector)}
              onManageSchedule={() => openSchedule(inspector)}
            />
          ))}
        </div>
      )}

      {/* Inspector add/edit modal */}
      <InspectorModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        existing={editTarget}
        onSaved={handleInspectorSaved}
        onDeleted={handleInspectorDeleted}
      />

      {/* Schedule management modal */}
      <ScheduleModal
        open={schedModalOpen}
        onClose={() => setSchedModalOpen(false)}
        inspector={scheduleTarget}
        accounts={accounts}
      />

      {/* Suppress unused var warning */}
      {assignedCounts.size === 0 && null}
    </div>
  );
}
