import { computeBookingFormulas, calculateExecutiveKpis, isCommercialBooking } from "./calculator";
import type { ExecutiveKpis, ServiceBookingRow, ServiceCategory } from "./types";
import { importedCommercialAccounts, type ImportedCommercialAccount } from "../commercial-accounts-data";
import { octoberResidentialBookings, OCTOBER_2026_KNOWN_BK_IDS } from "./seed-data-october-2026";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MonthInfo = {
  key: string; // "2026-10"
  year: number; // 2026
  month: number; // 10
  label: string; // "October 2026" or "Octubre 2026"
  shortLabel: string; // "Oct 2026"
  labelEn: string; // "October 2026"
  shortLabelEn: string; // "Oct 2026"
  labelEs: string; // "Octubre 2026"
  shortLabelEs: string; // "Oct 2026"
  startDate: string; // "2026-10-01"
  endDate: string; // "2026-10-31"
  daysInMonth: number; // 31
};

export const MONTH_NAMES_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const MONTH_NAMES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export const TRACKER_CACHE_PREFIX = "pristine_sales_tracker_v2_";
export const TRACKER_OVERRIDES_PREFIX = "pristine_sales_tracker_overrides_";

export const ALL_TRACKER_CLEANERS = [
  "Mayra Lopez",
  "Maria Lopez",
  "Miriam Lopez",
  "Sofia Diaz",
  "Lorena Benitez",
  "Rosa Calderon",
  "Juan Romero",
  "Maria Tolentino",
  "Jasmine Cardenas",
  "Gabriel Cardenas",
  "Blanca Garcia",
  "Ana Morales",
  "Luz Uribe",
  "Maria Mejia",
  "José Vazquez",
  "Lucia Portillo",
  "Sandra Hernandez",
  "Kassandra Valentin",
  "Emmi Guerra",
  "Martha Garcia",
  "Ivanda Mejia",
  "Veronica Ladinos",
  "Carlos Lopez",
  "Unassigned",
];

export type BookingOverride = {
  key: string;
  cleanerTeam: string;
  teamEarningsWithoutTips: number;
  subTotal?: number;
  updatedAt: string;
};

export function extractBookingKoalaId(row: ServiceBookingRow): string {
  const m = row.notes?.match(/BookingKoala ID:\s*([^;]+)/i);
  if (m && m[1]) return m[1].trim();
  return row.id.replace(/^(oct-|sep-|aug-|20\d{2}-\d{2}-res-)/, "");
}

export function getStoredBookingOverrides(monthKey: string): Record<string, BookingOverride> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`${TRACKER_OVERRIDES_PREFIX}${monthKey}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function applyBookingOverrides(
  rows: ServiceBookingRow[],
  monthKey: string
): ServiceBookingRow[] {
  const overrides = getStoredBookingOverrides(monthKey);
  if (Object.keys(overrides).length === 0) return rows;

  return rows.map((row) => {
    const bkId = extractBookingKoalaId(row);
    const ov = overrides[bkId] || overrides[row.id];
    if (!ov) return row;

    return computeBookingFormulas({
      ...row,
      cleanerTeam: ov.cleanerTeam,
      teamEarningsWithoutTips: ov.teamEarningsWithoutTips,
      subTotal: ov.subTotal !== undefined ? ov.subTotal : row.subTotal,
    });
  });
}

export function getMonthInfo(monthKey: string, lang: "en" | "es" = "en"): MonthInfo {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const daysInMonth = new Date(year, month, 0).getDate();
  const startDate = `${yearStr}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${yearStr}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  const labelEn = `${MONTH_NAMES_EN[month - 1]} ${year}`;
  const shortLabelEn = `${MONTH_NAMES_EN[month - 1].slice(0, 3)} ${year}`;
  const labelEs = `${MONTH_NAMES_ES[month - 1]} ${year}`;
  const shortLabelEs = `${MONTH_NAMES_ES[month - 1].slice(0, 3)} ${year}`;
  const label = lang === "es" ? labelEs : labelEn;
  const shortLabel = lang === "es" ? shortLabelEs : shortLabelEn;

  return {
    key: monthKey,
    year,
    month,
    label,
    shortLabel,
    labelEn,
    shortLabelEn,
    labelEs,
    shortLabelEs,
    startDate,
    endDate,
    daysInMonth,
  };
}

export function getCurrentMonthKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function isAccountActiveInMonth(account: ImportedCommercialAccount, monthKey: string): boolean {
  const norm = (account.name || "").toLowerCase();

  // Field AI terminó contrato el 31 de agosto de 2026 (inactiva a partir de sept 2026)
  if (norm.includes("field ai") && monthKey >= "2026-09") return false;

  // Mama's Restaurant HB y Los Alamitos terminaron contrato el 30 de septiembre de 2026 (inactivas a partir de oct 2026)
  if (norm.includes("mama") && monthKey >= "2026-10") return false;

  const { startDate, endDate } = getMonthInfo(monthKey);
  if (account.contract_end && account.contract_end < startDate) return false;
  if (account.contract_start && account.contract_start > endDate) return false;

  return true;
}

function diffDaysUtc(dateA: string, dateB: string): number {
  const a = new Date(`${dateA}T12:00:00Z`).getTime();
  const b = new Date(`${dateB}T12:00:00Z`).getTime();
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}

function isNthWeekdayOfMonth(dayOfMonth: number, nth: number): boolean {
  return Math.ceil(dayOfMonth / 7) === nth;
}

/**
 * Genera automáticamente las visitas comerciales para cualquier mes dado (YYYY-MM),
 * aplicando estrictamente las reglas salariales y frecuencias reales de Pristine Cleaners.
 */
export function generateMonthlyCommercialBookings(monthKey: string): ServiceBookingRow[] {
  const { year, month, daysInMonth } = getMonthInfo(monthKey);
  const activeAccounts = importedCommercialAccounts.filter((a) => isAccountActiveInMonth(a, monthKey));
  const bookings: ServiceBookingRow[] = [];

  for (const account of activeAccounts) {
    const norm = (account.name || "").toLowerCase();
    const rules = account.schedule_rules || [];
    const monthlyRev = account.revenue || 0;
    const monthlyCost = account.cost || 0;
    const city = account.city || "Orange County";
    const service = "Commercial Cleaning";
    const serviceCategory = "Commercial Cleaning";
    const frequency = account.frequency || "Monthly";

    const visits: { date: string; dow: number; cleaner: string; hours: number; visitRev?: number; visitCost?: number }[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, "0");
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${dayStr}`;
      const dt = new Date(`${dateStr}T12:00:00Z`);
      const dow = dt.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

      if (norm.includes("lsg sky chefs")) {
        // Daily visits (7x per week: 10h base + 4h add-on = 14h/day; 18h on Oct 20, 23, 24 with Maria Mejia exception)
        let cleaner = "Maria Mejia & Luz Uribe";
        let hrs = 14;
        if (dow === 2 || dow === 5 || dow === 6) {
          if (monthKey === "2026-10" && (day === 20 || day === 23 || day === 24)) {
            cleaner = "Luz Uribe, José Vazquez & Maria Mejia";
            hrs = 18;
          } else if (monthKey > "2026-10" || (monthKey === "2026-10" && day >= 10)) {
            cleaner = "Luz Uribe & José Vazquez";
          } else {
            cleaner = "Luz Uribe";
          }
        }
        visits.push({ date: dateStr, dow, cleaner, hours: hrs });
      } else if (norm.includes("steripax")) {
        // 5x per week (Monday to Friday)
        // Facturación cliente: $35/hr x horas de la jornada
        // Jornada nominal de Lucía Portillo: Lun, Mar, Vie 6h exactas ($108.00); Mié, Jue 8h exactas ($144.00) a $18/hr
        if (dow >= 1 && dow <= 5) {
          const hrs = (dow === 3 || dow === 4) ? 8 : 6;
          visits.push({
            date: dateStr,
            dow,
            cleaner: "Lucia Portillo",
            hours: hrs,
            visitRev: hrs * 35,
            visitCost: hrs * 18,
          });
        }
      } else if (norm.includes("corporate headquarters") || norm.includes("rancho bernardo")) {
        // ILG Corporate Headquarters (San Diego / Rancho Bernardo):
        if (monthKey === "2026-10") {
          if (day === 16) visits.push({ date: dateStr, dow, cleaner: "Ivanda Mejia", hours: 8, visitCost: 144 });
          else if (day === 19) visits.push({ date: dateStr, dow, cleaner: "Ivanda Mejia", hours: 4, visitCost: 72 });
          else if (day === 21) visits.push({ date: dateStr, dow, cleaner: "Ivanda Mejia", hours: 4, visitCost: 72 });
          else if (day === 25) visits.push({ date: dateStr, dow, cleaner: "Martha Garcia", hours: 8, visitCost: 144 });
          else if (day === 26) visits.push({ date: dateStr, dow, cleaner: "Martha Garcia", hours: 4, visitCost: 72 });
          else if (day === 28) visits.push({ date: dateStr, dow, cleaner: "Martha Garcia", hours: 4, visitCost: 72 });
          else if (day === 30) visits.push({ date: dateStr, dow, cleaner: "Martha Garcia", hours: 8, visitCost: 144 });
          else if (dow === 1 || dow === 3 || dow === 5) {
            const earlierCost = day === 14 ? 17.65 : 17.67;
            visits.push({ date: dateStr, dow, cleaner: "Martha Garcia", hours: 4, visitCost: earlierCost });
          }
        } else {
          // Regular schedule: Mon (4h), Wed (4h), Fri (8h) con Martha Garcia
          if (dow === 1 || dow === 3) {
            visits.push({ date: dateStr, dow, cleaner: "Martha Garcia", hours: 4, visitCost: 72 });
          } else if (dow === 5) {
            visits.push({ date: dateStr, dow, cleaner: "Martha Garcia", hours: 8, visitCost: 144 });
          }
        }
      } else if (norm.includes("green leaf")) {
        // Green Leaf Botanicals: Monthly (3rd Tuesday -> Oct 20 in 2026-10)
        if ((monthKey === "2026-10" && day === 20) || (monthKey !== "2026-10" && dow === 2 && isNthWeekdayOfMonth(day, 3))) {
          visits.push({ date: dateStr, dow, cleaner: "Lorena Benitez", hours: 2, visitRev: 238, visitCost: 119 });
        }
      } else if (norm.includes("posh pooch")) {
        // Posh Pooch: 2nd Monday of month (Oct 12 in 2026-10)
        if (dow === 1 && isNthWeekdayOfMonth(day, 2)) {
          visits.push({ date: dateStr, dow, cleaner: "Luz Uribe", hours: 4 });
        }
      } else if (norm.includes("university park dental")) {
        // University Park Dental: Biweekly Mondays anchored to 2026-10-12 (Oct 12 & Oct 26 in 2026-10)
        if (dow === 1 && Math.abs(diffDaysUtc(dateStr, "2026-10-12")) % 14 === 0) {
          visits.push({ date: dateStr, dow, cleaner: "Unassigned", hours: 2.25 });
        }
      } else if (norm.includes("swing easy") && norm.includes("yorba linda")) {
        // Swing Easy Golf Club Yorba Linda: Biweekly Thursdays anchored to 2026-10-08 (Oct 8 & Oct 22 in 2026-10)
        if (dow === 4 && Math.abs(diffDaysUtc(dateStr, "2026-10-08")) % 14 === 0) {
          visits.push({ date: dateStr, dow, cleaner: "Sandra Hernandez", hours: 3 });
        }
      } else if (norm.includes("kush fine art")) {
        // Kush Fine Art: Every 3 weeks anchored to 2026-10-13
        if (Math.abs(diffDaysUtc(dateStr, "2026-10-13")) % 21 === 0) {
          visits.push({ date: dateStr, dow, cleaner: account.cleaner_name || "Ana Morales", hours: 3 });
        }
      } else if (norm.includes("renewable farms")) {
        // Renewable Farms: 5 Octubre BK dates (Oct 3, 4, 10, 17, 24); otherwise biweekly Saturdays
        if (monthKey === "2026-10") {
          if ([3, 4, 10, 17, 24].includes(day)) {
            visits.push({ date: dateStr, dow, cleaner: "Ana Morales", hours: 3 });
          }
        } else if (dow === 6 && isNthWeekdayOfMonth(day, 2) || (dow === 6 && isNthWeekdayOfMonth(day, 4))) {
          visits.push({ date: dateStr, dow, cleaner: "Ana Morales", hours: 3 });
        }
      } else if (rules.length > 0) {
        const match = rules.find((r) => {
          if (r.day_of_week !== dow) return false;
          if (r.effective_start_date && dateStr < r.effective_start_date) return false;
          if (r.effective_end_date && dateStr > r.effective_end_date) return false;
          if (r.frequency_type === "biweekly" && r.anchor_date) {
            return Math.abs(diffDaysUtc(dateStr, r.anchor_date)) % 14 === 0;
          }
          if (r.frequency_type === "every_3_weeks" && r.anchor_date) {
            return Math.abs(diffDaysUtc(dateStr, r.anchor_date)) % 21 === 0;
          }
          if (r.frequency_type === "monthly") {
            return isNthWeekdayOfMonth(day, 2);
          }
          return true;
        });
        if (match) {
          visits.push({
            date: dateStr,
            dow,
            cleaner: match.assigned_cleaner_name || account.cleaner_name || "Unassigned",
            hours: Number(match.paid_hours) || Number(account.hours) || 3.0,
          });
        }
      } else {
        const f = frequency.toLowerCase();
        const baseHrs = Number(account.hours) || 3.0;
        const cl = account.cleaner_name || "Unassigned";

        if (f.includes("7x") || f.includes("daily")) {
          visits.push({ date: dateStr, dow, cleaner: cl, hours: baseHrs });
        } else if (f.includes("5x") && dow >= 1 && dow <= 5) {
          visits.push({ date: dateStr, dow, cleaner: cl, hours: baseHrs });
        } else if (f.includes("3x") && (dow === 1 || dow === 3 || dow === 5)) {
          visits.push({ date: dateStr, dow, cleaner: cl, hours: baseHrs });
        } else if (f.includes("2x") && (dow === 2 || dow === 5)) {
          visits.push({ date: dateStr, dow, cleaner: cl, hours: baseHrs });
        } else if (f.includes("1x") && dow === 5) {
          visits.push({ date: dateStr, dow, cleaner: cl, hours: baseHrs });
        } else if ((f.includes("14 days") || f.includes("2 weeks")) && (day === 9 || day === 23)) {
          visits.push({ date: dateStr, dow, cleaner: cl, hours: baseHrs });
        } else if (f.includes("21 days") && (day === 10 || day === 31)) {
          visits.push({ date: dateStr, dow, cleaner: cl, hours: baseHrs });
        } else if (f.includes("monthly") && day === 9) {
          visits.push({ date: dateStr, dow, cleaner: cl, hours: baseHrs });
        } else if (f.includes("as needed") && dow === 6) {
          // Event venues (e.g. The Harper Wedding Venue)
          visits.push({ date: dateStr, dow, cleaner: cl, hours: baseHrs });
        }
      }
    }

    if (visits.length === 0) continue;

    const totalVisits = visits.length;
    const revPerVisit = Math.round((monthlyRev / totalVisits) * 100) / 100;
    const costPerVisitDefault = Math.round((monthlyCost / totalVisits) * 100) / 100;

    let accumulatedRev = 0;
    let accumulatedCost = 0;

    visits.forEach((v, idx) => {
      const visitCleaner = v.cleaner;
      let visitLaborCost = v.visitCost ?? costPerVisitDefault;
      if (norm.includes("green leaf")) {
        visitLaborCost = 119;
      }

      let visitRev = v.visitRev !== undefined ? v.visitRev : revPerVisit;

      // Exact penny balancing on final visit
      if (idx === totalVisits - 1) {
        if (v.visitRev === undefined && monthlyRev > 0) {
          visitRev = Math.round((monthlyRev - accumulatedRev) * 100) / 100;
        }
        if (v.visitCost === undefined && monthlyCost > 0) {
          visitLaborCost = Math.round((monthlyCost - accumulatedCost) * 100) / 100;
        }
      }

      accumulatedRev += visitRev;
      accumulatedCost += visitLaborCost;

      let noteText = `Visita ${idx + 1} de ${totalVisits} en ${MONTH_NAMES_ES[month - 1]} (${visitCleaner}). ${account.name}`;
      if (norm.includes("steripax")) {
        noteText = `Visita ${idx + 1} de ${totalVisits} en ${MONTH_NAMES_ES[month - 1]} (Lucia Portillo - ${v.hours}h jornada nominal). Steripax (Factura $35/hr = $${visitRev.toFixed(2)}, Pago $18/hr = $${visitLaborCost.toFixed(2)})`;
      }

      const bookingRow = computeBookingFormulas({
        id: `comm-${monthKey}-${account.id || norm.replace(/\s+/g, "-")}-${String(idx + 1).padStart(2, "0")}`,
        date: v.date,
        clientName: account.name,
        service,
        serviceCategory,
        frequency,
        city,
        cleanerTeam: visitCleaner,
        subTotal: visitRev,
        salesTax: 0,
        processingFee: 0,
        tip: 0,
        teamEarningsWithoutTips: visitLaborCost,
        merchantFee: 0,
        stripeFee: 0,
        durationHours: v.hours,
        actualHours: v.hours,
        bookedBy: "Commercial Contract",
        status: "completed",
        notes: noteText,
      });

      bookings.push(bookingRow);
    });
  }

  return bookings.sort((a, b) => a.date.localeCompare(b.date));
}

function normalizeFrequencyAndCategory(rawFreq: string, service: string): { frequency: string; serviceCategory: ServiceCategory } {
  const s = service.toLowerCase();
  const f = (rawFreq || "").toLowerCase();

  if (s.includes("move")) {
    return { frequency: "One Time", serviceCategory: "Move In/Out Clean" };
  }
  if (s.includes("deep")) {
    return { frequency: "One Time", serviceCategory: "Deep Clean" };
  }
  if (f.includes("every other week") || f.includes("biweekly") || f.includes("2 week")) {
    return { frequency: "Biweekly", serviceCategory: "Biweekly" };
  }
  if (f.includes("3 week") || f.includes("triweekly")) {
    return { frequency: "Every 3 Weeks", serviceCategory: "Triweekly" };
  }
  if (f.includes("weekly")) {
    return { frequency: "Weekly", serviceCategory: "Weekly" };
  }
  if (f.includes("month")) {
    return { frequency: "Monthly", serviceCategory: "Monthly" };
  }
  return { frequency: "One Time", serviceCategory: "Standard Clean" };
}

/**
 * Convierte ÚNICAMENTE registros reales de BookingKoala (con "BookingKoala ID:" explícito y no eliminados)
 * a ServiceBookingRow residenciales para cualquier mes.
 * NUNCA incluye filas de nómina semanal (flat rates de Maria Lopez, Ana Morales, ni pagos manuales sin BookingKoala ID)
 * y NUNCA duplica cuentas comerciales activas.
 */
export function parseBookingKoalaRowsForMonth(
  workLogs: any[] = [],
  paymentRows: any[] = [],
  _commEntries: any[] = [],
  monthKey: string
): ServiceBookingRow[] {
  const { startDate, endDate } = getMonthInfo(monthKey);
  const map = new Map<string, ServiceBookingRow>();

  // Octubre 2026: base auditada oficial del CSV 1793642800_bookings_2026-10-01-to-2026-10-31 (42 servicios residenciales exactos)
  if (monthKey === "2026-10") {
    for (const row of octoberResidentialBookings) {
      const bkId = row.id.replace(/^oct-/, "");
      map.set(bkId, row);
    }
  }

  // 1. Process residential work logs (ESTRICTO: solo filas activas con "BookingKoala ID:")
  for (const log of workLogs) {
    if (log.deleted_at) continue;
    if (!log.work_date || log.work_date < startDate || log.work_date > endDate) continue;
    if (!log.notes || !/BookingKoala ID:\s*\S+/i.test(log.notes)) continue;

    const bookingIdMatch = log.notes.match(/BookingKoala ID:\s*([^;]+)/i);
    if (!bookingIdMatch || !bookingIdMatch[1]) continue;
    const bookingId = bookingIdMatch[1].trim();

    if (monthKey === "2026-10" && OCTOBER_2026_KNOWN_BK_IDS.has(bookingId)) {
      // Si el usuario guardó un [OVERRIDE] explícito desde el SOP para Octubre, aplicarlo sobre el seed auditado
      if (log.notes.includes("[OVERRIDE]") && map.has(bookingId)) {
        const existing = map.get(bookingId)!;
        const chargedOv = log.notes.match(/charged\s*\$([0-9.]+)/i);
        const payOv = log.notes.match(/cleaner pay\s*\$([0-9.]+)/i);
        map.set(
          bookingId,
          computeBookingFormulas({
            ...existing,
            cleanerTeam: log.team_name || existing.cleanerTeam,
            subTotal: chargedOv ? parseFloat(chargedOv[1]) : existing.subTotal,
            teamEarningsWithoutTips: payOv ? parseFloat(payOv[1]) : existing.teamEarningsWithoutTips,
          })
        );
      }
      continue;
    }
    if (map.has(bookingId)) continue;

    const chargedMatch = log.notes.match(/charged\s*\$([0-9.]+)/i);
    const cleanerPayMatch = log.notes.match(/cleaner pay\s*\$([0-9.]+)/i);
    const feeMatch = log.notes.match(/fee\s*\$([0-9.]+)/i);
    const tipMatch = log.notes.match(/tip\s*\$([0-9.]+)/i);
    const freqMatch = log.notes.match(/freq:\s*([^;]+)/i);

    const subTotal = chargedMatch ? parseFloat(chargedMatch[1]) : 0;
    const cleanerTeam = log.team_name || "Unassigned";
    const rawCleanerPay = cleanerPayMatch ? parseFloat(cleanerPayMatch[1]) : 0;
    const cleanerPay = cleanerTeam.toLowerCase() === "unassigned" ? 0 : rawCleanerPay;

    let service = "Express Clean";
    const serviceMatch = log.notes.match(/BookingKoala ID:\s*[^;]+;\s*([^;]+);/i);
    if (serviceMatch && serviceMatch[1]) {
      service = serviceMatch[1].trim();
    }

    // Nunca mezclar limpiezas comerciales dentro del bloque Residencial
    if (service.toLowerCase().includes("commercial")) continue;

    let city = "Orange County";
    const cityMatch = log.notes.match(/city:\s*([^;]+)/i);
    if (cityMatch && cityMatch[1]) {
      city = cityMatch[1].trim();
    } else {
      const parts = log.notes.split(";");
      if (parts.length >= 5) {
        const lastPart = parts[parts.length - 1].trim();
        if (!lastPart.includes("$") && !lastPart.includes(":")) city = lastPart;
      }
    }

    const hours = Number(log.hours_worked) || 2.5;
    const processingFee = feeMatch ? parseFloat(feeMatch[1]) : Math.round(subTotal * 0.03 * 100) / 100;
    const tip = tipMatch ? parseFloat(tipMatch[1]) : 0;
    const { frequency, serviceCategory } = normalizeFrequencyAndCategory(freqMatch ? freqMatch[1].trim() : "One Time", service);

    const row = computeBookingFormulas({
      id: `${monthKey}-res-${bookingId}`,
      date: log.work_date,
      clientName: log.account_name || "Residential Client",
      service,
      serviceCategory,
      frequency,
      city,
      cleanerTeam,
      subTotal,
      salesTax: 0,
      processingFee,
      tip,
      teamEarningsWithoutTips: cleanerPay,
      merchantFee: 0,
      stripeFee: 0,
      durationHours: hours,
      actualHours: hours,
      bookedBy: "Online Booking",
      status: "completed",
      notes: log.notes,
    });

    if (!isCommercialBooking(row)) {
      map.set(bookingId, row);
    }
  }

  // 2. Process residential weekly payment rows ONLY if they explicitly carry a BookingKoala ID not in workLogs
  for (const pay of paymentRows) {
    if (pay.deleted_at) continue;
    if (!pay.work_date || pay.work_date < startDate || pay.work_date > endDate) continue;
    if (!pay.notes || !/BookingKoala ID:\s*\S+/i.test(pay.notes)) continue;

    const bookingIdMatch = pay.notes.match(/BookingKoala ID:\s*([^;]+)/i);
    if (!bookingIdMatch || !bookingIdMatch[1]) continue;
    const bookingId = bookingIdMatch[1].trim();

    if (monthKey === "2026-10" && OCTOBER_2026_KNOWN_BK_IDS.has(bookingId)) continue;

    if (map.has(bookingId)) {
      const existing = map.get(bookingId)!;
      if (!existing.teamEarningsWithoutTips && pay.payment_amount && existing.cleanerTeam.toLowerCase() !== "unassigned") {
        existing.teamEarningsWithoutTips = Number(pay.payment_amount) || 0;
      }
      continue;
    }

    const chargedMatch = pay.notes.match(/charged\s*\$([0-9.]+)/i);
    const feeMatch = pay.notes.match(/fee\s*\$([0-9.]+)/i);
    const tipMatch = pay.notes.match(/tip\s*\$([0-9.]+)/i);
    const freqMatch = pay.notes.match(/freq:\s*([^;]+)/i);

    const subTotal = chargedMatch ? parseFloat(chargedMatch[1]) : 0;
    const cleanerTeam = pay.cleaner_name || "Unassigned";
    const cleanerPay = cleanerTeam.toLowerCase() === "unassigned" ? 0 : (Number(pay.payment_amount) || 0);

    let service = "Express Clean";
    const serviceMatch = pay.notes.match(/BookingKoala ID:\s*[^;]+;\s*[^;]+;\s*([^;]+);/i);
    if (serviceMatch && serviceMatch[1]) {
      service = serviceMatch[1].trim();
    }

    if (service.toLowerCase().includes("commercial")) continue;

    const processingFee = feeMatch ? parseFloat(feeMatch[1]) : Math.round(subTotal * 0.03 * 100) / 100;
    const tip = tipMatch ? parseFloat(tipMatch[1]) : 0;
    const { frequency, serviceCategory } = normalizeFrequencyAndCategory(freqMatch ? freqMatch[1].trim() : "One Time", service);

    const row = computeBookingFormulas({
      id: `${monthKey}-res-${bookingId}`,
      date: pay.work_date,
      clientName: (pay.notes.split(";")[1] || "Residential Client").trim(),
      service,
      serviceCategory,
      frequency,
      city: pay.city || "Orange County",
      cleanerTeam,
      subTotal,
      salesTax: 0,
      processingFee,
      tip,
      teamEarningsWithoutTips: cleanerPay,
      merchantFee: 0,
      stripeFee: 0,
      durationHours: 2.5,
      actualHours: 2.5,
      bookedBy: "Online Booking",
      status: "completed",
      notes: pay.notes,
    });

    if (!isCommercialBooking(row)) {
      map.set(bookingId, row);
    }
  }

  const sorted = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  return applyBookingOverrides(sorted, monthKey);
}

/**
 * Devuelve la carga inicial limpia e inmediata para un mes dinámico (sin basura de nómina).
 */
export function getInitialDynamicMonthBookings(monthKey: string): ServiceBookingRow[] {
  const commercial = generateMonthlyCommercialBookings(monthKey);
  if (monthKey === "2026-10") {
    const res = applyBookingOverrides(octoberResidentialBookings, monthKey);
    return [...res, ...commercial].sort((a, b) => a.date.localeCompare(b.date));
  }
  return commercial;
}

export type MonthlyReconciliationResult = {
  monthKey: string;
  monthInfo: MonthInfo;
  bookings: ServiceBookingRow[];
  residentialBookings: ServiceBookingRow[];
  commercialBookings: ServiceBookingRow[];
  kpis: ExecutiveKpis;
  stats: {
    totalBookings: number;
    residentialCount: number;
    commercialCount: number;
    totalRevenue: number;
    totalGrossCost: number;
    totalProfit: number;
    profitMarginPct: number;
    laborPct: number;
  };
};

/**
 * Concilia automáticamente un mes completo usando Supabase (SOLO BookingKoala reales) + Contratos Comerciales Activos.
 * Limpia cualquier caché corrupto previo en localStorage.
 */
export async function reconcileMonthlyTracker(
  supabase: SupabaseClient,
  monthKey: string
): Promise<MonthlyReconciliationResult> {
  const monthInfo = getMonthInfo(monthKey);

  // Limpiar caché viejo contaminado (v1) si existe
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(`pristine_sales_tracker_${monthKey}`);
    } catch {}
  }

  // 1. Fetch Supabase rows for this month (SOLO registros activos con BookingKoala ID)
  const [resLogs, resPays] = await Promise.all([
    supabase
      .from("residential_work_logs")
      .select("*")
      .is("deleted_at", null)
      .ilike("notes", "%BookingKoala ID:%")
      .gte("work_date", monthInfo.startDate)
      .lte("work_date", monthInfo.endDate),
    supabase
      .from("residential_weekly_payment_rows")
      .select("*")
      .is("deleted_at", null)
      .ilike("notes", "%BookingKoala ID:%")
      .gte("work_date", monthInfo.startDate)
      .lte("work_date", monthInfo.endDate),
  ]);

  const residentialBookings = parseBookingKoalaRowsForMonth(
    resLogs.data || [],
    resPays.data || [],
    [],
    monthKey
  );

  // 2. Generate active commercial bookings
  const commercialBookings = generateMonthlyCommercialBookings(monthKey);

  // 3. Check ONLY for explicit user-created manual rows (id starting with "manual-")
  let manualAdditions: ServiceBookingRow[] = [];
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(`${TRACKER_CACHE_PREFIX}${monthKey}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const autoIds = new Set([...residentialBookings, ...commercialBookings].map((b) => b.id));
          manualAdditions = parsed.filter(
            (b) => b && typeof b.id === "string" && b.id.startsWith("manual-") && !autoIds.has(b.id)
          );
        }
      }
    } catch {}
  }

  // 4. Combine all bookings
  const allBookings = [...residentialBookings, ...manualAdditions, ...commercialBookings].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // 5. Cache in v2 localStorage for the Sales Tracker page
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`${TRACKER_CACHE_PREFIX}${monthKey}`, JSON.stringify(allBookings));
    } catch {}
  }

  // 6. Compute executive KPIs
  const kpis = calculateExecutiveKpis(allBookings);

  const stats = {
    totalBookings: allBookings.length,
    residentialCount: residentialBookings.length,
    commercialCount: commercialBookings.length,
    totalRevenue: kpis.totalRevenue,
    totalGrossCost: kpis.totalGrossCost,
    totalProfit: kpis.totalGrossProfit,
    profitMarginPct: kpis.totalGrossProfitPct,
    laborPct: kpis.totalRevenue > 0 ? (kpis.totalGrossCost / kpis.totalRevenue) * 100 : 0,
  };

  return {
    monthKey,
    monthInfo,
    bookings: allBookings,
    residentialBookings,
    commercialBookings,
    kpis,
    stats,
  };
}

function weekRangeForDate(date: string) {
  const d = new Date(`${date}T12:00:00`);
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    weekStart: start.toISOString().slice(0, 10),
    weekEnd: end.toISOString().slice(0, 10),
  };
}

/**
 * Permite asignar o corregir desde el SOP (o desde el Sales Tracker) la cleaner y el pago de cualquier booking,
 * guardándolo tanto en localStorage (instantáneo) como en Supabase (persistencia multi-dispositivo).
 */
export async function saveSopBookingOverride(
  supabase: SupabaseClient,
  monthKey: string,
  booking: ServiceBookingRow,
  updates: { cleanerTeam: string; teamEarningsWithoutTips: number; subTotal?: number }
): Promise<MonthlyReconciliationResult> {
  const bkId = extractBookingKoalaId(booking);
  const now = new Date().toISOString();
  const newSubTotal = updates.subTotal !== undefined ? Number(updates.subTotal) : booking.subTotal;
  const newPay = Number(updates.teamEarningsWithoutTips) || 0;
  const newCleaner = (updates.cleanerTeam || "Unassigned").trim();

  // 1. Save override locally for 0ms sync with /commercial/sales-track
  if (typeof window !== "undefined") {
    try {
      const existing = getStoredBookingOverrides(monthKey);
      const entry: BookingOverride = {
        key: bkId,
        cleanerTeam: newCleaner,
        teamEarningsWithoutTips: newPay,
        subTotal: newSubTotal,
        updatedAt: now,
      };
      existing[bkId] = entry;
      existing[booking.id] = entry;
      localStorage.setItem(`${TRACKER_OVERRIDES_PREFIX}${monthKey}`, JSON.stringify(existing));

      // If this was a manual-* row, also update it inside the v2 cache directly
      if (booking.id.startsWith("manual-")) {
        const cachedRaw = localStorage.getItem(`${TRACKER_CACHE_PREFIX}${monthKey}`);
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw);
          if (Array.isArray(parsed)) {
            const updatedCache = parsed.map((r: ServiceBookingRow) =>
              r.id === booking.id
                ? computeBookingFormulas({
                    ...r,
                    cleanerTeam: newCleaner,
                    teamEarningsWithoutTips: newPay,
                    subTotal: newSubTotal,
                  })
                : r
            );
            localStorage.setItem(`${TRACKER_CACHE_PREFIX}${monthKey}`, JSON.stringify(updatedCache));
          }
        }
      }
    } catch {}
  }

  // 2. Persist in Supabase (residential_work_logs + residential_weekly_payment_rows)
  try {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;
    const updatedNote = `BookingKoala ID: ${bkId}; ${booking.service}; freq: ${booking.frequency}; charged $${newSubTotal}; fee $${booking.processingFee || 0}; tip $${booking.tip || 0}; cleaner pay $${newPay}; city: ${booking.city}; [OVERRIDE]`;

    const { data: existingLogs } = await supabase
      .from("residential_work_logs")
      .select("id")
      .is("deleted_at", null)
      .ilike("notes", `%BookingKoala ID: ${bkId}%`);

    if (existingLogs && existingLogs.length > 0) {
      await supabase
        .from("residential_work_logs")
        .update({
          team_name: newCleaner,
          notes: updatedNote,
          updated_at: now,
        })
        .in("id", existingLogs.map((r: { id: string }) => r.id));
    } else if (userId && !isCommercialBooking(booking)) {
      await supabase.from("residential_work_logs").insert({
        user_id: userId,
        account_name: booking.clientName,
        team_name: newCleaner,
        work_date: booking.date,
        hours_worked: booking.actualHours || booking.durationHours || 2.5,
        notes: updatedNote,
        status: "completed",
        created_at: now,
        updated_at: now,
      });
    }

    const { data: existingPays } = await supabase
      .from("residential_weekly_payment_rows")
      .select("id")
      .is("deleted_at", null)
      .ilike("notes", `%BookingKoala ID: ${bkId}%`);

    if (existingPays && existingPays.length > 0) {
      await supabase
        .from("residential_weekly_payment_rows")
        .update({
          cleaner_name: newCleaner,
          payment_amount: newPay,
          notes: `BookingKoala ID: ${bkId}; ${booking.clientName}; ${booking.service}; freq: ${booking.frequency}; charged $${newSubTotal}; fee $${booking.processingFee || 0}; tip $${booking.tip || 0}; [OVERRIDE]`,
          updated_at: now,
        })
        .in("id", existingPays.map((r: { id: string }) => r.id));
    } else if (userId && newPay > 0 && newCleaner.toLowerCase() !== "unassigned" && !isCommercialBooking(booking)) {
      const { weekStart, weekEnd } = weekRangeForDate(booking.date);
      await supabase.from("residential_weekly_payment_rows").insert({
        user_id: userId,
        cleaner_name: newCleaner,
        work_date: booking.date,
        city: booking.city || "Orange County",
        payment_amount: newPay,
        residential_amount: 0,
        commercial_amount: 0,
        payment_type: "residential",
        payment_mode: "residential_only",
        week_start: weekStart,
        week_end: weekEnd,
        status: "pending",
        notes: `BookingKoala ID: ${bkId}; ${booking.clientName}; ${booking.service}; freq: ${booking.frequency}; charged $${newSubTotal}; fee $${booking.processingFee || 0}; tip $${booking.tip || 0}; [OVERRIDE]`,
        created_at: now,
        updated_at: now,
      });
    }
  } catch (e) {
    console.warn("Could not persist SOP booking override to Supabase (saved locally):", e);
  }

  return reconcileMonthlyTracker(supabase, monthKey);
}

/**
 * Añade un booking adicional desde el SOP para el mes seleccionado y lo persiste en Supabase + caché local.
 */
export async function addSopManualBooking(
  supabase: SupabaseClient,
  monthKey: string,
  draft: {
    date: string;
    clientName: string;
    service: string;
    frequency?: string;
    city?: string;
    cleanerTeam: string;
    subTotal: number;
    teamEarningsWithoutTips: number;
    hours?: number;
  }
): Promise<MonthlyReconciliationResult> {
  const manualBkId = `SOP-${Date.now().toString().slice(-6)}`;
  const now = new Date().toISOString();
  const hrs = Number(draft.hours) || 2.5;
  const subTotal = Number(draft.subTotal) || 0;
  const cleanerPay = Number(draft.teamEarningsWithoutTips) || 0;
  const city = draft.city || "Orange County";
  const freq = draft.frequency || "One Time";
  const isComm = draft.service.toLowerCase().includes("commercial");
  const { frequency, serviceCategory } = isComm
    ? { frequency: freq, serviceCategory: "Commercial Cleaning" as ServiceCategory }
    : normalizeFrequencyAndCategory(freq, draft.service);

  const newRow = computeBookingFormulas({
    id: `manual-${monthKey}-${manualBkId}`,
    date: draft.date,
    clientName: draft.clientName,
    service: draft.service,
    serviceCategory,
    frequency,
    city,
    cleanerTeam: draft.cleanerTeam || "Unassigned",
    subTotal,
    salesTax: 0,
    processingFee: isComm ? 0 : Math.round(subTotal * 0.03 * 100) / 100,
    tip: 0,
    teamEarningsWithoutTips: cleanerPay,
    merchantFee: 0,
    stripeFee: 0,
    durationHours: hrs,
    actualHours: hrs,
    bookedBy: "SOP Manual",
    status: "completed",
    notes: `BookingKoala ID: ${manualBkId}; ${draft.service}; freq: ${frequency}; charged $${subTotal}; cleaner pay $${cleanerPay}; city: ${city}`,
  });

  if (typeof window !== "undefined") {
    try {
      const cachedRaw = localStorage.getItem(`${TRACKER_CACHE_PREFIX}${monthKey}`);
      const existing = cachedRaw ? JSON.parse(cachedRaw) : [];
      const list = Array.isArray(existing) ? existing : [];
      localStorage.setItem(`${TRACKER_CACHE_PREFIX}${monthKey}`, JSON.stringify([newRow, ...list]));
    } catch {}
  }

  try {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;
    if (userId && !isComm) {
      await supabase.from("residential_work_logs").insert({
        user_id: userId,
        account_name: draft.clientName,
        team_name: draft.cleanerTeam || "Unassigned",
        work_date: draft.date,
        hours_worked: hrs,
        notes: newRow.notes,
        status: "completed",
        created_at: now,
        updated_at: now,
      });
    }
  } catch (e) {
    console.warn("Could not save SOP manual booking to Supabase (saved locally):", e);
  }

  return reconcileMonthlyTracker(supabase, monthKey);
}
