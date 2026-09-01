const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/lib/commercial-accounts-data.ts');
let content = fs.readFileSync(filePath, 'utf8');

const regex = /(id: "import-moxi3-costa-mesa"[\s\S]*?schedule_rules: \[)[\s\S]*?(\] \},)/;

content = content.replace(regex, `$1
    { day_of_week: 1, paid_hours: 3.5, assigned_cleaner_name: "Luz Uribe" },
    { day_of_week: 4, paid_hours: 3.5, assigned_cleaner_name: "Luz Uribe" },
    { day_of_week: 6, paid_hours: 3.5, assigned_cleaner_name: "Luz Uribe" },
  $2`);

fs.writeFileSync(filePath, content);
console.log("Updated MOXI3 Rules with regex!");
