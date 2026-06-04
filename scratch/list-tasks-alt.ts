import { createClient } from "@supabase/supabase-js";

const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmZ2p5cnl0bGF2b2VxdWx0ZWZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNjc3NjQsImV4cCI6MjA5Mzc0Mzc2NH0.eLFze09BFvVI4wEUL0zTg_QL7vO6I5YNCYY-5iohG7I";
// Let's replace the ref in the key if it matches the other DB
const keyAlt = key.replace("lfgjyrytlavoequltefm", "lfgjyrtlavoqutlefm");

const supabase = createClient("https://lfgjyrtlavoqutlefm.supabase.co", keyAlt);

async function main() {
  const { data: tasks, error } = await supabase
    .from("operation_tasks")
    .select("id, title, due_date, assignee, status, deleted_at, metadata")
    .limit(50);

  if (error) {
    console.error("Error querying tasks:", error);
    return;
  }

  console.log(`Found ${tasks?.length} tasks in alternate DB:`);
  for (const t of tasks ?? []) {
    console.log(`- ID: ${t.id}
    Title: "${t.title}"
    Due Date: "${t.due_date}"
    Deleted At: "${t.deleted_at}"
    Metadata: ${JSON.stringify(t.metadata)}`);
  }
}

main().catch(console.error);
