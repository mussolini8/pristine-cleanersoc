"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BadgeCheck, CalendarDays, Eye, Filter, Plus, RefreshCw, Search, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { createClient } from "@/lib/supabase/client";
import { generatePayrollForPeriod, getBiweeklyPeriod, updateEntryStatus, type CommercialAccount, type PayrollEntryRow, type PayrollPeriodRow } from "@/lib/payroll";

type StatusFilter = "all" | "needs_review" | "approved" | "paid" | "unpaid" | "draft";
type EntryWithPeriod = PayrollEntryRow & { period?: PayrollPeriodRow | null };

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function iso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfWeek(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function endOfWeek(date = new Date()) {
  const end = startOfWeek(date);
  end.setDate(end.getDate() + 6);
  return end;
}

function periodLabel(start: string, end: string) {
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  return `${a.toLocaleDateString("en-US", { month: "short", day: "numeric" })}-${b.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function money(value: number | null | undefined) {
  return `$${Number(value ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function exceptionLabel(entry: PayrollEntryRow) {
  if (entry.review_notes) return entry.review_notes;
  const exceptions = entry.exceptions ?? [];
  if (exceptions.includes("missing_account_pay_settings")) return "Missing account pay settings";
  if (exceptions.includes("missing_pay_rate")) return "Missing rate";
  if (exceptions.includes("missing_cleaner")) return "Missing cleaner";
  if (exceptions.includes("missing_schedule")) return "Missing schedule rule";
  if (exceptions.includes("missing_anchor_date")) return "Missing anchor date";
  if (exceptions.includes("zero_hours")) return "Missing paid hours";
  return entry.requires_manual_review ? "Needs review" : "Clear";
}

function StatusBadge({ status }: { status: string }) {
  const className = status === "paid"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
    : status === "approved"
      ? "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200"
      : status === "needs_review"
        ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        : "border-border bg-muted/60 text-muted-foreground";
  return <Badge className={className}>{status.replace("_", " ")}</Badge>;
}

function SourceBadge({ source }: { source?: string | null }) {
  return source === "schedule_rule"
    ? <Badge className="border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-200">Synced</Badge>
    : <Badge className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200">Fallback</Badge>;
}

function Metric({ label, value, note, tone = "neutral" }: { label: string; value: string | number; note?: string; tone?: "neutral" | "good" | "warning" }) {
  const toneClass = tone === "warning"
    ? "border-amber-200/80 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/20"
    : tone === "good"
      ? "border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20"
      : "border-border/80 bg-card";

  return (
    <Card className={toneClass}>
      <CardContent className="p-4">
        <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-black leading-none">{value}</p>
        {note ? <p className="mt-2 text-xs font-semibold text-muted-foreground">{note}</p> : null}
      </CardContent>
    </Card>
  );
}

export default function CommercialOverviewPage() {
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState<EntryWithPeriod[]>([]);
  const [accounts, setAccounts] = useState<CommercialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => iso(startOfWeek()));
  const [weekEnd, setWeekEnd] = useState(() => iso(endOfWeek()));
  const [dayFilter, setDayFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
  const [cleanerFilter, setCleanerFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [generating, setGenerating] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: entryRows }, { data: periodRows }, { data: accountRows }] = await Promise.all([
      supabase.from("commercial_payroll_entries").select("*").gte("service_date", weekStart).lte("service_date", weekEnd).order("service_date"),
      supabase.from("commercial_pay_periods").select("*").order("start_date", { ascending: false }).limit(200),
      supabase.from("commercial_accounts").select("*").order("name"),
    ]);
    const periodMap = new Map(((periodRows ?? []) as PayrollPeriodRow[]).map((period) => [period.id, period]));
    setEntries(((entryRows ?? []) as PayrollEntryRow[]).map((entry) => ({ ...entry, period: periodMap.get(entry.pay_period_id) ?? null })));
    setAccounts((accountRows ?? []) as CommercialAccount[]);
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [weekStart, weekEnd]);

  function setCurrentWeek() {
    setWeekStart(iso(startOfWeek()));
    setWeekEnd(iso(endOfWeek()));
  }

  function applyMonthYear() {
    const year = Number(yearFilter) || new Date().getFullYear();
    const month = monthFilter ? Number(monthFilter) - 1 : new Date().getMonth();
    setWeekStart(iso(new Date(year, month, 1)));
    setWeekEnd(iso(new Date(year, month + 1, 0)));
  }

  async function generateCurrentPeriod() {
    setGenerating(true);
    setMessage(null);
    try {
      const { data } = await supabase.auth.getUser();
      const result = await generatePayrollForPeriod(getBiweeklyPeriod(new Date()), { userId: data.user?.id ?? null, forceRecalculate: true });
      setMessage(`Commercial payroll prepared ${result.createdEntries} synced entries for the current open period.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not prepare commercial payroll.");
    } finally {
      setGenerating(false);
    }
  }

  async function setEntryStatus(entry: EntryWithPeriod, status: PayrollEntryRow["status"]) {
    if (["paid", "locked"].includes(entry.status)) return;
    await updateEntryStatus(entry, status);
    await load();
  }

  const cleanerOptions = Array.from(new Set(entries.map((entry) => entry.cleaner_name).filter(Boolean))) as string[];
  const accountOptions = Array.from(new Set(entries.map((entry) => entry.account_name).filter(Boolean)));
  const visible = entries.filter((entry) => {
    if (dayFilter !== "all" && entry.scheduled_day !== dayFilter) return false;
    if (cleanerFilter !== "all" && entry.cleaner_name !== cleanerFilter) return false;
    if (accountFilter !== "all" && entry.account_name !== accountFilter) return false;
    if (statusFilter === "needs_review" && entry.status !== "needs_review" && !entry.requires_manual_review) return false;
    if (statusFilter === "approved" && entry.status !== "approved") return false;
    if (statusFilter === "paid" && entry.status !== "paid") return false;
    if (statusFilter === "unpaid" && ["paid", "locked"].includes(entry.status)) return false;
    if (statusFilter === "draft" && entry.status !== "draft") return false;
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [entry.account_name, entry.cleaner_name, entry.review_notes, entry.source, entry.scheduled_day].some((value) => String(value ?? "").toLowerCase().includes(query));
  });
  const metrics = {
    cleanings: visible.length,
    hours: visible.reduce((sum, entry) => sum + Number(entry.base_hours ?? 0), 0),
    pending: visible.filter((entry) => !["approved", "paid"].includes(entry.status)).reduce((sum, entry) => sum + Number(entry.final_amount ?? 0), 0),
    review: visible.filter((entry) => entry.status === "needs_review" || entry.requires_manual_review).length,
    approved: visible.filter((entry) => entry.status === "approved").length,
    paid: visible.filter((entry) => entry.status === "paid").length,
    open: visible.filter((entry) => !["paid", "locked"].includes(entry.status)).length,
    activeAccounts: accounts.filter((account) => account.source_sheet !== "Team supplies").length,
  };

  return (
    <DashboardShell userEmail="pristinecleanersoc@gmail.com">
      <div className="space-y-6">
        <section className="rounded-lg border border-border/80 bg-card p-5 shadow-[0_22px_60px_-52px_hsl(210_40%_20%)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-3xl">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-primary"><CalendarDays className="size-4" /> Commercial operations</p>
              <h1 className="mt-3 text-3xl font-black tracking-normal">Commercial cleanings</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="px-3 py-1 text-sm font-black">{periodLabel(weekStart, weekEnd)}</Badge>
                <span className="text-sm font-semibold text-muted-foreground">Scheduled work, review flags, and payroll readiness for this period.</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline"><Link href="/commercial/accounts"><Plus className="size-4" /> Accounts</Link></Button>
              <Button asChild variant="outline"><Link href="/commercial/payroll"><WalletCards className="size-4" /> Payroll</Link></Button>
              <Button disabled={generating} onClick={generateCurrentPeriod} type="button"><RefreshCw className="size-4" /> {generating ? "Preparing" : "Prepare payroll"}</Button>
            </div>
          </div>
          {message ? <p className="mt-5 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-bold">{message}</p> : null}
        </section>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Cleanings" value={metrics.cleanings} note="Visible in this view" />
          <Metric label="Scheduled hours" value={metrics.hours.toFixed(2)} note="Before adjustments" />
          <Metric label="Payroll pending" value={money(metrics.pending)} note="Open commercial amount" tone={metrics.pending > 0 ? "warning" : "neutral"} />
          <Metric label="Needs review" value={metrics.review} note="Missing data or manual check" tone={metrics.review > 0 ? "warning" : "good"} />
          <Metric label="Approved" value={metrics.approved} note="Ready for payroll" tone="good" />
          <Metric label="Paid" value={metrics.paid} note="Already paid" tone="good" />
          <Metric label="Unpaid / open" value={metrics.open} note="Can still be reviewed" />
          <Metric label="Active accounts" value={metrics.activeAccounts} note="Commercial account base" />
        </div>

        <Card className="border-border/80">
          <CardContent className="space-y-5 p-4 sm:p-5">
            <div className="flex flex-col gap-4 rounded-lg border bg-muted/20 p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-muted-foreground"><Filter className="size-4" /> Filters</p>
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">Narrow the schedule without leaving the commercial workspace.</p>
                </div>
                <Button variant="outline" type="button" onClick={setCurrentWeek}>Current week</Button>
              </div>
              <div className="grid gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))] xl:grid-cols-[repeat(6,minmax(0,1fr))]">
                <label className="space-y-1"><span className="text-xs font-black uppercase text-muted-foreground">Start</span><input className="h-10 w-full rounded-md border bg-background px-3 text-sm font-bold" type="date" value={weekStart} onChange={(event) => setWeekStart(event.target.value)} /></label>
                <label className="space-y-1"><span className="text-xs font-black uppercase text-muted-foreground">End</span><input className="h-10 w-full rounded-md border bg-background px-3 text-sm font-bold" type="date" value={weekEnd} onChange={(event) => setWeekEnd(event.target.value)} /></label>
                <label className="space-y-1"><span className="text-xs font-black uppercase text-muted-foreground">Day</span><select className="h-10 w-full rounded-md border bg-background px-3 text-sm font-bold" value={dayFilter} onChange={(event) => setDayFilter(event.target.value)}><option value="all">All days</option>{DAY_NAMES.map((day) => <option key={day}>{day}</option>)}</select></label>
                <label className="space-y-1"><span className="text-xs font-black uppercase text-muted-foreground">Cleaner/team</span><select className="h-10 w-full rounded-md border bg-background px-3 text-sm font-bold" value={cleanerFilter} onChange={(event) => setCleanerFilter(event.target.value)}><option value="all">All cleaners</option>{cleanerOptions.map((cleaner) => <option key={cleaner}>{cleaner}</option>)}</select></label>
                <label className="space-y-1"><span className="text-xs font-black uppercase text-muted-foreground">Account</span><select className="h-10 w-full rounded-md border bg-background px-3 text-sm font-bold" value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}><option value="all">All accounts</option>{accountOptions.map((account) => <option key={account}>{account}</option>)}</select></label>
                <label className="space-y-1"><span className="text-xs font-black uppercase text-muted-foreground">Status</span><select className="h-10 w-full rounded-md border bg-background px-3 text-sm font-bold" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="all">All statuses</option><option value="draft">Scheduled / draft</option><option value="needs_review">Needs review</option><option value="approved">Approved</option><option value="paid">Paid</option><option value="unpaid">Unpaid / open</option></select></label>
              </div>
              <div className="grid gap-3 lg:grid-cols-[180px_120px_auto_minmax(240px,1fr)]">
                <label className="space-y-1"><span className="text-xs font-black uppercase text-muted-foreground">Month</span><select className="h-10 w-full rounded-md border bg-background px-3 text-sm font-bold" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}><option value="">Select month</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={String(index + 1).padStart(2, "0")}>{new Date(2026, index, 1).toLocaleDateString("en-US", { month: "long" })}</option>)}</select></label>
                <label className="space-y-1"><span className="text-xs font-black uppercase text-muted-foreground">Year</span><input className="h-10 w-full rounded-md border bg-background px-3 text-sm font-bold" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)} /></label>
                <div className="flex items-end"><Button className="w-full" variant="outline" type="button" onClick={applyMonthYear}>Apply month</Button></div>
                <label className="relative space-y-1"><span className="text-xs font-black uppercase text-muted-foreground">Search</span><Search className="absolute left-3 top-[34px] size-4 text-muted-foreground" /><input className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm font-bold" placeholder="Account, cleaner, review note, source" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
              </div>
            </div>

            {loading ? <div className="rounded-lg border p-10 text-center font-bold text-muted-foreground">Loading commercial cleanings...</div> : null}
            {!loading && visible.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/20 p-10 text-center">
                <AlertTriangle className="mx-auto size-8 text-muted-foreground" />
                <h2 className="mt-3 text-lg font-black">No commercial cleanings match this view</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm font-semibold text-muted-foreground">Try clearing filters, add schedule rules on an account, or prepare payroll for the current open period.</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2"><Button asChild><Link href="/commercial/accounts">Add commercial cleaning</Link></Button><Button asChild variant="outline"><Link href="/commercial/payroll">Open payroll</Link></Button></div>
              </div>
            ) : null}

            {!loading && visible.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[1180px] border-collapse text-sm">
                  <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                    <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Account</th><th className="px-4 py-3">Cleaner / Team</th><th className="px-4 py-3 text-right">Scheduled</th><th className="px-4 py-3 text-right">Paid hours</th><th className="px-4 py-3 text-right">Rate / source</th><th className="px-4 py-3 text-right">Final amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Review</th><th className="px-4 py-3 text-right">Actions</th></tr>
                  </thead>
                  <tbody>
                    {visible.map((entry) => {
                      const locked = ["paid", "locked"].includes(entry.status) || ["paid", "locked"].includes(entry.period?.status ?? "");
                      const amountNeedsReason = Number(entry.final_amount ?? 0) === 0 && Number(entry.base_hours ?? 0) > 0;
                      return (
                        <tr className="border-t transition-colors hover:bg-accent/30" key={entry.id}>
                          <td className="px-4 py-3"><p className="font-black">{entry.service_date ?? "Unscheduled"}</p><p className="text-xs font-bold text-muted-foreground">{entry.scheduled_day ?? "No day"}</p></td>
                          <td className="px-4 py-3"><p className="font-black">{entry.account_name}</p><p className="text-xs font-bold text-muted-foreground">{entry.city ?? "Commercial account"}</p></td>
                          <td className="px-4 py-3 font-bold">{entry.cleaner_name ?? "Unassigned"}</td>
                          <td className="px-4 py-3 text-right font-black">{Number(entry.base_hours ?? 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-black">{Number(entry.adjusted_hours ?? entry.base_hours ?? 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right"><p className="font-black">{entry.pay_rate ? money(entry.pay_rate) : "Missing rate"}</p><div className="mt-1 flex justify-end"><SourceBadge source={entry.source} /></div></td>
                          <td className="px-4 py-3 text-right"><p className={amountNeedsReason ? "font-black text-amber-700 dark:text-amber-200" : "font-black"}>{money(entry.final_amount)}</p>{amountNeedsReason ? <p className="text-xs font-bold text-muted-foreground">{exceptionLabel(entry)}</p> : null}</td>
                          <td className="px-4 py-3"><StatusBadge status={entry.status} /></td>
                          <td className="px-4 py-3"><Badge className={entry.status === "needs_review" || entry.requires_manual_review ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200" : "border-border bg-muted/60 text-muted-foreground"}>{exceptionLabel(entry)}</Badge></td>
                          <td className="px-4 py-3"><div className="flex justify-end gap-2"><Button asChild size="sm" variant="outline"><Link href={`/commercial/payroll/${entry.pay_period_id}`}><Eye className="size-4" /> Payroll</Link></Button><Button disabled={locked} size="sm" variant="outline" onClick={() => setEntryStatus(entry, "needs_review")} type="button">Review</Button><Button disabled={locked} size="sm" onClick={() => setEntryStatus(entry, "approved")} type="button"><BadgeCheck className="size-4" /> Approve</Button></div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
