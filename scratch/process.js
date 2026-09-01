const fs = require('fs');
const path = require('path');

const csv = fs.readFileSync(path.join(__dirname, 'bookings.csv'), 'utf8');
const lines = csv.trim().split('\n');
const headers = lines[0].split(',');

const residential = [];

for (let i = 1; i < lines.length; i++) {
  // Simplistic CSV parsing
  const rowStr = lines[i];
  let inQuotes = false;
  let currentVal = '';
  const row = [];
  for (let j = 0; j < rowStr.length; j++) {
    const char = rowStr[j];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(currentVal);
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  row.push(currentVal);

  const entry = {};
  headers.forEach((h, idx) => {
    entry[h.trim()] = row[idx] ? row[idx].trim() : '';
  });

  if (entry.Service && !entry.Service.includes('Commercial')) {
    residential.push(entry);
  }
}

fs.writeFileSync(path.join(__dirname, '../src/data/residential-accounts.json'), JSON.stringify(residential, null, 2));
console.log(`Wrote ${residential.length} residential accounts.`);
