const fs = require('fs');
const file = 'src/components/dashboard/dashboard-shell.tsx';
let content = fs.readFileSync(file, 'utf8');

// Insert new nav items before "Commercial Accounts" or similar
const searchStr = '{ label: "Residential payments / commercial hours", href: "/residential", icon: Wallet, area: "workspace" as AccessArea },';
const newItems = `
  { label: "Residential Schedule", href: "/schedule-residential", icon: CalendarDays, area: "workspace" as AccessArea },
  { label: "Commercial Schedule", href: "/schedule-commercial", icon: CalendarDays, area: "workspace" as AccessArea },
  { label: "QC Schedule", href: "/schedule-qc", icon: CalendarDays, area: "workspace" as AccessArea },
`;

if(content.includes(searchStr)) {
    content = content.replace(searchStr, searchStr + newItems);
}

// ensure CalendarDays is imported
if (!content.includes('CalendarDays')) {
    content = content.replace('CalendarDays, ', ''); // in case it was half imported
    content = content.replace('LucideIcon,', 'LucideIcon, CalendarDays,');
    if (!content.includes('CalendarDays')) {
        content = content.replace('import { BarChart3,', 'import { BarChart3, CalendarDays,');
    }
}

fs.writeFileSync(file, content);
