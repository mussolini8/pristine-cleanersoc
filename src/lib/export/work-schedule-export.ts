import { PRISTINE_JANITORIAL_LOGO_BASE64 } from "./pristine-logo";

export interface WorkScheduleItem {
  id: string;
  date: string; // "YYYY-MM-DD"
  dateFormatted?: string; // "Thu, Oct 8, 2026"
  time: string; // "8:30 PM", "10:00 AM", or "Standard Hours"
  company: string; // "MOXI3 Costa Mesa"
  serviceType: "QC INSPECTION" | "FULL INSPECTION" | "SITE INSPECTION" | "COMMERCIAL CLEANING" | "RESIDENTIAL CLEANING" | string;
  category: "qc" | "cleaning";
  cleanerOrInspector: string;
  notes?: string;
}

export interface WorkScheduleMetric {
  label: string;
  value: number;
}

export interface WorkScheduleReport {
  employeeName: string;
  period: string; // e.g. "October 2026"
  role: string; // e.g. "Field Inspector / Quality Control" | "Commercial Cleaner"
  totalTasks: number;
  metrics: WorkScheduleMetric[];
  items: WorkScheduleItem[];
}

/**
 * Format a date string "YYYY-MM-DD" into "Thu, Oct 8, 2026"
 */
export function formatScheduleDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const [year, month, day] = dateStr.split("T")[0].split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Seed assignments for Maria Lopez (October 2026) matching the reference standard
 */
export const SEED_OCTOBER_2026_MARIA_LOPEZ_QC: WorkScheduleItem[] = [
  {
    id: "oct-26-01",
    date: "2026-10-08",
    dateFormatted: "Thu, Oct 8, 2026",
    time: "8:30 PM",
    company: "MOXI3 Costa Mesa",
    serviceType: "QC INSPECTION",
    category: "qc",
    cleanerOrInspector: "Maria Lopez",
  },
  {
    id: "oct-26-02",
    date: "2026-10-08",
    dateFormatted: "Thu, Oct 8, 2026",
    time: "Standard Hours",
    company: "13deMarzo",
    serviceType: "QC INSPECTION",
    category: "qc",
    cleanerOrInspector: "Maria Lopez",
  },
  {
    id: "oct-26-03",
    date: "2026-10-08",
    dateFormatted: "Thu, Oct 8, 2026",
    time: "Standard Hours",
    company: "Miraculous Milestones",
    serviceType: "QC INSPECTION",
    category: "qc",
    cleanerOrInspector: "Maria Lopez",
  },
  {
    id: "oct-26-04",
    date: "2026-10-09",
    dateFormatted: "Fri, Oct 9, 2026",
    time: "Standard Hours",
    company: "WREN",
    serviceType: "QC INSPECTION",
    category: "qc",
    cleanerOrInspector: "Maria Lopez",
  },
  {
    id: "oct-26-05",
    date: "2026-10-12",
    dateFormatted: "Mon, Oct 12, 2026",
    time: "10:00 AM",
    company: "SteriPax",
    serviceType: "QC INSPECTION",
    category: "qc",
    cleanerOrInspector: "Maria Lopez",
  },
  {
    id: "oct-26-06",
    date: "2026-10-12",
    dateFormatted: "Mon, Oct 12, 2026",
    time: "2:14 PM",
    company: "Posh Pooch",
    serviceType: "FULL INSPECTION",
    category: "qc",
    cleanerOrInspector: "Maria Lopez",
  },
  {
    id: "oct-26-07",
    date: "2026-10-12",
    dateFormatted: "Mon, Oct 12, 2026",
    time: "8:00 PM",
    company: "Lifted Dentistry",
    serviceType: "FULL INSPECTION",
    category: "qc",
    cleanerOrInspector: "Maria Lopez",
  },
  {
    id: "oct-26-08",
    date: "2026-10-13",
    dateFormatted: "Tue, Oct 13, 2026",
    time: "Standard Hours",
    company: "Elevate Aerial Huntington Beach",
    serviceType: "QC INSPECTION",
    category: "qc",
    cleanerOrInspector: "Maria Lopez",
  },
  {
    id: "oct-26-09",
    date: "2026-10-13",
    dateFormatted: "Tue, Oct 13, 2026",
    time: "Standard Hours",
    company: "GLO Bar MedSpa",
    serviceType: "QC INSPECTION",
    category: "qc",
    cleanerOrInspector: "Maria Lopez",
  },
  {
    id: "oct-26-10",
    date: "2026-10-13",
    dateFormatted: "Tue, Oct 13, 2026",
    time: "Standard Hours",
    company: "LSG Sky Chefs",
    serviceType: "QC INSPECTION",
    category: "qc",
    cleanerOrInspector: "Maria Lopez",
  },
  {
    id: "oct-26-11",
    date: "2026-10-14",
    dateFormatted: "Wed, Oct 14, 2026",
    time: "9:00 PM",
    company: "Cornerstone Southern California",
    serviceType: "QC INSPECTION",
    category: "qc",
    cleanerOrInspector: "Maria Lopez",
  },
  {
    id: "oct-26-12",
    date: "2026-10-14",
    dateFormatted: "Wed, Oct 14, 2026",
    time: "Standard Hours",
    company: '"The Harper" Wedgewood Venue',
    serviceType: "QC INSPECTION",
    category: "qc",
    cleanerOrInspector: "Maria Lopez",
  },
  {
    id: "oct-26-13",
    date: "2026-10-14",
    dateFormatted: "Wed, Oct 14, 2026",
    time: "Standard Hours",
    company: "Swing Easy Golf Club - Costa Mesa",
    serviceType: "QC INSPECTION",
    category: "qc",
    cleanerOrInspector: "Maria Lopez",
  },
  {
    id: "oct-26-14",
    date: "2026-10-15",
    dateFormatted: "Thu, Oct 15, 2026",
    time: "Standard Hours",
    company: "Swing Easy Golf Club - Yorba Linda",
    serviceType: "QC INSPECTION",
    category: "qc",
    cleanerOrInspector: "Maria Lopez",
  },
  {
    id: "oct-26-15",
    date: "2026-10-19",
    dateFormatted: "Mon, Oct 19, 2026",
    time: "Standard Hours",
    company: "MacArthur Dental Arts",
    serviceType: "QC INSPECTION",
    category: "qc",
    cleanerOrInspector: "Maria Lopez",
  },
  {
    id: "oct-26-16",
    date: "2026-10-21",
    dateFormatted: "Wed, Oct 21, 2026",
    time: "Standard Hours",
    company: "Interior Logic Group (Valencia Office)",
    serviceType: "QC INSPECTION",
    category: "qc",
    cleanerOrInspector: "Maria Lopez",
  },
  {
    id: "oct-26-17",
    date: "2026-10-21",
    dateFormatted: "Wed, Oct 21, 2026",
    time: "Standard Hours",
    company: "Interior Logic Group (Westlake Office)",
    serviceType: "QC INSPECTION",
    category: "qc",
    cleanerOrInspector: "Maria Lopez",
  },
  {
    id: "oct-26-18",
    date: "2026-10-27",
    dateFormatted: "Tue, Oct 27, 2026",
    time: "Standard Hours",
    company: "LSG Sky Chefs",
    serviceType: "QC INSPECTION",
    category: "qc",
    cleanerOrInspector: "Maria Lopez",
  },
];

/**
 * Builds standard WorkScheduleReport for a given dataset and config
 */
export function buildWorkScheduleReport(params: {
  employeeName: string;
  period: string; // e.g. "October 2026"
  role?: string;
  scope: "all" | "qc" | "cleaning";
  items: WorkScheduleItem[];
}): WorkScheduleReport {
  const { employeeName, period, scope, items } = params;

  let filtered = [...items];
  if (scope === "qc") {
    filtered = filtered.filter((i) => i.category === "qc");
  } else if (scope === "cleaning") {
    filtered = filtered.filter((i) => i.category === "cleaning");
  }

  // Sort items by date, then time
  filtered.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.time === "Standard Hours" && b.time !== "Standard Hours") return 1;
    if (a.time !== "Standard Hours" && b.time === "Standard Hours") return -1;
    return a.time.localeCompare(b.time);
  });

  const totalTasks = filtered.length;

  // Derive metrics
  let metrics: WorkScheduleMetric[] = [];
  if (scope === "qc") {
    const qcCount = filtered.filter((i) => i.serviceType.toUpperCase().includes("QC")).length;
    const siteOrFullCount = filtered.filter((i) => !i.serviceType.toUpperCase().includes("QC")).length;
    metrics = [
      { label: "TOTAL INSPECTIONS", value: totalTasks },
      { label: "QUALITY CONTROLS (QC)", value: qcCount },
      { label: "SITE INSPECTIONS", value: siteOrFullCount },
    ];
  } else if (scope === "cleaning") {
    const commCount = filtered.filter((i) => i.serviceType.toUpperCase().includes("COMMERCIAL")).length;
    const resCount = filtered.filter((i) => i.serviceType.toUpperCase().includes("RESIDENTIAL")).length;
    metrics = [
      { label: "TOTAL CLEANINGS", value: totalTasks },
      { label: "COMMERCIAL CLEANINGS", value: commCount },
      { label: "RESIDENTIAL CLEANINGS", value: resCount },
    ];
  } else {
    const qcCount = filtered.filter((i) => i.category === "qc").length;
    const cleaningsCount = filtered.filter((i) => i.category === "cleaning").length;
    metrics = [
      { label: "TOTAL ASSIGNMENTS", value: totalTasks },
      { label: "CLEANING SHIFTS", value: cleaningsCount },
      { label: "QC INSPECTIONS", value: qcCount },
    ];
  }

  // Determine role
  let role = params.role;
  if (!role) {
    if (scope === "qc" || employeeName.toLowerCase().includes("maria")) {
      role = "Field Inspector / Quality Control";
    } else {
      role = "Commercial & Residential Cleaner";
    }
  }

  return {
    employeeName,
    period,
    role,
    totalTasks,
    metrics,
    items: filtered,
  };
}

/**
 * Generate and download a pixel-perfect, crisp vector PDF of the Work Schedule
 */
export async function exportWorkScheduleToPDF(report: WorkScheduleReport, customFilename?: string): Promise<void> {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter", // 215.9 x 279.4 mm
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 187.9 mm

  // Columns specification
  const colDateWidth = 38;
  const colTimeWidth = 32;
  const colLocationWidth = 78;
  const colTypeWidth = 39.9; // 38 + 32 + 78 + 39.9 = 187.9

  const colDateX = margin;
  const colTimeX = colDateX + colDateWidth;
  const colLocationX = colTimeX + colTimeWidth;
  const colTypeX = colLocationX + colLocationWidth;

  const rowHeight = 9.2;
  const headerHeight = 8.5;
  const footerMargin = 15;

  let currentPage = 1;
  const totalPagesEstimate = Math.max(1, Math.ceil(Math.max(1, report.items.length - 18) / 25) + 1);

  // Helper to draw top running header on page 2+
  function drawRunningHeader(pageNum: number) {
    try {
      doc.addImage(PRISTINE_JANITORIAL_LOGO_BASE64, "PNG", margin, 7.5, 24, 7);
    } catch {}

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Work Schedule — ${report.employeeName}`, margin + 28, 12);
    doc.text(report.period, pageWidth - margin, 12, { align: "right" });

    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.3);
    doc.line(margin, 16, pageWidth - margin, 16);
  }

  // Helper to draw footer on any page
  function drawPageFooter(pageNum: number, totalPages: number) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("Pristine Janitorial · Operations & Quality Control", margin, pageHeight - 9);
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 9, { align: "right" });
  }

  // Helper to draw table header row
  function drawTableHeader(y: number) {
    doc.setFillColor(15, 23, 42); // slate-900 / #0f172a
    doc.rect(margin, y, contentWidth, headerHeight, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);

    const textY = y + 5.5;
    doc.text("DATE", colDateX + 4, textY);
    doc.text("TIME", colTimeX + 4, textY);
    doc.text("COMPANY / LOCATION", colLocationX + 4, textY);
    doc.text("SERVICE TYPE", colTypeX + 4, textY);
  }

  // ================= PAGE 1 =================
  // 1. Header Card Container
  const headerCardY = 13;
  const headerCardHeight = 24;

  // Blue vertical accent bar
  doc.setFillColor(37, 99, 235); // blue-600 #2563eb
  doc.roundedRect(margin, headerCardY, 3.5, headerCardHeight, 0.8, 0.8, "F");

  // Title: "Work Schedule"
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text("Work Schedule", margin + 6.5, headerCardY + 8.5);

  // Subtitle: "Employee: [Name]"
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(`Employee: ${report.employeeName}`, margin + 6.5, headerCardY + 17.5);

  // Pristine Janitorial Logo (top right)
  const logoWidth = 38; // mm
  const logoHeight = 11; // mm
  const logoX = pageWidth - margin - logoWidth;
  const logoY = headerCardY - 1.5;

  try {
    doc.addImage(PRISTINE_JANITORIAL_LOGO_BASE64, "PNG", logoX, logoY, logoWidth, logoHeight);
  } catch (e) {
    console.warn("Could not add logo to PDF:", e);
  }

  // Right Header info below logo
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Period: ${report.period}`, pageWidth - margin, headerCardY + 14.5, { align: "right" });

  doc.setFontSize(8.2);
  doc.text(`Role: ${report.role}`, pageWidth - margin, headerCardY + 19, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text(`Total Tasks: ${report.totalTasks} Assignments`, pageWidth - margin, headerCardY + 23.5, { align: "right" });

  // 2. Metrics Bar (3 Cards)
  const metricY = headerCardY + headerCardHeight + 5;
  const metricHeight = 16;
  const numMetrics = Math.max(1, report.metrics.length);
  const metricCardWidth = (contentWidth - (numMetrics - 1) * 3) / numMetrics;

  report.metrics.forEach((m, idx) => {
    const cardX = margin + idx * (metricCardWidth + 3);

    // Box
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.3);
    doc.roundedRect(cardX, metricY, metricCardWidth, metricHeight, 2, 2, "FD");

    // Big blue number
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(2, 132, 199); // sky-600 #0284c7
    doc.text(String(m.value), cardX + metricCardWidth / 2, metricY + 7.5, { align: "center" });

    // Label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(m.label, cardX + metricCardWidth / 2, metricY + 12.5, { align: "center" });
  });

  // 3. Table
  let currentY = metricY + metricHeight + 6;
  drawTableHeader(currentY);
  currentY += headerHeight;

  // Iterate rows
  report.items.forEach((item, index) => {
    // Check if row exceeds printable height on current page
    if (currentY + rowHeight > pageHeight - footerMargin) {
      doc.addPage();
      currentPage++;
      drawRunningHeader(currentPage);
      currentY = 19;
      drawTableHeader(currentY);
      currentY += headerHeight;
    }

    // Row background (alternating subtle tone or bottom border)
    const isEven = index % 2 === 1;
    if (isEven) {
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(margin, currentY, contentWidth, rowHeight, "F");
    }

    // Bottom border
    doc.setDrawColor(241, 245, 249); // slate-100
    doc.setLineWidth(0.2);
    doc.line(margin, currentY + rowHeight, pageWidth - margin, currentY + rowHeight);

    // Cell 1: DATE
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.8);
    doc.setTextColor(30, 41, 59); // slate-800
    const formattedDate = item.dateFormatted || formatScheduleDate(item.date);
    doc.text(formattedDate, colDateX + 4, currentY + 5.8);

    // Cell 2: TIME Pill badge
    const isStandard = !item.time || item.time.toLowerCase().includes("standard");
    const pillY = currentY + 1.8;
    const pillHeight = 5.2;

    if (!isStandard) {
      // Light blue pill for exact times (e.g. "8:30 PM", "10:00 AM")
      const pillWidth = 24;
      doc.setFillColor(219, 234, 254); // blue-100 #dbeafe
      doc.roundedRect(colTimeX + 3, pillY, pillWidth, pillHeight, 2, 2, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.8);
      doc.setTextColor(29, 78, 216); // blue-700 #1d4ed8
      doc.text(item.time, colTimeX + 3 + pillWidth / 2, pillY + 3.6, { align: "center" });
    } else {
      // Light slate pill for "Standard Hours"
      const pillWidth = 25;
      doc.setFillColor(241, 245, 249); // slate-100 #f1f5f9
      doc.roundedRect(colTimeX + 3, pillY, pillWidth, pillHeight, 2, 2, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.2);
      doc.setTextColor(71, 85, 105); // slate-600 #475569
      doc.text("Standard Hours", colTimeX + 3 + pillWidth / 2, pillY + 3.6, { align: "center" });
    }

    // Cell 3: COMPANY / LOCATION
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    doc.setTextColor(15, 23, 42); // slate-900

    // Truncate if company name is too long for the column
    let companyName = item.company;
    if (doc.getTextWidth(companyName) > colLocationWidth - 8) {
      while (companyName.length > 5 && doc.getTextWidth(companyName + "...") > colLocationWidth - 8) {
        companyName = companyName.slice(0, -1);
      }
      companyName += "...";
    }
    doc.text(companyName, colLocationX + 4, currentY + 5.8);

    // Cell 4: SERVICE TYPE Pill badge
    const upperType = (item.serviceType || "QC INSPECTION").toUpperCase();
    const typePillWidth = 33;
    const typePillX = colTypeX + 3;

    if (upperType.includes("FULL") || upperType.includes("SITE")) {
      // Pink / Rose pill
      doc.setFillColor(255, 228, 230); // rose-100 #ffe4e6
      doc.roundedRect(typePillX, pillY, typePillWidth, pillHeight, 2, 2, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.2);
      doc.setTextColor(159, 18, 57); // rose-800 #9f1239
      doc.text(upperType.includes("FULL") ? "FULL INSPECTION" : "SITE INSPECTION", typePillX + typePillWidth / 2, pillY + 3.6, { align: "center" });
    } else if (upperType.includes("QC")) {
      // Amber / Orange pill
      doc.setFillColor(254, 243, 199); // amber-100 #fef3c7
      doc.roundedRect(typePillX, pillY, typePillWidth, pillHeight, 2, 2, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.2);
      doc.setTextColor(146, 64, 14); // amber-800 #92400e
      doc.text("QC INSPECTION", typePillX + typePillWidth / 2, pillY + 3.6, { align: "center" });
    } else if (upperType.includes("COMMERCIAL")) {
      // Emerald pill
      doc.setFillColor(209, 250, 229); // emerald-100 #d1fae5
      doc.roundedRect(typePillX, pillY, typePillWidth, pillHeight, 2, 2, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(6, 95, 70); // emerald-800 #065f46
      doc.text("COMMERCIAL CLEANING", typePillX + typePillWidth / 2, pillY + 3.6, { align: "center" });
    } else if (upperType.includes("RESIDENTIAL")) {
      // Sky pill
      doc.setFillColor(224, 242, 254); // sky-100 #e0f2fe
      doc.roundedRect(typePillX, pillY, typePillWidth, pillHeight, 2, 2, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(7, 89, 133); // sky-800 #075985
      doc.text("RESIDENTIAL CLEANING", typePillX + typePillWidth / 2, pillY + 3.6, { align: "center" });
    } else {
      // Default gray pill
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(typePillX, pillY, typePillWidth, pillHeight, 2, 2, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.2);
      doc.setTextColor(71, 85, 105);
      doc.text(upperType.slice(0, 16), typePillX + typePillWidth / 2, pillY + 3.6, { align: "center" });
    }

    currentY += rowHeight;
  });

  // Draw footers on all pages with accurate total page count
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawPageFooter(i, totalPages);
  }

  // Clean filename
  const safeName = report.employeeName.replace(/[^a-zA-Z0-9]+/g, "_");
  const safePeriod = report.period.replace(/[^a-zA-Z0-9]+/g, "_");
  const filename = customFilename || `Work_Schedule_${safeName}_${safePeriod}.pdf`;

  doc.save(filename);
}
