"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BadgeDollarSign, CalendarDays, CheckCircle2, FileClock, LockKeyhole, RefreshCw, Search, Settings2, UsersRound, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { createClient } from "@/lib/supabase/client";
import {
  fetchPayrollOverview,
  generatePayrollForPeriod,
  getBiweeklyPeriod,
  upsertCleanerPaymentSetting,
  type CleanerPaymentSetting,
  type CommercialAccount,
  type PayrollPeriodRow,
} from "@/lib/payroll";

type StatusFilter = "all" | PayrollPeriodRow["status"];

const statusLabels: Record<string, string> = {
  draft: "Draft",
  in_review: "Needs Review",
  partially_approved: "Partially Approved",
  approved: "Approved",
  paid: "Paid",
  locked: "Locked",
};

function money(value: number | null | undefined) {
  return `$${Number(value ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${month}/${day}/${year}`;
}

function getSetting(settings: CleanerPaymentSetting[], cleanerName?: string | null) {
  if (!cleanerName) return null;
  return settings.find((setting) => setting.cleaner_name?.toLowerCase() === cleanerName.toLowerCase()) ?? null;
}

function settingFromName(name: string, settings: CleanerPaymentSetting[]) {
  return getSetting(settings, name) ?? {
    cleaner_name: name,
    default_pay_type: "hourly",
    default_pay_rate: null,
    payment_method: null,
    requires_manual_review: false,
    active: true,
  } satisfies CleanerPaymentSetting;
}

function MetricCard({ label, value, icon: Icon, tone = "neutral" }: { label: string; value: string | number; icon: typeof WalletCards; tone?: "neutral" | "warning" | "good" }) {
  return (
    <Card className={tone === "warning" ? "border-amber-300/60 bg-amber-50/70 dark:bg-amber-950/20" : tone === "good" ? "border-emerald-300/60 bg-emerald-50/70 dark:bg-emerald-950/20" : ""}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase text-muted-foreground">{label}</p>
          <p className="mt-1 truncate text-xl font-black">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className = status === "paid" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : status === "approved" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200" : status === "locked" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : status === "in_review" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" : "bg-muted text-muted-foreground";
  return <Badge className={className}>{statusLabels[status] ?? status}</Badge>;
}

function TeamSettingRow({ name, setting, onSaved }: { name: string; setting: CleanerPaymentSetting; onSaved: () => void }) {
  const [draft, setDraft] = useState<CleanerPaymentSetting>(setting);
  const [saving, setSaving] = useState(false);


  async function save() {
    setSaving(true);
    await upsertCleanerPaymentSetting(draft);
    setSaving(false);
    onSaved();
  }

  return (
    <tr className="border-t border-border/70">
      <td className="px-3 py-3 font-black">{name}</td>
      <td className="px-3 py-3">
        <input
          className="h-9 w-24 rounded-md border bg-background px-2 text-right text-sm font-bold"
          min="0"
          step="0.01"
          type="number"
          value={draft.default_pay_rate ?? ""}
          onChange={(event) => setDraft({ ...draft, default_pay_rate: event.target.value ? Number(event.target.value) : null })}
        />
      </td>
      <td className="px-3 py-3">
        <select className="h-9 rounded-md border bg-background px-2 text-sm font-bold" value={draft.payment_method ?? ""} onChange={(event) => setDraft({ ...draft, payment_method: event.target.value || null })}>
          <option value="">Not set</option>
          <option>ACH</option>
          <option>Check</option>
          <option>Zelle</option>
          <option>Cash</option>
          <option>Other</option>
        </select>
      </td>
      <td className="px-3 py-3">
        <label className="inline-flex items-center gap-2 text-sm font-bold">
          <input checked={Boolean(draft.requires_manual_review)} type="checkbox" onChange={(event) => setDraft({ ...draft, requires_manual_review: event.target.checked })} />
          Manual review
        </label>
      </td>
      <td className="px-3 py-3">
        <input
          className="h-9 w-full rounded-md border bg-background px-2 text-sm font-bold"
          placeholder="Why this team needs review"
          value={draft.manual_review_reason ?? ""}
          onChange={(event) => setDraft({ ...draft, manual_review_reason: event.target.value || null })}
        />
      </td>
      <td className="px-3 py-3 text-right">
        <Button disabled={saving} size="sm" type="button" onClick={save}>{saving ? "Saving" : "Save"}</Button>
      </td>
    </tr>
  );
}

export default function CommercialPayrollPage() {
  const supabase = useMemo(() => createClient(), []);
  const [periods, setPeriods] = useState<PayrollPeriodRow[]>([]);
  const [accounts, setAccounts] = useState<CommercialAccount[]>([]);
  const [settings, setSettings] = useState<CleanerPaymentSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const currentPeriod = useMemo(() => getBiweeklyPeriod(), []);

  async function load() {
    setLoading(true);
    const overview = await fetchPayrollOverview();
    setPeriods(overview.periods);
    setAccounts(overview.accounts);
    setSettings(overview.settings);
    setLoading(false);
  }

  useEffect(() => {
    let mounted = true;
    fetchPayrollOverview().then((overview) => {
      if (!mounted) return;
      setPeriods(overview.periods);
      setAccounts(overview.accounts);
      setSettings(overview.settings);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const currentGenerated = periods.find((period) => period.start_date === currentPeriod.startDate && period.end_date === currentPeriod.endDate) ?? null;
  const activeAccounts = accounts.filter((account) => account.source_sheet !== "Team supplies");
  const teamNames = Array.from(new Set(activeAccounts.map((account) => account.cleaner_name).filter(Boolean))) as string[];
  const missingCleaner = activeAccounts.filter((account) => !account.cleaner_name).length;
  const missingPayRate = activeAccounts.filter((account) => !account.cleaner_hourly_rate && !getSetting(settings, account.cleaner_name)?.default_pay_rate).length;
  const manualReviewTeams = settings.filter((setting) => setting.requires_manual_review).length;
  const currentTotals = currentGenerated ?? periods[0] ?? null;

  async function generate() {
    setGenerating(true);
    setMessage(null);
    try {
      const { data } = await supabase.auth.getUser();
      const forceRecalculate = currentGenerated ? window.confirm("Recalculate from current schedules? Existing draft entries for this period will be replaced.") : false;
      const result = await generatePayrollForPeriod(currentPeriod, { userId: data.user?.id ?? null, forceRecalculate });
      setMessage(`Generated ${result.createdEntries} service entries for ${currentPeriod.label}.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not generate payroll for this period.");
    } finally {
      setGenerating(false);
    }
  }

  const visiblePeriods = periods.filter((period) => {
    if (statusFilter !== "all" && period.status !== statusFilter) return false;
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [period.label, period.start_date, period.end_date, period.status].some((value) => String(value ?? "").toLowerCase().includes(query));
  });

  return (
    <DashboardShell userEmail="pristinecleanersoc@gmail.com">
      <div className="space-y-5">
        <section className="rounded-lg border border-border/80 bg-card/95 p-5 shadow-[0_22px_60px_-52px_hsl(210_40%_20%)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase text-primary"><WalletCards className="size-4" /> Payments</p>
              <h1 className="mt-2 text-2xl font-black tracking-normal">Commercial Payroll</h1>
              <p className="mt-1 max-w-3xl text-sm font-semibold text-muted-foreground">Biweekly payroll for commercial cleaning teams, calculated from account schedules, account hours, pay settings, and manual review flags.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={generating} onClick={generate} type="button">
                <RefreshCw className="size-4" /> {generating ? "Generating" : currentGenerated ? "Recalculate from current schedules" : "Generate payroll for this period"}
              </Button>
              {currentGenerated ? <Button asChild variant="outline"><Link href={`/payments/commercial-payroll/${currentGenerated.id}`}>Open current period</Link></Button> : null}
            </div>
          </div>
          {message ? <p className="mt-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-bold">{message}</p> : null}
        </section>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={CalendarDays} label="Current pay period" value={currentPeriod.label} />
          <MetricCard icon={BadgeDollarSign} label="Total estimated payroll" value={money(currentTotals?.total_estimated_amount)} />
          <MetricCard icon={CheckCircle2} label="Total approved payroll" value={money(periods.filter((period) => period.status === "approved" || period.status === "paid").reduce((sum, period) => sum + Number(period.total_final_amount ?? 0), 0))} tone="good" />
          <MetricCard icon={FileClock} label="Total paid" value={money(periods.filter((period) => period.status === "paid").reduce((sum, period) => sum + Number(period.total_final_amount ?? 0), 0))} tone="good" />
          <MetricCard icon={UsersRound} label="Active commercial accounts" value={activeAccounts.length} />
          <MetricCard icon={UsersRound} label="Teams to pay" value={teamNames.length} />
          <MetricCard icon={AlertTriangle} label="Missing pay rate" value={missingPayRate} tone={missingPayRate ? "warning" : "good"} />
          <MetricCard icon={AlertTriangle} label="Missing assigned cleaner" value={missingCleaner} tone={missingCleaner ? "warning" : "good"} />
          <MetricCard icon={AlertTriangle} label="Teams requiring manual review" value={manualReviewTeams} tone={manualReviewTeams ? "warning" : "good"} />
          <MetricCard icon={LockKeyhole} label="Locked periods" value={periods.filter((period) => period.status === "locked").length} />
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Payment History</CardTitle>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">Open a period to review teams, account hours, adjustments, approvals, and paid status.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input className="h-10 rounded-md border bg-background pl-9 pr-3 text-sm font-bold" placeholder="Search periods" value={search} onChange={(event) => setSearch(event.target.value)} />
              </label>
              <select className="h-10 rounded-md border bg-background px-3 text-sm font-bold" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="in_review">Needs Review</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
                <option value="locked">Locked</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[860px] border-collapse text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3">Period</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Hours</th>
                    <th className="px-3 py-3 text-right">Estimated</th>
                    <th className="px-3 py-3 text-right">Final</th>
                    <th className="px-3 py-3">Generated</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? <tr><td className="px-3 py-8 text-center font-bold text-muted-foreground" colSpan={7}>Loading commercial payroll…</td></tr> : null}
                  {!loading && visiblePeriods.length === 0 ? <tr><td className="px-3 py-8 text-center font-bold text-muted-foreground" colSpan={7}>No payroll periods match this view.</td></tr> : null}
                  {visiblePeriods.map((period) => (
                    <tr className="border-t" key={period.id}>
                      <td className="px-3 py-3">
                        <p className="font-black">{period.label ?? `${dateLabel(period.start_date)} - ${dateLabel(period.end_date)}`}</p>
                        <p className="text-xs font-bold text-muted-foreground">{dateLabel(period.start_date)} to {dateLabel(period.end_date)}</p>
                      </td>
                      <td className="px-3 py-3"><StatusBadge status={period.status} /></td>
                      <td className="px-3 py-3 text-right font-black">{Number(period.total_adjusted_hours ?? period.total_estimated_hours ?? 0).toFixed(2)}</td>
                      <td className="px-3 py-3 text-right font-black">{money(period.total_estimated_amount)}</td>
                      <td className="px-3 py-3 text-right font-black">{money(period.total_final_amount)}</td>
                      <td className="px-3 py-3 text-xs font-bold text-muted-foreground">{period.generated_at ? new Date(period.generated_at).toLocaleString() : "Draft"}</td>
                      <td className="px-3 py-3 text-right"><Button asChild size="sm" variant="outline"><Link href={`/payments/commercial-payroll/${period.id}`}>Open</Link></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings2 className="size-4" /> Cleaner / Team Payment Settings</CardTitle>
            <p className="text-sm font-semibold text-muted-foreground">Set default hourly rates, payment method, and reusable manual review flags. Lucia Portillo is configured here, not in payroll logic.</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[920px] border-collapse text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3">Cleaner / Team</th>
                    <th className="px-3 py-3">Default rate</th>
                    <th className="px-3 py-3">Payment method</th>
                    <th className="px-3 py-3">Review</th>
                    <th className="px-3 py-3">Reason</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teamNames.map((name) => (
                    <TeamSettingRow key={name} name={name} setting={settingFromName(name, settings)} onSaved={load} />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
