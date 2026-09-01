const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/lib/commercial-accounts-data.ts');
let content = fs.readFileSync(filePath, 'utf8');

const newAccounts = `  { 
    id: "import-13demarzo", 
    name: "13deMarzo", 
    city: "Irvine", 
    pricing_model: "flat rate", 
    cleaner_name: "Sandra Hernandez", 
    hours: 2.5, 
    frequency: "5x per week", 
    revenue: null, cost: null, payment_method: null, 
    contract_start: "2026-08-01", 
    contract_end: null, last_contact_date: null, last_qcc_date: null, 
    has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, 
    supplies_notes: "Dumpster in front of the building to the right of Capital Seafood Restaurant. Park vehicle in the main parking lot. Take special emphasis on all surfaces.", 
    source_sheet: "Manual Upload" 
  },
  { 
    id: "import-interior-logic-corona", 
    name: "Interior Logic Group - Corona Office", 
    city: "Corona", 
    pricing_model: "flat rate", 
    cleaner_name: "Sandra Hernandez", 
    hours: 3, 
    frequency: "3x per week", 
    revenue: null, cost: null, payment_method: null, 
    contract_start: "2025-11-22", 
    contract_end: null, last_contact_date: null, last_qcc_date: null, 
    has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, 
    supplies_notes: "Instructions: Look at the alarm code. Call Jake with any questions. Alarm: TO TURN THE ALARM OFF (WHITE ALARM AROUND CORNER ON THE LEFT) 49001 (OFF) TO SET WHEN FINISHED 49002 (AWAY) DO NOT PRESS 3 (STAY BUTTON)", 
    source_sheet: "Manual Upload" 
  },
  { 
    id: "import-interior-logic-irvine", 
    name: "Interior Logic Group - Irvine Office", 
    city: "Irvine", 
    pricing_model: "flat rate", 
    cleaner_name: "Maria Lopez", 
    hours: 2.5, 
    frequency: "3x per week", 
    revenue: null, cost: null, payment_method: null, 
    contract_start: "2025-11-19", 
    contract_end: null, last_contact_date: null, last_qcc_date: null, 
    has_supplies: false, has_keys: true, supply_delivery_date: null, estimated_fill_date: null, 
    supplies_notes: "Instructions: Use keys to clean Suite 100 and Suite 110. Internal: Only cleaning suite 100 from now on. Details on front surface door are important. No bathroom or outside hallway cleaning needed. Two different keys, one for main entrance and one for the suite 100.", 
    source_sheet: "Manual Upload" 
  },
  { 
    id: "import-moxi3-dana-point", 
    name: "MOXI3", 
    city: "Dana Point", 
    pricing_model: "flat rate", 
    cleaner_name: null, 
    hours: 3, 
    frequency: "2x per week", 
    revenue: null, cost: null, payment_method: null, 
    contract_start: "2026-06-12", 
    contract_end: null, last_contact_date: null, last_qcc_date: null, 
    has_supplies: true, has_keys: true, supply_delivery_date: null, estimated_fill_date: null, 
    supplies_notes: "Instructions: Lockbox code 5464. Supplies (toilet paper, trash bags, liners) are in supply closet, when running low please let us know. ALARM CODE: 1480. Internal: Floor details around machines are super important. Lockbox is either on the right side gate, or around the left corner of the building.", 
    source_sheet: "Manual Upload" 
  },
  { 
    id: "import-cornerstone-southern-california", 
    name: "Cornerstone Southern California", 
    city: "Santa Ana", 
    pricing_model: "flat rate", 
    cleaner_name: "Kassandra Valentin", 
    hours: 6.5, 
    frequency: "3x per week", 
    revenue: null, cost: null, payment_method: null, 
    contract_start: "2026-08-16", 
    contract_end: null, last_contact_date: null, last_qcc_date: null, 
    has_supplies: true, has_keys: true, supply_delivery_date: null, estimated_fill_date: null, 
    supplies_notes: "Comments: Alarm code 0505. Internal: Detailed dusting is super important. Multiple keys are given, one for office door, one for supply closet door. Restocking supplies is super important... Leave individual offices locked after cleaning.", 
    source_sheet: "Manual Upload" 
  },
];
`;

content = content.replace('];\n', newAccounts);
// Sometimes it's just `];` without newline at the end
if (!content.includes(newAccounts)) {
    content = content.replace(/\];[\s]*$/, newAccounts);
}

fs.writeFileSync(filePath, content);
console.log("Appended accounts successfully.");
