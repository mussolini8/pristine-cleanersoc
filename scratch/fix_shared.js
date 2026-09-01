const fs = require('fs');
const file = 'src/components/operations/shared-calendar.tsx';
let content = fs.readFileSync(file, 'utf8');

// I need to add exports.
content = content.replace('function OperationsCalendar', 'export function OperationsCalendar');
content = content.replace('type CalendarView =', 'export type CalendarView =');
content = content.replace('type NormalizedCalendarEvent =', 'export type NormalizedCalendarEvent =');

const imports = `import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDateKey, todayKey, startOfWeek, addDays, displayDate } from "@/lib/residential-operations";

function UnitBadge({ unit }: { unit: string }) {
  if (unit === "commercial") return <Badge variant="outline" className="border-indigo-200 text-indigo-700 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">Commercial</Badge>;
  if (unit === "qc") return <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">QC</Badge>;
  return <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">Residential</Badge>;
}

function statusLabel(status: string) { return status.charAt(0).toUpperCase() + status.slice(1).replace("_", " "); }

function CalendarEventPill({ event, dense, onSelect }: any) {
  return (
    <button type="button" onClick={() => onSelect(event)} className={cn("flex w-full flex-col items-start gap-1 rounded-md border p-1.5 text-left transition", event.color.borderClass, event.color.bgClass, "hover:brightness-95")}>
      <span className="truncate text-[10px] font-black uppercase text-muted-foreground/80">{event.start === event.end ? event.start : \`\${event.start} - \${event.end}\`}</span>
      <span className={cn("truncate font-bold leading-tight", dense ? "text-[11px]" : "text-xs", event.color.textClass)}>{event.title}</span>
    </button>
  );
}
`;

content = imports + "\n" + content;

fs.writeFileSync(file, content);
