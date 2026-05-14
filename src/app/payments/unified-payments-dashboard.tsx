"use client";

import Link from "next/link";
import { BadgeCheck, Search, WalletCards } from "lucide-react";
import type { UnifiedPayment } from "@/lib/payments/unified";

type UnifiedFilter = "all" | "commercial_payroll" | "legacy_payment" | "manual_extra" | "residential" | "needs_review" | "approved" | "paid" | "current_period";

function fmtUSD(n: number) {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function getCurrentPeriodBounds() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, now.getDate() <= 15 ? 1 : 16);
  const end = now.getDate() <= 15 ? new Date(year, month, 15) : new Date(year, month + 1, 0);
  const toISO = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { start: toISO(start), end: toISO(end) };
}

function sourceLabel(sourceType: UnifiedPayment["sourceType"]) {
  if (sourceType === "commercial_payroll") return "Commercial Payroll";
  if (sourceType === "manual_extra") return "Manual Extra";
  if (sourceType === "commercial_adjustment") return "Adjustment";
  return "Legacy";
}

function statusLabel(status: UnifiedPayment["status"]) {
  return status.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}

function UnifiedBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "blue" }) {
  return <span className={`unified-badge ${tone}`}>{children}</span>;
}

export function UnifiedPaymentsDashboard({ payments, filter, onFilterChange, onMarkPaid }: { payments: UnifiedPayment[]; filter: UnifiedFilter; onFilterChange: (filter: UnifiedFilter) => void; onMarkPaid: (payment: UnifiedPayment) => void }) {
  const currentPeriod = getCurrentPeriodBounds();
  const filteredPayments = payments.filter((payment) => {
    if (filter === "all") return true;
    if (filter === "commercial_payroll") return payment.sourceType === "commercial_payroll";
    if (filter === "legacy_payment") return payment.sourceType === "legacy_payment";
    if (filter === "manual_extra") return payment.sourceType === "manual_extra" || payment.category === "manual";
    if (filter === "residential") return payment.category === "residential";
    if (filter === "needs_review") return payment.requiresReview || payment.status === "needs_review";
    if (filter === "approved") return payment.status === "approved";
    if (filter === "paid") return payment.status === "paid";
    if (filter === "current_period") return payment.periodStart === currentPeriod.start || payment.periodEnd === currentPeriod.end || payment.serviceDate?.startsWith(currentPeriod.start.slice(0, 7));
    return true;
  });
  const totals = payments.reduce((acc, payment) => {
    acc.all += payment.finalAmount;
    if (payment.status === "paid") acc.paid += payment.finalAmount;
    if (payment.status === "approved") acc.approved += payment.finalAmount;
    if (payment.status === "needs_review" || payment.requiresReview) acc.review += 1;
    if (payment.sourceType === "commercial_payroll") acc.commercial += payment.finalAmount;
    if (payment.sourceType === "legacy_payment" || payment.sourceType === "manual_extra") acc.legacy += payment.finalAmount;
    return acc;
  }, { all: 0, paid: 0, approved: 0, review: 0, commercial: 0, legacy: 0 });
  const filters: [UnifiedFilter, string][] = [
    ["all", "All"],
    ["commercial_payroll", "Commercial Payroll"],
    ["legacy_payment", "Legacy"],
    ["manual_extra", "Manual Extras"],
    ["residential", "Residential"],
    ["needs_review", "Needs Review"],
    ["approved", "Approved"],
    ["paid", "Paid"],
    ["current_period", "Current Period"],
  ];

  return (
    <section className="unified-panel">
      <div className="unified-head">
        <div>
          <p className="section-kicker"><WalletCards size={14} /> Unified Payments Dashboard</p>
          <h2>All payment work in one place</h2>
          <p>Commercial payroll syncs here automatically while legacy weekly payments stay intact below.</p>
        </div>
        <Link className="action-btn primary" href="/payments/commercial-payroll"><BadgeCheck size={15} /> Commercial Payroll</Link>
      </div>

      <div className="unified-metrics">
        <div><span>Total Pending</span><strong>{fmtUSD(totals.all - totals.paid)}</strong></div>
        <div><span>Total Approved</span><strong>{fmtUSD(totals.approved)}</strong></div>
        <div><span>Total Paid</span><strong>{fmtUSD(totals.paid)}</strong></div>
        <div><span>Needs Review</span><strong>{totals.review}</strong></div>
        <div><span>Commercial Payroll</span><strong>{fmtUSD(totals.commercial)}</strong></div>
        <div><span>Manual / Legacy</span><strong>{fmtUSD(totals.legacy)}</strong></div>
      </div>

      <div className="unified-toolbar">
        <div className="unified-filter-list">
          {filters.map(([value, label]) => <button className={filter === value ? "active" : ""} key={value} onClick={() => onFilterChange(value)} type="button">{label}</button>)}
        </div>
        <div className="unified-search-note"><Search size={14} /> Showing {filteredPayments.length} of {payments.length}</div>
      </div>

      <div className="unified-table-wrap">
        <table className="unified-table">
          <thead><tr><th>Cleaner / Team</th><th>Source</th><th>Account</th><th>Period</th><th>Hours</th><th>Rate</th><th>Adjustments</th><th>Final Amount</th><th>Status</th><th>Review</th><th>Method</th><th>Actions</th></tr></thead>
          <tbody>
            {filteredPayments.length === 0 ? <tr><td colSpan={12} className="unified-empty">No payments match this filter.</td></tr> : null}
            {filteredPayments.map((payment) => {
              const isPaid = payment.status === "paid" || payment.status === "locked";
              return (
                <tr key={`${payment.sourceType}-${payment.id}`}>
                  <td><strong>{payment.cleanerName}</strong><span>{payment.cleanerType ?? payment.category}</span></td>
                  <td><UnifiedBadge tone={payment.sourceType === "commercial_payroll" ? "blue" : payment.sourceType === "legacy_payment" ? "neutral" : "warn"}>{sourceLabel(payment.sourceType)}</UnifiedBadge>{payment.synced ? <UnifiedBadge tone="good">Synced</UnifiedBadge> : null}</td>
                  <td>{payment.accountName ?? "-"}</td>
                  <td><strong>{payment.periodStart ?? payment.serviceDate ?? "-"}</strong><span>{payment.periodEnd && payment.periodEnd !== payment.periodStart ? payment.periodEnd : ""}</span></td>
                  <td>{payment.adjustedHours ?? payment.baseHours ?? "-"}</td>
                  <td>{payment.payRate ? fmtUSD(payment.payRate) : "-"}</td>
                  <td>{payment.adjustmentAmount ? fmtUSD(payment.adjustmentAmount) : "-"}</td>
                  <td className="money-cell">{fmtUSD(payment.finalAmount)}</td>
                  <td><UnifiedBadge tone={payment.status === "paid" ? "good" : payment.status === "needs_review" ? "warn" : "neutral"}>{statusLabel(payment.status)}</UnifiedBadge></td>
                  <td>{payment.requiresReview ? <UnifiedBadge tone="warn">Needs Review</UnifiedBadge> : <UnifiedBadge>Clear</UnifiedBadge>}</td>
                  <td>{payment.paymentMethod ?? "-"}</td>
                  <td><div className="unified-actions">{payment.payPeriodId ? <Link href={`/payments/commercial-payroll/${payment.payPeriodId}`}>Open period</Link> : null}<button disabled={isPaid} onClick={() => onMarkPaid(payment)} type="button">{isPaid ? "Paid" : "Mark paid"}</button></div>{isPaid && payment.sourceType === "commercial_payroll" ? <small>This payment is already paid. Create an adjustment instead.</small> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export type { UnifiedFilter };
