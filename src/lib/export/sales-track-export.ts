import type { ExportRow } from "./workbook";

export type SalesTrackItem = {
  id?: string;
  clientName: string;
  city?: string | null;
  serviceFrequency?: string | null;
  serviceDays?: string[] | string | null;
  hoursPerVisit?: number | string | null;
  monthlyHours?: number | string | null;
  cleanerTeam?: string | null;
  pricingModel?: string | null;
  monthlyRevenue: number;
  cleanerCost: number;
  grossProfit?: number;
  marginPct?: number;
  contractStart?: string | null;
  contractEnd?: string | null;
  status: "active" | "onboarding" | "proposal" | "paused" | "inactive";
  notes?: string | null;
};

export type SalesTrackSummary = {
  totalAccounts: number;
  totalMonthlyRevenue: number;
  totalCleanerCost: number;
  totalGrossProfit: number;
  averageMarginPct: number;
};

export function calculateSalesTrackSummary(items: SalesTrackItem[]): SalesTrackSummary {
  const totalAccounts = items.length;
  const totalMonthlyRevenue = items.reduce((sum, item) => sum + (Number(item.monthlyRevenue) || 0), 0);
  const totalCleanerCost = items.reduce((sum, item) => sum + (Number(item.cleanerCost) || 0), 0);
  const totalGrossProfit = totalMonthlyRevenue - totalCleanerCost;
  const averageMarginPct = totalMonthlyRevenue > 0 ? Math.round((totalGrossProfit / totalMonthlyRevenue) * 100) : 0;

  return {
    totalAccounts,
    totalMonthlyRevenue,
    totalCleanerCost,
    totalGrossProfit,
    averageMarginPct,
  };
}

export async function exportSalesTrackToXLSX(filename: string, items: SalesTrackItem[]) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  const summary = calculateSalesTrackSummary(items);

  const formattedRows: ExportRow[] = items.map((item, index) => {
    const revenue = Number(item.monthlyRevenue) || 0;
    const cost = Number(item.cleanerCost) || 0;
    const profit = item.grossProfit !== undefined ? item.grossProfit : revenue - cost;
    const margin = item.marginPct !== undefined ? item.marginPct : (revenue > 0 ? Math.round((profit / revenue) * 100) : 0);
    const days = Array.isArray(item.serviceDays) ? item.serviceDays.join(", ") : (item.serviceDays || "");

    return {
      "No.": index + 1,
      "Client / Account": item.clientName,
      "City": item.city || "—",
      "Cleaner / Team": item.cleanerTeam || "Unassigned",
      "Frequency": item.serviceFrequency || "—",
      "Service Days": days || "—",
      "Hours / Visit": item.hoursPerVisit ?? "—",
      "Monthly Revenue ($)": revenue,
      "Cleaner Cost ($)": cost,
      "Gross Profit ($)": profit,
      "Margin (%)": `${margin}%`,
      "Pricing Model": item.pricingModel || "Monthly",
      "Contract Start": item.contractStart || "—",
      "Contract End": item.contractEnd || "—",
      "Status": item.status.toUpperCase(),
      "Notes": item.notes || "",
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(formattedRows);

  worksheet["!cols"] = [
    { wch: 6 },
    { wch: 26 },
    { wch: 16 },
    { wch: 22 },
    { wch: 16 },
    { wch: 20 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 12 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 30 },
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Track Report");

  const summaryRows: ExportRow[] = [
    { "Metric": "Total Active & Tracked Accounts", "Value": summary.totalAccounts },
    { "Metric": "Total Monthly Revenue ($)", "Value": summary.totalMonthlyRevenue },
    { "Metric": "Total Monthly Cleaner Cost ($)", "Value": summary.totalCleanerCost },
    { "Metric": "Total Projected Gross Profit ($)", "Value": summary.totalGrossProfit },
    { "Metric": "Average Gross Margin (%)", "Value": `${summary.averageMarginPct}%` },
    { "Metric": "Report Generated At", "Value": new Date().toLocaleString("en-US") },
  ];
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  summarySheet["!cols"] = [{ wch: 35 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Executive Summary");

  XLSX.writeFile(workbook, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

export async function exportSalesTrackToPDF(filename: string, items: SalesTrackItem[], title = "Commercial Sales Track Report") {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const summary = calculateSalesTrackSummary(items);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Header Banner
  doc.setFillColor(33, 75, 59); // Pristine primary green
  doc.rect(0, 0, pageWidth, 24, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("PRISTINE CLEANERS", margin, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(title, margin, 18);

  const dateStr = `Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`;
  doc.setFontSize(9);
  doc.text(dateStr, pageWidth - margin - doc.getTextWidth(dateStr), 15);

  // KPI Summary Cards
  const cardY = 28;
  const cardWidth = (pageWidth - margin * 2 - 12) / 4;
  const cardHeight = 16;

  const kpis = [
    { label: "Total Accounts", value: `${summary.totalAccounts}` },
    { label: "Monthly Revenue", value: `$${summary.totalMonthlyRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { label: "Cleaner Cost", value: `$${summary.totalCleanerCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { label: "Gross Margin", value: `${summary.averageMarginPct}% ($${summary.totalGrossProfit.toLocaleString("en-US", { minimumFractionDigits: 0 })})` },
  ];

  kpis.forEach((kpi, i) => {
    const x = margin + i * (cardWidth + 4);
    doc.setFillColor(245, 248, 246);
    doc.setDrawColor(210, 225, 218);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, "FD");

    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(kpi.label.toUpperCase(), x + 4, cardY + 5.5);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(kpi.value, x + 4, cardY + 12.5);
  });

  // Table Headers
  let startY = 49;
  const colWidths = [45, 26, 38, 28, 30, 24, 24, 24, 18, 16];
  const headers = ["Account / Client", "City", "Cleaner / Team", "Frequency", "Days / Hours", "Revenue", "Cost", "Profit", "Margin", "Status"];

  function drawTableHeader(y: number) {
    doc.setFillColor(235, 242, 238);
    doc.rect(margin, y, pageWidth - margin * 2, 7, "F");
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);

    let curX = margin + 2;
    headers.forEach((h, idx) => {
      doc.text(h, curX, y + 4.8);
      curX += colWidths[idx];
    });
    doc.setDrawColor(200, 215, 208);
    doc.line(margin, y + 7, pageWidth - margin, y + 7);
  }

  drawTableHeader(startY);
  startY += 7;

  // Table Rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);

  items.forEach((item, index) => {
    if (startY > pageHeight - 15) {
      doc.addPage();
      startY = 15;
      drawTableHeader(startY);
      startY += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
    }

    const revenue = Number(item.monthlyRevenue) || 0;
    const cost = Number(item.cleanerCost) || 0;
    const profit = item.grossProfit !== undefined ? item.grossProfit : revenue - cost;
    const marginPct = item.marginPct !== undefined ? item.marginPct : (revenue > 0 ? Math.round((profit / revenue) * 100) : 0);
    const days = Array.isArray(item.serviceDays) ? item.serviceDays.join(", ") : (item.serviceDays || "—");

    if (index % 2 === 1) {
      doc.setFillColor(250, 252, 251);
      doc.rect(margin, startY, pageWidth - margin * 2, 6.5, "F");
    }

    let curX = margin + 2;
    doc.setTextColor(15, 23, 42);

    const values = [
      item.clientName.length > 24 ? `${item.clientName.substring(0, 23)}…` : item.clientName,
      item.city || "—",
      (item.cleanerTeam || "Unassigned").length > 20 ? `${(item.cleanerTeam || "Unassigned").substring(0, 19)}…` : (item.cleanerTeam || "Unassigned"),
      item.serviceFrequency || "—",
      `${days} ${item.hoursPerVisit ? `(${item.hoursPerVisit}h)` : ""}`.trim(),
      `$${revenue.toFixed(2)}`,
      `$${cost.toFixed(2)}`,
      `$${profit.toFixed(2)}`,
      `${marginPct}%`,
      item.status.toUpperCase(),
    ];

    values.forEach((val, cIdx) => {
      if (cIdx === 7) {
        doc.setTextColor(profit >= 0 ? 34 : 220, profit >= 0 ? 139 : 38, profit >= 0 ? 34 : 38);
      } else if (cIdx === 9) {
        doc.setTextColor(item.status === "active" ? 34 : 100, item.status === "active" ? 139 : 116, item.status === "active" ? 34 : 139);
      } else {
        doc.setTextColor(30, 41, 59);
      }
      doc.text(val, curX, startY + 4.5);
      curX += colWidths[cIdx];
    });

    startY += 6.5;
  });

  const totalPages = (doc.internal as any).getNumberOfPages ? (doc.internal as any).getNumberOfPages() : 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7.5);
    doc.text(`Pristine Cleaners Confidential · Page ${p} of ${totalPages}`, margin, pageHeight - 6);
  }

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
