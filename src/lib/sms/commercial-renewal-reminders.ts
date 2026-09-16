import { sendQuoSms } from "@/lib/sms/quo-client";
import { importedCommercialAccounts } from "@/lib/commercial-accounts-data";
import { createClient } from "@/lib/supabase/client";

export const JAKE_PHONE = "+12039091380";
export const RENEWAL_ALERT_THRESHOLD_DAYS = 35;

export type CommercialAccountRecord = {
  id?: string;
  name?: string;
  city?: string | null;
  revenue?: number | null;
  cleaner_name?: string | null;
  contract_end?: string | null;
  [key: string]: unknown;
};

export type CommercialRenewalAccount = {
  id: string;
  name: string;
  city: string | null;
  revenue: number | null;
  cleaner_name: string | null;
  contract_end: string | null;
  daysRemaining: number;
};

export type RenewalAlertResult = {
  accountName: string;
  contractEnd: string;
  daysRemaining: number;
  success: boolean;
  message: string;
  details?: unknown;
};

/**
 * Calculates remaining calendar days between a target date and reference date (defaults to today).
 */
export function getDaysUntilDate(targetDateStr: string, fromDate = new Date()): number {
  // Normalize both to UTC midnight to avoid DST or timezone drift
  const [year, month, day] = targetDateStr.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1, day));

  const fromUTC = new Date(
    Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate())
  );

  const diffMs = target.getTime() - fromUTC.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Formats a clean, professional English reminder alert for Jake
 */
export function formatRenewalAlertMessage({
  accountName,
  city,
  contractEnd,
  daysRemaining,
  revenue,
  cleanerName,
  isTest = false,
}: {
  accountName: string;
  city?: string | null;
  contractEnd: string;
  daysRemaining: number;
  revenue?: number | null;
  cleanerName?: string | null;
  isTest?: boolean;
}): string {
  const [year, month, day] = contractEnd.split("-");
  const formattedDate = `${month}/${day}/${year}`;
  const priceStr = revenue ? `$${Number(revenue).toFixed(2)}/month` : "N/A";

  const prefix = isTest
    ? "🔔 [TEST] Pristine Cleaners Commercial Renewal Alert"
    : "🔔 Commercial Contract Renewal Alert (35-Day Notice)";

  return `${prefix}

Account: ${accountName}
Location: ${city || "Orange County"}
Renewal Date: ${formattedDate} (${daysRemaining} days remaining)
Current Monthly Rate: ${priceStr}
Assigned Cleaner: ${cleanerName || "Unassigned"}

⚡ Action required: Review contract performance, prepare updated renewal proposal, and notify the client regarding any rate adjustments.`;
}

/**
 * Check commercial accounts and send Quo renewal alerts
 */
export async function checkAndSendRenewalAlerts({
  toPhone = JAKE_PHONE,
  specificAccountName,
  isTest = false,
  customAccounts,
}: {
  toPhone?: string;
  specificAccountName?: string;
  isTest?: boolean;
  customAccounts?: CommercialAccountRecord[];
} = {}): Promise<{
  totalChecked: number;
  alertsSent: number;
  results: RenewalAlertResult[];
}> {
  let accountsList: CommercialAccountRecord[] =
    customAccounts || [];

  if (!accountsList.length) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("commercial_accounts")
        .select("*");
      if (!error && data && data.length > 0) {
        accountsList = data;
      }
    } catch {
      // Ignore and fallback
    }
  }

  if (!accountsList.length) {
    accountsList = importedCommercialAccounts;
  }

  const results: RenewalAlertResult[] = [];
  let alertsSent = 0;

  for (const acc of accountsList) {
    if (!acc.contract_end) continue;

    const daysRemaining = getDaysUntilDate(acc.contract_end);
    const normalizedName = (acc.name || "").toLowerCase().trim();

    // If a specific account was requested (e.g. "13demarzo")
    if (specificAccountName) {
      const target = specificAccountName.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
      const current = normalizedName.replace(/[^a-z0-9]/g, "");
      if (!current.includes(target) && !target.includes(current)) {
        continue;
      }
    } else {
      // Normal production rule: Alert 35 days before expiration
      // Check if daysRemaining <= 35 and >= 0 (or within renewal window)
      if (daysRemaining > RENEWAL_ALERT_THRESHOLD_DAYS || daysRemaining < 0) {
        continue;
      }
    }

    const message = formatRenewalAlertMessage({
      accountName: acc.name || "Unknown Account",
      city: acc.city,
      contractEnd: acc.contract_end,
      daysRemaining,
      revenue: acc.revenue,
      cleanerName: acc.cleaner_name,
      isTest,
    });

    try {
      const smsRes = await sendQuoSms({
        to: toPhone,
        message,
      });

      results.push({
        accountName: acc.name || "Unknown Account",
        contractEnd: acc.contract_end,
        daysRemaining,
        success: smsRes.success,
        message: smsRes.message,
        details: smsRes.data,
      });

      if (smsRes.success) {
        alertsSent++;
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      results.push({
        accountName: acc.name || "Unknown Account",
        contractEnd: acc.contract_end,
        daysRemaining,
        success: false,
        message: errMsg,
      });
    }
  }

  return {
    totalChecked: accountsList.length,
    alertsSent,
    results,
  };
}
