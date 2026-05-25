import type { SupabaseClient } from "@supabase/supabase-js";

export const OPERATION_TASK_COLUMNS = [
  "id",
  "user_id",
  "title",
  "description",
  "priority",
  "status",
  "category",
  "due_date",
  "assignee",
  "reminder",
  "recurrence",
  "custom_interval_days",
  "assigned_by",
  "panel",
  "business_unit",
  "completion_notes",
  "completed_at",
  "created_by",
  "completed_by",
  "deleted_at",
  "metadata",
  "created_at",
  "updated_at",
].join(",");

const ACTIVITY_COLUMNS = "id,task_id,action,details,created_at";
const RESIDENTIAL_ACCOUNT_COLUMNS = "id,user_id,account_name,scheduled_hours,frequency,frequency_detail,day_of_week,city,custom_city,assigned_team_id,assigned_team_name,active,notes,deleted_at,created_at,updated_at";
const RESIDENTIAL_WORK_LOG_COLUMNS = "id,user_id,account_id,account_name,team_id,team_name,work_date,hours_worked,notes,status,deleted_at,created_at,updated_at";
const RESIDENTIAL_WEEKLY_PAYMENT_COLUMNS = "id,user_id,team_id,team_name,week_start,week_end,total_hours,hourly_rate,total_payment,status,paid_at,notes,deleted_at,created_at,updated_at";
const RESIDENTIAL_WEEKLY_PAYMENT_ROW_COLUMNS = "id,user_id,cleaner_id,cleaner_name,work_date,city,custom_city,payment_amount,residential_amount,commercial_amount,payment_type,payment_mode,week_start,week_end,status,paid_at,notes,deleted_at,created_at,updated_at";
const STAFF_COLUMNS = "id,user_id,name,email,role,display_role,team_scope,status,hourly_rate,payment_mode,commercial_payroll_eligible,active,deleted_at,created_at,updated_at";
const COMMERCIAL_ACCOUNT_COLUMNS = "id,user_id,name,city,cleaner_name,hours,frequency,contract_start,contract_end";
const COMMERCIAL_SCHEDULE_COLUMNS = "id,user_id,commercial_account_id,day_of_week,paid_hours,assigned_cleaner_name,active,effective_start_date,effective_end_date,notes,frequency_type,frequency_interval,anchor_date,scheduled_hours,effective_from,effective_until";
const COMMERCIAL_HOURS_COLUMNS = "id,user_id,account_id,account_name,team_id,team_name,work_date,scheduled_day,scheduled_hours,completed_hours,verified_hours,status,verified,paid_at,notes,manual_entry,deleted_at,created_at,updated_at";

export async function loadOperationsData(supabase: SupabaseClient) {
  const [
    taskResult,
    activityResult,
    accountResult,
    workLogResult,
    weeklyPaymentResult,
    weeklyPaymentRowResult,
    staffResult,
    commercialAccountResult,
    commercialScheduleResult,
    commercialHoursResult,
  ] = await Promise.all([
    supabase.from("operation_tasks").select(OPERATION_TASK_COLUMNS).order("due_date", { ascending: true, nullsFirst: false }).limit(1000),
    supabase.from("operation_task_audit_log").select(ACTIVITY_COLUMNS).order("created_at", { ascending: false }).limit(800),
    supabase.from("residential_recurring_cleaning_accounts").select(RESIDENTIAL_ACCOUNT_COLUMNS).is("deleted_at", null).order("account_name").limit(1000),
    supabase.from("residential_work_logs").select(RESIDENTIAL_WORK_LOG_COLUMNS).is("deleted_at", null).order("work_date", { ascending: false }).limit(1500),
    supabase.from("residential_weekly_payments").select(RESIDENTIAL_WEEKLY_PAYMENT_COLUMNS).is("deleted_at", null).order("week_start", { ascending: false }).limit(800),
    supabase.from("residential_weekly_payment_rows").select(RESIDENTIAL_WEEKLY_PAYMENT_ROW_COLUMNS).is("deleted_at", null).order("work_date", { ascending: true }).order("created_at", { ascending: true }).limit(2000),
    supabase.from("staff_members").select(STAFF_COLUMNS).is("deleted_at", null).order("name").limit(700),
    supabase.from("commercial_accounts").select(COMMERCIAL_ACCOUNT_COLUMNS).order("name").limit(1000),
    supabase.from("commercial_account_schedule_rules").select(COMMERCIAL_SCHEDULE_COLUMNS).eq("active", true).order("day_of_week").limit(2000),
    supabase.from("commercial_hours_entries").select(COMMERCIAL_HOURS_COLUMNS).is("deleted_at", null).order("work_date", { ascending: true }).limit(2000),
  ]);

  return {
    taskResult,
    activityResult,
    accountResult,
    workLogResult,
    weeklyPaymentResult,
    weeklyPaymentRowResult,
    staffResult,
    commercialAccountResult,
    commercialScheduleResult,
    commercialHoursResult,
  };
}
