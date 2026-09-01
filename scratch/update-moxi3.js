const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/lib/commercial-accounts-data.ts');
let content = fs.readFileSync(filePath, 'utf8');

const targetLine = '  { id: "import-moxi3-costa-mesa", name: "MOXI3 Costa Mesa", city: "Costa Mesa", pricing_model: "Flat Rate", cleaner_name: "Luz Uribe", hours: 3, frequency: "2x per week", revenue: 1100, cost: 642, payment_method: "Credit card", contract_start: "2026-06-01", contract_end: null, last_contact_date: null, last_qcc_date: null, has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "Saturday regular 3h + 2x/month mats (+2h = 5h total every 2 weeks)", source_sheet: "Accounts", schedule_rules: [';

const replacement = '  { id: "import-moxi3-costa-mesa", name: "MOXI3 Costa Mesa", city: "Costa Mesa", pricing_model: "Flat Rate", cleaner_name: "Luz Uribe", hours: 3.5, frequency: "3x per week", revenue: 1100, cost: 642, payment_method: "Credit card", contract_start: "2026-08-13", contract_end: null, last_contact_date: null, last_qcc_date: null, has_supplies: false, has_keys: true, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "Lockbox code 3400. ALARM CODE: 1480. Internal: Dumpster around the back of the building. Ensuring lock is completely lock in front and back door. Making sure we dont unplug the sound system or any cables in the gym. Saturday cleanings are only for the training room, flooring and mirrors in the training room. We steam clean the pilates mats 2x per month on the first and 3rd Saturday.", source_sheet: "Accounts", schedule_rules: [';

if(content.includes(targetLine)) {
  content = content.replace(targetLine, replacement);
  fs.writeFileSync(filePath, content);
  console.log("Updated MOXI3!");
} else {
  console.log("Could not find target line for MOXI3.");
}
