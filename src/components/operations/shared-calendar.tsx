"use client";

import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDateKey, todayKey, startOfWeek, addDays, displayDate } from "@/lib/residential-operations";

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

export function OperationsCalendar({
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
  const start = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));

  return (
    <div className="grid gap-3 lg:grid-cols-7">
      {days.map((day) => {
        const key = formatDateKey(day);
        const dayEvents = events.filter((event) => event.start === key);
        return (
          <section className="min-h-[16rem] rounded-lg border border-border bg-card p-3" key={key}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-black uppercase text-muted-foreground">{day.toLocaleDateString("en-US", { weekday: "short" })}</p>
                <p className="text-sm font-black">{day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
              </div>
              <Badge variant="outline">{dayEvents.length}</Badge>
            </div>
            <div className="space-y-2">
              {dayEvents.length === 0 ? <div className="rounded-md border border-dashed border-border p-3 text-center text-xs font-bold text-muted-foreground">Open day</div> : null}
              {dayEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => onEventSelect(event)}
                  className={cn("flex w-full flex-col items-start gap-1 rounded-md border p-2 text-left transition hover:brightness-95", event.color.bgClass, event.color.borderClass)}
                >
                  <span className={cn("text-xs font-bold leading-tight", event.color.textClass)}>{event.title}</span>
                  <span className="text-[10px] font-semibold text-muted-foreground">{event.summary}</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
