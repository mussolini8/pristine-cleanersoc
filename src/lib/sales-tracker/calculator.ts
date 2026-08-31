import type {
  CategoryPerformance,
  ExecutiveKpis,
  ServiceBookingRow,
  ServiceCategory,
  TargetRateModel,
} from "./types";

export function computeBookingFormulas(
  input: Partial<ServiceBookingRow> & {
    subTotal: number;
    teamEarningsWithoutTips: number;
  }
): ServiceBookingRow {
  const subTotal = Number(input.subTotal) || 0;
  const salesTax = Number(input.salesTax) || 0;
  const tip = Number(input.tip) || 0;
  const teamEarningsWithoutTips = Number(input.teamEarningsWithoutTips) || 0;
  const merchantFee = Number(input.merchantFee) || 0;
  const stripeFee = Number(input.stripeFee) || 0;
  const actualHours = Number(input.actualHours) || Number(input.durationHours) || 0;

  const finalAmount = subTotal + salesTax;
  const teamEarningsTotal = teamEarningsWithoutTips + tip;
  const laborPct = subTotal > 0 ? teamEarningsWithoutTips / subTotal : 0;
  const pcEarnings = subTotal - teamEarningsWithoutTips - merchantFee - stripeFee;
  const pcProfitPct = subTotal > 0 ? pcEarnings / subTotal : 0;

  return {
    id: input.id || `booking-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    date: input.date || new Date().toISOString().split("T")[0],
    clientName: input.clientName || "Unnamed Client",
    service: input.service || "Commercial Cleaning",
    serviceCategory: input.serviceCategory || "Commercial Cleaning",
    frequency: input.frequency || "Weekly",
    city: input.city || "Orange County",
    cleanerTeam: input.cleanerTeam || "Unassigned",
    subTotal,
    salesTax,
    finalAmount,
    tip,
    teamEarningsWithoutTips,
    teamEarningsTotal,
    laborPct,
    merchantFee,
    stripeFee,
    pcEarnings,
    pcProfitPct,
    durationHours: Number(input.durationHours) || actualHours,
    actualHours,
    bookedBy: input.bookedBy || "Direct",
    status: input.status || "completed",
    notes: input.notes || "",
  };
}

export const RECURRING_CATEGORIES: ServiceCategory[] = [
  "Weekly",
  "Biweekly",
  "Triweekly",
  "Monthly",
];

export const ONE_TIME_CATEGORIES: ServiceCategory[] = [
  "Deep Clean",
  "Standard Clean",
  "Move In/Out Clean",
  "Airbnb Clean",
  "Other",
];

export function categorizeBooking(row: ServiceBookingRow): ServiceCategory {
  if (row.serviceCategory) return row.serviceCategory;
  const s = (row.service || "").toLowerCase();
  const f = (row.frequency || "").toLowerCase();

  if (s.includes("commercial")) return "Commercial Cleaning";
  if (s.includes("airbnb") || s.includes("bnb")) return "Airbnb Clean";
  if (s.includes("move in") || s.includes("move out") || s.includes("move")) return "Move In/Out Clean";
  if (s.includes("deep")) return "Deep Clean";
  if (f.includes("weekly") && !f.includes("bi") && !f.includes("tri")) return "Weekly";
  if (f.includes("biweekly") || f.includes("2 weeks") || f.includes("every 2")) return "Biweekly";
  if (f.includes("triweekly") || f.includes("3 weeks") || f.includes("tri")) return "Triweekly";
  if (f.includes("monthly") || f.includes("month")) return "Monthly";
  if (s.includes("express") || s.includes("stand")) return "Standard Clean";

  return "Commercial Cleaning";
}

export function calculateCategoryBreakdown(bookings: ServiceBookingRow[]): CategoryPerformance[] {
  const activeBookings = bookings.filter((b) => b.status !== "cancelled");

  const categoriesToCompute: { name: ServiceCategory; filterFn: (b: ServiceBookingRow) => boolean }[] = [
    { name: "All", filterFn: () => true },
    {
      name: "All Recurring",
      filterFn: (b) => {
        const cat = categorizeBooking(b);
        const freq = (b.frequency || "").toLowerCase();
        return Boolean(RECURRING_CATEGORIES.includes(cat) || freq.includes("week") || freq.includes("month"));
      },
    },
    {
      name: "Weekly",
      filterFn: (b) => {
        const f = (b.frequency || "").toLowerCase();
        return Boolean(f === "weekly" || f === "5 days a week" || f === "3 times per week" || f.includes("week"));
      },
    },
    {
      name: "Biweekly",
      filterFn: (b) => {
        const f = (b.frequency || "").toLowerCase();
        return Boolean(f.includes("biweekly") || f.includes("every 2 weeks") || f.includes("2 week"));
      },
    },
    {
      name: "Triweekly",
      filterFn: (b) => {
        const f = (b.frequency || "").toLowerCase();
        return Boolean(f.includes("triweekly") || f.includes("tri weekly") || f.includes("3 week"));
      },
    },
    {
      name: "Monthly",
      filterFn: (b) => {
        const f = (b.frequency || "").toLowerCase();
        return Boolean(f === "monthly" || f.includes("month"));
      },
    },
    {
      name: "All One-Time",
      filterFn: (b) => {
        const f = (b.frequency || "").toLowerCase();
        const cat = categorizeBooking(b);
        return Boolean(f.includes("one time") || ONE_TIME_CATEGORIES.includes(cat));
      },
    },
    { name: "Deep Clean", filterFn: (b) => Boolean((b.service || "").toLowerCase().includes("deep")) },
    { name: "Standard Clean", filterFn: (b) => Boolean((b.service || "").toLowerCase().includes("express") || (b.service || "").toLowerCase().includes("stand")) },
    { name: "Move In/Out Clean", filterFn: (b) => Boolean((b.service || "").toLowerCase().includes("move")) },
    { name: "Commercial Cleaning", filterFn: (b) => Boolean((b.service || "").toLowerCase().includes("commercial")) },
    { name: "Airbnb Clean", filterFn: (b) => Boolean((b.service || "").toLowerCase().includes("bnb") || (b.service || "").toLowerCase().includes("airbnb")) },
  ];

  return categoriesToCompute.map(({ name, filterFn }) => {
    const subset = activeBookings.filter(filterFn);
    const totalBookings = subset.length;
    const totalCleanHours = subset.reduce((sum, b) => sum + (b.actualHours || b.durationHours || 0), 0);
    const avgCleanHours = totalBookings > 0 ? totalCleanHours / totalBookings : 0;

    const totalRevenue = subset.reduce((sum, b) => sum + b.subTotal, 0);
    const avgRevenuePerBooking = totalBookings > 0 ? totalRevenue / totalBookings : 0;
    const avgRevenuePerCleanHour = totalCleanHours > 0 ? totalRevenue / totalCleanHours : 0;

    const totalGrossCost = subset.reduce((sum, b) => sum + b.teamEarningsWithoutTips, 0);
    const avgGrossCostPerBooking = totalBookings > 0 ? totalGrossCost / totalBookings : 0;
    const avgGrossCostPerCleanHour = totalCleanHours > 0 ? totalGrossCost / totalCleanHours : 0;

    const totalGrossProfit = subset.reduce((sum, b) => sum + b.pcEarnings, 0);
    const avgGrossProfitPerBooking = totalBookings > 0 ? totalGrossProfit / totalBookings : 0;
    const avgGrossProfitPerCleanHour = totalCleanHours > 0 ? totalGrossProfit / totalCleanHours : 0;

    const grossProfitPct = totalRevenue > 0 ? totalGrossProfit / totalRevenue : 0;
    const laborPct = totalRevenue > 0 ? totalGrossCost / totalRevenue : 0;

    return {
      category: name,
      totalBookings,
      totalCleanHours,
      avgCleanHours,
      totalRevenue,
      avgRevenuePerBooking,
      avgRevenuePerCleanHour,
      totalGrossCost,
      avgGrossCostPerBooking,
      avgGrossCostPerCleanHour,
      totalGrossProfit,
      avgGrossProfitPerBooking,
      avgGrossProfitPerCleanHour,
      grossProfitPct,
      laborPct,
    };
  });
}

export function calculateExecutiveKpis(bookings: ServiceBookingRow[]): ExecutiveKpis {
  const breakdowns = calculateCategoryBreakdown(bookings);
  const allRow = breakdowns.find((b) => b.category === "All") || breakdowns[0];
  const recurringRow = breakdowns.find((b) => b.category === "All Recurring") || breakdowns[1];
  const oneTimeRow = breakdowns.find((b) => b.category === "All One-Time") || breakdowns[6];

  const totalRevenue = allRow?.totalRevenue || 0;
  const totalGrossProfit = allRow?.totalGrossProfit || 0;
  const totalGrossCost = allRow?.totalGrossCost || 0;
  const totalGrossProfitPct = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;

  const mrr = recurringRow?.totalRevenue || 0;
  const recurringRevenuePct = totalRevenue > 0 ? (mrr / totalRevenue) * 100 : 0;
  const recurringGrossProfitPct = (recurringRow?.grossProfitPct || 0) * 100;

  const totalBookings = allRow?.totalBookings || 0;
  const totalRecurringBookings = recurringRow?.totalBookings || 0;
  const totalOneTimeBookings = oneTimeRow?.totalBookings || (totalBookings - totalRecurringBookings);
  const totalCleanHours = allRow?.totalCleanHours || 0;

  const avgRevenuePerClean = allRow?.avgRevenuePerBooking || 0;
  const avgGrossProfitPerBooking = allRow?.avgGrossProfitPerBooking || 0;
  const avgRevenuePerCleanHour = allRow?.avgRevenuePerCleanHour || 0;
  const avgGrossCostPerCleanHour = allRow?.avgGrossCostPerCleanHour || 0;

  return {
    totalRevenue,
    totalGrossProfit,
    totalGrossProfitPct,
    totalGrossCost,
    mrr,
    recurringRevenuePct,
    recurringGrossProfitPct,
    totalBookings,
    totalRecurringBookings,
    totalOneTimeBookings,
    totalCleanHours,
    avgRevenuePerClean,
    avgGrossProfitPerBooking,
    avgRevenuePerCleanHour,
    avgGrossCostPerCleanHour,
  };
}

export function calculateTargetModels(bookings: ServiceBookingRow[]): TargetRateModel[] {
  const breakdowns = calculateCategoryBreakdown(bookings);
  const allRevenue = breakdowns.find((b) => b.category === "All")?.totalRevenue || 1;

  const targetConfigs = [
    { service: "Monthly", discountPct: 0.05, paidPortionPct: 0.95, baseHourlyRate: 60, cleanerRate: 17, targetPct: 0.7167 },
    { service: "Triweekly", discountPct: 0.10, paidPortionPct: 0.90, baseHourlyRate: 60, cleanerRate: 17, targetPct: 0.7167 },
    { service: "Biweekly", discountPct: 0.15, paidPortionPct: 0.85, baseHourlyRate: 60, cleanerRate: 17, targetPct: 0.7167 },
    { service: "Weekly", discountPct: 0.20, paidPortionPct: 0.80, baseHourlyRate: 60, cleanerRate: 17, targetPct: 0.7167 },
    { service: "Deep Clean", discountPct: 0.00, paidPortionPct: 1.00, baseHourlyRate: 60, cleanerRate: 23.5, targetPct: 0.6083 },
    { service: "Move In/Out", discountPct: 0.00, paidPortionPct: 1.00, baseHourlyRate: 60, cleanerRate: 23.5, targetPct: 0.6083 },
    { service: "Commercial", discountPct: 0.00, paidPortionPct: 1.00, baseHourlyRate: 50, cleanerRate: 20, targetPct: 0.6000 },
  ];

  return targetConfigs.map((cfg) => {
    const effectiveHourlyRate = cfg.baseHourlyRate * cfg.paidPortionPct;
    const cleanerDiscountCut = cfg.cleanerRate * cfg.discountPct;
    const cleanerEffectiveRate = cfg.cleanerRate - cleanerDiscountCut;
    const grossProfitPerHour = effectiveHourlyRate - cleanerEffectiveRate;

    // Find actual from breakdowns
    const matchedCategory = breakdowns.find(
      (b) => b.category.toLowerCase().includes(cfg.service.toLowerCase())
    );

    const actualRevenue = matchedCategory?.totalRevenue || 0;
    const actualProfitPct = (matchedCategory?.grossProfitPct || 0) * 100;
    const revPctOfTotal = allRevenue > 0 ? (actualRevenue / allRevenue) * 100 : 0;

    return {
      service: cfg.service,
      baseHourlyRate: cfg.baseHourlyRate,
      discountPct: cfg.discountPct * 100,
      paidPortionPct: cfg.paidPortionPct * 100,
      effectiveHourlyRate,
      cleanerBaseRate: cfg.cleanerRate,
      cleanerDiscountCutPct: cfg.discountPct * 100,
      cleanerEffectiveRate,
      grossProfitPerHour,
      grossProfitTargetPct: cfg.targetPct * 100,
      actualGrossProfitPct: actualProfitPct,
      actualGrossRevenue: actualRevenue,
      revenuePctOfTotal: revPctOfTotal,
    };
  });
}
