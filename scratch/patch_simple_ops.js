const fs = require('fs');
const file = 'src/components/operations/simple-operations-client.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace the return hooks
const oldHooks = `
        {!loading && view === "schedule-residential" ? renderResidentialSchedule() : null}
        {!loading && view === "schedule-commercial" ? renderCommercialSchedule() : null}
        {!loading && view === "schedule-qc" ? renderQcSchedule() : null}
`;
const newHooks = `
        {!loading && view === "schedules" ? renderSchedules() : null}
`;
content = content.replace(oldHooks, newHooks);

// Replace the header dictionary entries
const oldHeaders = `
      "schedule-residential": { title: "Residential Schedule", sub: "Day-time house cleaning routing", icon: CalendarDays },
      "schedule-commercial": { title: "Commercial Schedule", sub: "Evening and night crew shifts", icon: CalendarDays },
      "schedule-qc": { title: "QC Schedule", sub: "Quality control inspections", icon: CalendarDays },
`;
const newHeaders = `
      "schedules": { title: "Schedules", sub: "Commercial and QC Agenda", icon: CalendarDays },
`;
content = content.replace(oldHeaders, newHeaders);

// The old functions started right after 'const scheduleFunctions =' in my previous script, 
// up to 'function renderHeader() {'
// We will replace them by capturing everything from 'function renderResidentialSchedule()' up to 'function renderHeader() {'
const regex = /function renderResidentialSchedule\(\) \{[\s\S]*?(?=function renderHeader\(\) \{)/;

const newRenderFn = `
  const [scheduleTab, setScheduleTab] = useState<"commercial" | "qc">("commercial");

  function renderSchedules() {
    let events: NormalizedCalendarEvent[] = [];
    
    if (scheduleTab === "commercial") {
      events = commercialAccounts.map(acc => ({
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
    } else if (scheduleTab === "qc") {
      events = operationTasks.filter(t => t.category === "QC Inspection").map(task => ({
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
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border/70 pb-3">
          <button 
            className={\`px-4 py-2 text-sm font-bold rounded-lg transition-colors \${scheduleTab === 'commercial' ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:bg-muted'}\`}
            onClick={() => setScheduleTab("commercial")}
          >
            Commercial Schedule
          </button>
          <button 
            className={\`px-4 py-2 text-sm font-bold rounded-lg transition-colors \${scheduleTab === 'qc' ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:bg-muted'}\`}
            onClick={() => setScheduleTab("qc")}
          >
            QC Schedule
          </button>
        </div>
        
        <OperationsCalendar 
          events={events} 
          viewMode="week" 
          anchor={new Date()} 
          emptyMessage={scheduleTab === "commercial" ? "No commercial cleanings." : "No QC inspections."} 
          onEventSelect={() => {}} 
        />
      </div>
    );
  }

`;

content = content.replace(regex, newRenderFn);
fs.writeFileSync(file, content);
