import { NextResponse } from "next/server";
import {
  checkAndSendRenewalAlerts,
  CommercialAccountRecord,
  getDaysUntilDate,
  JAKE_PHONE,
  RENEWAL_ALERT_THRESHOLD_DAYS,
} from "@/lib/sms/commercial-renewal-reminders";
import { importedCommercialAccounts } from "@/lib/commercial-accounts-data";
import { createClient } from "@/lib/supabase/client";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const specificAccount = url.searchParams.get("account") || undefined;

    let accountsList: CommercialAccountRecord[] = [];
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from("commercial_accounts").select("*");
      if (!error && data && data.length > 0) {
        accountsList = data as CommercialAccountRecord[];
      }
    } catch {
      // ignore
    }

    if (!accountsList.length) {
      accountsList = importedCommercialAccounts as CommercialAccountRecord[];
    }

    const filteredList = specificAccount
      ? accountsList.filter((a) =>
          (a.name || "")
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]/g, "")
            .includes(specificAccount.toLowerCase().trim().replace(/[^a-z0-9]/g, ""))
        )
      : accountsList;

    const accountsWithExpiry = filteredList
      .filter((a) => Boolean(a.contract_end))
      .map((a) => {
        const days = getDaysUntilDate(a.contract_end as string);
        return {
          id: a.id,
          name: a.name,
          city: a.city,
          revenue: a.revenue,
          cleaner_name: a.cleaner_name,
          contract_end: a.contract_end,
          daysRemaining: days,
          isExpiringWithin35Days: days <= RENEWAL_ALERT_THRESHOLD_DAYS && days >= 0,
        };
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining);

    return NextResponse.json({
      targetPhone: JAKE_PHONE,
      thresholdDays: RENEWAL_ALERT_THRESHOLD_DAYS,
      accounts: accountsWithExpiry,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      testAccountName,
      toPhone = JAKE_PHONE,
      isTest = false,
      customAccounts,
    } = body;

    const result = await checkAndSendRenewalAlerts({
      toPhone,
      specificAccountName: testAccountName,
      isTest: isTest || Boolean(testAccountName),
      customAccounts,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
