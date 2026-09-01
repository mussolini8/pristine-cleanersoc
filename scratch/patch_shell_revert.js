const fs = require('fs');
const file = 'src/components/dashboard/dashboard-shell.tsx';
let content = fs.readFileSync(file, 'utf8');

// Remove the 3 separated schedule items and add the unified one
const toRemove1 = '{ label: "Residential Schedule", href: "/schedule-residential", icon: CalendarDays, area: "workspace" as AccessArea },';
const toRemove2 = '{ label: "Commercial Schedule", href: "/schedule-commercial", icon: CalendarDays, area: "workspace" as AccessArea },';
const toRemove3 = '{ label: "QC Schedule", href: "/schedule-qc", icon: CalendarDays, area: "workspace" as AccessArea },';

content = content.replace(toRemove1, '');
content = content.replace(toRemove2, '');
content = content.replace(toRemove3, '');

// Insert "Schedules" item
const searchStr = '{ label: "Residential payments / commercial hours", href: "/residential", icon: Wallet, area: "workspace" as AccessArea },';
const newItems = `\n  { label: "Schedules (Comm & QC)", href: "/schedules", icon: CalendarDays, area: "workspace" as AccessArea },`;

if (content.includes(searchStr) && !content.includes('href: "/schedules"')) {
    content = content.replace(searchStr, searchStr + newItems);
}

fs.writeFileSync(file, content);
