const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/lib/commercial-accounts-data.ts');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/\}\s*\n\s*\{\s*\n\s*id: "import-oc-spine-sports-physicians"/g, '},\n  {\n    id: "import-oc-spine-sports-physicians"');

fs.writeFileSync(filePath, content);
console.log("Comma fixed!");
