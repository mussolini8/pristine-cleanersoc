export type MonthlySopImportTask = {
  title: string;
  dueDate: string;
  sourceSection: string;
  sopWeek: string;
  sopDay: string;
};

export const MONTHLY_SOP_IMPORT = {
  sourceDocumentName: "Monthly SOP",
  targetMonth: "June",
  targetYear: 2026,
  calendarStartDate: "2026-06-01",
  calendarStartLabel: "Monday June 1, 2026",
  assignedTo: "Carlos Lopez",
  tasks: [
    {
      title: "Draft all recurring invoices during the last week of the month",
      dueDate: "2026-06-26",
      sourceSection: "Recurring Monthly Priorities",
      sopWeek: "Month-end / Last week of the month",
      sopDay: "Friday",
    },
    {
      title: "Update monthly labor income tracker during the last week of the month",
      dueDate: "2026-06-26",
      sourceSection: "Recurring Monthly Priorities",
      sopWeek: "Month-end / Last week of the month",
      sopDay: "Friday",
    },
    {
      title: "Confirm all invoices were sent during the first week of the month",
      dueDate: "2026-06-05",
      sourceSection: "Recurring Monthly Priorities",
      sopWeek: "Week 1",
      sopDay: "Friday",
    },
    {
      title: "Conduct cleaner check-ins with every cleaning team on the 3rd Wednesday of the month",
      dueDate: "2026-06-17",
      sourceSection: "Recurring Monthly Priorities",
      sopWeek: "Week 3",
      sopDay: "Wednesday",
    },
    {
      title: "Maintain communication logs and updates for all active accounts",
      dueDate: "2026-06-05",
      sourceSection: "Recurring Monthly Priorities",
      sopWeek: "Week 1",
      sopDay: "Friday",
    },
    {
      title: "Keep CRM, Google Drive folders, and tracking sheets organized",
      dueDate: "2026-06-05",
      sourceSection: "Recurring Monthly Priorities",
      sopWeek: "Week 1",
      sopDay: "Friday",
    },
    ...[
      "Create a list of current clients that could potentially add additional recurring services",
      "Review accounts for upsell opportunities",
      "Organize notes for follow-up conversations",
      "Contact Teams to configure monthly availability",
    ].map((title) => ({ title, dueDate: "2026-06-02", sourceSection: "Week 1 Tuesday", sopWeek: "Week 1", sopDay: "Tuesday" })),
    ...[
      "Gather pictures from team for Google Business Profile (GMB) post drafting",
      "Draft GMB content/posts for review",
      "Create a list of all client/customer messages that have not been responded to",
      "Organize callbacks and follow-up priorities",
    ].map((title) => ({ title, dueDate: "2026-06-04", sourceSection: "Week 1 Thursday", sopWeek: "Week 1", sopDay: "Thursday" })),
    ...[
      "Draft weekly geofence tracking report for all cleaners at every account",
      "Include notes regarding attendance, timing irregularities, or concerns",
      "Send full paragraph summary report to Jake",
    ].map((title) => ({ title, dueDate: "2026-06-05", sourceSection: "Week 1 Friday", sopWeek: "Week 1", sopDay: "Friday" })),
    ...[
      "Confirm all QC check-ins are scheduled for every recurring account",
      "Organize QC calendar confirmations",
      "Prepare drafted client reports for completed QC inspections",
      "Prepare drafted text messages/emails to send clients after QC completion",
      "Create/update recurring service add-on opportunity list for clients",
    ].map((title) => ({ title, dueDate: "2026-06-09", sourceSection: "Week 2 Tuesday", sopWeek: "Week 2", sopDay: "Tuesday" })),
    ...[
      "Check in with all cleaners regarding supply inventory needs",
      "Create list of supplies needing replenishment",
      "Confirm urgent inventory shortages",
    ].map((title) => ({ title, dueDate: "2026-06-10", sourceSection: "Week 2 Wednesday", sopWeek: "Week 2", sopDay: "Wednesday" })),
    ...[
      "Send Jake an updated list of current potential commercial cleaners",
      "Send Jake an updated list of current potential residential cleaners",
      "Gather pictures for GMB content drafting",
      "Draft GMB posts for review",
      "Create list of all unanswered messages needing responses/callbacks",
    ].map((title) => ({ title, dueDate: "2026-06-11", sourceSection: "Week 2 Thursday", sopWeek: "Week 2", sopDay: "Thursday" })),
    ...[
      "Draft weekly geofence tracking report for all cleaners at every account",
      "Include notes on attendance consistency and issues",
      "Send full paragraph summary report to Jake",
    ].map((title) => ({ title, dueDate: "2026-06-12", sourceSection: "Week 2 Friday", sopWeek: "Week 2", sopDay: "Friday" })),
    ...[
      "Conduct monthly cleaner check-ins with every cleaning team",
      "Document cleaner feedback/issues",
      "Note staffing concerns or performance updates",
      "Confirm morale and operational concerns are addressed",
    ].map((title) => ({ title, dueDate: "2026-06-17", sourceSection: "Week 3 Wednesday", sopWeek: "Week 3", sopDay: "Wednesday" })),
    ...[
      "Gather pictures for GMB content drafting",
      "Draft GMB posts for review",
      "Create list of all unanswered client/customer messages",
    ].map((title) => ({ title, dueDate: "2026-06-18", sourceSection: "Week 3 Thursday", sopWeek: "Week 3", sopDay: "Thursday" })),
    ...[
      "Draft weekly geofence tracking report for all cleaners at every account",
      "Include notes regarding missed punches, late arrivals, or concerns",
      "Send full paragraph summary report to Jake",
    ].map((title) => ({ title, dueDate: "2026-06-19", sourceSection: "Week 3 Friday", sopWeek: "Week 3", sopDay: "Friday" })),
    ...[
      "Conduct second monthly supply inventory check-in with all cleaners",
      "Create updated replenishment list",
      "Confirm upcoming supply orders needed",
    ].map((title) => ({ title, dueDate: "2026-06-24", sourceSection: "Week 4 Wednesday", sopWeek: "Week 4", sopDay: "Wednesday" })),
    ...[
      "Gather pictures for GMB content drafting",
      "Draft GMB posts for review",
      "Create list of all unanswered messages/callback opportunities",
    ].map((title) => ({ title, dueDate: "2026-06-25", sourceSection: "Week 4 Thursday", sopWeek: "Week 4", sopDay: "Thursday" })),
    ...[
      "Draft all recurring invoices for next month",
      "Update monthly labor income tracker",
      "Double-check invoice accuracy and account billing",
      "Draft weekly geofence tracking report for all cleaners at every account",
      "Send full paragraph summary report to Jake",
      "Organize month-end operational notes",
      "Prepare next month SOP checklist template",
    ].map((title) => ({ title, dueDate: "2026-06-26", sourceSection: "Week 4 Friday", sopWeek: "Week 4", sopDay: "Friday" })),
  ] satisfies MonthlySopImportTask[],
} as const;

export function normalizeMonthlySopTitle(title: string) {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function monthlySopDedupeKey(task: MonthlySopImportTask) {
  return [
    MONTHLY_SOP_IMPORT.sourceDocumentName,
    MONTHLY_SOP_IMPORT.targetMonth,
    MONTHLY_SOP_IMPORT.targetYear,
    task.sopWeek,
    task.sopDay,
    normalizeMonthlySopTitle(task.title),
  ].join("|");
}
