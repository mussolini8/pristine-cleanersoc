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

export function normalizeCalendarDateKey(value: string | null | undefined) {
  if (!value) return "";
  const [datePart] = value.split("T");
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
  if (/^\d{4}-\d{2}$/.test(datePart)) return `${datePart}-01`;
  return "";
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
    },
  };
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
