import { computeBookingFormulas, calculateExecutiveKpis } from "./calculator";
import type { ExecutiveKpis, ServiceBookingRow } from "./types";
import { importedCommercialAccounts, type ImportedCommercialAccount } from "../commercial-accounts-data";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MonthInfo = {
  key: string; // "2026-10"
  year: number; // 2026
  month: number; // 10
  label: string; // "Octubre 2026"
  shortLabel: string; // "Oct 2026"
  startDate: string; // "2026-10-01"
  endDate: string; // "2026-10-31"
  daysInMonth: number; // 31
};

export const MONTH_NAMES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export function getMonthInfo(monthKey: string): MonthInfo {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const daysInMonth = new Date(year, month, 0).getDate();
  const startDate = `${yearStr}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${yearStr}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  const label = `${MONTH_NAMES_ES[month - 1]} ${year}`;
  const shortLabel = `${MONTH_NAMES_ES[month - 1].slice(0, 3)} ${year}`;

  return { key: monthKey, year, month, label, shortLabel, startDate, endDate, daysInMonth };
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

/**
 * Genera automáticamente las visitas comerciales para cualquier mes dado (YYYY-MM),
 * aplicando estrictamente las reglas salariales de Pristine Cleaners.
 */
export function generateMonthlyCommercialBookings(monthKey: string): ServiceBookingRow[] {
  const { year, month, daysInMonth, startDate, endDate } = getMonthInfo(monthKey);
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

    const visits: { date: string; dow: number; cleaner: string; hours: number; visitCost?: number }[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, "0");
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${dayStr}`;
      const dt = new Date(`${dateStr}T12:00:00Z`);
      const dow = dt.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

      if (norm.includes("lsg sky chefs")) {
        // Daily visits (7x per week)
        let cleaner = "Luz Uribe";
        if (dow === 2 || dow === 5 || dow === 6) {
          // José Vazquez empezó el 10 de octubre de 2026
          cleaner = monthKey > "2026-10" || (monthKey === "2026-10" && day >= 10) ? "José Vazquez" : "Maria Mejia";
        }
        visits.push({ date: dateStr, dow, cleaner, hours: 4 });
      } else if (norm.includes("steripax")) {
        // 5x per week (Monday to Friday)
        if (dow >= 1 && dow <= 5) {
          const hrs = dow === 3 || dow === 4 ? 8 : 6;
          visits.push({ date: dateStr, dow, cleaner: "Lucia Portillo", hours: hrs });
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
            // Earlier regular visits before Oct 16 ($106 balance / 6 visits)
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
      } else if (rules.length > 0) {
        const match = rules.find((r) => r.day_of_week === dow);
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
        } else if (f.includes("as needed") && dow === 0) {
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
      let visitCleaner = v.cleaner;
      let cleanerHourlyRate = 18.0;

      // Special cleaner wage rules
      if (visitCleaner.includes("Emmi Guerra")) {
        cleanerHourlyRate = 18.15;
      } else if (visitCleaner.includes("Maria Lopez") || visitCleaner.includes("María López")) {
        cleanerHourlyRate = 22.0;
      }

      let visitLaborCost = v.visitCost ?? costPerVisitDefault;
      if (norm.includes("green leaf")) {
        visitLaborCost = 119;
      }

      let visitRev = revPerVisit;

      // Exact penny balancing on final visit
      if (idx === totalVisits - 1) {
        if (monthlyRev > 0) {
          visitRev = Math.round((monthlyRev - accumulatedRev) * 100) / 100;
        }
        if (v.visitCost === undefined && monthlyCost > 0) {
          visitLaborCost = Math.round((monthlyCost - accumulatedCost) * 100) / 100;
        }
      }

      accumulatedRev += visitRev;
      accumulatedCost += visitLaborCost;

      const bookingRow = computeBookingFormulas({
        id: `comm-${monthKey}-${account.id || norm.replace(/\s+/g, "-")}-${String(idx + 1).padStart(2, "0")}`,
        date: v.date,
        clientName: account.name,
        service,
        serviceCategory,
        frequency,
        city,
        cleanerTeam: visitCleaner,
        subTotal: revPerVisit,
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
        notes: `Visita ${idx + 1} de ${totalVisits} en ${MONTH_NAMES_ES[month - 1]} (${visitCleaner}). ${account.name}`,
      });

      bookings.push(bookingRow);
    });
  }

  return bookings.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Convierte registros de Supabase (BookingKoala imports) a ServiceBookingRow para cualquier mes.
 */
export function parseBookingKoalaRowsForMonth(
  workLogs: any[] = [],
  paymentRows: any[] = [],
  commEntries: any[] = [],
  monthKey: string
): ServiceBookingRow[] {
  const { startDate, endDate } = getMonthInfo(monthKey);
  const map = new Map<string, ServiceBookingRow>();

  // 1. Process residential work logs
  for (const log of workLogs) {
    if (!log.work_date || log.work_date < startDate || log.work_date > endDate) continue;

    const bookingIdMatch = log.notes?.match(/BookingKoala ID:\s*([^;]+)/i);
    const bookingId = bookingIdMatch ? bookingIdMatch[1].trim() : `res-log-${log.id || Math.random()}`;

    const chargedMatch = log.notes?.match(/charged\s*\$([0-9.]+)/i);
    const cleanerPayMatch = log.notes?.match(/cleaner pay\s*\$([0-9.]+)/i);

    const subTotal = chargedMatch ? parseFloat(chargedMatch[1]) : 0;
    const cleanerPay = cleanerPayMatch ? parseFloat(cleanerPayMatch[1]) : 0;

    let service = "Standard Clean";
    const serviceMatch = log.notes?.match(/BookingKoala ID:\s*[^;]+;\s*([^;]+);/i);
    if (serviceMatch && serviceMatch[1]) {
      service = serviceMatch[1].trim();
    }

    let city = "Orange County";
    if (log.notes) {
      const parts = log.notes.split(";");
      if (parts.length >= 5) city = parts[parts.length - 1].trim();
    }

    const hours = Number(log.hours_worked) || 2.5;
    const processingFee = Math.round(subTotal * 0.03 * 100) / 100;

    const row = computeBookingFormulas({
      id: `${monthKey}-res-${bookingId}`,
      date: log.work_date,
      clientName: log.account_name || "Residential Client",
      service,
      serviceCategory: service.includes("Deep")
        ? "Deep Clean"
        : service.includes("Move")
        ? "Move In/Out Clean"
        : "Standard Clean",
      frequency: "One Time",
      city,
      cleanerTeam: log.team_name || "Unassigned",
      subTotal,
      salesTax: 0,
      processingFee,
      tip: 0,
      teamEarningsWithoutTips: cleanerPay,
      merchantFee: 0,
      stripeFee: 0,
      durationHours: hours,
      actualHours: hours,
      bookedBy: "BookingKoala",
      status: "completed",
      notes: log.notes || `BookingKoala ${bookingId}`,
    });

    map.set(bookingId, row);
  }

  // 2. Process residential weekly payment rows if not already mapped
  for (const pay of paymentRows) {
    if (!pay.work_date || pay.work_date < startDate || pay.work_date > endDate) continue;

    const bookingIdMatch = pay.notes?.match(/BookingKoala ID:\s*([^;]+)/i);
    const bookingId = bookingIdMatch ? bookingIdMatch[1].trim() : `res-pay-${pay.id || Math.random()}`;

    if (map.has(bookingId)) {
      const existing = map.get(bookingId)!;
      if (!existing.teamEarningsWithoutTips && pay.payment_amount) {
        existing.teamEarningsWithoutTips = Number(pay.payment_amount) || 0;
      }
      continue;
    }

    const chargedMatch = pay.notes?.match(/charged\s*\$([0-9.]+)/i);
    const subTotal = chargedMatch ? parseFloat(chargedMatch[1]) : Number(pay.payment_amount) * 2 || 0;
    const cleanerPay = Number(pay.payment_amount) || 0;

    let service = "Standard Clean";
    const serviceMatch = pay.notes?.match(/BookingKoala ID:\s*[^;]+;\s*[^;]+;\s*([^;]+);/i);
    if (serviceMatch && serviceMatch[1]) {
      service = serviceMatch[1].trim();
    }

    const hours = 2.5;
    const row = computeBookingFormulas({
      id: `${monthKey}-res-${bookingId}`,
      date: pay.work_date,
      clientName: (pay.notes?.split(";")[1] || "Residential Client").trim(),
      service,
      serviceCategory: service.includes("Deep")
        ? "Deep Clean"
        : service.includes("Move")
        ? "Move In/Out Clean"
        : "Standard Clean",
      frequency: "One Time",
      city: pay.city || "Orange County",
      cleanerTeam: pay.cleaner_name || "Unassigned",
      subTotal,
      salesTax: 0,
      processingFee: Math.round(subTotal * 0.03 * 100) / 100,
      tip: 0,
      teamEarningsWithoutTips: cleanerPay,
      merchantFee: 0,
      stripeFee: 0,
      durationHours: hours,
      actualHours: hours,
      bookedBy: "BookingKoala",
      status: "completed",
      notes: pay.notes || `BookingKoala ${bookingId}`,
    });

    map.set(bookingId, row);
  }

  // 3. Process extra commercial entries with BookingKoala notes
  for (const comm of commEntries) {
    if (!comm.work_date || comm.work_date < startDate || comm.work_date > endDate) continue;
    if (!comm.notes?.includes("BookingKoala ID:")) continue;

    const bookingIdMatch = comm.notes.match(/BookingKoala ID:\s*([^;]+)/i);
    const bookingId = bookingIdMatch ? bookingIdMatch[1].trim() : `comm-entry-${comm.id || Math.random()}`;

    if (map.has(bookingId)) continue;

    const cleanerPayMatch = comm.notes.match(/\$([0-9.]+)\s*pay/i);
    const cleanerPay = cleanerPayMatch ? parseFloat(cleanerPayMatch[1]) : (Number(comm.completed_hours) || 3) * 18;
    const hours = Number(comm.completed_hours) || 3.0;

    const row = computeBookingFormulas({
      id: `${monthKey}-comm-bk-${bookingId}`,
      date: comm.work_date,
      clientName: comm.account_name || "Commercial Job",
      service: "Commercial Cleaning",
      serviceCategory: "Commercial Cleaning",
      frequency: "One Time",
      city: "Orange County",
      cleanerTeam: comm.team_name || "Unassigned",
      subTotal: Math.round(cleanerPay * 2.2 * 100) / 100,
      salesTax: 0,
      processingFee: 0,
      tip: 0,
      teamEarningsWithoutTips: cleanerPay,
      merchantFee: 0,
      stripeFee: 0,
      durationHours: hours,
      actualHours: hours,
      bookedBy: "BookingKoala",
      status: "completed",
      notes: comm.notes,
    });

    map.set(bookingId, row);
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
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
 * Concilia automáticamente un mes completo usando Supabase + Contratos Comerciales Activos.
 * Guarda en localStorage como caché instantáneo para la vista del Sales Tracker.
 */
export async function reconcileMonthlyTracker(
  supabase: SupabaseClient,
  monthKey: string
): Promise<MonthlyReconciliationResult> {
  const monthInfo = getMonthInfo(monthKey);

  // 1. Fetch Supabase rows for this month
  const [resLogs, resPays, commEntries] = await Promise.all([
    supabase
      .from("residential_work_logs")
      .select("*")
      .gte("work_date", monthInfo.startDate)
      .lte("work_date", monthInfo.endDate),
    supabase
      .from("residential_weekly_payment_rows")
      .select("*")
      .gte("work_date", monthInfo.startDate)
      .lte("work_date", monthInfo.endDate),
    supabase
      .from("commercial_hours_entries")
      .select("*")
      .gte("work_date", monthInfo.startDate)
      .lte("work_date", monthInfo.endDate),
  ]);

  const residentialBookings = parseBookingKoalaRowsForMonth(
    resLogs.data || [],
    resPays.data || [],
    commEntries.data || [],
    monthKey
  );

  // 2. Generate active commercial bookings
  const commercialBookings = generateMonthlyCommercialBookings(monthKey);

  // 3. Check for any manual additions in localStorage
  let manualAdditions: ServiceBookingRow[] = [];
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(`pristine_sales_tracker_${monthKey}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const autoIds = new Set([...residentialBookings, ...commercialBookings].map((b) => b.id));
          manualAdditions = parsed.filter((b) => !autoIds.has(b.id));
        }
      }
    } catch {}
  }

  // 4. Combine all bookings
  const allBookings = [...residentialBookings, ...manualAdditions, ...commercialBookings].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // 5. Cache in localStorage for the Sales Tracker page
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`pristine_sales_tracker_${monthKey}`, JSON.stringify(allBookings));
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
    profitMarginPct: kpis.totalGrossProfitPct * 100,
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
