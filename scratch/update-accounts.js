const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/lib/commercial-accounts-data.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update MacArthur Dental Arts
content = content.replace(
  /\{ id: "import-macarthur-dental-arts-irvine-37"[\s\S]*?source_sheet: "Accounts" \},/g,
  `{ id: "import-macarthur-dental-arts-irvine-37", name: "MacArthur Dental Arts", city: "Irvine", pricing_model: "Flat Rate", cleaner_name: "Kassandra Valentin", hours: 1.5, frequency: "4x per week", revenue: 1060, cost: 746.92, payment_method: "Credit card", contract_start: "2026-04-12", contract_end: null, last_contact_date: null, last_qcc_date: "2026-04-14", has_supplies: true, has_keys: true, supply_delivery_date: "2025-04-12", estimated_fill_date: null, supplies_notes: "Alarm code: TO ARM: 7897 ARM TO DISARM: 7897 DISARM. Lockbox code: 8544. The dumpster is on the right side of the parking lot. Internal: Monday to Wednesday, light cleaning and trash removal. We give the keys to the operating services team once a week. Floor mopping is once a week, on Thursdays.", source_sheet: "Accounts" },`
);

// 2. Update Mama's Los Alamitos
content = content.replace(
  /\{ id: "import-mama-s-restaurant-los-alamitos-4"[\s\S]*?source_sheet: "Accounts" \},/g,
  `{ id: "import-mama-s-restaurant-los-alamitos-4", name: "Mama's Restaurant", city: "Los Alamitos", pricing_model: "Per Service", cleaner_name: "Juan Romero", hours: 4, frequency: "1x per week (Fri)", revenue: 2028, cost: 858, payment_method: "Check", contract_start: "2026-04-09", contract_end: "2025-12-01", last_contact_date: "2026-02-18", last_qcc_date: "2026-04-16", has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "Account sheet flag: Y", source_sheet: "Accounts" },`
);

// 3. Update Mama's Huntington Beach
content = content.replace(
  /\{ id: "import-mama-s-restaurant-huntington-beach-3"[\s\S]*?source_sheet: "Accounts" \},/g,
  `{ id: "import-mama-s-restaurant-huntington-beach-3", name: "Mama's Restaurant", city: "Huntington Beach", pricing_model: "Per Service", cleaner_name: "Juan Romero", hours: 4, frequency: "1x per week (Fri)", revenue: 1898, cost: 996, payment_method: "Check", contract_start: "2026-04-08", contract_end: "2026-04-01", last_contact_date: "2026-02-18", last_qcc_date: "2026-04-10", has_supplies: false, has_keys: true, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "Internal: No alarm, the team has keys. Enfesis bathrooms, kitchen floor, the manager's contact information is important. (we provide him with an additional mop bucket.; Account sheet flag: Y)", source_sheet: "Accounts" },`
);

// 4. Update MOXI3 Costa Mesa. Wait, MOXI3 Costa Mesa has `schedule_rules` in the original array.
// I'll replace its top-level properties and keep schedule rules if they exist.
// Let's just do a targeted replace for frequency, hours and supplies_notes.
content = content.replace(
  /(id: "import-moxi3-costa-mesa"[\s\S]*?hours: )[\d.]+(, frequency: ")"([^"]+)("[\s\S]*?supplies_notes: ")([^"]+)(")/g,
  (match, p1, p2, oldFreq, p4, oldNotes, p6) => {
      return p1 + "3.5" + p2 + "3x per week" + p4 + "Lockbox code 3400. ALARM CODE: 1480. Internal: Dumpster around the back of the building. Ensuring lock is completely lock in front and back door. Making sure we dont unplug the sound system or any cables in the gym. Saturday cleanings are only for the training room, flooring and mirrors in the training room. We steam clean the pilates mats 2x per month on the first and 3rd Saturday. | " + oldNotes + p6;
  }
);

fs.writeFileSync(filePath, content);
console.log("Updated accounts successfully!");
