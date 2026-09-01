"use client";

import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDateKey, startOfWeek, addDays } from "@/lib/residential-operations";

export type CalendarView = "month" | "week" | "day" | "agenda";

export type NormalizedCalendarEvent = {
  id: string;
  type: string;
  status: string;
  title: string;
  start: string;
  end: string;
  summary: string;
  businessUnit: "residential" | "commercial" | "qc";
  color: {
    bgClass: string;
    borderClass: string;
    textClass: string;
    badgeClass: string;
  };
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function OperationsCalendar({
  events,
  emptyMessage,
  onEventSelect,
}: {
  events: NormalizedCalendarEvent[];
  viewMode?: CalendarView;
  anchor?: Date;
  emptyMessage: string;
  onEventSelect?: (event: NormalizedCalendarEvent) => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="grid gap-3 lg:grid-cols-7">
        {DAY_NAMES.map((day) => (
          <section className="min-h-[16rem] rounded-xl border border-border bg-card p-3 shadow-xs" key={day}>
            <div className="mb-3 flex items-center justify-between gap-2 border-b pb-2">
              <p className="text-xs font-black uppercase text-muted-foreground">{day}</p>
            </div>
            <div className="rounded-md border border-dashed border-border p-3 text-center text-xs font-bold text-muted-foreground">
              Loading...
            </div>
          </section>
        ))}
      </div>
    );
  }

  const start = startOfWeek(new Date());
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));

  return (
    <div className="grid gap-3 lg:grid-cols-7">
      {days.map((day) => {
        const key = formatDateKey(day);
        const dayEvents = (events || []).filter((event) => (event.start || "").startsWith(key));
        const dayName = DAY_NAMES[day.getDay()];
        const monthShort = day.toLocaleString("en-US", { month: "short" });
        const dayNum = day.getDate();

        return (
          <section className="min-h-[16rem] rounded-xl border border-border bg-card p-3 shadow-xs flex flex-col justify-between" key={key}>
            <div>
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                <div>
                  <p className="text-xs font-black uppercase text-muted-foreground">{dayName}</p>
                  <p className="text-sm font-black text-foreground">{monthShort} {dayNum}</p>
                </div>
                <Badge variant="outline" className="text-xs font-bold">{dayEvents.length}</Badge>
              </div>
              <div className="space-y-2">
                {dayEvents.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/80 p-3 text-center text-xs font-semibold text-muted-foreground">
                    Open day
                  </div>
                ) : null}
                {dayEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onEventSelect?.(event)}
                    className={cn(
                      "flex w-full flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition hover:scale-[1.01] hover:shadow-xs",
                      event.color?.bgClass || "bg-muted/40",
                      event.color?.borderClass || "border-border"
                    )}
                  >
                    <span className={cn("text-xs font-black leading-snug", event.color?.textClass || "text-foreground")}>
                      {event.title}
                    </span>
                    <span className="text-[10px] font-semibold text-muted-foreground line-clamp-2">
                      {event.summary}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
