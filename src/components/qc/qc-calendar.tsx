"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type QCInspector = {
  id: string;
  name: string;
  color: string;
};

export type QCSchedule = {
  id: string;
  inspector_id: string;
  account_name: string;
  frequency_type: string;
  days_of_week: number[] | null;
  frequency_interval: number | null;
  anchor_date: string | null;
  specific_date: string | null;
  scheduled_time: string | null;
  effective_start_date: string | null;
  effective_end_date: string | null;
  active: boolean;
};

// ─────────────────────────────────────────────
// Schedule expansion helper
// ─────────────────────────────────────────────

/**
 * Returns array of day-of-month numbers (1–31) where this schedule occurs
 * within the given year/month (month is 0-indexed: Jan=0).
 */
function getScheduledDaysInMonth(
  schedule: QCSchedule,
  year: number,
  month: number,
): number[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const result: number[] = [];

  // Helper: check if a specific date (year, month, day) is within effective range
  function isInRange(d: number): boolean {
    const ts = new Date(year, month, d).getTime();
    if (schedule.effective_start_date) {
      const start = new Date(schedule.effective_start_date + "T00:00:00").getTime();
      if (ts < start) return false;
    }
    if (schedule.effective_end_date) {
      const end = new Date(schedule.effective_end_date + "T00:00:00").getTime();
      if (ts > end) return false;
    }
    return true;
  }

  const ft = schedule.frequency_type?.toLowerCase() ?? "";

  if (ft === "daily") {
    for (let d = 1; d <= daysInMonth; d++) {
      if (isInRange(d)) result.push(d);
    }
  } else if (ft === "weekly") {
    const targetDays = schedule.days_of_week ?? [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, month, d).getDay(); // 0=Sun
      if (targetDays.includes(dow) && isInRange(d)) result.push(d);
    }
  } else if (ft === "biweekly" || ft === "bi-weekly") {
    const targetDays = schedule.days_of_week ?? [];
    // Anchor: use anchor_date or effective_start_date or first of year
    const anchorStr =
      schedule.anchor_date ||
      schedule.effective_start_date ||
      `${year}-01-01`;
    const anchor = new Date(anchorStr + "T00:00:00");
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dow = date.getDay();
      if (!targetDays.includes(dow)) continue;
      // Diff in weeks from anchor (find nearest matching weekday in anchor week)
      const diffMs = date.getTime() - anchor.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      const diffWeeks = Math.floor(diffDays / 7);
      if (diffWeeks >= 0 && diffWeeks % 2 === 0 && isInRange(d)) {
        result.push(d);
      }
    }
  } else if (ft === "monthly") {
    const targetDays = schedule.days_of_week ?? [];
    if (targetDays.length > 0) {
      for (let d = 1; d <= daysInMonth; d++) {
        const dow = new Date(year, month, d).getDay();
        if (targetDays.includes(dow) && isInRange(d)) {
          result.push(d);
          break; // monthly = first matching weekday of month
        }
      }
    }
  } else if (ft === "one_off" || ft === "one-off" || ft === "specific_date") {
    if (schedule.specific_date) {
      const sd = new Date(schedule.specific_date + "T00:00:00");
      if (sd.getFullYear() === year && sd.getMonth() === month) {
        const d = sd.getDate();
        if (isInRange(d)) result.push(d);
      }
    }
  }

  return result;
}

// ─────────────────────────────────────────────
// Day entry type (internal)
// ─────────────────────────────────────────────

type DayEntry = {
  scheduleId: string;
  accountName: string;
  inspectorColor: string;
  inspectorName: string;
  scheduledTime: string | null;
};

// ─────────────────────────────────────────────
// Calendar component
// ─────────────────────────────────────────────

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface QCCalendarProps {
  inspectors: QCInspector[];
  schedules: QCSchedule[];
}

export function QCCalendar({ inspectors, schedules }: QCCalendarProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Build inspector map for quick lookup
  const inspectorMap = new Map<string, QCInspector>(
    inspectors.map((i) => [i.id, i]),
  );

  // Build a map: day (1-31) → DayEntry[]
  const dayEntryMap = new Map<number, DayEntry[]>();

  const activeSchedules = schedules.filter((s) => s.active);
  for (const schedule of activeSchedules) {
    const inspector = inspectorMap.get(schedule.inspector_id);
    const days = getScheduledDaysInMonth(schedule, viewYear, viewMonth);
    for (const d of days) {
      const entries = dayEntryMap.get(d) ?? [];
      entries.push({
        scheduleId: schedule.id,
        accountName: schedule.account_name,
        inspectorColor: inspector?.color ?? "#6b7280",
        inspectorName: inspector?.name ?? "Unknown",
        scheduledTime: schedule.scheduled_time,
      });
      dayEntryMap.set(d, entries);
    }
  }

  // Navigation
  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  // Build calendar grid data
  const firstDow = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  // Cells: leading empty + day numbers
  const cells: (number | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const isToday = (d: number) =>
    d === today.getDate() &&
    viewMonth === today.getMonth() &&
    viewYear === today.getFullYear();

  function truncate(str: string, max: number) {
    return str.length > max ? str.slice(0, max) + "…" : str;
  }

  // Total inspections this view
  const totalThisMonth = Array.from(dayEntryMap.values()).reduce(
    (sum, entries) => sum + entries.length,
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            QC Inspection Calendar
          </p>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            {MONTHS[viewMonth]} {viewYear}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <span className="mr-3 text-xs font-semibold text-muted-foreground">
            {totalThisMonth} inspection{totalThisMonth !== 1 ? "s" : ""}
          </span>
          <button
            onClick={prevMonth}
            aria-label="Previous month"
            className="flex size-9 items-center justify-center rounded-xl border border-border/70 bg-card/80 text-muted-foreground transition-colors hover:bg-accent/55 hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={nextMonth}
            aria-label="Next month"
            className="flex size-9 items-center justify-center rounded-xl border border-border/70 bg-card/80 text-muted-foreground transition-colors hover:bg-accent/55 hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* ── Desktop grid calendar ── */}
      <div className="hidden sm:block">
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
          {/* Day labels */}
          <div className="grid grid-cols-7 border-b border-border/60">
            {WEEKDAYS.map((wd) => (
              <div
                key={wd}
                className="px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="grid grid-cols-7">
            {cells.map((cell, idx) => (
              <div
                key={idx}
                className={cn(
                  "min-h-[90px] border-b border-r border-border/40 p-1.5",
                  // Remove right border on last column, bottom border on last row
                  (idx + 1) % 7 === 0 && "border-r-0",
                  idx >= cells.length - 7 && "border-b-0",
                  cell === null && "bg-muted/20",
                )}
              >
                {cell !== null && (
                  <>
                    {/* Day number + count badge */}
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full text-xs font-bold",
                          isToday(cell)
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground",
                        )}
                      >
                        {cell}
                      </span>
                      {(dayEntryMap.get(cell)?.length ?? 0) > 1 && (
                        <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                          {dayEntryMap.get(cell)!.length}
                        </span>
                      )}
                    </div>

                    {/* Inspection pills — show max 3, then "+N more" */}
                    <div className="flex flex-col gap-[3px]">
                      {(dayEntryMap.get(cell) ?? [])
                        .slice(0, 3)
                        .map((entry) => (
                          <div
                            key={entry.scheduleId}
                            title={`${entry.accountName} · ${entry.inspectorName}${entry.scheduledTime ? " · " + entry.scheduledTime : ""}`}
                            className="flex items-center rounded-full px-1.5 py-px"
                            style={{ backgroundColor: entry.inspectorColor }}
                          >
                            <span className="truncate text-[10px] font-semibold leading-tight text-white">
                              {truncate(entry.accountName, 14)}
                            </span>
                          </div>
                        ))}
                      {(dayEntryMap.get(cell)?.length ?? 0) > 3 && (
                        <span className="pl-1 text-[9px] font-bold text-muted-foreground">
                          +{(dayEntryMap.get(cell)?.length ?? 0) - 3} more
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mobile: vertical day list ── */}
      <div className="flex flex-col gap-2 sm:hidden">
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
          const entries = dayEntryMap.get(d) ?? [];
          if (entries.length === 0) return null;
          const dow = new Date(viewYear, viewMonth, d).getDay();
          return (
            <div
              key={d}
              className="flex gap-3 rounded-xl border border-border/60 bg-card p-3"
            >
              {/* Date stamp */}
              <div className="flex w-10 shrink-0 flex-col items-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {WEEKDAYS[dow]}
                </span>
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full text-sm font-bold",
                    isToday(d)
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground",
                  )}
                >
                  {d}
                </span>
              </div>
              {/* Pills */}
              <div className="flex flex-1 flex-col gap-1.5">
                {entries.map((entry) => (
                  <div
                    key={entry.scheduleId}
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
                    style={{ backgroundColor: entry.inspectorColor }}
                  >
                    <span className="flex-1 truncate text-xs font-semibold text-white">
                      {entry.accountName}
                    </span>
                    {entry.scheduledTime && (
                      <span className="shrink-0 text-[10px] font-medium text-white/80">
                        {entry.scheduledTime.slice(0, 5)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {totalThisMonth === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No inspections scheduled for {MONTHS[viewMonth]}.
          </p>
        )}
      </div>

      {/* ── Inspector color legend ── */}
      {inspectors.length > 0 && (
        <div className="flex flex-wrap gap-3 rounded-xl border border-border/60 bg-card/60 px-4 py-3">
          {inspectors.map((ins) => (
            <div key={ins.id} className="flex items-center gap-1.5">
              <span
                className="block size-3 rounded-full"
                style={{ backgroundColor: ins.color }}
              />
              <span className="text-xs font-semibold text-foreground">
                {ins.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
