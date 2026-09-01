const fs = require('fs');
const file = 'src/lib/access-control.ts';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('{ prefix: "/schedules", area: "workspace" }')) {
  content = content.replace(
    '{ prefix: "/dashboard", area: "workspace" },',
    '{ prefix: "/dashboard", area: "workspace" },\n  { prefix: "/schedules", area: "workspace" },'
  );
  fs.writeFileSync(file, content);
}
console.log('Access control updated.');
