const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/lib/commercial-accounts-data.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Replace any occurrence of `,` followed by whitespace and then `,` or just double comma
content = content.replace(/},\s*,\s*{/g, '},\n  {');

fs.writeFileSync(filePath, content);
console.log("Fixed comma.");
