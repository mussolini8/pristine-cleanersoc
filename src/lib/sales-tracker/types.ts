export type ServiceCategory =
  | "All"
  | "All Recurring"
  | "Weekly"
  | "Biweekly"
  | "Triweekly"
  | "Monthly"
  | "All One-Time"
  | "Deep Clean"
  | "Standard Clean"
  | "Move In/Out Clean"
  | "Commercial Cleaning"
  | "Airbnb Clean"
  | "Other";

export type ServiceBookingRow = {
  id: string;
  date: string;
  clientName: string;
  service: string;
  serviceCategory: ServiceCategory;
  frequency: string;
  city: string;
  cleanerTeam: string;
  subTotal: number;
  salesTax: number;
  finalAmount: number;
  tip: number;
  teamEarningsWithoutTips: number;
  teamEarningsTotal: number;
  laborPct: number; // teamEarningsWithoutTips / subTotal
  merchantFee: number;
  stripeFee: number;
  pcEarnings: number; // subTotal - teamEarningsWithoutTips - merchantFee - stripeFee
  pcProfitPct: number; // pcEarnings / subTotal
  durationHours: number;
  actualHours: number;
  bookedBy?: string;
  status: "completed" | "scheduled" | "cancelled";
  notes?: string;
};

export type CategoryPerformance = {
  category: ServiceCategory;
  totalBookings: number;
  totalCleanHours: number;
  avgCleanHours: number;
  totalRevenue: number;
  avgRevenuePerBooking: number;
  avgRevenuePerCleanHour: number;
  totalGrossCost: number;
  avgGrossCostPerBooking: number;
  avgGrossCostPerCleanHour: number;
  totalGrossProfit: number;
  avgGrossProfitPerBooking: number;
  avgGrossProfitPerCleanHour: number;
  grossProfitPct: number;
  laborPct: number;
};

export type ExecutiveKpis = {
  totalRevenue: number;
  totalGrossProfit: number;
  totalGrossProfitPct: number;
  totalGrossCost: number;
  mrr: number; // Monthly Recurring Revenue
  recurringRevenuePct: number; // MRR / Total Revenue
  recurringGrossProfitPct: number;
  totalBookings: number;
  totalRecurringBookings: number;
  totalOneTimeBookings: number;
  totalCleanHours: number;
  avgRevenuePerClean: number;
  avgGrossProfitPerBooking: number;
  avgRevenuePerCleanHour: number;
  avgGrossCostPerCleanHour: number;
};

export type TargetRateModel = {
  service: string;
  baseHourlyRate: number;
  discountPct: number;
  paidPortionPct: number;
  effectiveHourlyRate: number;
  cleanerBaseRate: number;
  cleanerDiscountCutPct: number;
  cleanerEffectiveRate: number;
  grossProfitPerHour: number;
  grossProfitTargetPct: number;
  actualGrossProfitPct: number;
  actualGrossRevenue: number;
  revenuePctOfTotal: number;
};
