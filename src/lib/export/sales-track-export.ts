import type { ExportRow, ExportSheet } from "./workbook";
import type {
  CategoryPerformance,
  ExecutiveKpis,
  ServiceBookingRow,
  TargetRateModel,
} from "@/lib/sales-tracker/types";
import {
  calculateCategoryBreakdown,
  calculateExecutiveKpis,
  calculateTargetModels,
} from "@/lib/sales-tracker/calculator";

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

export async function exportComprehensiveTrackerToXLSX(
  filename: string,
  bookings: ServiceBookingRow[]
) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  const kpis = calculateExecutiveKpis(bookings);
  const breakdowns = calculateCategoryBreakdown(bookings);
  const targets = calculateTargetModels(bookings);

  // 1. Dash Sheet
  const dashRows: ExportRow[] = [
    { "Pristine Cleaners Executive KPI": "Total Revenue", "Value": kpis.totalRevenue, "Unit / Benchmark": "USD" },
    { "Pristine Cleaners Executive KPI": "Total Gross Profit", "Value": kpis.totalGrossProfit, "Unit / Benchmark": "USD" },
    { "Pristine Cleaners Executive KPI": "Total Gross Profit %", "Value": `${kpis.totalGrossProfitPct.toFixed(2)}%`, "Unit / Benchmark": "Target: 71.6%" },
    { "Pristine Cleaners Executive KPI": "Total Gross Labor Cost", "Value": kpis.totalGrossCost, "Unit / Benchmark": "USD" },
    { "Pristine Cleaners Executive KPI": "Monthly Recurring Revenue (MRR)", "Value": kpis.mrr, "Unit / Benchmark": "USD" },
    { "Pristine Cleaners Executive KPI": "Percentage of Revenue Recurring", "Value": `${kpis.recurringRevenuePct.toFixed(2)}%`, "Unit / Benchmark": "% of Total Sales" },
    { "Pristine Cleaners Executive KPI": "Recurring Gross Profit %", "Value": `${kpis.recurringGrossProfitPct.toFixed(2)}%`, "Unit / Benchmark": "%" },
    { "Pristine Cleaners Executive KPI": "Total Clean Hours", "Value": kpis.totalCleanHours, "Unit / Benchmark": "Hours" },
    { "Pristine Cleaners Executive KPI": "Total Bookings", "Value": kpis.totalBookings, "Unit / Benchmark": "Jobs" },
    { "Pristine Cleaners Executive KPI": "Total Recurring Bookings", "Value": kpis.totalRecurringBookings, "Unit / Benchmark": "Jobs" },
    { "Pristine Cleaners Executive KPI": "Total One-Time Bookings", "Value": kpis.totalOneTimeBookings, "Unit / Benchmark": "Jobs" },
    { "Pristine Cleaners Executive KPI": "Avg. Revenue Per Clean", "Value": kpis.avgRevenuePerClean.toFixed(2), "Unit / Benchmark": "USD / Booking" },
    { "Pristine Cleaners Executive KPI": "Avg. Gross Profit Per Booking", "Value": kpis.avgGrossProfitPerBooking.toFixed(2), "Unit / Benchmark": "USD / Booking" },
    { "Pristine Cleaners Executive KPI": "Avg. Revenue Per Clean Hour", "Value": kpis.avgRevenuePerCleanHour.toFixed(2), "Unit / Benchmark": "USD / Hour" },
  ];
  const dashSheet = XLSX.utils.json_to_sheet(dashRows);
  dashSheet["!cols"] = [{ wch: 38 }, { wch: 22 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(workbook, dashSheet, "Dash");

  // 2. Table Sheet (Category Breakdown)
  const tableRows: ExportRow[] = breakdowns.map((b) => ({
    "Service Type": b.category,
    "Total Clean Hrs": b.totalCleanHours,
    "Avg Clean Hrs": Number(b.avgCleanHours.toFixed(2)),
    "Total Revenue ($)": b.totalRevenue,
    "Avg Revenue / Booking": Number(b.avgRevenuePerBooking.toFixed(2)),
    "Avg Revenue / Clean Hr": Number(b.avgRevenuePerCleanHour.toFixed(2)),
    "Total Gross Cost ($)": b.totalGrossCost,
    "Avg Cost / Booking": Number(b.avgGrossCostPerBooking.toFixed(2)),
    "Avg Cost / Clean Hr": Number(b.avgGrossCostPerCleanHour.toFixed(2)),
    "Total Gross Profit ($)": b.totalGrossProfit,
    "Avg Profit / Booking": Number(b.avgGrossProfitPerBooking.toFixed(2)),
    "Avg Profit / Clean Hr": Number(b.avgGrossProfitPerCleanHour.toFixed(2)),
    "Gross Profit %": `${(b.grossProfitPct * 100).toFixed(1)}%`,
    "Labor Cost %": `${(b.laborPct * 100).toFixed(1)}%`,
  }));
  const tableSheet = XLSX.utils.json_to_sheet(tableRows);
  tableSheet["!cols"] = [
    { wch: 22 }, { wch: 16 }, { wch: 14 },
    { wch: 18 }, { wch: 20 }, { wch: 20 },
    { wch: 18 }, { wch: 18 }, { wch: 18 },
    { wch: 20 }, { wch: 20 }, { wch: 20 },
    { wch: 14 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(workbook, tableSheet, "Table");

  // 3. Target Sheet
  const targetRows: ExportRow[] = targets.map((t, idx) => ({
    "No.": idx + 1,
    "Service": t.service,
    "Base Hourly Rate": `$${t.baseHourlyRate}`,
    "Discount %": `${t.discountPct}%`,
    "Effective Hourly Rate": `$${t.effectiveHourlyRate.toFixed(2)}`,
    "Cleaner Rate": `$${t.cleanerBaseRate}`,
    "Cleaner Effective Rate": `$${t.cleanerEffectiveRate.toFixed(2)}`,
    "Gross Profit / Hr": `$${t.grossProfitPerHour.toFixed(2)}`,
    "Target Profit %": `${t.grossProfitTargetPct.toFixed(1)}%`,
    "Actual Revenue ($)": t.actualGrossRevenue,
    "Actual Profit %": `${t.actualGrossProfitPct.toFixed(1)}%`,
    "% of Total Sales": `${t.revenuePctOfTotal.toFixed(1)}%`,
  }));
  const targetSheet = XLSX.utils.json_to_sheet(targetRows);
  XLSX.utils.book_append_sheet(workbook, targetSheet, "Target");

  // 4. Master Ledger Sheet (Mon)
  const monRows: ExportRow[] = bookings.map((b) => ({
    "Date": b.date,
    "Full Name": b.clientName,
    "Services": b.service,
    "Frequency": b.frequency,
    "Teams Assigned": b.cleanerTeam,
    "City / Town": b.city,
    "Sub-Total ($)": b.subTotal,
    "Sales Tax ($)": b.salesTax,
    "Final Amount ($)": b.finalAmount,
    "Tip ($)": b.tip,
    "Team Earnings w/out Tips ($)": b.teamEarningsWithoutTips,
    "Team Earnings Total ($)": b.teamEarningsTotal,
    "Labour %": `${(b.laborPct * 100).toFixed(1)}%`,
    "PC Earnings ($)": b.pcEarnings,
    "PC Profit %": `${(b.pcProfitPct * 100).toFixed(1)}%`,
    "Duration (Hrs)": b.durationHours,
    "Actual Hours": b.actualHours,
    "Booked By": b.bookedBy || "",
  }));
  const monSheet = XLSX.utils.json_to_sheet(monRows);
  monSheet["!cols"] = [
    { wch: 12 }, { wch: 25 }, { wch: 22 }, { wch: 16 }, { wch: 20 }, { wch: 16 },
    { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 10 }, { wch: 25 }, { wch: 22 },
    { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(workbook, monSheet, "Master Ledger (Mon)");

  // 5. Commercial Sheet
  const commercialBookings = bookings.filter((b) => b.serviceCategory === "Commercial Cleaning" || b.service.toLowerCase().includes("commercial"));
  if (commercialBookings.length > 0) {
    const commRows: ExportRow[] = commercialBookings.map((b) => ({
      "Date": b.date,
      "Full Name": b.clientName,
      "Sub-Total": b.subTotal,
      "Final Amount": b.finalAmount,
      "Frequency": b.frequency,
      "Teams Assigned": b.cleanerTeam,
      "Team Earnings": b.teamEarningsWithoutTips,
      "Labour %": `${(b.laborPct * 100).toFixed(1)}%`,
      "PC Earnings": b.pcEarnings,
      "PC Profit %": `${(b.pcProfitPct * 100).toFixed(1)}%`,
      "Actual Hours": b.actualHours,
      "City": b.city,
    }));
    const commSheet = XLSX.utils.json_to_sheet(commRows);
    XLSX.utils.book_append_sheet(workbook, commSheet, "Commercial");
  }

  // 6. Recurring Sheet
  const recurBookings = bookings.filter((b) => b.serviceCategory !== "Commercial Cleaning" && (b.frequency.toLowerCase().includes("week") || b.frequency.toLowerCase().includes("month")));
  if (recurBookings.length > 0) {
    const recurRows: ExportRow[] = recurBookings.map((b) => ({
      "Date": b.date,
      "Full Name": b.clientName,
      "Sub-Total": b.subTotal,
      "Frequency": b.frequency,
      "Teams Assigned": b.cleanerTeam,
      "Team Earnings": b.teamEarningsWithoutTips,
      "Labour %": `${(b.laborPct * 100).toFixed(1)}%`,
      "PC Earnings": b.pcEarnings,
      "PC Profit %": `${(b.pcProfitPct * 100).toFixed(1)}%`,
      "Actual Hours": b.actualHours,
      "City": b.city,
    }));
    const recurSheet = XLSX.utils.json_to_sheet(recurRows);
    XLSX.utils.book_append_sheet(workbook, recurSheet, "RECUR");
  }

  XLSX.writeFile(workbook, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

export async function exportComprehensiveTrackerToPDF(
  filename: string,
  bookings: ServiceBookingRow[],
  title = "Income, Labor & Sales Tracker Executive Report"
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const kpis = calculateExecutiveKpis(bookings);
  const breakdowns = calculateCategoryBreakdown(bookings);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // PAGE 1: Header + Executive KPI Dashboard
  doc.setFillColor(33, 75, 59); // Pristine Green
  doc.rect(0, 0, pageWidth, 24, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("PRISTINE CLEANERS", margin, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(title, margin, 18);

  const dateStr = `Period: July 2026 · Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`;
  doc.setFontSize(9);
  doc.text(dateStr, pageWidth - margin - doc.getTextWidth(dateStr), 15);

  // Top 6 Executive KPI Cards
  const cardY = 28;
  const numCards = 4;
  const cardWidth = (pageWidth - margin * 2 - (numCards - 1) * 4) / numCards;
  const cardHeight = 18;

  const topKpis = [
    { label: "TOTAL REVENUE", value: `$${kpis.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: `${kpis.totalBookings} Total Bookings` },
    { label: "GROSS PROFIT", value: `$${kpis.totalGrossProfit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: `${kpis.totalGrossProfitPct.toFixed(1)}% Overall Margin` },
    { label: "MONTHLY RECURRING (MRR)", value: `$${kpis.mrr.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: `${kpis.recurringRevenuePct.toFixed(1)}% of Revenue` },
    { label: "CLEANING LABOR", value: `$${kpis.totalGrossCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: `${kpis.totalCleanHours.toFixed(1)} Clean Hours` },
  ];

  topKpis.forEach((kpi, i) => {
    const x = margin + i * (cardWidth + 4);
    doc.setFillColor(245, 248, 246);
    doc.setDrawColor(210, 225, 218);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, "FD");

    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(kpi.label, x + 4, cardY + 5);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(kpi.value, x + 4, cardY + 11.5);

    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(kpi.sub, x + 4, cardY + 15.5);
  });

  // Table 1: Category Performance Matrix
  let tableY = 52;
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Performance Breakdown by Service & Recurrence", margin, tableY);
  tableY += 4;

  const colWidths = [45, 18, 22, 22, 26, 22, 26, 24, 22, 22];
  const catHeaders = ["Service Type", "Jobs", "Total Hrs", "Revenue", "Rev / Hr", "Labor Cost", "Cost / Hr", "Profit", "Profit %", "Labor %"];

  function drawCatHeader(y: number) {
    doc.setFillColor(235, 242, 238);
    doc.rect(margin, y, pageWidth - margin * 2, 7, "F");
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);

    let curX = margin + 2;
    catHeaders.forEach((h, idx) => {
      doc.text(h, curX, y + 4.8);
      curX += colWidths[idx];
    });
    doc.setDrawColor(200, 215, 208);
    doc.line(margin, y + 7, pageWidth - margin, y + 7);
  }

  drawCatHeader(tableY);
  tableY += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);

  breakdowns.forEach((b, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(250, 252, 251);
      doc.rect(margin, tableY, pageWidth - margin * 2, 6.5, "F");
    }

    let curX = margin + 2;
    const values = [
      b.category,
      `${b.totalBookings}`,
      `${b.totalCleanHours.toFixed(1)}`,
      `$${b.totalRevenue.toFixed(2)}`,
      `$${b.avgRevenuePerCleanHour.toFixed(2)}`,
      `$${b.totalGrossCost.toFixed(2)}`,
      `$${b.avgGrossCostPerCleanHour.toFixed(2)}`,
      `$${b.totalGrossProfit.toFixed(2)}`,
      `${(b.grossProfitPct * 100).toFixed(1)}%`,
      `${(b.laborPct * 100).toFixed(1)}%`,
    ];

    values.forEach((val, cIdx) => {
      if (cIdx === 7) {
        doc.setTextColor(b.totalGrossProfit >= 0 ? 34 : 220, b.totalGrossProfit >= 0 ? 139 : 38, b.totalGrossProfit >= 0 ? 34 : 38);
      } else if (cIdx === 8) {
        doc.setTextColor(34, 139, 34);
      } else {
        doc.setTextColor(30, 41, 59);
      }
      doc.text(val, curX, tableY + 4.5);
      curX += colWidths[cIdx];
    });

    tableY += 6.5;
  });

  // PAGE 2: Transactional Ledger
  doc.addPage();
  let ledgerY = 15;

  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Individual Job Ledger (July 2026 Master Transactions)", margin, ledgerY);
  ledgerY += 5;

  const ledgerCols = [22, 45, 35, 26, 32, 24, 24, 24, 18, 18];
  const ledgerHeaders = ["Date", "Client", "Service", "Frequency", "Cleaner / Team", "Sub-Total", "Labor Cost", "Profit", "Margin", "Hours"];

  function drawLedgerHeader(y: number) {
    doc.setFillColor(235, 242, 238);
    doc.rect(margin, y, pageWidth - margin * 2, 7, "F");
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);

    let curX = margin + 2;
    ledgerHeaders.forEach((h, idx) => {
      doc.text(h, curX, y + 4.8);
      curX += ledgerCols[idx];
    });
    doc.setDrawColor(200, 215, 208);
    doc.line(margin, y + 7, pageWidth - margin, y + 7);
  }

  drawLedgerHeader(ledgerY);
  ledgerY += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);

  bookings.forEach((b, idx) => {
    if (ledgerY > pageHeight - 15) {
      doc.addPage();
      ledgerY = 15;
      drawLedgerHeader(ledgerY);
      ledgerY += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
    }

    if (idx % 2 === 1) {
      doc.setFillColor(250, 252, 251);
      doc.rect(margin, ledgerY, pageWidth - margin * 2, 6.2, "F");
    }

    let curX = margin + 2;
    const values = [
      b.date,
      b.clientName.length > 22 ? `${b.clientName.substring(0, 21)}…` : b.clientName,
      b.service.length > 18 ? `${b.service.substring(0, 17)}…` : b.service,
      b.frequency,
      b.cleanerTeam.length > 16 ? `${b.cleanerTeam.substring(0, 15)}…` : b.cleanerTeam,
      `$${b.subTotal.toFixed(2)}`,
      `$${b.teamEarningsWithoutTips.toFixed(2)}`,
      `$${b.pcEarnings.toFixed(2)}`,
      `${(b.pcProfitPct * 100).toFixed(0)}%`,
      `${b.actualHours}h`,
    ];

    values.forEach((val, cIdx) => {
      if (cIdx === 7) {
        doc.setTextColor(b.pcEarnings >= 0 ? 34 : 220, b.pcEarnings >= 0 ? 139 : 38, b.pcEarnings >= 0 ? 34 : 38);
      } else {
        doc.setTextColor(30, 41, 59);
      }
      doc.text(val, curX, ledgerY + 4.2);
      curX += ledgerCols[cIdx];
    });

    ledgerY += 6.2;
  });

  // Footer / Page numbers
  const totalPages = (doc.internal as any).getNumberOfPages ? (doc.internal as any).getNumberOfPages() : 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7.5);
    doc.text(`Pristine Cleaners Confidential · July 2026 Sales & Labor Report · Page ${p} of ${totalPages}`, margin, pageHeight - 6);
  }

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

// Backward compatibility helper
export async function exportSalesTrackToXLSX(filename: string, items: SalesTrackItem[]) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const rows = items.map((item, idx) => ({
    "No.": idx + 1,
    "Client / Account": item.clientName,
    "City": item.city || "—",
    "Cleaner / Team": item.cleanerTeam || "Unassigned",
    "Frequency": item.serviceFrequency || "—",
    "Monthly Revenue ($)": item.monthlyRevenue,
    "Cleaner Cost ($)": item.cleanerCost,
    "Gross Profit ($)": item.grossProfit ?? (item.monthlyRevenue - item.cleanerCost),
    "Margin (%)": `${item.marginPct ?? 0}%`,
    "Status": item.status.toUpperCase(),
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, ws, "Sales Track");
  XLSX.writeFile(workbook, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

export async function exportSalesTrackToPDF(filename: string, items: SalesTrackItem[], title = "Sales Track Report") {
  // Convert SalesTrackItem to ServiceBookingRow
  const bookings: ServiceBookingRow[] = items.map((item, idx) => ({
    id: `item-${idx}`,
    date: new Date().toISOString().split("T")[0],
    clientName: item.clientName,
    service: "Commercial Cleaning",
    serviceCategory: "Commercial Cleaning",
    frequency: item.serviceFrequency || "Weekly",
    city: item.city || "Orange County",
    cleanerTeam: item.cleanerTeam || "Unassigned",
    subTotal: item.monthlyRevenue,
    salesTax: 0,
    finalAmount: item.monthlyRevenue,
    tip: 0,
    teamEarningsWithoutTips: item.cleanerCost,
    teamEarningsTotal: item.cleanerCost,
    laborPct: item.monthlyRevenue > 0 ? item.cleanerCost / item.monthlyRevenue : 0,
    merchantFee: 0,
    stripeFee: 0,
    pcEarnings: item.monthlyRevenue - item.cleanerCost,
    pcProfitPct: item.monthlyRevenue > 0 ? (item.monthlyRevenue - item.cleanerCost) / item.monthlyRevenue : 0,
    durationHours: typeof item.hoursPerVisit === "number" ? item.hoursPerVisit : 3,
    actualHours: typeof item.hoursPerVisit === "number" ? item.hoursPerVisit : 3,
    status: "completed",
  }));

  await exportComprehensiveTrackerToPDF(filename, bookings, title);
}
