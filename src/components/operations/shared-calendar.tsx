"use client";

import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
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
  anchor,
  onAnchorChange,
}: {
  events: NormalizedCalendarEvent[];
  viewMode?: CalendarView;
  anchor?: Date;
  onAnchorChange?: (date: Date) => void;
  emptyMessage: string;
  onEventSelect?: (event: NormalizedCalendarEvent) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [internalAnchor, setInternalAnchor] = useState<Date>(new Date());

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeAnchor = anchor ?? internalAnchor;
  const setAnchor = onAnchorChange ?? setInternalAnchor;

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

  const start = startOfWeek(activeAnchor);
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const weekStartStr = days[0].toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const weekEndStr = days[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const goToPrevWeek = () => {
    const prev = new Date(activeAnchor);
    prev.setDate(prev.getDate() - 7);
    setAnchor(prev);
  };

  const goToNextWeek = () => {
    const next = new Date(activeAnchor);
    next.setDate(next.getDate() + 7);
    setAnchor(next);
  };

  const goToToday = () => {
    setAnchor(new Date());
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPrevWeek} className="h-8 w-8 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday} className="h-8 text-xs font-bold">
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={goToNextWeek} className="h-8 w-8 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-bold text-foreground ml-1">
            {weekStartStr} – {weekEndStr}
          </span>
        </div>
        <div className="text-xs font-semibold text-muted-foreground">
          {events.length} {events.length === 1 ? "service" : "services"} scheduled this week
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-7">
        {days.map((day) => {
          const key = formatDateKey(day);
          const dayEvents = (events || []).filter((event) => (event.start || "").startsWith(key));
          const dayName = DAY_NAMES[day.getDay()];
          const monthShort = day.toLocaleString("en-US", { month: "short" });
          const dayNum = day.getDate();
          const isToday = formatDateKey(new Date()) === key;

          return (
            <section
              className={cn(
                "min-h-[18rem] rounded-xl border bg-card p-3 shadow-xs flex flex-col justify-between transition-colors",
                isToday ? "border-primary/60 ring-1 ring-primary/30 bg-primary/5" : "border-border"
              )}
              key={key}
            >
              <div>
                <div className="mb-3 flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                  <div>
                    <p className={cn("text-xs font-black uppercase", isToday ? "text-primary font-black" : "text-muted-foreground")}>
                      {dayName} {isToday ? "• Today" : ""}
                    </p>
                    <p className="text-sm font-black text-foreground">{monthShort} {dayNum}</p>
                  </div>
                  <Badge variant={dayEvents.length > 0 ? "default" : "outline"} className={cn("text-xs font-bold", isToday && dayEvents.length > 0 ? "bg-primary text-primary-foreground" : "")}>
                    {dayEvents.length}
                  </Badge>
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
                        "flex w-full flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition hover:scale-[1.01] hover:shadow-xs cursor-pointer",
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
    </div>
  );
}

