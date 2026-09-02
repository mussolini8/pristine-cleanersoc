const { createClient } = require("@supabase/supabase-js");
require("@next/env").loadEnvConfig(process.cwd());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: "carlos@pristinecleanersoc.com",
    password: "123456"
  });
  if (authErr) {
    console.error("Auth error:", authErr.message);
    return;
  }
  console.log("Logged in as Carlos:", auth.user?.id);

  const { data: staff, error: staffErr } = await supabase
    .from("staff_members")
    .select("*")
    .order("name");

  if (staffErr) {
    console.error("Staff query error:", staffErr.message);
    return;
  }
  console.log("Staff members count:", staff ? staff.length : 0);
  (staff || []).forEach((s, idx) => {
    console.log(`${idx+1}. ${s.name} | Phone: ${s.phone || "No phone"} | Role: ${s.role} | Scope: ${s.team_scope} | Rate: $${s.hourly_rate} | Status: ${s.status}`);
  });
}

check();
