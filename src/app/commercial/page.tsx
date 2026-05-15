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
  if (exceptions.includes("missing_pay_rate")) return "Missing rate";
  if (exceptions.includes("missing_cleaner")) return "Missing cleaner";
  if (exceptions.includes("missing_schedule")) return "Missing schedule rule";
  if (exceptions.includes("missing_anchor_date")) return "Missing anchor date";
  if (exceptions.includes("zero_hours")) return "Missing paid hours";
  return entry.requires_manual_review ? "Needs review" : "Clear";
}

function statusTone(status: string) {
  if (status === "paid") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
  if (status === "approved") return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200";
  if (status === "needs_review") return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200";
  return "bg-muted text-muted-foreground";
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <Card><CardContent className="p-4"><p className="text-xs font-black uppercase text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></CardContent></Card>;
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
      <div className="space-y-5">
        <section className="rounded-lg border bg-card p-5 shadow-[0_22px_60px_-52px_hsl(210_40%_20%)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase text-primary"><CalendarDays className="size-4" /> Commercial Overview</p>
              <h1 className="mt-2 text-2xl font-black tracking-normal">This week&apos;s commercial cleanings</h1>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">{periodLabel(weekStart, weekEnd)}. Commercial only, with payroll status visible before it reaches accounting.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline"><Link href="/commercial/accounts"><Plus className="size-4" /> Open accounts</Link></Button>
              <Button asChild variant="outline"><Link href="/commercial/payroll"><WalletCards className="size-4" /> Commercial Payroll</Link></Button>
              <Button disabled={generating} onClick={generateCurrentPeriod} type="button"><RefreshCw className="size-4" /> {generating ? "Preparing" : "Prepare payroll"}</Button>
            </div>
          </div>
          {message ? <p className="mt-4 rounded-md border bg-muted/40 px-3 py-2 text-sm font-bold">{message}</p> : null}
        </section>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Cleanings this period" value={metrics.cleanings} />
          <Metric label="Scheduled hours" value={metrics.hours.toFixed(2)} />
          <Metric label="Payroll pending" value={money(metrics.pending)} />
          <Metric label="Needs review" value={metrics.review} />
          <Metric label="Approved" value={metrics.approved} />
          <Metric label="Paid" value={metrics.paid} />
          <Metric label="Unpaid / open" value={metrics.open} />
          <Metric label="Commercial accounts active" value={metrics.activeAccounts} />
        </div>

        <Card><CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-sm font-black text-muted-foreground"><Filter className="size-4" /> Filters</div>
            <input className="h-10 rounded-md border bg-background px-3 text-sm font-bold" type="date" value={weekStart} onChange={(event) => setWeekStart(event.target.value)} />
            <input className="h-10 rounded-md border bg-background px-3 text-sm font-bold" type="date" value={weekEnd} onChange={(event) => setWeekEnd(event.target.value)} />
            <Button variant="outline" type="button" onClick={setCurrentWeek}>Current week</Button>
            <select className="h-10 rounded-md border bg-background px-3 text-sm font-bold" value={dayFilter} onChange={(event) => setDayFilter(event.target.value)}><option value="all">All days</option>{DAY_NAMES.map((day) => <option key={day}>{day}</option>)}</select>
            <select className="h-10 rounded-md border bg-background px-3 text-sm font-bold" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}><option value="">Month</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={String(index + 1).padStart(2, "0")}>{new Date(2026, index, 1).toLocaleDateString("en-US", { month: "long" })}</option>)}</select>
            <input className="h-10 w-24 rounded-md border bg-background px-3 text-sm font-bold" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)} />
            <Button variant="outline" type="button" onClick={applyMonthYear}>Apply month</Button>
            <select className="h-10 rounded-md border bg-background px-3 text-sm font-bold" value={cleanerFilter} onChange={(event) => setCleanerFilter(event.target.value)}><option value="all">All cleaners</option>{cleanerOptions.map((cleaner) => <option key={cleaner}>{cleaner}</option>)}</select>
            <select className="h-10 rounded-md border bg-background px-3 text-sm font-bold" value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}><option value="all">All accounts</option>{accountOptions.map((account) => <option key={account}>{account}</option>)}</select>
            <select className="h-10 rounded-md border bg-background px-3 text-sm font-bold" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="all">All statuses</option><option value="draft">Scheduled / draft</option><option value="needs_review">Needs review</option><option value="approved">Approved</option><option value="paid">Paid</option><option value="unpaid">Unpaid / open</option></select>
            <label className="relative min-w-[240px] flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm font-bold" placeholder="Search account, cleaner, notes, source" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          </div>

          {loading ? <div className="rounded-md border p-10 text-center font-bold text-muted-foreground">Loading commercial cleanings...</div> : null}
          {!loading && visible.length === 0 ? <div className="rounded-lg border border-dashed bg-muted/20 p-10 text-center"><AlertTriangle className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-3 text-lg font-black">No commercial cleanings in this view</h2><p className="mx-auto mt-1 max-w-xl text-sm font-semibold text-muted-foreground">Add schedule rules on a commercial account or prepare the current payroll period to sync this week&apos;s commercial work.</p><div className="mt-4 flex justify-center gap-2"><Button asChild><Link href="/commercial/accounts">Add commercial cleaning</Link></Button><Button asChild variant="outline"><Link href="/commercial/payroll">Open payroll</Link></Button></div></div> : null}

          {!loading && visible.length > 0 ? <div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[1180px] border-collapse text-sm"><thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Day</th><th className="px-3 py-3">Account</th><th className="px-3 py-3">Cleaner / Team</th><th className="px-3 py-3 text-right">Scheduled hours</th><th className="px-3 py-3 text-right">Actual / paid hours</th><th className="px-3 py-3 text-right">Rate / source</th><th className="px-3 py-3 text-right">Final amount</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Review</th><th className="px-3 py-3 text-right">Actions</th></tr></thead><tbody>{visible.map((entry) => { const locked = ["paid", "locked"].includes(entry.status) || ["paid", "locked"].includes(entry.period?.status ?? ""); return <tr className="border-t" key={entry.id}><td className="px-3 py-3 font-black">{entry.service_date ?? "Unscheduled"}</td><td className="px-3 py-3">{entry.scheduled_day ?? "-"}</td><td className="px-3 py-3"><p className="font-black">{entry.account_name}</p><p className="text-xs font-bold text-muted-foreground">{entry.city ?? ""}</p></td><td className="px-3 py-3 font-bold">{entry.cleaner_name ?? "Unassigned"}</td><td className="px-3 py-3 text-right font-black">{Number(entry.base_hours ?? 0).toFixed(2)}</td><td className="px-3 py-3 text-right font-black">{Number(entry.adjusted_hours ?? entry.base_hours ?? 0).toFixed(2)}</td><td className="px-3 py-3 text-right"><p className="font-black">{entry.pay_rate ? money(entry.pay_rate) : "Missing rate"}</p><Badge variant="secondary">{entry.source === "schedule_rule" ? "Synced" : "Fallback"}</Badge></td><td className="px-3 py-3 text-right font-black">{money(entry.final_amount)}</td><td className="px-3 py-3"><Badge className={statusTone(entry.status)}>{entry.status.replace("_", " ")}</Badge></td><td className="px-3 py-3"><Badge className={entry.status === "needs_review" || entry.requires_manual_review ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" : "bg-muted text-muted-foreground"}>{exceptionLabel(entry)}</Badge></td><td className="px-3 py-3"><div className="flex justify-end gap-2"><Button asChild size="sm" variant="outline"><Link href={`/commercial/payroll/${entry.pay_period_id}`}><Eye className="size-4" /> Payroll</Link></Button><Button disabled={locked} size="sm" variant="outline" onClick={() => setEntryStatus(entry, "needs_review")} type="button">Review</Button><Button disabled={locked} size="sm" onClick={() => setEntryStatus(entry, "approved")} type="button"><BadgeCheck className="size-4" /> Approve</Button></div></td></tr>; })}</tbody></table></div> : null}
        </CardContent></Card>
      </div>
    </DashboardShell>
  );
}
