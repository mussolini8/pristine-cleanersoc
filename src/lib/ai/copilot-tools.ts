// Tool definitions for Gemini function calling
// These let the copilot answer questions from live DB data

export interface CopilotTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, { type: string; description: string; required?: boolean }>;
    required?: string[];
  };
}

export const COPILOT_TOOLS: CopilotTool[] = [
  {
    name: "query_cleaner_hours",
    description: "Get total hours worked by a specific cleaner in a date range from commercial_hours_entries. Use when asked about a cleaner's hours, work log, or performance.",
    parameters: {
      type: "object",
      properties: {
        cleanerName: { type: "string", description: "Full name of the cleaner (e.g. 'Luz Uribe')" },
        startDate: { type: "string", description: "Start date in ISO format YYYY-MM-DD" },
        endDate: { type: "string", description: "End date in ISO format YYYY-MM-DD" },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "query_account_schedule",
    description: "Get the current active schedule rules for a commercial account, including days, hours, cleaner, and frequency.",
    parameters: {
      type: "object",
      properties: {
        accountName: { type: "string", description: "Commercial account name (e.g. 'Field Day Brewery')" },
      },
      required: ["accountName"],
    },
  },
  {
    name: "query_upcoming_qc",
    description: "Get upcoming QC inspection schedules for the next N days.",
    parameters: {
      type: "object",
      properties: {
        days: { type: "number", description: "Number of days to look ahead (default: 7)" },
      },
    },
  },
  {
    name: "query_unassigned_accounts",
    description: "Get all commercial accounts with no cleaner assigned (cleaner_name is null or empty).",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "query_payroll_summary",
    description: "Get payroll summary for a date range showing total hours and amounts grouped by cleaner.",
    parameters: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Start date in ISO format YYYY-MM-DD" },
        endDate: { type: "string", description: "End date in ISO format YYYY-MM-DD" },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "query_staff_list",
    description: "Get the current list of active staff members with their roles and scopes.",
    parameters: {
      type: "object",
      properties: {
        scope: { type: "string", description: "Filter by team scope: 'commercial', 'residential', or 'mixed'. Leave empty for all." },
      },
    },
  },
  {
    name: "query_residential_accounts",
    description: "Get residential recurring cleaning accounts with their team assignments and schedules.",
    parameters: {
      type: "object",
      properties: {
        teamName: { type: "string", description: "Filter by assigned team name. Leave empty for all." },
      },
    },
  },
  {
    name: "audit_business_rules",
    description: "Audits system compliance with critical business rules from AGENTS.md (Steripax manual calculation check, Maria Lopez $22/hr & $1,000 biweekly flat, Emmi Guerra $18.15/hr, Ana Morales 80h biweekly, and inactive accounts like Mama's HB/Los Alamitos and Field AI).",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Optional category to check: 'all', 'payroll', 'rates', 'inactive_accounts', 'steripax'. Defaults to 'all'.",
        },
      },
    },
  },
  {
    name: "query_account_access",
    description: "Get access and entry instructions for a commercial or residential account (lockbox code, alarm code, gate code, suite, parking, key location, entry notes).",
    parameters: {
      type: "object",
      properties: {
        accountName: { type: "string", description: "Name of the account to look up entry and access codes for." },
      },
      required: ["accountName"],
    },
  },
  {
    name: "query_payroll_discrepancies",
    description: "Checks commercial payroll hours entered vs scheduled hours, flagging missing shifts, excessive deviations, and accounts requiring manual review.",
    parameters: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Start date in ISO format YYYY-MM-DD" },
        endDate: { type: "string", description: "End date in ISO format YYYY-MM-DD" },
      },
      required: ["startDate", "endDate"],
    },
  },
];

// Convert to Gemini function declarations format
export function toGeminiFunctionDeclarations() {
  return COPILOT_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

