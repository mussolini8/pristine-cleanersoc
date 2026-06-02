import type {
  CommercialHoursStatus,
  CommercialScheduleFrequency,
  PaymentMode,
  PaymentStatus,
  StaffPipelineStatus,
  StaffTeamScope,
  TaskPriority,
  WorkLogStatus,
} from "@/lib/operations/constants";
import type { ResidentialAssignee, ResidentialFrequency, TaskReminderFrequency } from "@/lib/residential-operations";

export type {
  CommercialHoursStatus,
  CommercialScheduleFrequency,
  PaymentMode,
  StaffPipelineStatus,
  StaffTeamScope,
  WorkLogStatus,
} from "@/lib/operations/constants";

export type SimpleOperationsView = "dashboard" | "tasks" | "residential" | "staff" | "reports" | "settings";
export type TaskTab = "pending" | "completed" | "overdue" | "all";
export type TaskViewMode = "month" | "day" | "list";
export type ReportKind = "tasks" | "hours" | "weekly_payments";
export type PaymentKindFilter = "all" | "residential" | "mixed";
export type MessageTone = "success" | "error" | "info";
export type PaymentModalMode = "residential" | "juan" | "commercial_hours" | "commercial_schedule";
export type CommercialSourceFilter = "all" | "manual" | "scheduled";
export type CommercialVerifiedFilter = "all" | "verified" | "needs_review";
export type WeeklyPaymentStatus = PaymentStatus;

export type EnvStatus = {
  appBaseUrl: boolean;
  gmailUser: boolean;
  gmailPassword: boolean;
  ownerEmail: boolean;
  operationsManagerEmail: boolean;
};

export type OperationTaskRow = {
  id: string;
  user_id?: string | null;
  title: string;
  description: string | null;
  priority: string | null;
  status: string | null;
  category: string | null;
  due_date: string | null;
  assignee: string | null;
  reminder?: boolean | null;
  recurrence?: string | null;
  custom_interval_days?: number | null;
  assigned_by?: string | null;
  panel?: string | null;
  business_unit?: string | null;
  completion_notes?: string | null;
  completed_at?: string | null;
  created_by?: string | null;
  completed_by?: string | null;
  deleted_at?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ActivityRow = {
  id: string;
  task_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

export type ResidentialAccountRow = {
  id: string;
  user_id?: string | null;
  account_name: string;
  scheduled_hours: number | string | null;
  frequency: ResidentialFrequency | string | null;
  frequency_detail: string | null;
  day_of_week: string | null;
  city?: string | null;
  custom_city?: string | null;
  assigned_team_id: string | null;
  assigned_team_name: string | null;
  active: boolean | null;
  notes: string | null;
  deleted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ResidentialWorkLogRow = {
  id: string;
  user_id?: string | null;
  account_id: string | null;
  account_name: string;
  team_id: string | null;
  team_name: string;
  work_date: string;
  hours_worked: number | string | null;
  notes: string | null;
  status: WorkLogStatus | string | null;
  deleted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ResidentialWeeklyPaymentRow = {
  id: string;
  user_id?: string | null;
  team_id: string | null;
  team_name: string;
  week_start: string;
  week_end: string;
  total_hours: number | string | null;
  hourly_rate: number | string | null;
  total_payment: number | string | null;
  status: WeeklyPaymentStatus | string | null;
  paid_at: string | null;
  notes: string | null;
  deleted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ResidentialWeeklyPaymentLineRow = {
  id: string;
  user_id?: string | null;
  cleaner_id: string | null;
  cleaner_name: string;
  work_date: string;
  city: string | null;
  custom_city?: string | null;
  payment_amount: number | string | null;
  residential_amount: number | string | null;
  commercial_amount: number | string | null;
  payment_type: "residential" | "commercial" | "mixed" | string | null;
  payment_mode?: PaymentMode | string | null;
  week_start: string;
  week_end: string;
  status: WeeklyPaymentStatus | string | null;
  paid_at?: string | null;
  notes: string | null;
  deleted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CommercialAccountRow = {
  id: string;
  user_id?: string | null;
  name: string;
  city: string | null;
  cleaner_name: string | null;
  hours: number | string | null;
  frequency: string | null;
  contract_start?: string | null;
  contract_end?: string | null;
  cleaner_pay_type?: string | null;
  cleaner_hourly_rate?: number | string | null;
  cleaner_flat_rate?: number | string | null;
  revenue?: number | string | null;
  cost?: number | string | null;
};

export type CommercialScheduleRuleRow = {
  id: string;
  user_id?: string | null;
  commercial_account_id: string | null;
  day_of_week: number | null;
  paid_hours: number | string | null;
  assigned_cleaner_name: string | null;
  active: boolean | null;
  effective_start_date: string | null;
  effective_end_date: string | null;
  notes?: string | null;
  frequency_type?: string | null;
  frequency_interval?: number | null;
  anchor_date?: string | null;
  scheduled_hours?: number | string | null;
  effective_from?: string | null;
  effective_until?: string | null;
};

export type CommercialHoursEntryRow = {
  id: string;
  user_id?: string | null;
  account_id: string | null;
  account_name: string;
  team_id: string | null;
  team_name: string | null;
  work_date: string;
  scheduled_day: string | null;
  scheduled_hours: number | string | null;
  completed_hours: number | string | null;
  verified_hours: number | string | null;
  status: CommercialHoursStatus | string | null;
  verified: boolean | null;
  paid_at?: string | null;
  notes: string | null;
  manual_entry?: boolean | null;
  deleted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type StaffMemberRow = {
  id: string;
  user_id?: string | null;
  name: string;
  email: string | null;
  role: string | null;
  display_role?: string | null;
  team_scope?: string | null;
  status: string | null;
  hourly_rate?: number | string | null;
  payment_mode?: PaymentMode | string | null;
  commercial_payroll_eligible?: boolean | null;
  active?: boolean | null;
  deleted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type TaskDraft = {
  id?: string;
  title: string;
  description: string;
  assignee: ResidentialAssignee;
  dueDate: string;
  frequency: TaskReminderFrequency;
  customIntervalDays: string;
  priority: TaskPriority;
  notifyAssignee: boolean;
  notifyOwnerOnCompletion: boolean;
};

export type AccountDraft = {
  id?: string;
  accountName: string;
  scheduledHours: string;
  frequency: ResidentialFrequency;
  frequencyDetail: string;
  dayOfWeek: string;
  city: string;
  customCity: string;
  assignedTeamId: string;
  assignedTeamName: string;
  active: boolean;
  notes: string;
};

export type WorkLogDraft = {
  accountId: string;
  teamId: string;
  workDate: string;
  hoursWorked: string;
  notes: string;
  status: WorkLogStatus;
};

export type StaffDraft = {
  id?: string;
  name: string;
  email: string;
  role: string;
  teamScope: StaffTeamScope;
  status: StaffPipelineStatus;
  hourlyRate: string;
  paymentMode: PaymentMode;
  active: boolean;
};

export type PaymentRowDraft = {
  id?: string;
  cleanerId: string;
  cleanerName: string;
  workDate: string;
  city: string;
  customCity: string;
  paymentAmount: string;
  residentialAmount: string;
  commercialAmount: string;
  notes: string;
  status: WeeklyPaymentStatus;
};

export type CommercialHoursDraft = {
  id?: string;
  accountId: string;
  teamId: string;
  teamName: string;
  workDate: string;
  hours: string;
  status: CommercialHoursStatus;
  verified: boolean;
  notes: string;
  manualEntry: boolean;
};

export type CommercialScheduleDraft = {
  accountId: string;
  assignedTeamId: string;
  assignedTeamName: string;
  frequency: CommercialScheduleFrequency;
  selectedDays: string[];
  dayHours: Record<string, string>;
  effectiveFrom: string;
  effectiveUntil: string;
  active: boolean;
  notes: string;
};
