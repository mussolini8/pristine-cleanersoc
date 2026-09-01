const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/lib/commercial-accounts-data.ts');
let content = fs.readFileSync(filePath, 'utf8');

const regex = /schedule_rules\?: ImportedCommercialScheduleRule\[([\s\S]*?)export const importedCommercialAccounts/;
content = content.replace(regex, "schedule_rules?: ImportedCommercialScheduleRule[];\n};\n\nexport const importedCommercialAccounts");

fs.writeFileSync(filePath, content);
console.log("Fixed the broken file again");
