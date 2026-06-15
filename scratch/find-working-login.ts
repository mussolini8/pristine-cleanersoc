import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

const candidates = [
  { email: "pristinejanitorial@pristine.local", password: "123456" },
  { email: "pristinecleaners@pristine.local", password: "123456" },
  { email: "pristineseo@pristine.local", password: "123456" },
  { email: "carlos@pristinecleanersoc.com", password: "123456" },
  { email: "info@pristinecleanersoc.com", password: "123456" },
];

async function main() {
  for (const c of candidates) {
    console.log(`Trying ${c.email} / ${c.password}...`);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: c.email,
      password: c.password
    });
    if (!error && data.user) {
      console.log(`=> SUCCESS! User ID: ${data.user.id}`);
      
      // Try inserting the rule for OCSS Office
      const ocssAccountId = '93aa4335-911d-4a3b-9f6d-b759cff2ff07';
      const payload = {
        user_id: data.user.id,
        commercial_account_id: ocssAccountId,
        day_of_week: 6, // Saturday
        paid_hours: 2.5,
        scheduled_hours: 2.5,
        assigned_cleaner_name: 'Mirna Contreras',
        active: true,
        effective_start_date: '2026-06-06',
        effective_end_date: null,
        effective_from: '2026-06-06',
        effective_until: null,
        frequency_type: 'biweekly',
        frequency_interval: 2,
        anchor_date: '2026-06-06',
        notes: 'Every 2 weeks on Saturday starting June 6th',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: inserted, error: insertError } = await supabase
        .from("commercial_account_schedule_rules")
        .insert([payload])
        .select();

      if (insertError) {
        console.error("Insert failed with this user:", insertError);
      } else {
        console.log("INSERT SUCCEEDED! Inserted rule:", inserted);
        return;
      }
    } else {
      console.log(`=> Failed: ${error?.message}`);
    }
  }
}

main().catch(console.error);
