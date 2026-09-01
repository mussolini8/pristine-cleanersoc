import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function normTitle(title) {
  return String(title || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function main() {
  console.log("Fetching all operation tasks...");
  
  const { data: tasks, error } = await supabase
    .from("operation_tasks")
    .select("id, title, category, due_date, status, created_at, metadata")
    .in("panel", ["Residential", "Operations"])
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching tasks:", error);
    process.exit(1);
  }

  console.log(`Found ${tasks.length} total residential/operations tasks.`);

  // Group by normalized title and due_date day
  const groups = new Map();

  for (const t of tasks) {
    if (!t.due_date || !t.title) continue;
    
    // Create a deterministic key for what should be a unique SOP task
    const key = `${normTitle(t.title)}|${t.due_date.split("T")[0]}`;
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(t);
  }

  let deletedCount = 0;
  let preservedCount = 0;

  for (const [key, groupTasks] of groups.entries()) {
    if (groupTasks.length > 1) {
      console.log(`\nFound duplicate group: ${key} (${groupTasks.length} items)`);
      
      // Sort so completed are kept first, then oldest
      groupTasks.sort((a, b) => {
        if (a.status === "completed" && b.status !== "completed") return -1;
        if (b.status === "completed" && a.status !== "completed") return 1;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      const keep = groupTasks[0];
      const remove = groupTasks.slice(1);

      console.log(`  Keeping: ${keep.id} [${keep.status}]`);
      
      for (const r of remove) {
        console.log(`  Deleting duplicate: ${r.id} [${r.status}]`);
        const { error: deleteError } = await supabase.from("operation_tasks").delete().eq("id", r.id);
        if (deleteError) {
          console.error(`  Failed to delete ${r.id}:`, deleteError);
        } else {
          deletedCount++;
        }
      }
      preservedCount++;
    } else {
      preservedCount++;
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Total groups (unique tasks): ${preservedCount}`);
  console.log(`Duplicates deleted: ${deletedCount}`);
  console.log(`\nIMPORTANT: Make sure you have run the schema migration to add 'sop_source_key' to prevent future duplicates!`);
}

main().catch(console.error);
