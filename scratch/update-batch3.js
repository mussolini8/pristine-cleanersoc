const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/lib/commercial-accounts-data.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Orange County Spine and Sports Physicians if not present
if (!content.includes("import-oc-spine-sports-physicians")) {
  const newAccount = `
  { 
    id: "import-oc-spine-sports-physicians", 
    name: "Orange County Spine and Sports Physicians", 
    city: "Huntington Beach", 
    pricing_model: "flat rate", 
    cleaner_name: "Mirna Contreras", 
    hours: 2.5, 
    frequency: "2nd & 4th Sat of Month", 
    revenue: null, cost: null, payment_method: null, 
    contract_start: "2026-01-31", 
    contract_end: null, last_contact_date: null, last_qcc_date: null, 
    has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, 
    supplies_notes: "Address: 18800 Delaware Street, Huntington Beach, CA 92648. Time: 9:00 AM - 11:20 AM. Internal: Building is at the top of a business center. Dumpsters are in the parking lot below. Street parking is necessary because parking lot adjacent to building is paid. Suite 1000 is on the 10th floor entered by elevator. Door for suite 1000 is to the left from elevator.", 
    source_sheet: "Manual Upload" 
  },
`;
  const lastIndex = content.lastIndexOf('];');
  if (lastIndex !== -1) {
    content = content.substring(0, lastIndex) + newAccount + '];\n';
  }
}

// 2. Update Posh Pooch
content = content.replace(
  /\{ id: "import-posh-pooch-seal-beach-15"[\s\S]*?source_sheet: "Accounts" \},/g,
  `{ id: "import-posh-pooch-seal-beach-15", name: "Posh Pooch", city: "Seal Beach", pricing_model: "per Service", cleaner_name: "Luz Uribe", hours: 4, frequency: "Every month on 2nd Mon", revenue: 338, cost: 92, payment_method: "Credit Card", contract_start: "2026-08-12", contract_end: "2026-08-25", last_contact_date: "2026-02-18", last_qcc_date: null, has_supplies: true, has_keys: true, supply_delivery_date: "2025-08-26", estimated_fill_date: null, supplies_notes: "Address: 350 Main Street, Seal Beach, CA 90740. Time: 3:00 PM - 8:15 PM. Internal: Only cleaning the Posh Pooch suite. Key is given and separate vacuum is left at the job. We dont clean the cages, everything else is done in detail, especially pet wash area for dog hair. We go when closed on Sunday or Monday.", source_sheet: "Accounts" },`
);

// 3. Update Sierra Analytical
content = content.replace(
  /\{ id: "import-sierra-analytical-aliso-viejo-9"[\s\S]*?source_sheet: "Accounts" \},/g,
  `{ id: "import-sierra-analytical-aliso-viejo-9", name: "Sierra Analytical Lab", city: "Laguna Hills", pricing_model: "per Service", cleaner_name: "Luz Uribe", hours: 6, frequency: "Every 14 days", revenue: 533, cost: 292.5, payment_method: "Check", contract_start: "2026-07-09", contract_end: "2026-04-29", last_contact_date: "2026-02-18", last_qcc_date: null, has_supplies: true, has_keys: false, supply_delivery_date: "2025-07-07", estimated_fill_date: null, supplies_notes: "Address: 26052 Merit Circle, Laguna Hills, CA 92653. Internal: Cleaning around glass vials on countertops, detailed cleaning in front lobby area, desks, and all surfaces in offices. Bathroom details important & front lobby dusting. Dumpster through back door (prop open so it doesn't lock). Trash bags under sink in kitchen.", source_sheet: "Accounts" },`
);

// 4. Update Swing Easy Costa Mesa
content = content.replace(
  /\{ id: "import-swing-easy-golf-club-costa-mesa-5"[\s\S]*?source_sheet: "Accounts" \},/g,
  `{ id: "import-swing-easy-golf-club-costa-mesa-5", name: "Swing Easy Golf Club Costa Mesa", city: "Costa Mesa", pricing_model: "Flat rate", cleaner_name: "Sandra Hernandez", hours: 3, frequency: "Every week on Wed", revenue: 520, cost: 299, payment_method: "Credit Card", contract_start: "2025-12-03", contract_end: "2026-05-01", last_contact_date: "2026-04-15", last_qcc_date: "2026-03-12", has_supplies: true, has_keys: true, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "Address: 2960 Airway Avenue, Costa Mesa, CA 92626. Internal: Key given, dumpster in parking lot back. Important to dust monitors and keyboards in hitting bay. Supplies either in bathroom for trash bags or under bar area.", source_sheet: "Accounts" },`
);

// 5. Update Swing Easy Yorba Linda
content = content.replace(
  /\{ id: "import-swing-easy-golf-club-yorba-linda-6"[\s\S]*?source_sheet: "Accounts" \},/g,
  `{ id: "import-swing-easy-golf-club-yorba-linda-6", name: "Swing Easy Golf Club Yorba Linda", city: "Yorba Linda", pricing_model: "Flat rate", cleaner_name: "Sandra Hernandez", hours: 3, frequency: "Every 14 days", revenue: 486, cost: 200, payment_method: "Credit Card", contract_start: "2025-12-04", contract_end: "2026-04-11", last_contact_date: "2026-04-15", last_qcc_date: "2026-03-12", has_supplies: true, has_keys: true, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "Address: 22755 Savi Ranch Parkway, Yorba Linda, CA 92887. Internal: Dumpster for trash in parking lot, supplies in bathroom & bar area, lobby dusting important as well hitting bay monitors, tables, keyboards. Cubbies in left side of building dusting important.", source_sheet: "Accounts" },`
);

// Clean up formatting
content = content.replace(/},\s*,\s*{/g, '},\n  {');
fs.writeFileSync(filePath, content);
console.log("Batch 3 updated successfully!");
