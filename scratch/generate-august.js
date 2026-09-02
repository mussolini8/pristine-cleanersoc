const fs = require("fs");
const path = require("path");
const { importedCommercialAccounts } = require("../src/lib/commercial-accounts-data.ts");

// 1. Read scratch/bookings.csv
const csvPath = path.join(process.cwd(), "scratch/bookings.csv");
const lines = fs.readFileSync(csvPath, "utf8").trim().split("\n");
const headers = lines[0].split(",");

function parseDuration(s) {
  if (!s || s === "0:00") return 0;
  const [h, m] = s.split(":").map(Number);
  return (h || 0) + (m || 0) / 60;
}

function mapCategory(service, freq) {
  if (service === "Commercial Cleaning") return "Commercial Cleaning";
  if (service === "Move In/Out Clean") return "Move In/Out Clean";
  if (service === "Deep Clean") return "Deep Clean";
  if (freq === "Weekly") return "Weekly";
  if (freq === "Every Other Week") return "Biweekly";
  if (freq === "Every 3 Weeks") return "Triweekly";
  if (freq === "Monthly") return "Monthly";
  return "Standard Clean";
}

function cleanerName(raw) {
  if (!raw || raw === "Unassigned") return "Unassigned";
  return raw.replace(/^\d+:\s*/, "").trim();
}

function parseCSVLine(line) {
  let inQuotes = false;
  let val = "";
  const cols = [];
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "\"") inQuotes = !inQuotes;
    else if (c === "," && !inQuotes) {
      cols.push(val);
      val = "";
    } else val += c;
  }
  cols.push(val);
  return cols;
}

const residentialEntries = [];

for (let i = 1; i < lines.length; i++) {
  const cols = parseCSVLine(lines[i]);
  const entry = {};
  headers.forEach((h, idx) => {
    entry[h.trim()] = cols[idx] ? cols[idx].trim() : "";
  });

  const client = entry["Full name"] || "";
  const service = entry["Service"] || "";
  const isComm =
    service.includes("Commercial") ||
    client.includes("Sierra Analytical") ||
    client.includes("Renewable") ||
    client.includes("Catherine Maller");

  if (!isComm) {
    const [m, d, y] = entry.Date.split("/");
    const isoDate = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    const dur = parseDuration(entry["Estimated job length (HH:MM)"]);
    const subTotal = parseFloat(entry["Service total (USD)"]) || 0;
    const processingFee = parseFloat(entry["Processing Fee"]) || 0;
    const teamEarnings = parseFloat(entry["Provider/team payment (USD)"]) || 0;
    const tip = parseFloat(entry["Tip (USD)"]) || 0;
    const category = mapCategory(entry["Service"], entry["Frequency"]);
    const frequency = entry["Frequency"] === "One-Time" ? "One Time" : entry["Frequency"];
    const cleaner = cleanerName(entry["Provider/team"]);
    const bookedBy = entry["Frequency"] === "One-Time" ? "Online Booking" : "Subscription";

    residentialEntries.push(`  // ${entry.Date} — ${client} — ${category}
  computeBookingFormulas({
    id: "aug-${entry["Booking id"]}",
    date: "${isoDate}",
    clientName: ${JSON.stringify(client)},
    service: ${JSON.stringify(service)},
    serviceCategory: ${JSON.stringify(category)},
    frequency: ${JSON.stringify(frequency)},
    city: ${JSON.stringify(entry["City"] || "Orange County")},
    cleanerTeam: ${JSON.stringify(cleaner)},
    subTotal: ${subTotal},
    salesTax: 0,
    processingFee: ${processingFee},
    tip: ${tip},
    teamEarningsWithoutTips: ${teamEarnings},
    merchantFee: 0,
    stripeFee: 0,
    durationHours: ${dur},
    actualHours: ${dur},
    bookedBy: "${bookedBy}",
    status: "completed",
  }),`);
  }
}

// 2. Build 31 commercial contracts
const dowCounts = [5, 5, 4, 4, 4, 4, 5]; // Sun..Sat in August 2026

const commercialEntries = importedCommercialAccounts.map((acc) => {
  let monthlyHours = 0;
  let visits = 0;
  let scheduleDesc = "";

  if (acc.name === "The Harper Wedding Venue") {
    visits = 13;
    monthlyHours = 13 * 5.0;
    scheduleDesc = "13 eventos en agosto ($90 por evento a Juan Romero | Turno 12 AM - 7 AM)";
  } else if (acc.schedule_rules && acc.schedule_rules.length > 0) {
    scheduleDesc = acc.schedule_rules.map((r) => r.notes || `Día ${r.day_of_week}`).join("; ");
    acc.schedule_rules.forEach((rule) => {
      const times = dowCounts[rule.day_of_week] || 4;
      if (acc.frequency && acc.frequency.includes("14 days")) {
        visits += 2;
        monthlyHours += rule.paid_hours * 2;
      } else if (acc.frequency && (acc.frequency.includes("month") || acc.frequency.includes("Monthly"))) {
        visits += 1;
        monthlyHours += rule.paid_hours * 1;
      } else if (acc.frequency && acc.frequency.includes("21 days")) {
        visits += 1.5;
        monthlyHours += rule.paid_hours * 1.5;
      } else if (acc.frequency && acc.frequency.includes("2nd & 4th")) {
        visits += 2;
        monthlyHours += rule.paid_hours * 2;
      } else {
        visits += times;
        monthlyHours += rule.paid_hours * times;
      }
    });
  } else {
    monthlyHours = (acc.hours || 3) * 4;
    visits = 4;
    scheduleDesc = acc.frequency || "Mensual";
  }

  const durationHours = Math.round(monthlyHours * 10) / 10;
  const safeId = "comm-aug-" + acc.id.replace(/^import-/, "").replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();

  return `  // Contrato Comercial: ${acc.name} (${acc.cleaner_name}) — ${acc.frequency}
  computeBookingFormulas({
    id: ${JSON.stringify(safeId)},
    date: "2026-08-31",
    clientName: ${JSON.stringify(acc.name)},
    service: "Commercial Cleaning",
    serviceCategory: "Commercial Cleaning",
    frequency: ${JSON.stringify(acc.frequency || "Monthly")},
    city: ${JSON.stringify(acc.city || "Orange County")},
    cleanerTeam: ${JSON.stringify(acc.cleaner_name || "Unassigned")},
    subTotal: ${Number(acc.revenue) || 0},
    salesTax: 0,
    processingFee: 0,
    tip: 0,
    teamEarningsWithoutTips: ${Number(acc.cost) || 0},
    merchantFee: 0,
    stripeFee: 0,
    durationHours: ${durationHours},
    actualHours: ${durationHours},
    bookedBy: "Commercial Contract",
    status: "completed",
    notes: ${JSON.stringify(`${visits} visitas en agosto (${acc.cleaner_name}). Horario: ${scheduleDesc}`)},
  }),`;
});

const fileOutput = `import { computeBookingFormulas } from "./calculator";
import type { ServiceBookingRow } from "./types";

/**
 * AGOSTO 2026 (CERRADO Y AUDITADO):
 * 1. Residencial: 55 servicios individuales extraídos del archivo oficial Booking Koala.
 * 2. Comercial: 31 cuentas y contratos comerciales activos extraídos de las capturas con horarios, frecuencias y tarifas exactas de CleanGuru.
 * TOTAL UNIFICADO: 86 registros (55 BK Residencial + 31 Contratos Comerciales).
 */

export const augustResidentialBookings: ServiceBookingRow[] = [
${residentialEntries.join("\n")}
];

export const augustCommercialBookings: ServiceBookingRow[] = [
${commercialEntries.join("\n")}
];

export const augustSalesTrackerBookings: ServiceBookingRow[] = [
  ...augustResidentialBookings,
  ...augustCommercialBookings,
];
`;

fs.writeFileSync(path.join(process.cwd(), "src/lib/sales-tracker/seed-data-august-2026.ts"), fileOutput, "utf8");
console.log(`Successfully generated seed-data-august-2026.ts:`);
console.log(`- ${residentialEntries.length} Residential Bookings (Booking Koala)`);
console.log(`- ${commercialEntries.length} Commercial Contract Accounts`);
console.log(`- Total: ${residentialEntries.length + commercialEntries.length} records`);
