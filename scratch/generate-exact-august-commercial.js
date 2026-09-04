const fs = require("fs");
const path = require("path");

// 1. Read scratch/bookings.csv for residential bookings
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

    residentialEntries.push({
      date: isoDate,
      code: `  // ${entry.Date} — ${client} — ${category}
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
  }),`
    });
  }
}

// 2. Commercial Accounts Exact Visits Generator
const { importedCommercialAccounts, importedCommercialEventEntries } = require("../src/lib/commercial-accounts-data.ts");

function getDow(day) {
  return new Date(Date.UTC(2026, 7, day, 12, 0, 0)).getUTCDay();
}

const commercialEntries = [];

importedCommercialAccounts.forEach((acc) => {
  // Special case: The Harper Wedding Venue (13 specific events from importedCommercialEventEntries)
  if (acc.name === "The Harper Wedding Venue") {
    const events = importedCommercialEventEntries.filter(
      (e) => e.account_name === acc.name && e.work_date.startsWith("2026-08")
    );
    events.forEach((ev, idx) => {
      const visitNum = String(idx + 1).padStart(2, "0");
      commercialEntries.push({
        date: ev.work_date,
        code: `  // The Harper Wedding Venue — Evento #${idx + 1} (${ev.work_date})
  computeBookingFormulas({
    id: "comm-aug-the-harper-${visitNum}",
    date: "${ev.work_date}",
    clientName: "The Harper Wedding Venue",
    service: "Commercial Cleaning",
    serviceCategory: "Commercial Cleaning",
    frequency: "As needed (Events)",
    city: "Costa Mesa",
    cleanerTeam: ${JSON.stringify(ev.cleaner_name)},
    subTotal: 230,
    salesTax: 0,
    processingFee: 0,
    tip: 0,
    teamEarningsWithoutTips: 90,
    merchantFee: 0,
    stripeFee: 0,
    durationHours: ${ev.hours},
    actualHours: ${ev.hours},
    bookedBy: "Commercial Contract",
    status: "completed",
    notes: ${JSON.stringify(`Evento #${idx + 1} en agosto (Turno 12 AM - 7 AM | $90 cleaner pay)`)}
  }),`
      });
    });
    return;
  }

  // Special case: Green Leaf Botanicals (Monthly service on 2026-08-17)
  if (acc.name.includes("Green Leaf")) {
    commercialEntries.push({
      date: "2026-08-17",
      code: `  // Green Leaf Botanicals — Servicio Mensual (2026-08-17)
  computeBookingFormulas({
    id: "comm-aug-green-leaf-01",
    date: "2026-08-17",
    clientName: "Green Leaf Botanicals",
    service: "Commercial Cleaning",
    serviceCategory: "Commercial Cleaning",
    frequency: "Monthly",
    city: ${JSON.stringify(acc.city || "Whittier")},
    cleanerTeam: ${JSON.stringify(acc.cleaner_name || "Lorena Benitez")},
    subTotal: ${acc.revenue},
    salesTax: 0,
    processingFee: 0,
    tip: 0,
    teamEarningsWithoutTips: ${acc.cost},
    merchantFee: 0,
    stripeFee: 0,
    durationHours: 2,
    actualHours: 2,
    bookedBy: "Commercial Contract",
    status: "completed",
    notes: "Servicio mensual regular Whittier (Lorena Benitez). $119.00 labor per service"
  }),`
    });
    return;
  }

  // Special case: University Park Dental (2 visits in August: Aug 10 and Aug 24)
  if (acc.name.includes("University Park Dental")) {
    ["2026-08-10", "2026-08-24"].forEach((vDate, idx) => {
      commercialEntries.push({
        date: vDate,
        code: `  // University Park Dental — Visita ${idx + 1}/2 (${vDate})
  computeBookingFormulas({
    id: "comm-aug-university-park-dental-0${idx + 1}",
    date: "${vDate}",
    clientName: "University Park Dental",
    service: "Commercial Cleaning",
    serviceCategory: "Commercial Cleaning",
    frequency: "Every 2 weeks",
    city: "Irvine",
    cleanerTeam: "Unassigned",
    subTotal: 162.5,
    salesTax: 0,
    processingFee: 0,
    tip: 0,
    teamEarningsWithoutTips: 51.75,
    merchantFee: 0,
    stripeFee: 0,
    durationHours: 2.25,
    actualHours: 2.25,
    bookedBy: "Commercial Contract",
    status: "completed",
    notes: "Visita ${idx + 1} de 2 en agosto (Unassigned). Every 14 days ($51.75 labor per service)",
  }),`
      });
    });
    return;
  }

  // Special case: LA Model Unit Cleaning
  if (acc.name.includes("LA Model")) {
    commercialEntries.push({
      date: "2026-08-11",
      code: `  // LA Model Unit Cleaning (2026-08-11)
  computeBookingFormulas({
    id: "comm-aug-la-model-01",
    date: "2026-08-11",
    clientName: "LA Model Unit Cleaning",
    service: "Commercial Cleaning",
    serviceCategory: "Commercial Cleaning",
    frequency: "As needed (Events)",
    city: "Los Angeles",
    cleanerTeam: "Sandra Hernandez",
    subTotal: 340,
    salesTax: 0,
    processingFee: 0,
    tip: 0,
    teamEarningsWithoutTips: 170,
    merchantFee: 0,
    stripeFee: 0,
    durationHours: 3,
    actualHours: 3,
    bookedBy: "Commercial Contract",
    status: "completed",
    notes: "Event clean (Sandra Hernandez). $170.00 labor amount per service",
  }),`
    });
    return;
  }

  // Special case: Renewable Farms
  if (acc.name.includes("Renewable Farms")) {
    ["2026-08-08", "2026-08-22"].forEach((vDate, idx) => {
      commercialEntries.push({
        date: vDate,
        code: `  // Renewable Farms — Evento #${idx + 1} (${vDate})
  computeBookingFormulas({
    id: "comm-aug-renewable-farms-0${idx + 1}",
    date: "${vDate}",
    clientName: "Renewable Farms",
    service: "Commercial Cleaning",
    serviceCategory: "Commercial Cleaning",
    frequency: "As needed",
    city: "Aliso Viejo",
    cleanerTeam: "Ana Morales",
    subTotal: 360,
    salesTax: 0,
    processingFee: 0,
    tip: 0,
    teamEarningsWithoutTips: 69,
    merchantFee: 0,
    stripeFee: 0,
    durationHours: 3,
    actualHours: 3,
    bookedBy: "Commercial Contract",
    status: "completed",
    notes: "Event clean (Ana Morales). $69.00 labor amount per service",
  }),`
      });
    });
    return;
  }

  // Skip as-needed accounts without August occurrences
  if (acc.name.includes("Revive Real Estate") || acc.name.includes("Flex Fitness")) {
    return;
  }

  // Expand all recurring schedule rules across August 1..31
  const visits = [];
  for (let d = 1; d <= 31; d++) {
    const dateStr = `2026-08-${String(d).padStart(2, "0")}`;
    const dow = getDow(d);

    for (const rule of (acc.schedule_rules || [])) {
      if (rule.day_of_week !== dow) continue;

      if (rule.effective_start_date && dateStr < rule.effective_start_date) continue;
      if (rule.effective_end_date && dateStr > rule.effective_end_date) continue;
      if (rule.effective_until && dateStr > rule.effective_until) continue;

      if (rule.frequency_type === "biweekly") {
        if (rule.anchor_date) {
          const anchor = new Date(rule.anchor_date + "T12:00:00Z");
          const cur = new Date(dateStr + "T12:00:00Z");
          const diffDays = Math.round((cur - anchor) / (1000 * 60 * 60 * 24));
          const diffWeeks = Math.floor(diffDays / 7);
          if (diffWeeks % 2 !== 0) continue;
        }
      } else if (rule.frequency_type === "every_3_weeks") {
        if (rule.anchor_date) {
          const anchor = new Date(rule.anchor_date + "T12:00:00Z");
          const cur = new Date(dateStr + "T12:00:00Z");
          const diffDays = Math.round((cur - anchor) / (1000 * 60 * 60 * 24));
          const diffWeeks = Math.floor(diffDays / 7);
          if (diffWeeks % 3 !== 0) continue;
        }
      } else if (rule.frequency_type === "monthly") {
        if (acc.name.includes("Posh Pooch")) {
          // 2nd Monday = Aug 10
          if (d !== 10) continue;
        } else if (acc.name.includes("Orange County Spine")) {
          // 2nd & 4th Saturday = Aug 8 and Aug 22
          if (d !== 8 && d !== 22) continue;
        }
      }

      visits.push({
        date: dateStr,
        hours: rule.paid_hours,
        cleaner: rule.assigned_cleaner_name || acc.cleaner_name || "Unassigned",
        notes: rule.notes || ""
      });
    }
  }

  const count = visits.length;
  if (count === 0) {
    console.error(`ERROR: Zero visits generated for ${acc.name}!`);
    return;
  }

  const totalRev = Number(acc.revenue) || 0;
  const totalCost = Number(acc.cost) || 0;
  const revPerVisit = Math.round((totalRev / count) * 100) / 100;
  const costPerVisit = Math.round((totalCost / count) * 100) / 100;
  const safeSlug = acc.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  visits.forEach((v, idx) => {
    const isLast = idx === count - 1;
    const subTotal = isLast ? Math.round((totalRev - revPerVisit * (count - 1)) * 100) / 100 : revPerVisit;
    const laborCost = isLast ? Math.round((totalCost - costPerVisit * (count - 1)) * 100) / 100 : costPerVisit;
    const visitNum = String(idx + 1).padStart(2, "0");

    commercialEntries.push({
      date: v.date,
      code: `  // ${acc.name} — Visita ${idx + 1}/${count} (${v.date})
  computeBookingFormulas({
    id: "comm-aug-${safeSlug}-${visitNum}",
    date: "${v.date}",
    clientName: ${JSON.stringify(acc.name)},
    service: "Commercial Cleaning",
    serviceCategory: "Commercial Cleaning",
    frequency: ${JSON.stringify(acc.frequency || "Monthly")},
    city: ${JSON.stringify(acc.city || "Orange County")},
    cleanerTeam: ${JSON.stringify(v.cleaner)},
    subTotal: ${subTotal},
    salesTax: 0,
    processingFee: 0,
    tip: 0,
    teamEarningsWithoutTips: ${laborCost},
    merchantFee: 0,
    stripeFee: 0,
    durationHours: ${v.hours},
    actualHours: ${v.hours},
    bookedBy: "Commercial Contract",
    status: "completed",
    notes: ${JSON.stringify(`Visita ${idx + 1} de ${count} en agosto (${v.cleaner}). ${v.notes}`.trim())},
  }),`
    });
  });
});

// Sort all entries chronologically by date
const allEntries = [...residentialEntries, ...commercialEntries].sort((a, b) => a.date.localeCompare(b.date));

const fileOutput = `import { computeBookingFormulas } from "./calculator";
import type { ServiceBookingRow } from "./types";

/**
 * AGOSTO 2026 (CERRADO, AUDITADO Y DISTRIBUIDO POR FECHA EXACTA DE VISITA):
 * 1. Residencial: 55 servicios individuales extraídos del archivo oficial Booking Koala.
 * 2. Comercial: ${commercialEntries.length} visitas individuales distribuidas en sus fechas exactas de agosto (1 al 31)
 *    según los horarios de CleanGuru y acuerdos operativos de las 31 cuentas comerciales activas.
 * TOTAL UNIFICADO: ${allEntries.length} servicios registrados en agosto 2026.
 */

export const augustResidentialBookings: ServiceBookingRow[] = [
${residentialEntries.map((e) => e.code).join("\n")}
];

export const augustCommercialBookings: ServiceBookingRow[] = [
${commercialEntries.map((e) => e.code).join("\n")}
];

export const augustSalesTrackerBookings: ServiceBookingRow[] = [
${allEntries.map((e) => e.code).join("\n")}
];
`;

const destPath = path.join(process.cwd(), "src/lib/sales-tracker/seed-data-august-2026.ts");
fs.writeFileSync(destPath, fileOutput, "utf8");

console.log("Successfully generated src/lib/sales-tracker/seed-data-august-2026.ts!");
console.log(`- Residential: ${residentialEntries.length} bookings`);
console.log(`- Commercial: ${commercialEntries.length} individual visits across August (2026-08-01 to 2026-08-31)`);
console.log(`- Total: ${allEntries.length} bookings`);
