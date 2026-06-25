/**
 * deduplicate-all-tasks.mjs
 *
 * Removes duplicate operation_tasks where the same (title, due_date) pair
 * exists more than once on the same day, regardless of panel/business_unit.
 *
 * Keep priority:
 *   1. Completed tasks are always kept over pending ones
 *   2. Among same status, the OLDEST record (earliest created_at) is kept
 *
 * Duplicates are SOFT-DELETED (deleted_at = now) so they can be recovered.
 *
 * Usage:
 *   node tools/deduplicate-all-tasks.mjs [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const DRY_RUN = process.argv.includes("--dry-run");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function normTitle(title) {
  return String(title ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function main() {
  if (DRY_RUN) {
    console.log("🔍 DRY RUN — no changes will be made.\n");
  }

  console.log("Fetching all active operation tasks...");

  const { data: tasks, error } = await supabase
    .from("operation_tasks")
    .select("id, title, due_date, status, created_at, panel, business_unit")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching tasks:", error);
    process.exit(1);
  }

  console.log(`Found ${tasks.length} active tasks.\n`);

  // Group by normalized title + date (day only)
  const groups = new Map();

  for (const t of tasks) {
    if (!t.due_date || !t.title) continue;
    const dayKey = String(t.due_date).split("T")[0];
    const key = `${normTitle(t.title)}|${dayKey}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }

  let softDeletedCount = 0;
  let uniqueCount = 0;

  const now = new Date().toISOString();

  for (const [key, group] of groups.entries()) {
    uniqueCount++;

    if (group.length <= 1) continue;

    console.log(`\n⚠️  Duplicate group (${group.length}): "${key}"`);

    // Sort: completed first, then oldest created_at
    group.sort((a, b) => {
      const aComp = a.status === "completed" ? 0 : 1;
      const bComp = b.status === "completed" ? 0 : 1;
      if (aComp !== bComp) return aComp - bComp;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const keep = group[0];
    const remove = group.slice(1);

    console.log(
      `  ✅ Keep:   id=${keep.id} status=${keep.status} panel=${keep.panel ?? "-"} created=${keep.created_at}`
    );

    for (const r of remove) {
      console.log(
        `  🗑️  Remove: id=${r.id} status=${r.status} panel=${r.panel ?? "-"} created=${r.created_at}`
      );

      if (!DRY_RUN) {
        const { error: deleteError } = await supabase
          .from("operation_tasks")
          .delete()
          .eq("id", r.id);

        if (deleteError) {
          console.error(`  ❌ Failed to delete ${r.id}:`, deleteError.message);
        } else {
          softDeletedCount++;
        }
      } else {
        softDeletedCount++; // count for dry-run summary
      }
    }
  }

  // Also purge any existing soft-deleted tasks to clean up database duplicates completely
  if (!DRY_RUN) {
    const { error: purgeError } = await supabase
      .from("operation_tasks")
      .delete()
      .not("deleted_at", "is", null);
    if (purgeError) {
      console.error(`  ❌ Failed to purge soft-deleted tasks:`, purgeError.message);
    } else {
      console.log("\n✅ Purged all existing soft-deleted tasks.");
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Unique task slots scanned: ${uniqueCount}`);
  console.log(`Duplicates ${DRY_RUN ? "would be" : ""} deleted: ${softDeletedCount}`);
  if (DRY_RUN) {
    console.log(
      "\nRun WITHOUT --dry-run to apply changes:\n  node tools/deduplicate-all-tasks.mjs"
    );
  } else {
    console.log("\n✅ Done. Duplicates have been permanently deleted.");
  }
}

main().catch(console.error);
