const { createClient } = require("@supabase/supabase-js");
require("@next/env").loadEnvConfig(process.cwd());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const phoneUpdates = [
  { name: "Emmi Guerra", phone: "7472188351" },
  { name: "john ivanpal", phone: "2039091380" },
  { name: "Kassandra Valentin", phone: "7147159147" },
  { name: "Lesbia Vasquez", phone: "7143129183" },
  { name: "Lucia Portillo", phone: "7146608440" },
  { name: "Luz Uribe", phone: "9516224922" },
  { name: "Maria Lopez", phone: "7144990339" },
  { name: "Maria Mejia", phone: "9514072157" },
  { name: "Mirna Contreras", phone: "6573973158" },
  { name: "Rossy Legorreta", phone: "7147575641" },
  { name: "Sandra Hernandez", phone: "7144835971" },
];

async function updatePhones() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: "pristineseo@pristine.local",
    password: "123456",
  });
  if (authErr) {
    console.error("Auth error:", authErr.message);
    return;
  }
  console.log("Logged in:", auth.user?.id);

  for (const item of phoneUpdates) {
    const formatted = item.phone.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
    console.log(`Updating ${item.name} with phone ${formatted}...`);
    const { data, error } = await supabase
      .from("staff_members")
      .update({ phone: formatted })
      .ilike("name", `%${item.name}%`)
      .select();
    if (error) console.error(`Error updating ${item.name}:`, error.message);
    else console.log(`Updated ${item.name}: ${data?.length || 0} row(s)`);
  }

  // Also check all staff in DB
  const { data: allStaff } = await supabase.from("staff_members").select("name, phone, role").order("name");
  console.log("\n--- Updated Staff in DB ---");
  allStaff?.forEach(s => {
    if (s.phone) console.log(`✓ ${s.name}: ${s.phone} (${s.role})`);
  });
}

updatePhones();
