const fs = require('fs');

// 1. Fix simple-operations-client.tsx
{
  const file = 'src/components/operations/simple-operations-client.tsx';
  let content = fs.readFileSync(file, 'utf8');

  // Remove the rogue useState after return
  content = content.replace('const [scheduleTab, setScheduleTab] = useState<"commercial" | "qc">("commercial");', '');

  // Add it to the top state definitions
  const target = 'const [monthlySopImportSummary, setMonthlySopImportSummary] = useState<MonthlySopImportSummary | null>(null);';
  const addition = `const [monthlySopImportSummary, setMonthlySopImportSummary] = useState<MonthlySopImportSummary | null>(null);
  const [scheduleTab, setScheduleTab] = useState<"commercial" | "qc">("commercial");`;

  content = content.replace(target, addition);
  fs.writeFileSync(file, content);
}

// 2. Fix shared-calendar.tsx (ensure "use client" is at the top)
{
  const file = 'src/components/operations/shared-calendar.tsx';
  let content = fs.readFileSync(file, 'utf8');
  if (!content.startsWith('"use client";')) {
    content = '"use client";\n\n' + content;
    fs.writeFileSync(file, content);
  }
}

console.log('Fixed Rules of Hooks and use client directive.');
