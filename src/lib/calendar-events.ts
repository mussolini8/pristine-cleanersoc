import type { BusinessUnit } from "@/lib/business-units";
import type { UnifiedPayment } from "@/lib/payments/unified";

export type CalendarEventType = "booking" | "payment" | "task" | "sop";

export type CalendarEventColor = {
  eventClass: string;
  dotClass: string;
  badgeClass: string;
  accentClass: string;
};

export type NormalizedCalendarEvent = {
  id: string;
  sourceId: string;
  type: CalendarEventType;
  title: string;
  start: string;
  end?: string;
  status: string;
  businessUnit: BusinessUnit | "seo";
  color: CalendarEventColor;
  summary: string;
  meta: Record<string, string | number | boolean | null | undefined>;
};

type CalendarTaskLike = {
  id: string;
  title: string;
  due_date?: string | null;
  status?: string | null;
  normalizedStatus?: string;
  priority?: string | null;
  normalizedPriority?: string;
  category?: string | null;
  assignee?: string | null;
  unit?: BusinessUnit | "seo";
  business_unit?: string | null;
  panel?: string | null;
  account_name?: string | null;
  property_address?: string | null;
  metadata?: Record<string, unknown> | null;
};

type BookingLike = {
  id: string;
  title?: string | null;
  accountName?: string | null;
  customerName?: string | null;
  cleanerName?: string | null;
  serviceDate?: string | null;
  start?: string | null;
  end?: string | null;
  status?: string | null;
  source?: string | null;
  amount?: number | null;
};

type SopTemplateLike = {
  id: string;
  natural_key?: string | null;
  title: string;
  description?: string | null;
  category: string;
  frequency: string;
  schedule_label: string;
  preferred_due_timing?: string | null;
  week_scope?: string | null;
  week_of_month?: number | null;
  day_of_week?: string | null;
  assigned_to: string;
  assigned_role?: string | null;
  panel?: string | null;
  business_unit?: string | null;
  priority?: string | null;
  status?: string | null;
  source?: string | null;
};

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export function normalizeCalendarDateKey(value: string | null | undefined) {
  if (!value) return "";
  const [datePart] = value.split("T");
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
  if (/^\d{4}-\d{2}$/.test(datePart)) return `${datePart}-01`;
  return "";
}

function parseDateKey(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function weekdayIndex(day: string | null | undefined) {
  const normalized = String(day ?? "").trim().toLowerCase();
  return WEEKDAY_INDEX[normalized] ?? null;
}

function nthWeekdayOfMonth(year: number, monthIndex: number, weekday: number, weekNumber: number) {
  const first = new Date(year, monthIndex, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  const date = new Date(year, monthIndex, 1 + offset + (weekNumber - 1) * 7);
  return date.getMonth() === monthIndex ? date : null;
}

function lastWeekdayOfMonth(year: number, monthIndex: number, weekday: number) {
  const last = new Date(year, monthIndex + 1, 0);
  const offset = (last.getDay() - weekday + 7) % 7;
  return new Date(year, monthIndex, last.getDate() - offset);
}

function everyWeekdayOfMonth(year: number, monthIndex: number, weekday: number) {
  const first = nthWeekdayOfMonth(year, monthIndex, weekday, 1);
  if (!first) return [];
  const dates: Date[] = [];
  for (let date = new Date(first); date.getMonth() === monthIndex; date.setDate(date.getDate() + 7)) {
    dates.push(new Date(date));
  }
  return dates;
}

function isLastWeekSchedule(template: SopTemplateLike) {
  const label = `${template.schedule_label} ${template.preferred_due_timing ?? ""} ${template.week_scope ?? ""} ${template.natural_key ?? ""}`.toLowerCase();
  return label.includes("last week") || label.includes("last friday") || label.includes("last_");
}

function isFirstWeekSchedule(template: SopTemplateLike) {
  const label = `${template.schedule_label} ${template.preferred_due_timing ?? ""} ${template.week_scope ?? ""}`.toLowerCase();
  return label.includes("first week") || label.includes("week_1");
}

export function sopOccurrenceKey(templateId: string, occurrenceDate: string) {
  return `${templateId}:${occurrenceDate}`;
}

export function getSopOccurrenceDatesForRange(template: SopTemplateLike, startKey: string, endKey: string) {
  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  const day = weekdayIndex(template.day_of_week) ?? WEEKDAY_INDEX.friday;
  if (!start || !end || start > end) return [];

  const dates = new Set<string>();
  for (let cursor = new Date(start.getFullYear(), start.getMonth(), 1); cursor <= end; cursor = addMonths(cursor, 1)) {
    const year = cursor.getFullYear();
    const monthIndex = cursor.getMonth();
    const frequency = String(template.frequency ?? "").toLowerCase();
    const label = String(template.schedule_label ?? "").toLowerCase();
    const monthDates = frequency === "weekly" || label.includes("every ")
      ? everyWeekdayOfMonth(year, monthIndex, day)
      : isLastWeekSchedule(template)
        ? [lastWeekdayOfMonth(year, monthIndex, day)]
        : [nthWeekdayOfMonth(year, monthIndex, day, template.week_of_month ?? (isFirstWeekSchedule(template) ? 1 : 1))].filter((date): date is Date => Boolean(date));

    for (const date of monthDates) {
      const key = formatDateKey(date);
      if (key >= startKey && key <= endKey) dates.add(key);
    }
  }

  return Array.from(dates).sort();
}

export function getCalendarEventColor(type: CalendarEventType, status: string, businessUnit?: BusinessUnit | "seo"): CalendarEventColor {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus.includes("locked")) {
    return {
      eventClass: "border-slate-300 bg-slate-100 text-slate-900 hover:border-slate-500 dark:border-slate-700 dark:bg-slate-900/75 dark:text-slate-100",
      dotClass: "bg-slate-600",
      badgeClass: "border-slate-300 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
      accentClass: "bg-slate-600",
    };
  }

  if (normalizedStatus.includes("paid") || normalizedStatus.includes("approved") || normalizedStatus.includes("completed") || normalizedStatus.includes("done")) {
    return {
      eventClass: "border-emerald-200 bg-emerald-50 text-emerald-950 hover:border-emerald-400 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100",
      dotClass: "bg-emerald-500",
      badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
      accentClass: "bg-emerald-500",
    };
  }

  if (normalizedStatus.includes("review") || normalizedStatus.includes("urgent")) {
    return {
      eventClass: "border-rose-200 bg-rose-50 text-rose-950 hover:border-rose-400 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100",
      dotClass: "bg-rose-500",
      badgeClass: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100",
      accentClass: "bg-rose-500",
    };
  }

  if (type === "task") {
    if (businessUnit === "seo") {
      return {
        eventClass: "border-violet-200 bg-violet-50 text-violet-950 hover:border-violet-400 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-100",
        dotClass: "bg-violet-500",
        badgeClass: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100",
        accentClass: "bg-violet-500",
      };
    }

    return {
      eventClass: "border-amber-200 bg-amber-50 text-amber-950 hover:border-amber-400 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100",
      dotClass: "bg-amber-500",
      badgeClass: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
      accentClass: "bg-amber-500",
    };
  }

  if (businessUnit === "commercial" || type === "booking" || type === "payment") {
    return {
      eventClass: "border-sky-200 bg-sky-50 text-sky-950 hover:border-sky-400 dark:border-sky-900 dark:bg-sky-950/35 dark:text-sky-100",
      dotClass: "bg-sky-500",
      badgeClass: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100",
      accentClass: "bg-sky-500",
    };
  }

  return {
    eventClass: "border-teal-200 bg-teal-50 text-teal-950 hover:border-teal-400 dark:border-teal-900 dark:bg-teal-950/35 dark:text-teal-100",
    dotClass: "bg-teal-500",
    badgeClass: "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-100",
    accentClass: "bg-teal-500",
  };
}

export function mapPaymentToCalendarEvent(
  payment: UnifiedPayment,
  options: {
    amountLabel?: string;
    sourceLabel?: string;
    date?: string;
    businessUnit?: BusinessUnit;
  } = {},
): NormalizedCalendarEvent {
  const start = normalizeCalendarDateKey(options.date ?? payment.serviceDate ?? payment.periodStart ?? payment.createdAt);
  const isPayrollBooking = payment.sourceType === "commercial_payroll";
  const type: CalendarEventType = isPayrollBooking ? "booking" : "payment";
  const status = payment.requiresReview || payment.finalAmount === 0 ? "needs_review" : payment.status;
  const businessUnit = options.businessUnit ?? (payment.category === "commercial" || isPayrollBooking || payment.sourceType === "commercial_adjustment" ? "commercial" : "residential");
  const title = payment.accountName || payment.cleanerName || options.sourceLabel || "Payment item";
  const amount = options.amountLabel ?? `$${Number(payment.finalAmount ?? 0).toFixed(2)}`;

  return {
    id: `payment-${payment.sourceType}-${payment.id}`,
    sourceId: payment.id,
    type,
    title,
    start,
    end: normalizeCalendarDateKey(payment.periodEnd),
    status,
    businessUnit,
    color: getCalendarEventColor(type, status, businessUnit),
    summary: `${payment.cleanerName || "Unassigned"} · ${amount}`,
    meta: {
      sourceType: payment.sourceType,
      sourceLabel: options.sourceLabel,
      amount,
      cleanerName: payment.cleanerName,
      accountName: payment.accountName,
      requiresReview: payment.requiresReview,
      synced: payment.synced,
    },
  };
}

export function mapTaskToCalendarEvent(task: CalendarTaskLike): NormalizedCalendarEvent {
  const businessUnit = task.unit ?? (String(task.panel ?? task.business_unit).toLowerCase().includes("seo") ? "seo" : String(task.panel ?? task.business_unit).toLowerCase().includes("commercial") ? "commercial" : "residential");
  const status = task.normalizedStatus ?? task.status ?? "todo";
  const priority = task.normalizedPriority ?? task.priority ?? "normal";
  const metadata = task.metadata ?? {};
  const source = typeof metadata.source === "string" ? metadata.source : "manual_task";
  const templateId = typeof metadata.template_id === "string" ? metadata.template_id : null;
  const occurrenceDate = typeof metadata.occurrence_date === "string" ? metadata.occurrence_date : null;

  return {
    id: `task-${task.id}`,
    sourceId: task.id,
    type: "task",
    title: task.title || "Untitled task",
    start: normalizeCalendarDateKey(task.due_date),
    status,
    businessUnit,
    color: getCalendarEventColor("task", priority === "urgent" ? "urgent" : status, businessUnit),
    summary: `${task.assignee || "Unassigned"} · ${task.category || "Operations"}`,
    meta: {
      priority,
      category: task.category,
      assignee: task.assignee,
      accountName: task.account_name,
      propertyAddress: task.property_address,
      source,
      templateId,
      occurrenceDate,
      completionEmailEnabled: metadata.notify_owner_on_completed !== false,
      assignmentEmailEnabled: metadata.notify_assignee_on_assignment !== false,
    },
  };
}

export function mapSopTemplateToCalendarEvents(
  template: SopTemplateLike,
  options: {
    start: string;
    end: string;
    excludedOccurrenceKeys?: Set<string>;
  },
): NormalizedCalendarEvent[] {
  return getSopOccurrenceDatesForRange(template, options.start, options.end)
    .filter((occurrenceDate) => !options.excludedOccurrenceKeys?.has(sopOccurrenceKey(template.id, occurrenceDate)))
    .map((occurrenceDate) => {
      const priority = template.priority ?? "normal";

      return {
        id: `sop-${template.id}-${occurrenceDate}`,
        sourceId: template.id,
        type: "sop",
        title: template.title || "SOP task",
        start: occurrenceDate,
        status: "todo",
        businessUnit: "residential",
        color: getCalendarEventColor("task", priority === "urgent" ? "urgent" : "todo", "residential"),
        summary: `${template.assigned_to || "Unassigned"} · ${template.schedule_label}`,
        meta: {
          source: "sop_template",
          templateId: template.id,
          naturalKey: template.natural_key,
          occurrenceDate,
          scheduleSummary: template.schedule_label,
          preferredDueTiming: template.preferred_due_timing,
          category: template.category,
          priority,
          assignee: template.assigned_to,
          assignedRole: template.assigned_role,
          frequency: template.frequency,
          weekScope: template.week_scope,
          weekOfMonth: template.week_of_month,
          dayOfWeek: template.day_of_week,
          sourceType: template.source ?? "monthly_sop",
          completionEmailEnabled: true,
          assignmentEmailEnabled: false,
        },
      };
    });
}

export function mapBookingToCalendarEvent(booking: BookingLike): NormalizedCalendarEvent {
  const status = booking.status ?? "scheduled";
  const title = booking.accountName ?? booking.customerName ?? booking.title ?? "Commercial booking";

  return {
    id: `booking-${booking.id}`,
    sourceId: booking.id,
    type: "booking",
    title,
    start: normalizeCalendarDateKey(booking.serviceDate ?? booking.start),
    end: normalizeCalendarDateKey(booking.end),
    status,
    businessUnit: "commercial",
    color: getCalendarEventColor("booking", status, "commercial"),
    summary: [booking.cleanerName, booking.source, booking.amount === undefined || booking.amount === null ? null : `$${booking.amount.toFixed(2)}`].filter(Boolean).join(" · "),
    meta: {
      sourceLabel: booking.source,
      cleanerName: booking.cleanerName,
      amount: booking.amount,
    },
  };
}
