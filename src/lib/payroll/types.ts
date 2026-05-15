export type PayrollPeriodStatus = "draft" | "in_review" | "partially_approved" | "approved" | "paid" | "locked";

export type PayrollEntryStatus = "draft" | "needs_review" | "reviewed" | "approved" | "paid";

export type AdjustmentType =
  | "add_hours"
  | "remove_hours"
  | "add_bonus"
  | "deduction"
  | "skipped_visit"
  | "rescheduled_visit"
  | "one_time_job"
  | "holiday_adjustment"
  | "correction"
  | "manual_override";

export type CommercialAccount = {
  id: string;
  name: string;
  city?: string | null;
  hours?: number | string | null;
  frequency?: string | null;
  cleaner_name?: string | null;
  cleaner_pay_type?: string | null;
  cleaner_hourly_rate?: number | null;
  cleaner_flat_rate?: number | null;
  contract_start?: string | null;
  contract_end?: string | null;
  payment_method?: string | null;
  revenue?: number | null;
  cost?: number | null;
  source_sheet?: string | null;
  schedule_rules?: CommercialScheduleRule[];
};

export type CommercialScheduleRule = {
  id?: string;
  commercial_account_id?: string | null;
  day_of_week: number;
  start_time?: string | null;
  end_time?: string | null;
  paid_hours: number;
  assigned_cleaner_name?: string | null;
  frequency_type?: "weekly" | "biweekly" | "monthly" | "custom" | null;
  frequency_interval?: number | null;
  anchor_date?: string | null;
  active?: boolean | null;
  effective_start_date?: string | null;
  effective_end_date?: string | null;
};

export type CleanerPaymentSetting = {
  id?: string;
  cleaner_id?: string | null;
  cleaner_name: string | null;
  default_pay_type?: string | null;
  default_pay_rate?: number | null;
  payment_method?: string | null;
  requires_manual_review?: boolean | null;
  manual_review_reason?: string | null;
  review_notes?: string | null;
  active?: boolean | null;
};

export type PayrollPeriod = {
  id?: string;
  startDate: string;
  endDate: string;
  label: string;
};

export type PayrollExceptionCode =
  | "missing_cleaner"
  | "missing_pay_rate"
  | "inactive_cleaner"
  | "zero_hours"
  | "missing_schedule"
  | "missing_anchor_date"
  | "missing_account_pay_settings"
  | "manual_review"
  | "contract_boundary";

export type PayrollGeneratedEntry = {
  cleaner_name: string | null;
  account_id: string | null;
  account_name: string;
  city: string | null;
  service_date: string | null;
  scheduled_day: string | null;
  base_hours: number;
  adjusted_hours: number;
  pay_rate: number;
  estimated_amount: number;
  adjustment_amount: number;
  final_amount: number;
  status: PayrollEntryStatus;
  requires_manual_review: boolean;
  review_status: string;
  review_notes: string | null;
  payment_method: string | null;
  source: "schedule_rule" | "account_fallback";
  exceptions: PayrollExceptionCode[];
};

export type PayrollPeriodRow = {
  id: string;
  start_date: string;
  end_date: string;
  label: string | null;
  status: PayrollPeriodStatus;
  total_estimated_hours: number | null;
  total_adjusted_hours: number | null;
  total_estimated_amount: number | null;
  total_final_amount: number | null;
  generated_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
  locked_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PayrollEntryRow = PayrollGeneratedEntry & {
  id: string;
  pay_period_id: string;
  cleaner_id?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  paid_at?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type PayrollAdjustmentRow = {
  id: string;
  pay_period_id: string;
  payroll_entry_id: string | null;
  cleaner_name: string | null;
  account_id: string | null;
  adjustment_type: AdjustmentType | string | null;
  hours_delta: number | null;
  amount_delta: number | null;
  reason: string | null;
  internal_note: string | null;
  created_by: string | null;
  created_at: string;
};
