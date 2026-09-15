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
  raw?: any;
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function OperationsCalendar({
  events,
  emptyMessage,
  onEventSelect,
  anchor,
  onAnchorChange,
  viewMode = "week",
  onViewModeChange,
}: {
  events: NormalizedCalendarEvent[];
  viewMode?: CalendarView;
  onViewModeChange?: (view: CalendarView) => void;
  anchor?: Date;
  onAnchorChange?: (date: Date) => void;
  emptyMessage: string;
  onEventSelect?: (event: NormalizedCalendarEvent) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [internalAnchor, setInternalAnchor] = useState<Date>(new Date());
  const [internalViewMode, setInternalViewMode] = useState<CalendarView>(viewMode);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeAnchor = anchor ?? internalAnchor;
  const setAnchor = onAnchorChange ?? setInternalAnchor;
  const activeViewMode = onViewModeChange ? viewMode : internalViewMode;
  const setViewMode = (mode: CalendarView) => {
    if (onViewModeChange) onViewModeChange(mode);
    setInternalViewMode(mode);
  };

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

  // Navigation handlers
  const handlePrev = () => {
    const d = new Date(activeAnchor);
    if (activeViewMode === "day") {
      d.setDate(d.getDate() - 1);
    } else if (activeViewMode === "month") {
      d.setMonth(d.getMonth() - 1);
    } else {
      d.setDate(d.getDate() - 7);
    }
    setAnchor(d);
  };

  const handleNext = () => {
    const d = new Date(activeAnchor);
    if (activeViewMode === "day") {
      d.setDate(d.getDate() + 1);
    } else if (activeViewMode === "month") {
      d.setMonth(d.getMonth() + 1);
    } else {
      d.setDate(d.getDate() + 7);
    }
    setAnchor(d);
  };

  const handleToday = () => {
    setAnchor(new Date());
  };

  // Header range label
  const getHeaderLabel = () => {
    if (activeViewMode === "day") {
      return activeAnchor.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    if (activeViewMode === "month") {
      return activeAnchor.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    }
    // Week
    const start = startOfWeek(activeAnchor);
    const end = addDays(start, 6);
    const startStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endStr = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${startStr} – ${endStr}`;
  };

  const todayStr = formatDateKey(new Date());

  // RENDER DAY VIEW
  const renderDayView = () => {
    const dayKey = formatDateKey(activeAnchor);
    const dayEvents = (events || []).filter((e) => (e.start || "").startsWith(dayKey));
    const totalHours = dayEvents.reduce((sum, e) => sum + (Number(e.raw?.totalHours) || 0), 0);
    const isToday = dayKey === todayStr;

    return (
      <div className="space-y-4">
        <section
          className={cn(
            "rounded-xl border bg-card p-4 sm:p-5 shadow-xs transition-colors",
            isToday ? "border-primary/50 ring-1 ring-primary/30 bg-primary/[0.02]" : "border-border"
          )}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
            <div>
              <p className={cn("text-xs font-black uppercase", isToday ? "text-primary font-black" : "text-muted-foreground")}>
                {activeAnchor.toLocaleDateString("en-US", { weekday: "long" })} {isToday ? "• Today" : ""}
              </p>
              <h2 className="text-xl font-black text-foreground">
                {activeAnchor.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-bold px-2.5 py-1">
                {dayEvents.length} {dayEvents.length === 1 ? "service" : "services"}
              </Badge>
              {totalHours > 0 && (
                <Badge className="bg-primary/15 text-primary border-primary/20 text-xs font-bold px-2.5 py-1">
                  {totalHours.toFixed(1)} hrs total
                </Badge>
              )}
            </div>
          </div>

          {dayEvents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/80 p-10 text-center text-sm font-semibold text-muted-foreground">
              {emptyMessage || "No cleanings scheduled for this day."}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {dayEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onEventSelect?.(event)}
                  className={cn(
                    "flex flex-col justify-between gap-2.5 rounded-xl border p-3.5 text-left transition hover:scale-[1.01] hover:shadow-md cursor-pointer",
                    event.color?.bgClass || "bg-muted/40",
                    event.color?.borderClass || "border-border"
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("text-sm font-black leading-snug", event.color?.textClass || "text-foreground")}>
                        {event.title}
                      </span>
                      {event.raw?.totalHours > 0 && (
                        <span className="text-xs font-black px-2 py-0.5 rounded-md bg-background/80 border border-border/60 text-foreground">
                          {event.raw.totalHours}h
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-foreground/80 font-medium">
                      <span>{event.raw?.cleaner || "Unassigned"}</span>
                    </div>
                  </div>

                  {event.summary && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2 border-t border-border/40 pt-1.5">
                      {event.summary}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  };

  // RENDER WEEK VIEW
  const renderWeekView = () => {
    const start = startOfWeek(activeAnchor);
    const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));

    return (
      <div className="grid gap-3 lg:grid-cols-7">
        {days.map((day) => {
          const key = formatDateKey(day);
          const dayEvents = (events || []).filter((event) => (event.start || "").startsWith(key));
          const dayName = DAY_NAMES[day.getDay()];
          const monthShort = day.toLocaleString("en-US", { month: "short" });
          const dayNum = day.getDate();
          const isToday = todayStr === key;

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
                  <button
                    type="button"
                    onClick={() => {
                      setAnchor(day);
                      setViewMode("day");
                    }}
                    className="text-left group cursor-pointer"
                    title="Click to view full day"
                  >
                    <p className={cn("text-xs font-black uppercase transition-colors group-hover:text-primary", isToday ? "text-primary font-black" : "text-muted-foreground")}>
                      {dayName} {isToday ? "• Today" : ""}
                    </p>
                    <p className="text-sm font-black text-foreground group-hover:underline">
                      {monthShort} {dayNum}
                    </p>
                  </button>
                  <Badge
                    variant={dayEvents.length > 0 ? "default" : "outline"}
                    className={cn(
                      "text-xs font-bold",
                      isToday && dayEvents.length > 0 ? "bg-primary text-primary-foreground" : ""
                    )}
                  >
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
                        "flex w-full flex-col items-start gap-1 rounded-lg border p-2 text-left transition hover:scale-[1.01] hover:shadow-xs cursor-pointer",
                        event.color?.bgClass || "bg-muted/40",
                        event.color?.borderClass || "border-border"
                      )}
                    >
                      <div className="flex items-center justify-between w-full gap-1">
                        <span className={cn("text-xs font-black leading-snug truncate", event.color?.textClass || "text-foreground")}>
                          {event.title}
                        </span>
                        {event.raw?.totalHours > 0 && (
                          <span className="text-[10px] font-bold shrink-0 text-muted-foreground">
                            {event.raw.totalHours}h
                          </span>
                        )}
                      </div>
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
  };

  // RENDER MONTH VIEW
  const renderMonthView = () => {
    const monthStart = new Date(activeAnchor.getFullYear(), activeAnchor.getMonth(), 1);
    const gridStart = startOfWeek(monthStart);
    const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));

    return (
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center">
          {DAY_NAMES.map((name) => (
            <div key={name} className="py-2.5 text-xs font-black uppercase text-muted-foreground">
              {name}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 divide-x divide-y divide-border">
          {days.map((day) => {
            const key = formatDateKey(day);
            const dayEvents = (events || []).filter((event) => (event.start || "").startsWith(key));
            const isOutside = day.getMonth() !== activeAnchor.getMonth();
            const isToday = todayStr === key;

            return (
              <div
                key={key}
                className={cn(
                  "min-h-[7rem] sm:min-h-[8.5rem] p-1.5 sm:p-2 transition-colors flex flex-col justify-between",
                  isOutside ? "bg-muted/15 text-muted-foreground/60" : "bg-card",
                  isToday && "bg-primary/[0.04] ring-1 ring-inset ring-primary/40"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setAnchor(day);
                        setViewMode("day");
                      }}
                      className={cn(
                        "grid size-6 place-items-center rounded-md text-xs font-black transition-colors cursor-pointer",
                        isToday
                          ? "bg-primary text-primary-foreground font-black"
                          : isOutside
                          ? "text-muted-foreground/50 hover:bg-muted"
                          : "text-foreground hover:bg-muted"
                      )}
                      title="Click to view day details"
                    >
                      {day.getDate()}
                    </button>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] font-black text-muted-foreground">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => onEventSelect?.(event)}
                        className={cn(
                          "w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-bold border transition hover:scale-[1.01] cursor-pointer block",
                          event.color?.bgClass || "bg-muted/50",
                          event.color?.borderClass || "border-border/60",
                          event.color?.textClass || "text-foreground"
                        )}
                        title={`${event.title} (${event.summary})`}
                      >
                        {event.title}
                      </button>
                    ))}

                    {dayEvents.length > 3 && (
                      <button
                        type="button"
                        onClick={() => {
                          setAnchor(day);
                          setViewMode("day");
                        }}
                        className="w-full text-left text-[10px] font-bold text-primary hover:underline px-1 cursor-pointer"
                      >
                        +{dayEvents.length - 3} more
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Calendar Toolbar with View Switcher */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-card border border-border/70 rounded-xl p-2.5 shadow-xs">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrev} className="h-8 w-8 p-0 cursor-pointer">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday} className="h-8 text-xs font-bold cursor-pointer">
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={handleNext} className="h-8 w-8 p-0 cursor-pointer">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-black text-foreground ml-1">
            {getHeaderLabel()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle pills */}
          <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer",
                activeViewMode === "month"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer",
                activeViewMode === "week"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setViewMode("day")}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer",
                activeViewMode === "day"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Day
            </button>
          </div>

          <div className="text-xs font-semibold text-muted-foreground hidden sm:block">
            {events.length} {events.length === 1 ? "service" : "services"}
          </div>
        </div>
      </div>

      {/* Main Calendar View Body */}
      {activeViewMode === "day" && renderDayView()}
      {activeViewMode === "week" && renderWeekView()}
      {activeViewMode === "month" && renderMonthView()}
    </div>
  );
}

