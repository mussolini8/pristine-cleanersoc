const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/lib/commercial-accounts-data.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Target LSG block and replace Vanessa Ortega with Maria Mejia
const lsgRegex = /id: "import-lsg-sky-chefs-costa-mesa"[\s\S]*?\] \},/g;
content = content.replace(lsgRegex, (match) => {
    let newMatch = match.replace(/Vanessa Ortega/g, 'Maria Mejia');
    // Also update start date from 2026-07-15 to 2026-07-09 (from image)
    newMatch = newMatch.replace(/2026-07-15/g, '2026-07-09');
    // Update main cleaner name from "Luz and Vanessa" to "Luz and Maria"
    newMatch = newMatch.replace(/Luz and Vanessa/g, 'Luz and Maria');
    return newMatch;
});

// 2. Append new accounts
const newAccounts = `
  { 
    id: "import-field-ai-irvine-new", 
    name: "Field AI", 
    city: "Irvine", 
    pricing_model: "flat rate", 
    cleaner_name: "Veronica Ladinos", 
    hours: 6, 
    frequency: "5x per week", 
    revenue: null, cost: null, payment_method: null, 
    contract_start: "2026-01-13", 
    contract_end: null, last_contact_date: null, last_qcc_date: null, 
    has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, 
    supplies_notes: "Instructions: Monday through Friday Trash. Monday full office cleaning. Be sure all toilet paper dispensers have at least 1 FULL roll. Kitchen cleaning needs coffee machine detailed cleaning...", 
    source_sheet: "Manual Upload" 
  },
  { 
    id: "import-glo-bar-medspa-costa-mesa-new", 
    name: "GLO Bar MedSpa", 
    city: "Costa Mesa", 
    pricing_model: "flat rate", 
    cleaner_name: "Juan Romero", 
    hours: 3, 
    frequency: "2x per week", 
    revenue: null, cost: null, payment_method: null, 
    contract_start: "2026-04-02", 
    contract_end: null, last_contact_date: null, last_qcc_date: null, 
    has_supplies: true, has_keys: true, supply_delivery_date: null, estimated_fill_date: null, 
    supplies_notes: "Instructions: Door code: 5436. Alarm code: 2891. Internal: Details around staff kitchen and baseboards, chair details in all operatory rooms... Key is given and dumpster is outside the back door to the right.", 
    source_sheet: "Manual Upload" 
  },
  { 
    id: "import-kush-fine-art-laguna-beach-new", 
    name: "Kush Fine Art", 
    city: "Laguna Beach", 
    pricing_model: "flat rate", 
    cleaner_name: null, 
    hours: 3, 
    frequency: "Every 21 days", 
    revenue: null, cost: null, payment_method: null, 
    contract_start: "2025-12-22", 
    contract_end: null, last_contact_date: null, last_qcc_date: null, 
    has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, 
    supplies_notes: "Internal: Detailed dusting not touching sculptures or pieces. Bathroom cleaning necessary. Cobweb cleaning is a must. Parking is the hardest part. Parking near the library or on side streets...", 
    source_sheet: "Manual Upload" 
  },
  { 
    id: "import-kott-koatings-lake-forest-new", 
    name: "Kott Koatings", 
    city: "Lake Forest", 
    pricing_model: "flat rate", 
    cleaner_name: "Susana Bautista", 
    hours: 3, 
    frequency: "1x per week", 
    revenue: null, cost: null, payment_method: null, 
    contract_start: "2026-08-25", 
    contract_end: null, last_contact_date: null, last_qcc_date: null, 
    has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, 
    supplies_notes: "Instructions: Cleaning the front lobby, 2 bathrooms, and offices to the left and to the right of the lobby. Not cleaning anything in the back area... Internal: Alfredo is the man that will allow them in... No key or alarm needed.", 
    source_sheet: "Manual Upload" 
  }
`;

const lastIndex = content.lastIndexOf('];');
if (lastIndex !== -1 && !content.includes("import-field-ai-irvine-new")) {
    content = content.substring(0, lastIndex) + ',\n' + newAccounts + '\n];\n';
    // Clean up commas
    content = content.replace(/},\s*,\s*{/g, '},\n  {');
    fs.writeFileSync(filePath, content);
    console.log("Success!");
} else {
    console.log("Failed or already done.");
}
