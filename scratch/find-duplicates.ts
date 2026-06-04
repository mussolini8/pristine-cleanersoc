import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function main() {
  const { data: tasks, error } = await supabase
    .from("operation_tasks")
    .select("id, title, due_date, assignee, status, deleted_at, metadata")
    .eq("due_date", "2026-06-02")
    .is("deleted_at", null);

  if (error) {
    console.error("Error querying tasks:", error);
    return;
  }

  console.log(`Found ${tasks?.length} active tasks for 2026-06-02:`);
  for (const t of tasks ?? []) {
    console.log(`- ID: ${t.id}
    Title: "${t.title}"
    Status: "${t.status}"
    Metadata: ${JSON.stringify(t.metadata)}`);
  }
}

main().catch(console.error);
