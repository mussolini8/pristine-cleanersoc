import {
  generateMonthlyCommercialBookings,
  parseBookingKoalaRowsForMonth,
} from "./monthly-reconciler";
import type { ServiceBookingRow } from "./types";

// Pre-generated commercial bookings for October 2026
export const octoberCommercialBookings: ServiceBookingRow[] = generateMonthlyCommercialBookings("2026-10");

// Helper for October BookingKoala conversion
export const parseSupabaseRowsToOctoberBookings = (
  workLogs: any[] = [],
  paymentRows: any[] = [],
  commEntries: any[] = []
): ServiceBookingRow[] => parseBookingKoalaRowsForMonth(workLogs, paymentRows, commEntries, "2026-10");

// Default seed list for October
export const octoberSalesTrackerBookings: ServiceBookingRow[] = [...octoberCommercialBookings];
