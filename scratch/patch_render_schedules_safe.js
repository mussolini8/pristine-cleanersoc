const fs = require('fs');
const file = 'src/components/operations/simple-operations-client.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldFn = `  function renderSchedules() {
    let events: NormalizedCalendarEvent[] = [];
    
    if (scheduleTab === "commercial") {
      events = commercialAccounts.map(acc => ({
        id: acc.id,
        type: "booking",
        status: "active",
        title: acc.name,
        start: todayKey(),
        end: todayKey(),
        summary: \`\${acc.frequency} - \${acc.cleaner_name || 'Unassigned'}\`,
        businessUnit: "commercial",
        color: { bgClass: "bg-indigo-50", borderClass: "border-indigo-200", textClass: "text-indigo-800", badgeClass: "bg-indigo-100 text-indigo-800" }
      }));
    } else if (scheduleTab === "qc") {
      events = tasks.filter(t => t.category === "QC Inspection").map(task => ({
        id: task.id,
        type: "task",
        status: task.status || "pending",
        title: task.title,
        start: task.due_date || todayKey(),
        end: task.due_date || todayKey(),
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
  }`;

const newFn = `  function renderSchedules() {
    let events: NormalizedCalendarEvent[] = [];
    
    if (scheduleTab === "commercial") {
      events = (commercialAccounts || []).map((acc) => ({
        id: acc.id,
        type: "booking",
        status: "active",
        title: acc.name,
        start: todayKey(),
        end: todayKey(),
        summary: \`\${acc.frequency || "Schedule"} - \${acc.cleaner_name || "Unassigned"}\`,
        businessUnit: "commercial",
        color: { bgClass: "bg-indigo-50 dark:bg-indigo-950/40", borderClass: "border-indigo-200 dark:border-indigo-800", textClass: "text-indigo-800 dark:text-indigo-300", badgeClass: "bg-indigo-100 text-indigo-800" }
      }));
    } else if (scheduleTab === "qc") {
      events = (tasks || []).filter((t) => t.category === "QC Inspection" || t.category === "QC" || t.title.toLowerCase().includes("qc")).map((task) => ({
        id: task.id,
        type: "task",
        status: task.status || "pending",
        title: task.title,
        start: (task.due_date || "").split("T")[0] || todayKey(),
        end: (task.due_date || "").split("T")[0] || todayKey(),
        summary: task.assignee || "Unassigned",
        businessUnit: "qc",
        color: { bgClass: "bg-amber-50 dark:bg-amber-950/40", borderClass: "border-amber-200 dark:border-amber-800", textClass: "text-amber-800 dark:text-amber-300", badgeClass: "bg-amber-100 text-amber-800" }
      }));
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border/70 pb-3">
          <button 
            type="button"
            className={\`px-4 py-2 text-sm font-bold rounded-lg transition-colors \${scheduleTab === 'commercial' ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:bg-muted'}\`}
            onClick={() => setScheduleTab("commercial")}
          >
            Commercial Schedule
          </button>
          <button 
            type="button"
            className={\`px-4 py-2 text-sm font-bold rounded-lg transition-colors \${scheduleTab === 'qc' ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:bg-muted'}\`}
            onClick={() => setScheduleTab("qc")}
          >
            QC Schedule
          </button>
        </div>
        
        <OperationsCalendar 
          events={events} 
          viewMode="week" 
          emptyMessage={scheduleTab === "commercial" ? "No commercial cleanings." : "No QC inspections."} 
        />
      </div>
    );
  }`;

content = content.replace(oldFn, newFn);
fs.writeFileSync(file, content);
console.log('Patched renderSchedules with safe parsing.');
