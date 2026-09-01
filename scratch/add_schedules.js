const fs = require('fs');
const file = 'src/components/operations/simple-operations-client.tsx';
let content = fs.readFileSync(file, 'utf8');

const imports = `import { OperationsCalendar, type CalendarView, type NormalizedCalendarEvent } from "./shared-calendar";\n`;
if(!content.includes('OperationsCalendar')) {
  content = content.replace('import { DashboardShell', imports + 'import { DashboardShell');
}

const renderHooks = `
        {!loading && view === "settings" ? renderSettings() : null}
        {!loading && view === "schedule-residential" ? renderResidentialSchedule() : null}
        {!loading && view === "schedule-commercial" ? renderCommercialSchedule() : null}
        {!loading && view === "schedule-qc" ? renderQcSchedule() : null}
`;

content = content.replace('{!loading && view === "settings" ? renderSettings() : null}', renderHooks);

const scheduleFunctions = `

  function renderResidentialSchedule() {
    const events: NormalizedCalendarEvent[] = residentialAccounts.map(acc => ({
      id: acc.id,
      type: "booking",
      status: "active",
      title: acc.account_name,
      start: acc.created_at.split('T')[0], // Approximation for demo
      end: acc.created_at.split('T')[0],
      summary: \`\${acc.frequency} - \${acc.assigned_team_name || 'Unassigned'}\`,
      businessUnit: "residential",
      color: { bgClass: "bg-emerald-50", borderClass: "border-emerald-200", textClass: "text-emerald-800", badgeClass: "bg-emerald-100 text-emerald-800" }
    }));
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-xl font-bold">Residential Schedule</h2>
            <p className="text-sm text-muted-foreground">Manage your home cleaning bookings</p>
          </div>
        </div>
        <OperationsCalendar events={events} viewMode="week" anchor={new Date()} emptyMessage="No residential cleanings." onEventSelect={() => {}} />
      </div>
    );
  }

  function renderCommercialSchedule() {
    const events: NormalizedCalendarEvent[] = commercialAccounts.map(acc => ({
      id: acc.id,
      type: "booking",
      status: "active",
      title: acc.name,
      start: acc.created_at.split('T')[0],
      end: acc.created_at.split('T')[0],
      summary: \`\${acc.frequency} - \${acc.cleaner_name || 'Unassigned'}\`,
      businessUnit: "commercial",
      color: { bgClass: "bg-indigo-50", borderClass: "border-indigo-200", textClass: "text-indigo-800", badgeClass: "bg-indigo-100 text-indigo-800" }
    }));
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-xl font-bold">Commercial Schedule</h2>
            <p className="text-sm text-muted-foreground">Manage your night crews and office cleanings</p>
          </div>
        </div>
        <OperationsCalendar events={events} viewMode="week" anchor={new Date()} emptyMessage="No commercial cleanings." onEventSelect={() => {}} />
      </div>
    );
  }

  function renderQcSchedule() {
    const events: NormalizedCalendarEvent[] = operationTasks.filter(t => t.category === "QC Inspection").map(task => ({
      id: task.id,
      type: "task",
      status: task.status,
      title: task.title,
      start: task.due_date || task.created_at.split('T')[0],
      end: task.due_date || task.created_at.split('T')[0],
      summary: task.assignee || 'Unassigned',
      businessUnit: "qc",
      color: { bgClass: "bg-amber-50", borderClass: "border-amber-200", textClass: "text-amber-800", badgeClass: "bg-amber-100 text-amber-800" }
    }));
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-xl font-bold">QC Schedule</h2>
            <p className="text-sm text-muted-foreground">Quality control inspections agenda</p>
          </div>
        </div>
        <OperationsCalendar events={events} viewMode="week" anchor={new Date()} emptyMessage="No QC inspections." onEventSelect={() => {}} />
      </div>
    );
  }

`;

content = content.replace('function renderHeader() {', scheduleFunctions + '\n  function renderHeader() {');

// update header for the new views
const headerRepl = `
      "schedule-residential": { title: "Residential Schedule", sub: "Day-time house cleaning routing", icon: CalendarDays },
      "schedule-commercial": { title: "Commercial Schedule", sub: "Evening and night crew shifts", icon: CalendarDays },
      "schedule-qc": { title: "QC Schedule", sub: "Quality control inspections", icon: CalendarDays },
`;
if(!content.includes('"schedule-residential":')) {
  content = content.replace('settings: { title:', headerRepl + '      settings: { title:');
}

fs.writeFileSync(file, content);
