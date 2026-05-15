"use client";

import Link from "next/link";
import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { createClient } from "@/lib/supabase/client";
import { UnifiedPaymentsDashboard, type UnifiedFilter } from "./unified-payments-dashboard";
import {
  markUnifiedPaymentPaid,
  normalizePaymentEntry,
  normalizePaymentExtra,
  type LegacyPaymentEntryRow,
  type PaymentExtraUnifiedRow,
  type UnifiedPayment,
} from "@/lib/payments/unified";
import {
  ArrowDownRight,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileDown,
  ListPlus,
  MapPin,
  Trash2,
  WalletCards,
} from "lucide-react";

const WEEK_COUNT = 5;
const JUAN_ROMERO = "Juan Romero";

const RESIDENTIAL_CLEANERS = [
  { name: "Jasmine Cardenas", email: "cardenaskarla2603@gmail.com", type: "residential", city: "Orange County" },
  { name: JUAN_ROMERO, email: "juanes.romero@hotmail.com", type: "mixed", city: "Orange County" },
  { name: "Dovissy Calderon", email: "dovissycalderon@gmail.com", type: "residential", city: "Orange County" },
  { name: "Lorena Benitez", email: "lorenabenitez382@gmail.com", type: "residential", city: "Orange County" },
  { name: "Gabriel Cardenas", email: "g18490991@gmail.com", type: "residential", city: "Orange County" },
  { name: "Rosa Calderon", email: "rosicalderon1979@gmail.com", type: "residential", city: "Orange County" },
  { name: "Miriam Lopez", email: "miriam.84.mvl@gmail.com", type: "residential", city: "Orange County" },
  { name: "Esperanza Yoseff", email: "esperanzayoseff9@gmail.com", type: "mixed", city: "Orange County" },
  { name: "Blanca Garcia", email: "bceliag1971@gmail.com", type: "residential", city: "Orange County" },
];

const CITY_OPTIONS = [
  "Aliso Viejo",
  "Anaheim",
  "Brea",
  "Buena Park",
  "Costa Mesa",
  "Cypress",
  "Dana Point",
  "Fountain Valley",
  "Fullerton",
  "Garden Grove",
  "Huntington Beach",
  "Irvine",
  "La Habra",
  "La Palma",
  "Ladera Ranch",
  "Laguna Beach",
  "Laguna Hills",
  "Laguna Niguel",
  "Laguna Woods",
  "Lake Forest",
  "Los Alamitos",
  "Mission Viejo",
  "Newport Beach",
  "Orange",
  "Placentia",
  "Rancho Santa Margarita",
  "San Clemente",
  "San Juan Capistrano",
  "Santa Ana",
  "Seal Beach",
  "Stanton",
  "Tustin",
  "Villa Park",
  "Westminster",
  "Yorba Linda",
  "Long Beach",
  "Torrance",
  "Whittier",
  "Corona",
  "Compton",
  "Valencia",
  "Westlake Village",
];

type PaymentRow = {
  id: string;
  date: string;
  city: string;
  residential: string;
  commercial: string;
  payment: string;
};

type WeekEntry = {
  rows: PaymentRow[];
};

type CleanerData = {
  weeks: WeekEntry[];
};

type CleanerSummary = {
  name: string;
  city: string;
  type: string;
  cleanings: number;
  residential: number;
  commercial: number;
  amount: number;
  share: number;
  weeks: {
    cleanings: number;
    residential: number;
    commercial: number;
    amount: number;
  }[];
};

type ExportFrequency = "week" | "month" | "quarter" | "year";

type ExtraData = {
  id: string;
  cleaner: string;
  hours: string;
  amount: string;
};

type PaymentEntryRow = {
  id: string;
  cleaner_name: string;
  cleaner_email: string | null;
  cleaner_type: string;
  week_index: number;
  service_date: string | null;
  city: string | null;
  residential_amount: number;
  commercial_amount: number;
  payment_amount: number;
  source_type?: string | null;
  category?: string | null;
};

type PaymentExtraRow = {
  id: string;
  week_index: number;
  cleaner: string | null;
  hours: number;
  amount: number;
};

const exportFrequencyLabels: Record<ExportFrequency, string> = {
  week: "Selected week",
  month: "Month overview",
  quarter: "Quarter",
  year: "Year",
};

function makeRow(city = ""): PaymentRow {
  return { id: crypto.randomUUID(), date: "", city, residential: "", commercial: "", payment: "" };
}

function makeExtra(): ExtraData {
  return { id: crypto.randomUUID(), cleaner: "Carlos Lopez", hours: "", amount: "" };
}

function emptyWeeks(city = ""): WeekEntry[] {
  return Array.from({ length: WEEK_COUNT }, () => ({ rows: [makeRow(city), makeRow(city)] }));
}

function emptyExtras(): ExtraData[] {
  return Array.from({ length: WEEK_COUNT }, () => makeExtra());
}

function parseNum(value: string) {
  const n = parseFloat(value.replace(/[$,]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

function fmtUSD(n: number) {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function toDateInputValue(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (!match) return "";
  const [, month, day, year] = match;
  const fullYear = year ? (year.length === 2 ? `20${year}` : year) : String(new Date().getFullYear());
  return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function formatDateForExport(value: string) {
  if (!value) return "-";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [, month, day] = value.split("-");
  return `${month}/${day}`;
}

function normalizeAmericanDate(value: string) {
  const clean = value.trim();
  if (!clean) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return formatDateForExport(clean);

  const match = clean.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (!match) return clean;

  const [, month, day, year] = match;
  const normalizedYear = year ? (year.length === 2 ? `20${year}` : year) : String(new Date().getFullYear());
  return `${month.padStart(2, "0")}/${day.padStart(2, "0")}/${normalizedYear}`;
}

function getMonthDate(offset: number) {
  const date = new Date();
  date.setMonth(date.getMonth() + offset);
  return date;
}

function getMonthLabel(offset: number) {
  return getMonthDate(offset).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function getMonthKey(offset: number) {
  const date = getMonthDate(offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getExportLabel(frequency: ExportFrequency, monthOffset: number, selectedWeek: number) {
  const date = getMonthDate(monthOffset);

  if (frequency === "week") return `${getMonthLabel(monthOffset)} - Week ${selectedWeek + 1}`;
  if (frequency === "month") return getMonthLabel(monthOffset);
  if (frequency === "quarter") {
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    return `Q${quarter} ${date.getFullYear()}`;
  }

  return String(date.getFullYear());
}

function getExportWeeks(frequency: ExportFrequency, selectedWeek: number) {
  return frequency === "week" ? [selectedWeek] : Array.from({ length: WEEK_COUNT }, (_, index) => index);
}

function isFilledRow(row: PaymentRow, isJuan: boolean) {
  return Boolean(
    row.date.trim() ||
      row.city.trim() ||
      (isJuan ? parseNum(row.residential) + parseNum(row.commercial) : parseNum(row.payment)),
  );
}

function summarizeWeek(rows: PaymentRow[], isJuan: boolean) {
  const residential = isJuan ? rows.reduce((sum, row) => sum + parseNum(row.residential), 0) : 0;
  const commercial = isJuan ? rows.reduce((sum, row) => sum + parseNum(row.commercial), 0) : 0;
  const payment = isJuan ? 0 : rows.reduce((sum, row) => sum + parseNum(row.payment), 0);

  return {
    cleanings: rows.filter((row) => isFilledRow(row, isJuan)).length,
    residential,
    commercial,
    amount: residential + commercial + payment,
  };
}

function buildEmptyCleanerData() {
  return Object.fromEntries(
    RESIDENTIAL_CLEANERS.map((cleaner) => [
      cleaner.name,
      { weeks: emptyWeeks(cleaner.city === "Orange County" ? "" : cleaner.city) },
    ]),
  ) as Record<string, CleanerData>;
}

function toPaymentPayload(
  row: PaymentRow,
  cleaner: (typeof RESIDENTIAL_CLEANERS)[0],
  userId: string,
  monthKey: string,
  weekIndex: number,
) {
  return {
    id: row.id,
    user_id: userId,
    cleaner_name: cleaner.name,
    cleaner_email: cleaner.email,
    cleaner_type: cleaner.type,
    month_key: monthKey,
    week_index: weekIndex,
    service_date: row.date || null,
    city: row.city || null,
    residential_amount: parseNum(row.residential),
    commercial_amount: parseNum(row.commercial),
    payment_amount: parseNum(row.payment),
  };
}

function toExtraPayload(extra: ExtraData, userId: string, monthKey: string, weekIndex: number) {
  return {
    id: extra.id,
    user_id: userId,
    month_key: monthKey,
    week_index: weekIndex,
    cleaner: extra.cleaner || null,
    hours: parseNum(extra.hours),
    amount: parseNum(extra.amount),
  };
}

function CityInput({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      aria-label={label}
      list="payment-city-options"
      placeholder="City"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function DateInput({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      aria-label={label}
      type="date"
      value={toDateInputValue(value)}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function CleanerFrame({
  cleaner,
  data,
  index,
  selectedWeek,
  maxAmount,
  onChange,
  onDeleteRow,
  onPersistRow,
}: {
  cleaner: (typeof RESIDENTIAL_CLEANERS)[0];
  data: CleanerData;
  index: number;
  selectedWeek: number;
  maxAmount: number;
  onChange: (data: CleanerData) => void;
  onDeleteRow: (id: string) => void;
  onPersistRow: (row: PaymentRow, cleaner: (typeof RESIDENTIAL_CLEANERS)[0]) => void;
}) {
  const isJuan = cleaner.name === JUAN_ROMERO;
  const week = data.weeks[selectedWeek];
  const summary = summarizeWeek(week.rows, isJuan);
  const fill = maxAmount > 0 ? Math.max(5, Math.round((summary.amount / maxAmount) * 100)) : 0;

  function updateRow(id: string, field: keyof PaymentRow, value: string) {
    let nextRow: PaymentRow | null = null;
    const weeks = data.weeks.map((entry, i) => (
      i === selectedWeek
        ? {
            rows: entry.rows.map((row) => {
              if (row.id !== id) return row;
              nextRow = { ...row, [field]: value };
              return nextRow;
            }),
          }
        : entry
    ));
    onChange({ ...data, weeks });
    if (nextRow) onPersistRow(nextRow, cleaner);
  }

  function addRow() {
    const weeks = data.weeks.map((entry, i) => (
      i === selectedWeek ? { rows: [...entry.rows, makeRow()] } : entry
    ));
    onChange({ ...data, weeks });
  }

  function removeRow(id: string) {
    const weeks = data.weeks.map((entry, i) => {
      if (i !== selectedWeek) return entry;
      const rows = entry.rows.length > 1 ? entry.rows.filter((row) => row.id !== id) : [makeRow()];
      return { rows };
    });
    onChange({ ...data, weeks });
    onDeleteRow(id);
  }

  return (
    <section className={`cleaner-frame ${isJuan ? "juan-frame" : ""}`} style={{ "--delay": `${index * 45}ms`, "--fill": `${fill}%` } as CSSProperties}>
      <div className="frame-head">
        <div>
          <h2 title={cleaner.name}>{cleaner.name}</h2>
          <p title={cleaner.email}>{cleaner.email}</p>
        </div>
        <span className={`type-chip type-${cleaner.type}`}>{isJuan ? "Residential + Commercial" : cleaner.type}</span>
      </div>

      <div className="week-token-row">
        <div className="week-token">Week {selectedWeek + 1}</div>
        <div className="city-help"><MapPin size={13} /> City menu accepts custom entries</div>
      </div>

      <div className="payroll-table-wrap">
        <table className={`payroll-table ${isJuan ? "juan-table" : ""}`}>
          <thead>
            <tr>
              <th>Date</th>
              <th>City</th>
              {isJuan ? (
                <>
                  <th>Residential</th>
                  <th>Commercial</th>
                </>
              ) : (
                <th>Payment</th>
              )}
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {week.rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <DateInput
                    label={`${cleaner.name} date`}
                    value={row.date}
                    onChange={(value) => updateRow(row.id, "date", value)}
                  />
                </td>
                <td>
                  <CityInput
                    label={`${cleaner.name} city`}
                    value={row.city}
                    onChange={(value) => updateRow(row.id, "city", value)}
                  />
                </td>
                {isJuan ? (
                  <>
                    <td>
                      <input
                        aria-label={`${cleaner.name} residential payment`}
                        className="money-input"
                        placeholder="$0.00"
                        value={row.residential}
                        onChange={(event) => updateRow(row.id, "residential", event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`${cleaner.name} commercial payment`}
                        className="money-input highlight-money"
                        placeholder="$0.00"
                        value={row.commercial}
                        onChange={(event) => updateRow(row.id, "commercial", event.target.value)}
                      />
                    </td>
                  </>
                ) : (
                  <td>
                    <input
                      aria-label={`${cleaner.name} payment`}
                      className="money-input highlight-money"
                      placeholder="$0.00"
                      value={row.payment}
                      onChange={(event) => updateRow(row.id, "payment", event.target.value)}
                    />
                  </td>
                )}
                <td>
                  <button className="row-btn" type="button" aria-label="Remove row" onClick={() => removeRow(row.id)}>
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td>{summary.cleanings}</td>
              {isJuan ? (
                <>
                  <td>{fmtUSD(summary.residential)}</td>
                  <td className="highlight-total">{fmtUSD(summary.commercial)}</td>
                  <td className="grand-total">{fmtUSD(summary.amount)}</td>
                </>
              ) : (
                <>
                  <td className="highlight-total">{fmtUSD(summary.amount)}</td>
                  <td />
                </>
              )}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="frame-total">
        <button className="add-row-btn" type="button" onClick={addRow}>
          <ListPlus size={14} /> Add row
        </button>
        <strong>{summary.cleanings} jobs</strong>
        <strong>{fmtUSD(summary.amount)}</strong>
      </div>
    </section>
  );
}

function OverviewPanel({ summaries, grandAmount }: { summaries: CleanerSummary[]; grandAmount: number }) {
  const paidCleaners = summaries.filter((item) => item.amount > 0).length;
  const average = paidCleaners > 0 ? grandAmount / paidCleaners : 0;

  return (
    <section className="overview-panel">
      <div className="overview-head">
        <div>
          <span className="section-kicker">
            <BarChart3 size={14} /> Overview
          </span>
          <h2>Full month by week</h2>
        </div>
        <div className="average-chip">
          <span>Avg paid cleaner</span>
          <strong>{fmtUSD(average)}</strong>
        </div>
      </div>

      <div className="month-table-wrap">
        <table className="month-table">
          <thead>
            <tr>
              <th>Cleaner</th>
              <th>City</th>
              {Array.from({ length: WEEK_COUNT }, (_, index) => (
                <th key={index}>W{index + 1}</th>
              ))}
              <th>Jobs</th>
              <th>Residential</th>
              <th>Commercial</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((item) => (
              <tr key={item.name}>
                <td>
                  <strong>{item.name}</strong>
                  <span>{item.type}</span>
                </td>
                <td>{item.city || "No city"}</td>
                {item.weeks.map((week, index) => (
                  <td key={index}>
                    <strong>{fmtUSD(week.amount)}</strong>
                    <span>{week.cleanings} jobs</span>
                  </td>
                ))}
                <td>{item.cleanings}</td>
                <td>{fmtUSD(item.residential)}</td>
                <td>{fmtUSD(item.commercial)}</td>
                <td className="month-money">{fmtUSD(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function PaymentsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [showOverview, setShowOverview] = useState(false);
  const [exportFrequency, setExportFrequency] = useState<ExportFrequency>("week");
  const [extras, setExtras] = useState<ExtraData[]>(emptyExtras);
  const [cleanerData, setCleanerData] = useState<Record<string, CleanerData>>(buildEmptyCleanerData);
  const [dataError, setDataError] = useState<string | null>(null);
  const [unifiedPayments, setUnifiedPayments] = useState<UnifiedPayment[]>([]);
  const [unifiedFilter, setUnifiedFilter] = useState<UnifiedFilter>("all");
  const monthKey = getMonthKey(monthOffset);

  useEffect(() => {
    let mounted = true;

    async function loadPayments() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted || !user) return;
      setUserId(user.id);
      setDataError(null);

      const [
        { data: entryRows, error: entryError },
        { data: extraRows, error: extraError },
        { data: unifiedEntryRows, error: unifiedEntryError },
        { data: unifiedExtraRows, error: unifiedExtraError },
      ] = await Promise.all([
        supabase.from("payment_entries").select("*").eq("month_key", monthKey),
        supabase.from("payment_extras").select("*").eq("month_key", monthKey),
        supabase.from("payment_entries").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("payment_extras").select("*").order("created_at", { ascending: false }).limit(200),
      ]);

      if (!mounted) return;

      if (entryError || extraError || unifiedEntryError || unifiedExtraError) {
        setDataError(entryError?.message ?? extraError?.message ?? unifiedEntryError?.message ?? unifiedExtraError?.message ?? "Could not load payments.");
        setCleanerData(buildEmptyCleanerData());
        setExtras(emptyExtras());
        return;
      }

      const nextData = buildEmptyCleanerData();
      for (const row of (entryRows ?? []) as PaymentEntryRow[]) {
        if (row.source_type === "commercial_payroll" || row.category === "commercial") continue;
        const cleaner = RESIDENTIAL_CLEANERS.find((item) => item.name === row.cleaner_name);
        if (!cleaner || row.week_index < 0 || row.week_index >= WEEK_COUNT) continue;
        const isJuan = cleaner.name === JUAN_ROMERO;
        const paymentRow: PaymentRow = {
          id: row.id,
          date: row.service_date ?? "",
          city: row.city ?? "",
          residential: row.residential_amount ? String(row.residential_amount) : "",
          commercial: row.commercial_amount ? String(row.commercial_amount) : "",
          payment: row.payment_amount ? String(row.payment_amount) : "",
        };

        const weekRows = nextData[cleaner.name].weeks[row.week_index].rows;
        const firstEmpty = weekRows.findIndex((item) => !isFilledRow(item, isJuan));
        if (firstEmpty >= 0) weekRows[firstEmpty] = paymentRow;
        else weekRows.push(paymentRow);
      }

      const nextExtras = emptyExtras();
      for (const row of (extraRows ?? []) as PaymentExtraRow[]) {
        if (row.week_index < 0 || row.week_index >= WEEK_COUNT) continue;
        nextExtras[row.week_index] = {
          id: row.id,
          cleaner: row.cleaner ?? "Carlos Lopez",
          hours: row.hours ? String(row.hours) : "",
          amount: row.amount ? String(row.amount) : "",
        };
      }

      setCleanerData(nextData);
      setExtras(nextExtras);
      setUnifiedPayments([
        ...((unifiedEntryRows ?? []) as LegacyPaymentEntryRow[]).map(normalizePaymentEntry),
        ...((unifiedExtraRows ?? []) as PaymentExtraUnifiedRow[]).map(normalizePaymentExtra),
      ].filter((payment) => payment.category !== "commercial" && payment.sourceType !== "commercial_payroll").sort((a, b) => String(b.updatedAt ?? b.createdAt ?? "").localeCompare(String(a.updatedAt ?? a.createdAt ?? ""))));
    }

    loadPayments();
    return () => {
      mounted = false;
    };
  }, [monthKey, supabase]);

  const updateCleaner = useCallback((name: string, data: CleanerData) => {
    setCleanerData((prev) => ({ ...prev, [name]: data }));
  }, []);

  const persistPaymentRow = useCallback(async (row: PaymentRow, cleaner: (typeof RESIDENTIAL_CLEANERS)[0]) => {
    if (!userId) return;
    const weekIndex = cleanerData[cleaner.name].weeks.findIndex((week) => week.rows.some((item) => item.id === row.id));
    if (weekIndex < 0) return;

    const { error } = await supabase
      .from("payment_entries")
      .upsert(toPaymentPayload(row, cleaner, userId, monthKey, weekIndex));

    if (error) setDataError(error.message);
  }, [cleanerData, monthKey, supabase, userId]);

  const deletePaymentRow = useCallback(async (id: string) => {
    if (!userId) return;
    const { error } = await supabase.from("payment_entries").delete().eq("id", id);
    if (error) setDataError(error.message);
  }, [supabase, userId]);

  const updateExtra = useCallback(async (field: keyof ExtraData, value: string) => {
    const next = extras.map((extra, index) => index === selectedWeek ? { ...extra, [field]: value } : extra);
    setExtras(next);
    if (!userId) return;
    const { error } = await supabase
      .from("payment_extras")
      .upsert(toExtraPayload(next[selectedWeek], userId, monthKey, selectedWeek));
    if (error) setDataError(error.message);
  }, [extras, monthKey, selectedWeek, supabase, userId]);

  const summaries = useMemo<CleanerSummary[]>(() => {
    const rows = RESIDENTIAL_CLEANERS.map((cleaner) => {
      const data = cleanerData[cleaner.name];
      const isJuan = cleaner.name === JUAN_ROMERO;
      const weeks = data.weeks.map((week) => summarizeWeek(week.rows, isJuan));
      const cleanings = weeks.reduce((sum, week) => sum + week.cleanings, 0);
      const residential = weeks.reduce((sum, week) => sum + week.residential, 0);
      const commercial = weeks.reduce((sum, week) => sum + week.commercial, 0);
      const amount = weeks.reduce((sum, week) => sum + week.amount, 0);
      const firstCity = data.weeks.flatMap((week) => week.rows).find((row) => row.city.trim())?.city ?? cleaner.city;

      return { name: cleaner.name, city: firstCity, type: cleaner.type, cleanings, residential, commercial, amount, share: 0, weeks };
    });
    const max = Math.max(0, ...rows.map((row) => row.amount));

    return rows
      .map((row) => ({ ...row, share: max > 0 ? Math.max(8, Math.round((row.amount / max) * 100)) : 0 }))
      .sort((a, b) => b.amount - a.amount);
  }, [cleanerData]);

  const weeklySummaries = RESIDENTIAL_CLEANERS.map((cleaner) => {
    const isJuan = cleaner.name === JUAN_ROMERO;
    const week = cleanerData[cleaner.name].weeks[selectedWeek];
    return { name: cleaner.name, ...summarizeWeek(week.rows, isJuan) };
  });
  const weekCleanings = weeklySummaries.reduce((sum, row) => sum + row.cleanings, 0);
  const weeklyBaseAmount = weeklySummaries.reduce((sum, row) => sum + row.amount, 0);
  const weekExtraAmount = parseNum(extras[selectedWeek].amount);
  const weekAmount = weeklyBaseAmount + weekExtraAmount;
  const extraGrandAmount = extras.reduce((sum, extra) => sum + parseNum(extra.amount), 0);
  const grandAmount = summaries.reduce((sum, row) => sum + row.amount, 0) + extraGrandAmount;
  const maxWeeklyAmount = Math.max(0, ...weeklySummaries.map((row) => row.amount));
  const monthLabel = getMonthLabel(monthOffset);
  const exportLabel = getExportLabel(exportFrequency, monthOffset, selectedWeek);

  async function handleMarkUnifiedPaymentPaid(payment: UnifiedPayment) {
    if (payment.requiresReview && payment.status === "needs_review" && !window.confirm("Review hours before marking this payment as paid. Continue?")) return;
    if (payment.status === "paid" || payment.status === "locked") return;
    try {
      const now = new Date().toISOString();
      if (payment.sourceType === "manual_extra") {
        const { error } = await supabase.from("payment_extras").update({ status: "paid", paid_at: now }).eq("id", payment.id);
        if (error) throw error;
      } else {
        await markUnifiedPaymentPaid(payment.id);
      }
      setUnifiedPayments((prev) => prev.map((item) => item.id === payment.id && item.sourceType === payment.sourceType ? { ...item, status: "paid", paidAt: now } : item));
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Could not mark payment as paid.");
    }
  }

  async function exportPDF() {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const exportWeeks = getExportWeeks(exportFrequency, selectedWeek);

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Pristine Cleaners - Payment Export", 14, 14);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`${exportFrequencyLabels[exportFrequency]}: ${exportLabel}`, 14, 21);

    let y = 32;
    let totalJobs = 0;
    let totalAmount = 0;

    for (const cleaner of RESIDENTIAL_CLEANERS) {
      const isJuan = cleaner.name === JUAN_ROMERO;
      const rows = exportWeeks.flatMap((weekIndex) =>
        cleanerData[cleaner.name].weeks[weekIndex].rows
          .filter((row) => isFilledRow(row, isJuan))
          .map((row) => ({ ...row, week: weekIndex + 1 })),
      );
      if (!rows.length) continue;

      if (y > 175) {
        doc.addPage();
        y = 18;
      }

      const totals = exportWeeks.reduce(
        (sum, weekIndex) => {
          const week = summarizeWeek(cleanerData[cleaner.name].weeks[weekIndex].rows, isJuan);
          return { jobs: sum.jobs + week.cleanings, amount: sum.amount + week.amount };
        },
        { jobs: 0, amount: 0 },
      );
      totalJobs += totals.jobs;
      totalAmount += totals.amount;

      doc.setFont("helvetica", "bold");
      doc.text(`${cleaner.name} - ${totals.jobs} jobs - ${fmtUSD(totals.amount)}`, 14, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.text(isJuan ? "Week   Date   City   Residential   Commercial" : "Week   Date   City   Payment", 18, y);
      y += 5;

      for (const row of rows) {
        if (y > 185) {
          doc.addPage();
          y = 18;
        }
        const amountText = isJuan
          ? `${fmtUSD(parseNum(row.residential))}   ${fmtUSD(parseNum(row.commercial))}`
          : fmtUSD(parseNum(row.payment));
        doc.text(`W${row.week}     ${formatDateForExport(row.date)}     ${row.city || "-"}     ${amountText}`, 18, y);
        y += 5;
      }
      y += 3;
    }

    for (const weekIndex of exportWeeks) {
      const extra = extras[weekIndex];
      const amount = parseNum(extra.amount);
      if (!amount && !parseNum(extra.hours)) continue;
      totalAmount += amount;
      doc.setFont("helvetica", "bold");
      doc.text(`W${weekIndex + 1} Extra Hours - ${extra.cleaner || "Cleaner"} - ${extra.hours || "0"} hrs - ${fmtUSD(amount)}`, 14, y);
      y += 6;
    }

    doc.text(`Total Jobs: ${totalJobs} | Total Paid: ${fmtUSD(totalAmount)}`, 14, 27);
    doc.save(`pristine-payments-${exportFrequency}-${exportLabel.replace(/[^a-z0-9]+/gi, "_")}.pdf`);
  }

  return (
    <DashboardShell userEmail="pristinecleanersoc@gmail.com">
      <style>{`
        .unified-panel { border:1px solid hsl(var(--border)/.82); border-radius:8px; background:hsl(var(--card)/.96); padding:16px; box-shadow:0 18px 55px -48px hsl(210 40% 20%); }
        .unified-head { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; flex-wrap:wrap; margin-bottom:14px; }
        .unified-head h2 { margin-top:4px; font-size:1.15rem; font-weight:950; }
        .unified-head p:not(.section-kicker) { margin-top:4px; color:hsl(var(--muted-foreground)); font-size:.84rem; font-weight:700; }
        .unified-metrics { display:grid; grid-template-columns:repeat(6, minmax(0,1fr)); gap:9px; margin-bottom:12px; }
        .unified-metrics div { border:1px solid hsl(var(--border)); border-radius:8px; background:hsl(var(--background)/.65); padding:10px; min-width:0; }
        .unified-metrics span { display:block; font-size:.62rem; font-weight:950; text-transform:uppercase; color:hsl(var(--muted-foreground)); }
        .unified-metrics strong { display:block; margin-top:4px; font-size:1rem; font-weight:950; white-space:nowrap; }
        .unified-toolbar { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-bottom:10px; }
        .unified-filter-list { display:flex; flex-wrap:wrap; gap:6px; }
        .unified-filter-list button { border:1px solid hsl(var(--border)); border-radius:7px; background:hsl(var(--background)); color:hsl(var(--muted-foreground)); padding:7px 9px; font-size:.72rem; font-weight:950; cursor:pointer; }
        .unified-filter-list button.active { border-color:hsl(var(--primary)); background:hsl(var(--primary)); color:hsl(var(--primary-foreground)); }
        .unified-search-note { display:flex; align-items:center; gap:6px; color:hsl(var(--muted-foreground)); font-size:.74rem; font-weight:900; }
        .unified-table-wrap { overflow:auto; border:1px solid hsl(var(--border)); border-radius:8px; }
        .unified-table { width:100%; min-width:1260px; border-collapse:collapse; font-size:.76rem; }
        .unified-table th { text-align:left; padding:9px; background:hsl(var(--muted)/.52); color:hsl(var(--muted-foreground)); font-size:.62rem; font-weight:950; text-transform:uppercase; }
        .unified-table td { padding:9px; border-top:1px solid hsl(var(--border)); vertical-align:top; }
        .unified-table td span:not(.unified-badge) { display:block; margin-top:2px; color:hsl(var(--muted-foreground)); font-size:.66rem; font-weight:750; }
        .unified-badge { display:inline-flex; align-items:center; width:max-content; margin:0 4px 4px 0; border-radius:6px; padding:3px 7px; background:hsl(var(--muted)); color:hsl(var(--muted-foreground)); font-size:.62rem; font-weight:950; }
        .unified-badge.good { background:hsl(142 76% 36%/.13); color:hsl(142 76% 28%); }
        .unified-badge.warn { background:hsl(38 92% 50%/.16); color:hsl(32 92% 34%); }
        .unified-badge.blue { background:hsl(199 89% 48%/.12); color:hsl(199 89% 34%); }
        .money-cell { font-weight:950; color:hsl(var(--primary)); white-space:nowrap; }
        .unified-actions { display:flex; gap:6px; flex-wrap:wrap; }
        .unified-actions a, .unified-actions button { border:1px solid hsl(var(--border)); border-radius:7px; background:hsl(var(--background)); color:hsl(var(--foreground)); padding:6px 8px; font-size:.68rem; font-weight:950; text-decoration:none; cursor:pointer; }
        .unified-actions button:disabled { opacity:.55; cursor:not-allowed; }
        .unified-actions + small { display:block; margin-top:5px; color:hsl(var(--muted-foreground)); font-size:.66rem; font-weight:800; }
        .unified-empty { text-align:center; padding:28px !important; color:hsl(var(--muted-foreground)); font-weight:900; }
        @media (max-width:1180px) { .unified-metrics { grid-template-columns:repeat(3, minmax(0,1fr)); } }
        @media (max-width:680px) { .unified-metrics { grid-template-columns:1fr 1fr; } }

        .pay-page { display:flex; flex-direction:column; gap:18px; color:hsl(var(--foreground)); }
        .pay-hero { position:relative; overflow:hidden; border:1px solid hsl(var(--border)/.82); border-radius:8px; background:
          linear-gradient(135deg, hsl(var(--card)/.96), hsl(var(--primary)/.08) 58%, hsl(42 95% 55%/.08)); padding:18px; box-shadow:0 22px 60px -52px hsl(210 40% 20%); }
        .dark .pay-hero { background:linear-gradient(135deg, hsl(var(--card)/.92), hsl(var(--primary)/.12) 58%, hsl(42 55% 14%/.26)); }
        .pay-topbar { position:relative; z-index:1; display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap; }
        .pay-title { font-size:1.7rem; font-weight:800; line-height:1.05; }
        .pay-sub { margin-top:6px; font-size:.88rem; font-weight:500; color:hsl(var(--muted-foreground)); }
        .pay-actions { display:flex; align-items:center; flex-wrap:wrap; justify-content:flex-end; gap:10px; }
        .month-nav, .export-group { display:flex; align-items:center; gap:8px; padding:5px; border-radius:8px; border:1px solid hsl(var(--border)); background:hsl(var(--background)/.76); backdrop-filter:blur(14px); }
        .nav-btn, .action-btn { display:inline-flex; align-items:center; justify-content:center; border:1px solid hsl(var(--border)); cursor:pointer; color:hsl(var(--foreground)); background:hsl(var(--background)); transition:transform .18s ease, box-shadow .18s ease, background .18s ease; }
        .nav-btn { width:30px; height:30px; border-radius:7px; }
        .nav-btn:hover, .action-btn:hover { transform:translateY(-1px); box-shadow:0 10px 24px -18px hsl(210 40% 20%); }
        .month-label { min-width:142px; text-align:center; font-size:.82rem; font-weight:900; white-space:nowrap; }
        .action-btn { gap:7px; min-height:42px; padding:0 14px; border-radius:8px; font-size:.82rem; font-weight:900; }
        .action-btn.primary { border-color:hsl(var(--primary)); background:hsl(var(--primary)); color:hsl(var(--primary-foreground)); }
        .action-btn.active { border-color:hsl(199 89% 48%/.35); background:hsl(199 89% 48%/.1); color:hsl(199 89% 34%); }
        .export-select { height:32px; min-width:122px; border:0; background:transparent; color:hsl(var(--foreground)); font-size:.78rem; font-weight:900; outline:none; }
        .week-tabs { display:flex; gap:8px; flex-wrap:wrap; margin-top:16px; }
        .week-tab { height:34px; min-width:48px; border:1px solid hsl(var(--border)); border-radius:8px; background:hsl(var(--background)/.76); color:hsl(var(--muted-foreground)); cursor:pointer; font-size:.76rem; font-weight:950; }
        .week-tab.active { border-color:hsl(var(--primary)); background:hsl(var(--primary)); color:hsl(var(--primary-foreground)); }
        .kpi-ribbon { position:relative; z-index:1; display:grid; grid-template-columns:.9fr 1fr 1.55fr 1fr; gap:10px; margin-top:14px; }
        .kpi { min-width:0; min-height:112px; padding:12px; border-radius:8px; background:hsl(var(--card)/.78); border:1px solid hsl(var(--border)/.82); backdrop-filter:blur(16px); display:flex; flex-direction:column; justify-content:center; box-shadow:0 14px 38px -36px hsl(210 40% 20%); }
        .kpi-label { display:flex; align-items:center; justify-content:center; gap:7px; text-align:center; font-size:.67rem; font-weight:900; text-transform:uppercase; color:hsl(var(--muted-foreground)); }
        .kpi-value { margin-top:5px; text-align:center; font-size:1.35rem; font-weight:950; }
        .kpi.primary { color:hsl(var(--primary-foreground)); border-color:hsl(var(--primary)); background:linear-gradient(135deg, hsl(var(--primary)), hsl(160 42% 28%)); }
        .kpi.primary .kpi-label { color:hsl(var(--primary-foreground)/.74); }
        .extra-kpi { justify-content:space-between; gap:10px; padding:14px; }
        .extra-title { display:flex; align-items:center; justify-content:space-between; gap:10px; width:100%; }
        .extra-title span:first-child { color:hsl(var(--muted-foreground)); font-size:.7rem; font-weight:950; text-transform:uppercase; letter-spacing:.03em; }
        .extra-title span:last-child { color:hsl(var(--primary)); font-size:1rem; font-weight:950; }
        .extra-fields { display:grid; grid-template-columns:minmax(130px, 1fr) 82px 104px; gap:8px; width:100%; align-items:end; }
        .extra-kpi label { min-width:0; }
        .extra-kpi label span { display:block; margin-bottom:4px; color:hsl(var(--muted-foreground)); font-size:.56rem; font-weight:950; text-transform:uppercase; letter-spacing:.03em; }
        .extra-kpi input { width:100%; height:34px; border:1px solid hsl(var(--border)); border-radius:7px; background:hsl(var(--background)); color:hsl(var(--foreground)); font:inherit; font-size:.78rem; font-weight:850; padding:0 8px; outline:none; box-sizing:border-box; text-align:center; }
        .extra-kpi input:focus { border-color:hsl(var(--primary)); box-shadow:0 0 0 3px hsl(var(--primary)/.1); }
        .extra-kpi .amount-extra { background:hsl(60 100% 50%/.42); text-align:center; }
        .overview-panel { border:1px solid hsl(var(--border)/.82); border-radius:8px; padding:16px; background:hsl(var(--card)/.96); box-shadow:0 18px 55px -48px hsl(210 40% 20%); animation:riseIn .34s ease both; }
        .overview-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; }
        .section-kicker { display:inline-flex; align-items:center; gap:7px; color:hsl(var(--primary)); font-size:.7rem; font-weight:950; text-transform:uppercase; letter-spacing:.08em; }
        .overview-head h2 { margin-top:4px; font-size:1rem; font-weight:950; }
        .average-chip { text-align:right; border:1px solid hsl(var(--border)); border-radius:8px; padding:9px 12px; background:hsl(var(--muted)/.35); }
        .average-chip span { display:block; font-size:.65rem; font-weight:900; color:hsl(var(--muted-foreground)); text-transform:uppercase; }
        .average-chip strong { display:block; margin-top:2px; font-size:.98rem; }
        .month-table-wrap { overflow:auto; border:1px solid hsl(var(--border)); border-radius:8px; }
        .month-table { width:100%; min-width:980px; border-collapse:collapse; font-size:.76rem; }
        .month-table th { text-align:left; padding:10px; background:hsl(var(--muted)/.55); color:hsl(var(--muted-foreground)); font-size:.65rem; text-transform:uppercase; }
        .month-table td { padding:10px; border-top:1px solid hsl(var(--border)); vertical-align:top; }
        .month-table td span { display:block; margin-top:2px; color:hsl(var(--muted-foreground)); font-size:.66rem; font-weight:700; }
        .month-money { color:hsl(var(--primary)); font-weight:950; white-space:nowrap; }
        .cleaner-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(430px, 1fr)); gap:12px; grid-auto-flow:dense; }
        .cleaner-frame { display:flex; flex-direction:column; min-height:246px; border:1px solid hsl(var(--border)/.82);
          border-radius:8px; background:linear-gradient(180deg, hsl(var(--card)/.98), hsl(var(--card)/.98) calc(100% - 5px), hsl(var(--primary)/.2) calc(100% - 5px), hsl(var(--primary)/.2) var(--fill), hsl(var(--card)) var(--fill));
          box-shadow:0 18px 48px -44px hsl(210 40% 20%); animation:riseIn .36s ease both; animation-delay:var(--delay); padding:10px; gap:9px; transition:transform .18s ease, border-color .18s ease, box-shadow .18s ease; }
        .cleaner-frame:hover { transform:translateY(-2px); border-color:hsl(var(--primary)/.28); box-shadow:0 22px 52px -42px hsl(210 40% 20%); }
        .juan-frame { grid-column:auto; }
        .frame-head { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
        .frame-head h2 { max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:.95rem; font-weight:950; }
        .frame-head p { margin-top:2px; max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:hsl(var(--muted-foreground)); font-size:.68rem; font-weight:700; }
        .type-chip { flex-shrink:0; padding:4px 8px; border-radius:7px; font-size:.61rem; font-weight:950; text-transform:uppercase; letter-spacing:.04em; }
        .type-residential { background:hsl(199 89% 48%/.12); color:hsl(199 89% 34%); }
        .type-mixed { background:hsl(38 92% 50%/.16); color:hsl(32 92% 34%); }
        .week-token-row { display:flex; align-items:center; justify-content:space-between; gap:10px; }
        .week-token { display:grid; place-items:center; height:26px; padding:0 9px; border-radius:7px; background:hsl(var(--muted)/.65); color:hsl(var(--muted-foreground)); font-size:.68rem; font-weight:950; }
        .city-help { display:none; }
        .payroll-table-wrap { overflow:auto; border:1px solid hsl(var(--border)); border-radius:7px; background:hsl(var(--background)); }
        .payroll-table { width:100%; min-width:350px; border-collapse:collapse; table-layout:fixed; font-size:.75rem; }
        .payroll-table th:first-child, .payroll-table td:first-child { width:118px; }
        .juan-table { min-width:520px; }
        .payroll-table th { height:30px; padding:5px 7px; border:1px solid hsl(var(--border)); background:hsl(var(--muted)/.52); font-size:.64rem; font-weight:950; text-align:center; text-transform:uppercase; color:hsl(var(--muted-foreground)); }
        .payroll-table td { height:32px; border:1px solid hsl(var(--border)); padding:0; }
        .payroll-table input { width:100%; height:32px; border:0; background:transparent; color:hsl(var(--foreground)); font:inherit; font-size:.76rem; font-weight:800; outline:none; padding:0 7px; box-sizing:border-box; }
        .payroll-table input:focus { box-shadow:inset 0 0 0 2px hsl(var(--primary)/.32); }
        .money-input { text-align:right; }
        .highlight-money { background:hsl(60 100% 50%/.42) !important; }
        .row-btn { display:grid; place-items:center; width:100%; height:32px; border:0; background:transparent; color:hsl(var(--muted-foreground)); cursor:pointer; }
        .row-btn:hover { color:hsl(0 84% 50%); background:hsl(0 84% 60%/.08); }
        .payroll-table tfoot td { height:34px; padding:0 8px; background:hsl(var(--card)); font-weight:950; text-transform:uppercase; }
        .payroll-table tfoot td:not(:first-child) { text-align:right; }
        .highlight-total { background:hsl(60 100% 50%/.72) !important; color:hsl(0 0% 0%); }
        .grand-total { min-width:110px; background:hsl(60 100% 50%/.72) !important; color:hsl(0 0% 0%); white-space:nowrap; }
        .frame-total { margin-top:auto; display:grid; grid-template-columns:1fr auto auto; gap:10px; align-items:center; padding-top:8px; border-top:1px solid hsl(var(--border)); font-size:.76rem; }
        .add-row-btn { display:inline-flex; align-items:center; gap:6px; justify-self:start; height:30px; border:1px solid hsl(var(--border)); border-radius:7px; background:hsl(var(--background)); color:hsl(var(--foreground)); padding:0 10px; font-size:.72rem; font-weight:900; cursor:pointer; }
        .add-row-btn:hover { border-color:hsl(var(--primary)); color:hsl(var(--primary)); }
        .frame-total strong:last-child { color:hsl(var(--primary)); }
        @keyframes riseIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @media (max-width:980px) {
          .juan-frame { grid-column:auto; }
        }
        @media (max-width:1100px) {
          .kpi-ribbon { grid-template-columns:1fr 1fr; }
        }
        @media (max-width:820px) {
          .kpi-ribbon { grid-template-columns:1fr; }
          .pay-actions { justify-content:flex-start; }
          .extra-fields { grid-template-columns:1fr; }
        }
        @media (max-width:520px) {
          .pay-hero { padding:14px; }
          .month-label { min-width:112px; }
          .cleaner-grid { grid-template-columns:1fr; }
          .action-btn, .export-group { width:100%; }
          .export-select { flex:1; }
          .week-token-row { align-items:flex-start; flex-direction:column; }
        }
      `}</style>

      <datalist id="payment-city-options">
        {CITY_OPTIONS.map((city) => (
          <option key={city} value={city} />
        ))}
      </datalist>

      <div className="pay-page">
        <UnifiedPaymentsDashboard payments={unifiedPayments} filter={unifiedFilter} onFilterChange={setUnifiedFilter} onMarkPaid={handleMarkUnifiedPaymentPaid} />
        <section className="pay-hero">
          <div className="pay-topbar">
            <div>
              <h1 className="pay-title">Legacy Weekly Payments</h1>
              <p className="pay-sub">Existing weekly workflow kept intact for residential, manual, and historical payments.</p>
            </div>
            <div className="pay-actions">
              <div className="month-nav">
                <button className="nav-btn" onClick={() => setMonthOffset((offset) => offset - 1)} type="button" aria-label="Previous month">
                  <ChevronLeft size={15} />
                </button>
                <span className="month-label">{monthLabel}</span>
                <button className="nav-btn" onClick={() => setMonthOffset((offset) => offset + 1)} type="button" aria-label="Next month">
                  <ChevronRight size={15} />
                </button>
              </div>
              <button className={`action-btn ${showOverview ? "active" : ""}`} onClick={() => setShowOverview((value) => !value)} type="button">
                <BarChart3 size={15} /> Overview
              </button>
              <Link className="action-btn" href="/commercial/payroll">
                <WalletCards size={15} /> Commercial Panel
              </Link>
              <div className="export-group">
                <select
                  aria-label="PDF export frequency"
                  className="export-select"
                  value={exportFrequency}
                  onChange={(event) => setExportFrequency(event.target.value as ExportFrequency)}
                >
                  {Object.entries(exportFrequencyLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <button className="action-btn primary" onClick={exportPDF} type="button">
                  <FileDown size={15} /> Export PDF
                </button>
              </div>
            </div>
          </div>

          <div className="week-tabs" aria-label="Select payment week">
            {Array.from({ length: WEEK_COUNT }, (_, index) => (
              <button
                className={`week-tab ${selectedWeek === index ? "active" : ""}`}
                key={index}
                onClick={() => setSelectedWeek(index)}
                type="button"
              >
                W{index + 1}
              </button>
            ))}
          </div>

          <div className="kpi-ribbon">
            <div className="kpi">
              <div className="kpi-label"><WalletCards size={14} /> Cleaners</div>
              <div className="kpi-value">{RESIDENTIAL_CLEANERS.length} / {fmtUSD(weekAmount)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label"><CalendarDays size={14} /> Week {selectedWeek + 1}</div>
              <div className="kpi-value">{weekCleanings} / {fmtUSD(weekAmount)}</div>
            </div>
            <div className="kpi extra-kpi">
              <div className="extra-title">
                <span>Operations Manager</span>
                <span>{fmtUSD(weekExtraAmount)}</span>
              </div>
              <div className="extra-fields">
                <label>
                  <span>Manager</span>
                  <input
                    value={extras[selectedWeek].cleaner}
                    onChange={(event) => updateExtra("cleaner", event.target.value)}
                    placeholder="Carlos Lopez"
                  />
                </label>
                <label>
                  <span>Extra hours</span>
                  <input
                    min="0"
                    type="number"
                    value={extras[selectedWeek].hours}
                    onChange={(event) => updateExtra("hours", event.target.value)}
                    placeholder="0"
                  />
                </label>
                <label>
                  <span>Amount</span>
                  <input
                    className="amount-extra"
                    value={extras[selectedWeek].amount}
                    onChange={(event) => updateExtra("amount", event.target.value)}
                    placeholder="$0.00"
                  />
                </label>
              </div>
            </div>
            <div className="kpi primary">
              <div className="kpi-label"><ArrowDownRight size={14} /> Monthly Overview Total</div>
              <div className="kpi-value">{fmtUSD(grandAmount)}</div>
            </div>
          </div>
        </section>

        {dataError ? (
          <p className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive">{dataError}</p>
        ) : null}

        {showOverview ? <OverviewPanel grandAmount={grandAmount} summaries={summaries} /> : null}

        <div className="cleaner-grid">
          {RESIDENTIAL_CLEANERS.map((cleaner, index) => (
            <CleanerFrame
              data={cleanerData[cleaner.name]}
              index={index}
              key={cleaner.name}
              cleaner={cleaner}
              maxAmount={maxWeeklyAmount}
              selectedWeek={selectedWeek}
              onChange={(data) => updateCleaner(cleaner.name, data)}
              onDeleteRow={deletePaymentRow}
              onPersistRow={persistPaymentRow}
            />
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
