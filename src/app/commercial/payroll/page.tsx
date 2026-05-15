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
type PeriodEntryIndexRow = {
  pay_period_id: string;
  cleaner_name: string | null;
  account_name: string | null;
};

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
  const className = status === "paid"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
    : status === "approved"
      ? "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200"
      : status === "locked"
        ? "border-slate-300 bg-slate-950 text-white dark:border-slate-700 dark:bg-slate-100 dark:text-slate-950"
        : status === "in_review"
          ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          : "border-border bg-muted/60 text-muted-foreground";
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
  const [periodEntryIndex, setPeriodEntryIndex] = useState<PeriodEntryIndexRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [cleanerFilter, setCleanerFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const currentPeriod = useMemo(() => getBiweeklyPeriod(), []);

  async function load() {
    setLoading(true);
    const overview = await fetchPayrollOverview();
    const { data: indexRows } = await supabase
      .from("commercial_payroll_entries")
      .select("pay_period_id,cleaner_name,account_name")
      .order("service_date", { ascending: false })
      .limit(3000);
    setPeriods(overview.periods);
    setAccounts(overview.accounts);
    setSettings(overview.settings);
    setPeriodEntryIndex((indexRows ?? []) as PeriodEntryIndexRow[]);
    setLoading(false);
  }

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetchPayrollOverview(),
      supabase.from("commercial_payroll_entries").select("pay_period_id,cleaner_name,account_name").order("service_date", { ascending: false }).limit(3000),
    ]).then(([overview, indexResult]) => {
      if (!mounted) return;
      setPeriods(overview.periods);
      setAccounts(overview.accounts);
      setSettings(overview.settings);
      setPeriodEntryIndex((indexResult.data ?? []) as PeriodEntryIndexRow[]);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [supabase]);

  const currentGenerated = periods.find((period) => period.start_date === currentPeriod.startDate && period.end_date === currentPeriod.endDate) ?? null;
  const activeAccounts = accounts.filter((account) => account.source_sheet !== "Team supplies");
  const teamNames = Array.from(new Set(activeAccounts.map((account) => account.cleaner_name).filter(Boolean))) as string[];
  const missingCleaner = activeAccounts.filter((account) => !account.cleaner_name).length;
  const missingPayRate = activeAccounts.filter((account) => !account.cleaner_hourly_rate && !getSetting(settings, account.cleaner_name)?.default_pay_rate).length;
  const manualReviewTeams = settings.filter((setting) => setting.requires_manual_review).length;
  const currentTotals = currentGenerated ?? periods[0] ?? null;
  const entryIndexByPeriod = useMemo(() => {
    const map = new Map<string, PeriodEntryIndexRow[]>();
    for (const row of periodEntryIndex) {
      const rows = map.get(row.pay_period_id) ?? [];
      rows.push(row);
      map.set(row.pay_period_id, rows);
    }
    return map;
  }, [periodEntryIndex]);
  const periodOptions = periods.map((period) => ({ value: period.id, label: period.label ?? `${dateLabel(period.start_date)} - ${dateLabel(period.end_date)}` }));
  const cleanerOptions = Array.from(new Set(periodEntryIndex.map((entry) => entry.cleaner_name).filter(Boolean))).sort() as string[];
  const accountOptions = Array.from(new Set(periodEntryIndex.map((entry) => entry.account_name).filter(Boolean))).sort() as string[];

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
    if (periodFilter !== "all" && period.id !== periodFilter) return false;
    if (statusFilter !== "all" && period.status !== statusFilter) return false;
    const entries = entryIndexByPeriod.get(period.id) ?? [];
    if (cleanerFilter !== "all" && !entries.some((entry) => entry.cleaner_name === cleanerFilter)) return false;
    if (accountFilter !== "all" && !entries.some((entry) => entry.account_name === accountFilter)) return false;
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [
      period.label,
      period.start_date,
      period.end_date,
      period.status,
      ...entries.flatMap((entry) => [entry.cleaner_name, entry.account_name]),
    ].some((value) => String(value ?? "").toLowerCase().includes(query));
  });

  return (
    <DashboardShell userEmail="pristinecleanersoc@gmail.com">
      <div className="space-y-5">
        <section className="rounded-lg border border-border/80 bg-card p-5 shadow-[0_22px_60px_-52px_hsl(210_40%_20%)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase text-primary"><WalletCards className="size-4" /> Commercial Operations</p>
              <h1 className="mt-2 text-3xl font-black tracking-normal">Commercial Payroll</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2"><Badge variant="outline" className="px-3 py-1 text-sm font-black">{currentPeriod.label}</Badge><span className="text-sm font-semibold text-muted-foreground">Commercial-only payroll periods, generated from account schedules and team pay settings.</span></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={generating} onClick={generate} type="button">
                <RefreshCw className="size-4" /> {generating ? "Generating" : currentGenerated ? "Recalculate from current schedules" : "Generate payroll for this period"}
              </Button>
              {currentGenerated ? <Button asChild variant="outline"><Link href={`/commercial/payroll/${currentGenerated.id}`}>Open current period</Link></Button> : null}
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

        <Card className="border-border/80">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Commercial Payroll Periods</CardTitle>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">Open a period to review teams, account hours, adjustments, approvals, and paid status.</p>
              </div>
              <Badge variant="outline" className="px-3 py-1 font-black">{visiblePeriods.length} visible</Badge>
            </div>
            <div className="grid gap-2 rounded-lg border bg-muted/20 p-3 md:grid-cols-2 xl:grid-cols-5">
              <label className="relative xl:col-span-2">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input className="h-10 rounded-md border bg-background pl-9 pr-3 text-sm font-bold" placeholder="Search periods, cleaners, accounts" value={search} onChange={(event) => setSearch(event.target.value)} />
              </label>
              <select className="h-10 rounded-md border bg-background px-3 text-sm font-bold" value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)}>
                <option value="all">All periods</option>
                {periodOptions.map((period) => <option key={period.value} value={period.value}>{period.label}</option>)}
              </select>
              <select className="h-10 rounded-md border bg-background px-3 text-sm font-bold" value={cleanerFilter} onChange={(event) => setCleanerFilter(event.target.value)}>
                <option value="all">All cleaners</option>
                {cleanerOptions.map((cleaner) => <option key={cleaner} value={cleaner}>{cleaner}</option>)}
              </select>
              <select className="h-10 rounded-md border bg-background px-3 text-sm font-bold" value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}>
                <option value="all">All accounts</option>
                {accountOptions.map((account) => <option key={account} value={account}>{account}</option>)}
              </select>
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
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
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
                  {loading ? <tr><td className="px-3 py-10 text-center font-bold text-muted-foreground" colSpan={7}>Loading commercial payroll...</td></tr> : null}
                  {!loading && visiblePeriods.length === 0 ? <tr><td className="px-3 py-10 text-center" colSpan={7}><div className="mx-auto max-w-md"><AlertTriangle className="mx-auto size-7 text-muted-foreground" /><p className="mt-3 font-black">No commercial payroll periods match these filters.</p><p className="mt-1 text-sm font-semibold text-muted-foreground">Clear a filter or generate the current open commercial period.</p></div></td></tr> : null}
                  {visiblePeriods.map((period) => (
                    <tr className="border-t transition-colors hover:bg-accent/30" key={period.id}>
                      <td className="px-3 py-3">
                        <p className="font-black">{period.label ?? `${dateLabel(period.start_date)} - ${dateLabel(period.end_date)}`}</p>
                        <p className="text-xs font-bold text-muted-foreground">{dateLabel(period.start_date)} to {dateLabel(period.end_date)}</p>
                      </td>
                      <td className="px-3 py-3"><StatusBadge status={period.status} /></td>
                      <td className="px-3 py-3 text-right font-black">{Number(period.total_adjusted_hours ?? period.total_estimated_hours ?? 0).toFixed(2)}</td>
                      <td className="px-3 py-3 text-right font-black">{money(period.total_estimated_amount)}</td>
                      <td className="px-3 py-3 text-right font-black">{money(period.total_final_amount)}</td>
                      <td className="px-3 py-3 text-xs font-bold text-muted-foreground">{period.generated_at ? new Date(period.generated_at).toLocaleString() : "Draft"}</td>
                      <td className="px-3 py-3 text-right"><Button asChild size="sm" variant="outline"><Link href={`/commercial/payroll/${period.id}`}>Open</Link></Button></td>
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
