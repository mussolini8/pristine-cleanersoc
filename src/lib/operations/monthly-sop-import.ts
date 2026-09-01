import residentialSopTasks from "@/data/residential-sop-tasks.json";

export type MonthlySopRecurrenceRule =
  | "first_week_of_month"
  | "last_week_of_month"
  | "nth_weekday_of_month"
  | "week_day_of_month";

export type MonthlySopTemplate = {
  natural_key: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  sourceSection: string;
  sopWeek: string;
  sopDay: string;
  recurrenceType: "monthly";
  recurrenceRule: MonthlySopRecurrenceRule;
  preferredDay?: string;
  nth?: number;
  weekday?: string;
  juneDueDate: string;
};

export type MonthlySopInstance = MonthlySopTemplate & {
  dueDate: string;
  targetMonth: string;
  targetYear: number;
};

type SopTaskSeed = {
  natural_key: string;
  title: string;
  description: string;
  category: string;
  frequency: string;
  schedule_label: string;
  preferred_due_timing: string;
  week_scope: string;
  week_of_month: number | null;
  day_of_week: string | null;
  priority: string;
};

const rawTasks = residentialSopTasks as SopTaskSeed[];

const WEEKDAY_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SPECIAL_RULES: Record<
  string,
  { rule: MonthlySopRecurrenceRule; section: string; week: string; day: string; nth?: number; weekday?: string; juneDueDate: string }
> = {
  "Draft all recurring invoices during the last week of the month": {
    rule: "last_week_of_month",
    section: "Recurring Monthly Priorities",
    week: "Month-end / Last week of the month",
    day: "Friday",
    juneDueDate: "2026-06-26",
  },
  "Update monthly labor income tracker during the last week of the month": {
    rule: "last_week_of_month",
    section: "Recurring Monthly Priorities",
    week: "Month-end / Last week of the month",
    day: "Friday",
    juneDueDate: "2026-06-26",
  },
  "Confirm all invoices were sent during the first week of the month": {
    rule: "first_week_of_month",
    section: "Recurring Monthly Priorities",
    week: "Week 1",
    day: "Friday",
    juneDueDate: "2026-06-05",
  },
  "Conduct cleaner check-ins with every cleaning team on the 3rd Wednesday of the month": {
    rule: "nth_weekday_of_month",
    nth: 3,
    weekday: "Wednesday",
    section: "Recurring Monthly Priorities",
    week: "Week 3",
    day: "Wednesday",
    juneDueDate: "2026-06-17",
  },
  "Maintain communication logs and updates for all active accounts": {
    rule: "first_week_of_month",
    section: "Recurring Monthly Priorities",
    week: "Week 1",
    day: "Friday",
    juneDueDate: "2026-06-05",
  },
  "Keep CRM, Google Drive folders, and tracking sheets organized": {
    rule: "first_week_of_month",
    section: "Recurring Monthly Priorities",
    week: "Week 1",
    day: "Friday",
    juneDueDate: "2026-06-05",
  },
};

const JUNE_WEEK_DATES: Record<string, string> = {
  "Week 1 Tuesday": "2026-06-02",
  "Week 1 Thursday": "2026-06-04",
  "Week 1 Friday": "2026-06-05",
  "Week 2 Tuesday": "2026-06-09",
  "Week 2 Wednesday": "2026-06-10",
  "Week 2 Thursday": "2026-06-11",
  "Week 2 Friday": "2026-06-12",
  "Week 3 Wednesday": "2026-06-17",
  "Week 3 Thursday": "2026-06-18",
  "Week 3 Friday": "2026-06-19",
  "Week 4 Wednesday": "2026-06-24",
  "Week 4 Thursday": "2026-06-25",
  "Week 4 Friday": "2026-06-26",
};

export const MONTHLY_SOP_IMPORT = {
  sourceDocumentName: "Monthly SOP",
  initialMonth: "June",
  initialYear: 2026,
  calendarStartDate: "2026-06-01",
  calendarStartLabel: "Monday June 1, 2026",
  assignedTo: "Carlos Lopez",
  templates: rawTasks.map((task) => {
    const special = SPECIAL_RULES[task.title];
    if (special) {
      return {
        natural_key: task.natural_key,
        title: task.title,
        description: task.description,
        category: task.category,
        priority: task.priority,
        sourceSection: special.section,
        sopWeek: special.week,
        sopDay: special.day,
        recurrenceType: "monthly" as const,
        recurrenceRule: special.rule,
        preferredDay: special.day,
        nth: special.nth,
        weekday: special.weekday,
        juneDueDate: special.juneDueDate,
      };
    }

    const weekNum = task.week_of_month ?? 1;
    const sopWeek = `Week ${weekNum}`;
    const sopDay = task.day_of_week ?? "Friday";
    const sectionKey = `${sopWeek} ${sopDay}`;
    const juneDueDate = JUNE_WEEK_DATES[sectionKey] ?? "2026-06-05";

    return {
      natural_key: task.natural_key,
      title: task.title,
      description: task.description,
      category: task.category,
      priority: task.priority,
      sourceSection: sectionKey,
      sopWeek,
      sopDay,
      recurrenceType: "monthly" as const,
      recurrenceRule: "week_day_of_month" as const,
      preferredDay: sopDay,
      nth: weekNum,
      weekday: sopDay,
      juneDueDate,
    };
  }) satisfies MonthlySopTemplate[],
} as const;

export function normalizeMonthlySopTitle(title: string) {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function monthlySopTemplateKey(template: MonthlySopTemplate) {
  return template.natural_key;
}

export function monthlySopDedupeKey(instance: MonthlySopInstance, templateId?: string | null) {
  void templateId;
  return [
    MONTHLY_SOP_IMPORT.sourceDocumentName,
    instance.targetMonth,
    instance.targetYear,
    instance.sopWeek,
    instance.sopDay,
    normalizeMonthlySopTitle(instance.title),
  ].join("|");
}

export function generateMonthlySopTasks(month: number, year: number): MonthlySopInstance[] {
  const targetMonth = MONTH_LABELS[month - 1];
  if (!targetMonth) throw new Error("Month must be between 1 and 12.");
  return MONTHLY_SOP_IMPORT.templates.map((template) => ({
    ...template,
    dueDate: calculateDueDate(template, month, year),
    targetMonth,
    targetYear: year,
  }));
}

export function calculateDueDate(template: MonthlySopTemplate, month: number, year: number) {
  if (month === 6 && year === 2026) return template.juneDueDate;
  if (template.recurrenceRule === "first_week_of_month") return nthWeekdayOfMonth(month, year, template.preferredDay ?? template.sopDay, 1);
  if (template.recurrenceRule === "last_week_of_month") return lastWeekdayOfMonth(month, year, template.preferredDay ?? template.sopDay);
  if (template.recurrenceRule === "nth_weekday_of_month") return nthWeekdayOfMonth(month, year, template.weekday ?? template.sopDay, template.nth ?? 1);
  const weekNumber = Number(template.sopWeek.match(/\d+/)?.[0] ?? 1);
  return nthWeekdayOfMonth(month, year, template.sopDay, weekNumber);
}

function nthWeekdayOfMonth(month: number, year: number, weekday: string, nth: number) {
  const weekdayIndex = WEEKDAY_INDEX[weekday];
  if (weekdayIndex === undefined) throw new Error(`Unsupported weekday: ${weekday}`);
  const date = new Date(Date.UTC(year, month - 1, 1));
  const offset = (weekdayIndex - date.getUTCDay() + 7) % 7;
  date.setUTCDate(1 + offset + (nth - 1) * 7);
  if (date.getUTCMonth() !== month - 1) {
    return lastWeekdayOfMonth(month, year, weekday);
  }
  return formatDate(date);
}

function lastWeekdayOfMonth(month: number, year: number, weekday: string) {
  const weekdayIndex = WEEKDAY_INDEX[weekday];
  if (weekdayIndex === undefined) throw new Error(`Unsupported weekday: ${weekday}`);
  const date = new Date(Date.UTC(year, month, 0));
  const offset = (date.getUTCDay() - weekdayIndex + 7) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return formatDate(date);
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
