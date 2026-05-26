import { z } from "zod";
import {
  COMMERCIAL_HOURS_STATUSES,
  COMMERCIAL_SCHEDULE_FREQUENCIES,
  OUTSIDE_OC_CITY,
  PAYMENT_MODES,
  PAYMENT_STATUSES,
  STAFF_PIPELINE_STATUSES,
  STAFF_TEAM_SCOPES,
  TASK_PRIORITIES,
  WORK_LOG_STATUSES,
} from "@/lib/operations/constants";

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.");
const optionalText = z.string().trim().optional().nullable();
const positiveAmount = z.number().finite().gt(0, "Payment amount must be greater than 0.");
const nonNegativeAmount = z.number().finite().min(0, "Amounts cannot be negative.");
const positiveHours = z.number().finite().gt(0, "Hours must be greater than 0.");

export const taskReminderSchema = z.object({
  title: z.string().trim().min(1, "Task title is required."),
  description: optionalText,
  assignee: z.string().trim().min(1, "Assign responsibility before saving."),
  dueDate: dateOnlySchema,
  priority: z.enum(TASK_PRIORITIES),
  status: z.enum(["pending", "in_progress", "completed"]).default("pending"),
  completedAt: z.string().datetime().nullable().optional(),
  frequency: z.enum(["one_time", "daily", "weekly", "every_2_weeks", "monthly", "custom"]),
  customIntervalDays: z.number().int().positive().nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.completedAt && value.status !== "completed") {
    ctx.addIssue({ code: "custom", path: ["completedAt"], message: "Completed date is only allowed for completed tasks." });
  }
  if (value.frequency === "custom" && !value.customIntervalDays) {
    ctx.addIssue({ code: "custom", path: ["customIntervalDays"], message: "Custom reminders need an interval." });
  }
});

export const staffMemberSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.email("Use a valid email.").or(z.literal("")).nullable().optional(),
  role: z.string().trim().min(1, "Role is required."),
  teamScope: z.enum(STAFF_TEAM_SCOPES),
  status: z.enum(STAFF_PIPELINE_STATUSES),
  hourlyRate: z.number().finite().min(0).nullable().optional(),
  paymentMode: z.enum(PAYMENT_MODES),
  active: z.boolean(),
});

export const residentialPaymentRowSchema = z.object({
  cleanerId: z.string().nullable().optional(),
  cleanerName: z.string().trim().min(1, "Cleaner is required."),
  workDate: dateOnlySchema,
  city: z.string().trim().min(1, "City is required."),
  customCity: z.string().trim().nullable().optional(),
  paymentAmount: nonNegativeAmount,
  residentialAmount: nonNegativeAmount,
  commercialAmount: nonNegativeAmount,
  paymentMode: z.enum(PAYMENT_MODES),
  status: z.enum(PAYMENT_STATUSES),
}).superRefine((value, ctx) => {
  if (value.city === OUTSIDE_OC_CITY && !value.customCity) {
    ctx.addIssue({ code: "custom", path: ["customCity"], message: "Custom city is required for outside Orange County jobs." });
  }
  if (value.paymentMode === "mixed") {
    if (value.residentialAmount === 0 && value.commercialAmount === 0) {
      ctx.addIssue({ code: "custom", path: ["residentialAmount"], message: "Juan Romero's payment row needs a residential or commercial amount." });
    }
    return;
  }
  if (value.paymentAmount <= 0) {
    ctx.addIssue({ code: "custom", path: ["paymentAmount"], message: positiveAmount.safeParse(value.paymentAmount).success ? "Payment amount must be greater than 0." : "Payment amount must be greater than 0." });
  }
});

export const commercialHoursEntrySchema = z.object({
  commercialAccountId: z.string().trim().min(1, "Commercial account is required."),
  teamName: z.string().trim().min(1, "Team or person is required."),
  workDate: dateOnlySchema,
  hours: positiveHours,
  status: z.enum(COMMERCIAL_HOURS_STATUSES),
  source: z.enum(["manual", "scheduled"]),
  verified: z.boolean(),
}).superRefine((value, ctx) => {
  if (value.status === "paid" && !value.verified) {
    ctx.addIssue({ code: "custom", path: ["verified"], message: "Commercial hours must be verified before paid." });
  }
});

export const commercialScheduleSchema = z.object({
  commercialAccountId: z.string().trim().min(1, "Commercial account is required."),
  assignedName: z.string().trim().min(1, "Team or person is required."),
  frequency: z.enum(COMMERCIAL_SCHEDULE_FREQUENCIES),
  selectedDays: z.array(z.string()).min(1, "Select at least one service day."),
  dayHours: z.record(z.string(), z.number().finite().gt(0, "Each selected day needs hours greater than 0.")),
  effectiveFrom: dateOnlySchema,
  effectiveUntil: dateOnlySchema.or(z.literal("")).nullable().optional(),
  active: z.boolean(),
});

export const workLogSchema = z.object({
  accountId: z.string().trim().min(1, "Account is required."),
  teamId: z.string().trim().min(1, "Team is required."),
  workDate: dateOnlySchema,
  hoursWorked: positiveHours,
  status: z.enum(WORK_LOG_STATUSES),
});

export const appSettingSchema = z.object({
  key: z.enum([
    "notifications.enabled",
    "payments.default_period",
    "exports.format",
    "payroll.week_start",
  ]),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; message: string };

export function validateInput<T>(schema: z.ZodType<T>, input: unknown): ValidationResult<T> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, message: parsed.error.issues[0]?.message ?? "Please review the highlighted fields." };
}
