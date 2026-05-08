"use client";

import { useMemo, useState } from "react";
import { BarChart3, ClipboardCheck, Download, FileText, TrendingUp } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

type ReportFrequency = "week" | "month" | "quarter" | "year";

const frequencyLabels: Record<ReportFrequency, string> = {
  week: "Weekly",
  month: "Monthly",
  quarter: "Quarterly",
  year: "Yearly",
};

const kpis = [
  { label: "Reports Ready", value: "4", Icon: FileText },
  { label: "QC Health", value: "94%", Icon: ClipboardCheck },
  { label: "Trend", value: "+8%", Icon: TrendingUp },
  { label: "Review Queue", value: "2", Icon: BarChart3 },
];

const reportRows = [
  { name: "Commercial QC", metric: "94%", status: "Ready", accent: "Quality checks and account readiness." },
  { name: "Residential Payments", metric: "$0.00", status: "Draft", accent: "Cleaner payroll and weekly totals." },
  { name: "Supplies Tracker", metric: "6 checks", status: "Review", accent: "Keys, supplies, delivery dates, and fill notes." },
  { name: "Client Follow-ups", metric: "12 calls", status: "Ready", accent: "Renewals, satisfaction checks, and callback queue." },
];

function getWindowLabel(frequency: ReportFrequency) {
  const now = new Date();
  const month = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  if (frequency === "week") return `Week of ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  if (frequency === "month") return month;
  if (frequency === "quarter") return `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;
  return String(now.getFullYear());
}

export default function ReportsPage() {
  const [frequency, setFrequency] = useState<ReportFrequency>("month");
  const windowLabel = useMemo(() => getWindowLabel(frequency), [frequency]);

  async function downloadReport(reportName: string) {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const report = reportRows.find((row) => row.name === reportName);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Pristine Cleaners SOP Report", 16, 18);
    doc.setFontSize(12);
    doc.text(reportName, 16, 29);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Frequency: ${frequencyLabels[frequency]}`, 16, 38);
    doc.text(`Window: ${windowLabel}`, 16, 45);
    doc.text(`Status: ${report?.status ?? "Ready"}`, 16, 52);
    doc.text(`Metric: ${report?.metric ?? "-"}`, 16, 59);

    doc.setFont("helvetica", "bold");
    doc.text("Summary", 16, 72);
    doc.setFont("helvetica", "normal");
    doc.text(report?.accent ?? "Operational SOP snapshot.", 16, 80, { maxWidth: 170 });

    let y = 96;
    for (const row of reportRows) {
      doc.setFont("helvetica", "bold");
      doc.text(row.name, 16, y);
      doc.setFont("helvetica", "normal");
      doc.text(`${row.metric} - ${row.status}`, 86, y);
      y += 8;
    }

    doc.save(`pristine-${reportName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${frequency}.pdf`);
  }

  async function downloadAllReports() {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Pristine Cleaners SOP Reports", 16, 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Frequency: ${frequencyLabels[frequency]} | Window: ${windowLabel}`, 16, 28);

    let y = 42;
    for (const row of reportRows) {
      doc.setFont("helvetica", "bold");
      doc.text(row.name, 16, y);
      doc.setFont("helvetica", "normal");
      doc.text(`Metric: ${row.metric}`, 16, y + 7);
      doc.text(`Status: ${row.status}`, 70, y + 7);
      doc.text(row.accent, 16, y + 14, { maxWidth: 170 });
      y += 30;
    }

    doc.save(`pristine-sop-reports-${frequency}.pdf`);
  }

  return (
    <DashboardShell userEmail="pristinecleanersoc@gmail.com">
      <style>{`
        .reports-page { display:flex; flex-direction:column; gap:18px; }
        .reports-head { display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:14px; border:1px solid hsl(var(--border)); border-radius:8px; padding:18px;
          background:linear-gradient(135deg,hsl(var(--primary)/.1),hsl(199 89% 48%/.07),hsl(42 95% 55%/.1)); box-shadow:0 18px 55px -48px hsl(210 40% 20%); }
        .reports-kicker { display:flex; align-items:center; gap:7px; font-size:.72rem; font-weight:950; color:hsl(var(--primary)); text-transform:uppercase; letter-spacing:.12em; }
        .reports-title { margin-top:8px; font-size:1.65rem; font-weight:950; }
        .reports-sub { margin-top:4px; color:hsl(var(--muted-foreground)); font-size:.88rem; font-weight:650; }
        .report-actions { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
        .frequency-select { height:38px; border:1px solid hsl(var(--border)); border-radius:8px; background:hsl(var(--background)); color:hsl(var(--foreground)); padding:0 10px; font:inherit; font-size:.82rem; font-weight:900; outline:none; }
        .download-all { display:inline-flex; align-items:center; gap:7px; height:38px; border:none; border-radius:8px; padding:0 13px; background:hsl(var(--primary)); color:hsl(var(--primary-foreground)); font-weight:950; cursor:pointer; }
        .kpi-grid { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:10px; }
        .report-kpi { border:1px solid hsl(var(--border)); border-radius:8px; background:hsl(var(--card)); padding:14px; box-shadow:0 16px 42px -42px hsl(210 40% 20%); transition:transform .18s ease, box-shadow .18s ease; }
        .report-kpi:hover { transform:translateY(-2px); box-shadow:0 18px 42px -36px hsl(210 40% 20%); }
        .report-kpi svg { color:hsl(var(--primary)); }
        .kpi-label { margin-top:12px; font-size:.68rem; font-weight:950; text-transform:uppercase; letter-spacing:.1em; color:hsl(var(--muted-foreground)); }
        .kpi-value { margin-top:3px; font-size:1.8rem; font-weight:950; }
        .library { border:1px solid hsl(var(--border)); border-radius:8px; overflow:hidden; background:hsl(var(--card)); }
        .library-head { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:14px 16px; border-bottom:1px solid hsl(var(--border)); }
        .library-title { font-size:.98rem; font-weight:950; }
        .window-pill { border:1px solid hsl(var(--border)); border-radius:999px; padding:5px 10px; color:hsl(var(--muted-foreground)); font-size:.72rem; font-weight:900; }
        .report-list { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:0; }
        .report-card { min-width:0; padding:15px; border-bottom:1px solid hsl(var(--border)); transition:background .18s ease; }
        .report-card:nth-child(odd) { border-right:1px solid hsl(var(--border)); }
        .report-card:hover { background:hsl(var(--muted)/.24); }
        .report-card-top { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
        .report-name { font-size:.92rem; font-weight:950; }
        .report-accent { margin-top:4px; color:hsl(var(--muted-foreground)); font-size:.76rem; font-weight:650; line-height:1.4; }
        .metric { margin-top:12px; color:hsl(var(--primary)); font-size:1.15rem; font-weight:950; }
        .status-pill { display:inline-flex; border-radius:999px; background:hsl(var(--primary)/.1); color:hsl(var(--primary)); padding:4px 9px; font-size:.68rem; font-weight:950; }
        .report-download { display:inline-flex; align-items:center; gap:6px; margin-top:12px; height:32px; border:1px solid hsl(var(--border)); border-radius:8px; background:hsl(var(--background)); color:hsl(var(--foreground)); padding:0 10px; font-size:.74rem; font-weight:950; cursor:pointer; }
        .report-download:hover { border-color:hsl(var(--primary)); color:hsl(var(--primary)); }
        @media (max-width:980px) { .kpi-grid, .report-list { grid-template-columns:1fr 1fr; } }
        @media (max-width:640px) { .kpi-grid, .report-list { grid-template-columns:1fr; } .report-card:nth-child(odd) { border-right:none; } }
      `}</style>

      <div className="reports-page">
        <section className="reports-head">
          <div>
            <p className="reports-kicker"><FileText size={15} /> SOP Pristine Cleaners</p>
            <h1 className="reports-title">Reports</h1>
            <p className="reports-sub">Operational snapshots for QC, payroll, supplies, and client follow-up.</p>
          </div>
          <div className="report-actions">
            <select className="frequency-select" value={frequency} onChange={(event) => setFrequency(event.target.value as ReportFrequency)}>
              {Object.entries(frequencyLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <button className="download-all" type="button" onClick={downloadAllReports}>
              <Download size={15} /> Download PDF
            </button>
          </div>
        </section>

        <div className="kpi-grid">
          {kpis.map(({ label, value, Icon }) => (
            <div className="report-kpi" key={label}>
              <Icon className="size-5" />
              <p className="kpi-label">{label}</p>
              <p className="kpi-value">{value}</p>
            </div>
          ))}
        </div>

        <section className="library">
          <div className="library-head">
            <h2 className="library-title">Report Library</h2>
            <span className="window-pill">{frequencyLabels[frequency]} · {windowLabel}</span>
          </div>
          <div className="report-list">
            {reportRows.map((report) => (
              <article className="report-card" key={report.name}>
                <div className="report-card-top">
                  <div>
                    <h3 className="report-name">{report.name}</h3>
                    <p className="report-accent">{report.accent}</p>
                  </div>
                  <span className="status-pill">{report.status}</span>
                </div>
                <p className="metric">{report.metric}</p>
                <button className="report-download" type="button" onClick={() => downloadReport(report.name)}>
                  <Download size={14} /> PDF
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
