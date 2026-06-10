import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function main() {
  console.log("Fetching operation task templates...");
  const { data: templates, error: err } = await supabase
    .from("operation_task_templates")
    .select("*");
  if (err) console.error("Error templates:", err);
  else {
    console.log(`Found ${templates.length} templates.`);
    templates.forEach(t => {
      console.log(`Template: ID: ${t.id}, Title: "${t.title}", DayOfWeek: "${t.day_of_week}", Recurrence: "${t.recurrence}", WeekOfMonth: "${t.week_of_month}", Active: ${t.active}`);
    });
  }
}

main().catch(console.error);
