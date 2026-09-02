const fs = require("fs");
const path = require("path");

// Update commercial-accounts-data.ts
let content = fs.readFileSync("./src/lib/commercial-accounts-data.ts", "utf8");

// 1. Kush Fine Art cleaner -> Ana Morales
content = content.replace(
  /id:\s*"import-kush-fine-art-laguna-beach-14"[\s\S]*?cleaner_name:\s*"[^"]*"/,
  (match) => match.replace(/cleaner_name:\s*"[^"]*"/, 'cleaner_name: "Ana Morales"')
);
content = content.replace(
  /assigned_cleaner_name:\s*"Sandra Hernandez",\s*notes:\s*"Every 3 weeks"/,
  'assigned_cleaner_name: "Ana Morales", notes: "Every 3 weeks (Ana Morales)"'
);

// 2. LSG Sky Chefs cleaner -> Luz and Vanessa
content = content.replace(
  /id:\s*"import-lsg-sky-chefs-costa-mesa"[\s\S]*?cleaner_name:\s*"[^"]*"/,
  (match) => match.replace(/cleaner_name:\s*"[^"]*"/, 'cleaner_name: "Luz and Vanessa"')
);

// 3. Miracle Minds -> Miracle Minds (Miraculous Milestones)
content = content.replace(
  /name:\s*"Miracle Minds"/g,
  'name: "Miracle Minds (Miraculous Milestones)"'
);

// 4. Cornerstone Southern California -> Cornerstone Rehab (7h, $161/service)
content = content.replace(
  /name:\s*"Cornerstone Southern California"/g,
  'name: "Cornerstone Rehab"'
);
content = content.replace(
  /hours:\s*6\.5/g,
  'hours: 7'
);

// 5. Swing Easy Golf Club Yorba Linda cleaner -> Unassigned
content = content.replace(
  /id:\s*"import-swing-easy-golf-club-yorba-linda-6"[\s\S]*?cleaner_name:\s*"[^"]*"/,
  (match) => match.replace(/cleaner_name:\s*"[^"]*"/, 'cleaner_name: "Unassigned"')
);

// 6. Ensure Lifted Dentistry is present
if (!content.includes("Lifted Dentistry")) {
  const liftedAcc = `  {
    id: "import-lifted-dentistry-irvine",
    name: "Lifted Dentistry",
    city: "Irvine",
    pricing_model: "per service",
    cleaner_name: "Unassigned",
    hours: 3,
    frequency: "Every 14 days",
    revenue: 335,
    cost: 149,
    payment_method: "Zelle",
    contract_start: "2026-08-01",
    contract_end: null,
    last_contact_date: null,
    last_qcc_date: null,
    has_supplies: false,
    has_keys: false,
    supply_delivery_date: null,
    estimated_fill_date: null,
    supplies_notes: "Every other week cleaning ($69.00 per service).",
    source_sheet: "Accounts",
    schedule_rules: [
      { day_of_week: 4, paid_hours: 3, assigned_cleaner_name: "Unassigned", frequency_type: "biweekly", frequency_interval: 2, anchor_date: "2026-08-06", notes: "Every 14 days (Thursday)" }
    ]
  },
];`;
  content = content.replace(/\n\];\s*\n\s*export type ImportedCommercialEventEntry/, `,\n${liftedAcc}\n\nexport type ImportedCommercialEventEntry`);
}

fs.writeFileSync("./src/lib/commercial-accounts-data.ts", content, "utf8");
console.log("Updated commercial-accounts-data.ts successfully!");
