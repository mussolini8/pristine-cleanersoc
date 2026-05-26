export type MonthlySopRecurrenceRule =
  | "first_week_of_month"
  | "last_week_of_month"
  | "nth_weekday_of_month"
  | "week_day_of_month";

export type MonthlySopTemplate = {
  title: string;
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

export const MONTHLY_SOP_IMPORT = {
  sourceDocumentName: "Monthly SOP",
  initialMonth: "June",
  initialYear: 2026,
  calendarStartDate: "2026-06-01",
  calendarStartLabel: "Monday June 1, 2026",
  assignedTo: "Carlos Lopez",
  templates: [
    priority("Draft all recurring invoices during the last week of the month", "2026-06-26", "last_week_of_month", "Friday"),
    priority("Update monthly labor income tracker during the last week of the month", "2026-06-26", "last_week_of_month", "Friday"),
    priority("Confirm all invoices were sent during the first week of the month", "2026-06-05", "first_week_of_month", "Friday"),
    {
      title: "Conduct cleaner check-ins with every cleaning team on the 3rd Wednesday of the month",
      sourceSection: "Recurring Monthly Priorities",
      sopWeek: "Week 3",
      sopDay: "Wednesday",
      recurrenceType: "monthly",
      recurrenceRule: "nth_weekday_of_month",
      nth: 3,
      weekday: "Wednesday",
      juneDueDate: "2026-06-17",
    },
    priority("Maintain communication logs and updates for all active accounts", "2026-06-05", "first_week_of_month", "Friday"),
    priority("Keep CRM, Google Drive folders, and tracking sheets organized", "2026-06-05", "first_week_of_month", "Friday"),
    ...weekDay("Week 1", "Tuesday", "2026-06-02", [
      "Create a list of current clients that could potentially add additional recurring services",
      "Review accounts for upsell opportunities",
      "Organize notes for follow-up conversations",
      "Contact Teams to configure monthly availability",
    ]),
    ...weekDay("Week 1", "Thursday", "2026-06-04", [
      "Gather pictures from team for Google Business Profile (GMB) post drafting",
      "Draft GMB content/posts for review",
      "Create a list of all client/customer messages that have not been responded to",
      "Organize callbacks and follow-up priorities",
    ]),
    ...weekDay("Week 1", "Friday", "2026-06-05", [
      "Draft weekly geofence tracking report for all cleaners at every account",
      "Include notes regarding attendance, timing irregularities, or concerns",
      "Send full paragraph summary report to Jake",
    ]),
    ...weekDay("Week 2", "Tuesday", "2026-06-09", [
      "Confirm all QC check-ins are scheduled for every recurring account",
      "Organize QC calendar confirmations",
      "Prepare drafted client reports for completed QC inspections",
      "Prepare drafted text messages/emails to send clients after QC completion",
      "Create/update recurring service add-on opportunity list for clients",
    ]),
    ...weekDay("Week 2", "Wednesday", "2026-06-10", [
      "Check in with all cleaners regarding supply inventory needs",
      "Create list of supplies needing replenishment",
      "Confirm urgent inventory shortages",
    ]),
    ...weekDay("Week 2", "Thursday", "2026-06-11", [
      "Send Jake an updated list of current potential commercial cleaners",
      "Send Jake an updated list of current potential residential cleaners",
      "Gather pictures for GMB content drafting",
      "Draft GMB posts for review",
      "Create list of all unanswered messages needing responses/callbacks",
    ]),
    ...weekDay("Week 2", "Friday", "2026-06-12", [
      "Draft weekly geofence tracking report for all cleaners at every account",
      "Include notes on attendance consistency and issues",
      "Send full paragraph summary report to Jake",
    ]),
    ...weekDay("Week 3", "Wednesday", "2026-06-17", [
      "Conduct monthly cleaner check-ins with every cleaning team",
      "Document cleaner feedback/issues",
      "Note staffing concerns or performance updates",
      "Confirm morale and operational concerns are addressed",
    ]),
    ...weekDay("Week 3", "Thursday", "2026-06-18", [
      "Gather pictures for GMB content drafting",
      "Draft GMB posts for review",
      "Create list of all unanswered client/customer messages",
    ]),
    ...weekDay("Week 3", "Friday", "2026-06-19", [
      "Draft weekly geofence tracking report for all cleaners at every account",
      "Include notes regarding missed punches, late arrivals, or concerns",
      "Send full paragraph summary report to Jake",
    ]),
    ...weekDay("Week 4", "Wednesday", "2026-06-24", [
      "Conduct second monthly supply inventory check-in with all cleaners",
      "Create updated replenishment list",
      "Confirm upcoming supply orders needed",
    ]),
    ...weekDay("Week 4", "Thursday", "2026-06-25", [
      "Gather pictures for GMB content drafting",
      "Draft GMB posts for review",
      "Create list of all unanswered messages/callback opportunities",
    ]),
    ...weekDay("Week 4", "Friday", "2026-06-26", [
      "Draft all recurring invoices for next month",
      "Update monthly labor income tracker",
      "Double-check invoice accuracy and account billing",
      "Draft weekly geofence tracking report for all cleaners at every account",
      "Send full paragraph summary report to Jake",
      "Organize month-end operational notes",
      "Prepare next month SOP checklist template",
    ]),
  ] satisfies MonthlySopTemplate[],
} as const;

function priority(title: string, juneDueDate: string, recurrenceRule: "first_week_of_month" | "last_week_of_month", preferredDay: string): MonthlySopTemplate {
  return {
    title,
    sourceSection: "Recurring Monthly Priorities",
    sopWeek: recurrenceRule === "last_week_of_month" ? "Month-end / Last week of the month" : "Week 1",
    sopDay: preferredDay,
    recurrenceType: "monthly",
    recurrenceRule,
    preferredDay,
    juneDueDate,
  };
}

function weekDay(sopWeek: string, sopDay: string, juneDueDate: string, titles: string[]): MonthlySopTemplate[] {
  return titles.map((title) => ({
    title,
    sourceSection: `${sopWeek} ${sopDay}`,
    sopWeek,
    sopDay,
    recurrenceType: "monthly",
    recurrenceRule: "week_day_of_month",
    preferredDay: sopDay,
    juneDueDate,
  }));
}

export function normalizeMonthlySopTitle(title: string) {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function monthlySopTemplateKey(template: MonthlySopTemplate) {
  return [
    "monthly_sop",
    normalizeMonthlySopTitle(template.title),
    template.recurrenceRule,
    template.sopWeek,
    template.sopDay,
  ].join("_");
}

export function monthlySopDedupeKey(instance: MonthlySopInstance, templateId?: string | null) {
  if (templateId) return `${templateId}|${instance.targetMonth}|${instance.targetYear}`;
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
  if (date.getUTCMonth() !== month - 1) throw new Error(`${nth} ${weekday} is outside ${month}/${year}.`);
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
