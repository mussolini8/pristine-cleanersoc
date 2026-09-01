const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/lib/commercial-accounts-data.ts');
let content = fs.readFileSync(filePath, 'utf8');

const typeDef = `
export type ImportedCommercialScheduleRule = {
  day_of_week: number;
  paid_hours: number;
  assigned_cleaner_name?: string | null;
  active?: boolean;
  effective_start_date?: string | null;
  effective_end_date?: string | null;
};

export const importedCommercialAccounts`;

content = content.replace('export const importedCommercialAccounts', typeDef);
fs.writeFileSync(filePath, content);
console.log("Type put back.");
