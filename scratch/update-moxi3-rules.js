const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/lib/commercial-accounts-data.ts');
let content = fs.readFileSync(filePath, 'utf8');

const targetBlock = `  { id: "import-moxi3-costa-mesa", name: "MOXI3 Costa Mesa", city: "Costa Mesa", pricing_model: "Flat Rate", cleaner_name: "Luz Uribe", hours: 3.5, frequency: "3x per week", revenue: 1100, cost: 642, payment_method: "Credit card", contract_start: "2026-08-13", contract_end: null, last_contact_date: null, last_qcc_date: null, has_supplies: false, has_keys: true, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "Lockbox code 3400. ALARM CODE: 1480. Internal: Dumpster around the back of the building. Ensuring lock is completely lock in front and back door. Making sure we dont unplug the sound system or any cables in the gym. Saturday cleanings are only for the training room, flooring and mirrors in the training room. We steam clean the pilates mats 2x per month on the first and 3rd Saturday.", source_sheet: "Accounts", schedule_rules: [
    { day_of_week: 4, paid_hours: 3.0, assigned_cleaner_name: "Luz Uribe" },
    { day_of_week: 6, paid_hours: 3.0, assigned_cleaner_name: "Luz Uribe" },
  ] },`;

const replacementBlock = `  { id: "import-moxi3-costa-mesa", name: "MOXI3 Costa Mesa", city: "Costa Mesa", pricing_model: "Flat Rate", cleaner_name: "Luz Uribe", hours: 3.5, frequency: "3x per week", revenue: 1100, cost: 642, payment_method: "Credit card", contract_start: "2026-08-13", contract_end: null, last_contact_date: null, last_qcc_date: null, has_supplies: false, has_keys: true, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "Lockbox code 3400. ALARM CODE: 1480. Internal: Dumpster around the back of the building. Ensuring lock is completely lock in front and back door. Making sure we dont unplug the sound system or any cables in the gym. Saturday cleanings are only for the training room, flooring and mirrors in the training room. We steam clean the pilates mats 2x per month on the first and 3rd Saturday.", source_sheet: "Accounts", schedule_rules: [
    { day_of_week: 1, paid_hours: 3.5, assigned_cleaner_name: "Luz Uribe" },
    { day_of_week: 4, paid_hours: 3.5, assigned_cleaner_name: "Luz Uribe" },
    { day_of_week: 6, paid_hours: 3.5, assigned_cleaner_name: "Luz Uribe" },
  ] },`;

if(content.includes(targetBlock)) {
  content = content.replace(targetBlock, replacementBlock);
  fs.writeFileSync(filePath, content);
  console.log("Updated MOXI3 Rules!");
} else {
  console.log("Could not find target block for MOXI3 Rules.");
}
