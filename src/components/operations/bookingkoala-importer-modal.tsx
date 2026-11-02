"use client";

import { useState, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  Upload,
  Clipboard,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  X,
  Sparkles,
  Database,
  Building2,
  Home,
  Clock,
  UserCheck,
  RefreshCw,
  Search,
  ChevronDown,
  Info,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/providers/language-provider";

export type BookingKoalaRow = {
  id?: string;
  bookingId?: string;
  customerName: string;
  serviceDate: string;
  serviceDay?: string;
  startTime?: string;
  cleanerName: string;
  serviceType: string;
  frequency?: string;
  chargedAmount: number;
  processingFee?: number;
  tip?: number;
  cleanerPay: number;
  hours: number;
  city?: string;
  address?: string;
  status?: string;
  isCommercial: boolean;
  notes?: string;
};

const KNOWN_CLEANERS = [
  "Ana Morales",
  "Carlos Lopez",
  "Emmi Guerra",
  "Juan Romero",
  "Kassandra Valentin",
  "Lesbia Vasquez",
  "Lucia Portillo",
  "Luz Uribe",
  "Maria Lopez",
  "Maria Mejia",
  "Mirna Contreras",
  "Rossy Legorreta",
  "Sandra Hernandez",
  "Susana Bautista",
  "Veronica Ladinos",
  "Vanessa Ortega",
  "José Vazquez",
  "Ivanda Mejia",
  "Martha Garcia",
];

const KNOWN_COMMERCIAL_KEYWORDS = [
  "mama's", "mamas", "swing easy", "green leaf", "sierra analytical",
  "university park", "la model", "kott", "kush", "posh pooch", "renewable",
  "ilg", "interior logic", "elevate aerial", "vntr", "miwa", "ocss",
  "field ai", "13de", "13demarzo", "miracle", "miraculous", "the harper",
  "harper", "wren", "globar", "glo bar", "steripax", "macarthur",
  "lsg", "sky chefs", "moxi3", "cornerstone", "lifted dentistry"
];

function matchCleanerName(raw?: string): string {
  if (!raw) return "Unassigned";
  const cleaned = raw.replace(/^\d+\s*:\s*/, "").trim();
  const lower = cleaned.toLowerCase();
  for (const c of KNOWN_CLEANERS) {
    if (lower.includes(c.toLowerCase()) || c.toLowerCase().includes(lower)) {
      return c;
    }
  }
  return cleaned || "Unassigned";
}

function detectIsCommercial(customerName: string, serviceType: string): boolean {
  const text = `${customerName} ${serviceType}`.toLowerCase();
  if (text.includes("commercial") || text.includes("office") || text.includes("clinic") || text.includes("gym") || text.includes("venue")) {
    return true;
  }
  for (const kw of KNOWN_COMMERCIAL_KEYWORDS) {
    if (text.includes(kw)) return true;
  }
  return false;
}

function normalizeDate(raw?: any): string {
  if (!raw) return new Date().toISOString().split("T")[0];
  if (typeof raw === "number") {
    // Round to nearest integer serial day to prevent timezone float offsets (.999537 -> previous day 23:59)
    const parsed = XLSX.SSF.parse_date_code(Math.round(raw));
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }
  const trimmed = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // Handle MM/DD/YYYY or MM/DD/YY
  const match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (match) {
    const month = match[1].padStart(2, "0");
    const day = match[2].padStart(2, "0");
    let year = match[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }
  return trimmed;
}

function parseCurrency(raw?: any): number {
  if (typeof raw === "number") return raw;
  if (!raw) return 0;
  const cleaned = String(raw).replace(/[^0-9.-]/g, "");
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

function parseHours(raw?: any): number {
  if (typeof raw === "number") return raw;
  if (!raw) return 0;
  const value = String(raw).trim();
  const timeMatch = value.match(/^(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    return Number((Number(timeMatch[1]) + Number(timeMatch[2]) / 60).toFixed(2));
  }
  return parseCurrency(value);
}

function weekRangeFor(date: string) {
  const d = new Date(`${date}T12:00:00`);
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    weekStart: start.toISOString().slice(0, 10),
    weekEnd: end.toISOString().slice(0, 10),
  };
}

function parseBookingRows(gridRows: any[][]): BookingKoalaRow[] {
  if (!gridRows || gridRows.length < 2) return [];

  const headers = gridRows[0].map((h) => String(h || "").trim().toLowerCase());
  return gridRows.slice(1).flatMap((cols, idx) => {
    if (!cols || cols.length === 0) return [];

    let customerName = "";
    let serviceDate = new Date().toISOString().split("T")[0];
    let cleanerName = "Unassigned";
    let serviceType = "Standard Cleaning";
    let frequency = "One-Time";
    let serviceTotal = 0;
    let finalAmount = 0;
    let processingFee = 0;
    let tip = 0;
    let cleanerPay = 0;
    let hours = 0;
    let city = "Orange County";
    let address = "";
    let bookingId = `BK-${idx + 1}`;

    headers.forEach((h, hIdx) => {
      const rawVal = cols[hIdx];
      if (rawVal === undefined || rawVal === null || rawVal === "") return;
      const val = String(rawVal).trim();

      if (h === "full name" || h === "customer" || h === "client" || h.includes("customer name") || h.includes("client name")) customerName = val;
      else if (h === "company name" && val && !customerName) customerName = val;
      else if (h === "date" || h.includes("service date")) serviceDate = normalizeDate(rawVal);
      else if (h.includes("provider/team payment") || h.includes("cleaner pay") || h.includes("wage") || h.includes("payout")) cleanerPay = parseCurrency(val);
      else if (h === "provider/team" || h === "provider" || h === "cleaner" || h === "team" || h.includes("assigned")) cleanerName = matchCleanerName(val);
      else if (h === "service" || h.includes("service type") || h.includes("category")) serviceType = val;
      else if (h === "frequency") frequency = val;
      else if (h.includes("service total") || h === "price" || h.includes("charged") || h.includes("revenue")) serviceTotal = parseCurrency(val);
      else if (h.includes("final amount")) finalAmount = parseCurrency(val);
      else if (h.includes("processing fee")) processingFee = parseCurrency(val);
      else if (h === "tip (usd)" || h === "tip") tip = parseCurrency(val);
      else if (h.includes("estimated job length") || h.includes("hour") || h.includes("duration") || h.includes("length")) hours = parseHours(val);
      else if (h === "city") city = val || city;
      else if (h === "address") address = val;
      else if (h === "booking id" || h === "booking #" || h === "job id" || h === "id") bookingId = val;
    });

    if (!customerName && cols[2]) customerName = String(cols[2]).trim();
    if (!customerName) return [];

    const chargedAmount = serviceTotal > 0
      ? serviceTotal
      : Math.max(0, Number((finalAmount - processingFee - tip).toFixed(2)));

    const isCommercial = detectIsCommercial(customerName, serviceType);

    // Solo estimar pago por hora ($18/hr) en trabajos comerciales con cleaner asignado; nunca fabricar pago en Unassigned residenciales
    if (isCommercial && cleanerName !== "Unassigned" && hours > 0 && cleanerPay === 0) {
      cleanerPay = Number((hours * 18).toFixed(2));
    } else if (cleanerPay > 0 && hours === 0) {
      hours = Number((cleanerPay / 18).toFixed(2));
    }

    return [{
      bookingId,
      customerName,
      serviceDate,
      cleanerName,
      serviceType,
      frequency,
      chargedAmount,
      processingFee,
      tip,
      cleanerPay,
      hours,
      city,
      address,
      isCommercial,
      status: "Confirmed",
    }];
  });
}

export function BookingKoalaImporterModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { isEn } = useLanguage();
  const [tab, setTab] = useState<"paste" | "upload" | "guide">("paste");
  const [pasteText, setPasteText] = useState("");
  const [parsedRows, setParsedRows] = useState<BookingKoalaRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | "residential" | "commercial">("all");
  const [searchFilter, setSearchFilter] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = useMemo(() => createClient(), []);

  // Parse pasted raw text or table data
  const handleParseText = () => {
    if (!pasteText.trim()) {
      setError(isEn ? "Please paste the BookingKoala text or table." : "Por favor pega el texto o tabla de BookingKoala.");
      return;
    }

    setParsing(true);
    setError(null);
    setSaveSuccessMsg(null);

    try {
      const workbook = XLSX.read(pasteText.trim(), { type: "string" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const gridRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false }) as any[][];

      if (!gridRows || gridRows.length === 0) {
        setError(isEn ? "No data lines found." : "No se encontraron líneas de datos.");
        setParsing(false);
        return;
      }

      const results = parseBookingRows(gridRows);

      setParsedRows(results);
      if (results.length === 0) {
        setError(isEn ? "Could not extract valid rows. Check the pasted format." : "No se pudieron extraer filas válidas. Verifica el formato pegado.");
      }
    } catch (err: any) {
      setError(isEn ? `Error processing the text: ${err.message}` : `Error al procesar el texto: ${err.message}`);
    } finally {
      setParsing(false);
    }
  };

  // Handle File Upload (CSV or Excel)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setError(null);
    setSaveSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false }) as any[][];

        if (!jsonRows || jsonRows.length < 2) {
          setError(isEn ? "The file does not contain data rows." : "El archivo no contiene filas de datos.");
          setParsing(false);
          return;
        }

        const results = parseBookingRows(jsonRows);

        setParsedRows(results);
      } catch (err: any) {
        setError(isEn ? `Error reading the file: ${err.message}` : `Error al leer el archivo: ${err.message}`);
      } finally {
        setParsing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Save parsed rows to Supabase database
  const handleSaveToDatabase = async () => {
    if (parsedRows.length === 0) return;
    setSaving(true);
    setError(null);
    setSaveSuccessMsg(null);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) {
        setError(isEn ? "You must sign in to save data to the system." : "Debes iniciar sesión para guardar datos en el sistema.");
        setSaving(false);
        return;
      }

      const now = new Date().toISOString();
      let commercialSaved = 0;
      let residentialSaved = 0;
      let residentialPaymentRowsSaved = 0;

      const serviceDates = parsedRows.map((row) => row.serviceDate).filter(Boolean).sort();
      const importStartDate = serviceDates[0];
      const importEndDate = serviceDates[serviceDates.length - 1];
      const getExistingBookingIds = async (tableName: string) => {
        if (!importStartDate || !importEndDate) return new Set<string>();
        const { data, error } = await supabase
          .from(tableName)
          .select("notes")
          .ilike("notes", "%BookingKoala ID:%")
          .gte("work_date", importStartDate)
          .lte("work_date", importEndDate);
        if (error) throw error;
        return new Set((data || []).flatMap((row: { notes: string | null }) => {
          const match = row.notes?.match(/BookingKoala ID:\s*([^;]+)/i);
          return match?.[1] ? [match[1].trim()] : [];
        }));
      };

      const [existingCommercialBookingIds, existingResidentialWorkBookingIds, existingResidentialPaymentBookingIds] = await Promise.all([
        getExistingBookingIds("commercial_hours_entries"),
        getExistingBookingIds("residential_work_logs"),
        getExistingBookingIds("residential_weekly_payment_rows"),
      ]);

      // Split into commercial and residential
      const commercialItems = parsedRows.filter((r) => r.isCommercial);
      const residentialItems = parsedRows.filter((r) => !r.isCommercial);

      // Save commercial hours entries
      if (commercialItems.length > 0) {
        const { data: commAccounts } = await supabase.from("commercial_accounts").select("id, name");
        const commMap = new Map<string, string>();
        for (const c of commAccounts || []) {
          commMap.set(c.name.toLowerCase().trim(), c.id);
        }

        const entries = commercialItems.filter((item) => !existingCommercialBookingIds.has(item.bookingId || "")).map((item) => {
          const accId = commMap.get(item.customerName.toLowerCase().trim()) || null;
          return {
            user_id: userId,
            account_id: accId,
            account_name: item.customerName,
            team_name: item.cleanerName,
            work_date: item.serviceDate,
            scheduled_day: new Date(item.serviceDate + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long" }),
            scheduled_hours: item.hours || 3.0,
            completed_hours: item.hours || 3.0,
            verified_hours: item.hours || 3.0,
            status: "completed",
            verified: true,
            notes: `BookingKoala ID: ${item.bookingId}; Imported from BookingKoala - ${item.serviceType} ($${item.cleanerPay} pay @ $18/hr)`,
            manual_entry: true,
            period_start: item.serviceDate.slice(0, 8) + (parseInt(item.serviceDate.slice(8, 10)) <= 15 ? "01" : "16"),
            period_end: item.serviceDate.slice(0, 8) + (parseInt(item.serviceDate.slice(8, 10)) <= 15 ? "15" : String(new Date(parseInt(item.serviceDate.slice(0, 4)), parseInt(item.serviceDate.slice(5, 7)), 0).getDate()).padStart(2, "0")),
            created_at: now,
            updated_at: now,
          };
        });

        if (entries.length > 0) {
          const { error: commErr } = await supabase.from("commercial_hours_entries").insert(entries);
          if (commErr) throw commErr;
        }
        commercialSaved = entries.length;
      }

      // Save residential payments / work logs
      if (residentialItems.length > 0) {
        const resWorkEntries = residentialItems.filter((item) => !existingResidentialWorkBookingIds.has(item.bookingId || "")).map((item) => ({
          user_id: userId,
          account_name: item.customerName,
          team_name: item.cleanerName,
          work_date: item.serviceDate,
          hours_worked: item.hours,
          notes: `BookingKoala ID: ${item.bookingId}; ${item.serviceType}; freq: ${item.frequency || "One-Time"}; charged $${item.chargedAmount}; fee $${item.processingFee || 0}; tip $${item.tip || 0}; cleaner pay $${item.cleanerPay}; city: ${item.city}`,
          status: "completed",
          created_at: now,
          updated_at: now,
        }));
        const paymentRows = residentialItems.filter((item) => item.cleanerPay > 0 && !existingResidentialPaymentBookingIds.has(item.bookingId || "")).map((item) => {
          const { weekStart, weekEnd } = weekRangeFor(item.serviceDate);
          return {
            user_id: userId,
            cleaner_name: item.cleanerName,
            work_date: item.serviceDate,
            city: item.city,
            payment_amount: item.cleanerPay,
            residential_amount: 0,
            commercial_amount: 0,
            payment_type: "residential",
            payment_mode: "residential_only",
            week_start: weekStart,
            week_end: weekEnd,
            status: "pending",
            notes: `BookingKoala ID: ${item.bookingId}; ${item.customerName}; ${item.serviceType}; freq: ${item.frequency || "One-Time"}; charged $${item.chargedAmount}; fee $${item.processingFee || 0}; tip $${item.tip || 0}`,
            created_at: now,
            updated_at: now,
          };
        });

        if (resWorkEntries.length > 0) {
          const { error: resWorkErr } = await supabase.from("residential_work_logs").insert(resWorkEntries);
          if (resWorkErr) throw resWorkErr;
        }
        if (paymentRows.length > 0) {
          const { error: paymentErr } = await supabase.from("residential_weekly_payment_rows").insert(paymentRows);
          if (paymentErr) throw paymentErr;
        }
        residentialSaved = resWorkEntries.length;
        residentialPaymentRowsSaved = paymentRows.length;
      }

      setSaveSuccessMsg(
        isEn
          ? `Successfully imported ${parsedRows.length} bookings (${commercialSaved} new commercial entries, ${residentialSaved} new residential work logs, ${residentialPaymentRowsSaved} new residential payment rows) into the system.`
          : `Se importaron ${parsedRows.length} reservas (${commercialSaved} nuevas entradas comerciales, ${residentialSaved} nuevos registros residenciales, ${residentialPaymentRowsSaved} nuevas filas de pago residencial) al sistema.`
      );
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(isEn ? `Error saving to the database: ${err.message}` : `Error al guardar en la base de datos: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const filteredRows = parsedRows.filter((r) => {
    if (filterType === "residential" && r.isCommercial) return false;
    if (filterType === "commercial" && !r.isCommercial) return false;
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      return (
        r.customerName.toLowerCase().includes(q) ||
        r.cleanerName.toLowerCase().includes(q) ||
        r.serviceType.toLowerCase().includes(q) ||
        r.serviceDate.includes(q)
      );
    }
    return true;
  });

  const totals = useMemo(() => {
    const charged = parsedRows.reduce((sum, r) => sum + r.chargedAmount, 0);
    const pay = parsedRows.reduce((sum, r) => sum + r.cleanerPay, 0);
    const hrs = parsedRows.reduce((sum, r) => sum + r.hours, 0);
    return { charged, pay, hrs, count: parsedRows.length };
  }, [parsedRows]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/80 px-6 py-4 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                {isEn ? "BookingKoala Smart Importer" : "Importador Inteligente de BookingKoala"}
                <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  {isEn ? "Fast Import" : "Importación Rápida"}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                {isEn
                  ? "Bulk import bookings, cleaners, and hours without copying them one by one."
                  : "Importa reservas, limpiadoras y horas en lote sin copiarlas una por una."}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={isEn ? "Close" : "Cerrar"}
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center gap-2 border-b border-border/60 px-6 py-2 bg-muted/10">
          <button
            onClick={() => setTab("paste")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              tab === "paste"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Clipboard className="size-3.5" />
            {isEn ? "1. Paste Table / Direct Text" : "1. Pegar Tabla / Texto Directo"}
          </button>
          <button
            onClick={() => setTab("upload")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              tab === "upload"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Upload className="size-3.5" />
            {isEn ? "2. Upload CSV / Excel File" : "2. Subir Archivo CSV / Excel"}
          </button>
          <button
            onClick={() => setTab("guide")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              tab === "guide"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Info className="size-3.5" />
            {isEn ? "BookingKoala Access Guide" : "Guía de Acceso a BookingKoala"}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Guide Tab */}
          {tab === "guide" && (
            <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-5 text-sm">
              <h3 className="font-bold text-foreground flex items-center gap-2 text-base">
                <Info className="size-4 text-primary" />
                {isEn
                  ? 'How to get the list if "Reports" says you do not have admin permissions:'
                  : 'Cómo obtener la lista si "Reports" indica que no tienes permisos de administrador:'}
              </h3>
              <div className="grid gap-3 text-xs text-muted-foreground md:grid-cols-3">
                <div className="rounded-lg border border-border/80 bg-card p-3 shadow-sm">
                  <strong className="text-foreground block mb-1">
                    {isEn ? "Step 1: Bookings Menu" : "Paso 1: Menú Bookings"}
                  </strong>
                  {isEn ? (
                    <>Click the left menu in BookingKoala and open <strong>Bookings</strong> (not Reports).</>
                  ) : (
                    <>Haz clic en el menú izquierdo de BookingKoala y abre <strong>Bookings</strong> (no Reports).</>
                  )}
                </div>
                <div className="rounded-lg border border-border/80 bg-card p-3 shadow-sm">
                  <strong className="text-foreground block mb-1">
                    {isEn ? "Step 2: List View" : "Paso 2: Vista de Lista"}
                  </strong>
                  {isEn ? (
                    <>Select <strong>List View</strong> or <strong>All Bookings</strong> to see the full table with dates and cleaners.</>
                  ) : (
                    <>Selecciona <strong>List View</strong> o <strong>All Bookings</strong> para ver la tabla completa con fechas y limpiadoras.</>
                  )}
                </div>
                <div className="rounded-lg border border-border/80 bg-card p-3 shadow-sm">
                  <strong className="text-foreground block mb-1">
                    {isEn ? "Step 3: Copy and Paste" : "Paso 3: Copiar y Pegar"}
                  </strong>
                  {isEn ? (
                    <>Select the text with your mouse or <kbd className="rounded bg-muted px-1">Cmd+A</kbd>, copy with <kbd className="rounded bg-muted px-1">Cmd+C</kbd>, and paste it in the <strong>Paste Table</strong> here.</>
                  ) : (
                    <>Selecciona el texto con el mouse o <kbd className="rounded bg-muted px-1">Cmd+A</kbd>, copia con <kbd className="rounded bg-muted px-1">Cmd+C</kbd> y pégalo aquí en <strong>Pegar Tabla</strong>.</>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Paste Tab */}
          {tab === "paste" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <Clipboard className="size-3.5 text-primary" />
                  {isEn
                    ? "Paste the table or list copied from BookingKoala here:"
                    : "Pega aquí la tabla o lista copiada de BookingKoala:"}
                </label>
                <span className="text-[11px] text-muted-foreground">
                  {isEn
                    ? "Supports tab-separated text, commas, or copied columns"
                    : "Admite texto separado por tabulaciones, comas o columnas copiadas"}
                </span>
              </div>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={
                  isEn
                    ? "Booking ID   Customer   Date   Cleaner   Service   Price   Pay...\nBK-101   Field AI   8/1/2026   Ana Morales   Commercial   $154.09   $54.00..."
                    : "Booking ID   Cliente   Fecha   Cleaner   Servicio   Precio   Pago...\nBK-101   Field AI   8/1/2026   Ana Morales   Commercial   $154.09   $54.00..."
                }
                rows={6}
                className="w-full rounded-xl border border-border bg-background p-3 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPasteText("")}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
                >
                  {isEn ? "Clear" : "Limpiar"}
                </button>
                <button
                  type="button"
                  onClick={handleParseText}
                  disabled={parsing || !pasteText.trim()}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 shadow-sm disabled:opacity-50"
                >
                  <Sparkles className="size-3.5" />
                  {parsing
                    ? isEn ? "Processing..." : "Procesando..."
                    : isEn ? "Analyze and Preview" : "Analizar y Previsualizar"}
                </button>
              </div>
            </div>
          )}

          {/* Upload Tab */}
          {tab === "upload" && (
            <div className="rounded-2xl border-2 border-dashed border-border/80 bg-muted/10 p-8 text-center hover:border-primary/50 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
                <FileSpreadsheet className="size-6" />
              </div>
              <h4 className="text-sm font-bold text-foreground">
                {isEn ? "Drag your CSV or Excel file here" : "Arrastra tu archivo CSV o Excel aquí"}
              </h4>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                {isEn ? "Direct Bookings export (.csv, .xlsx)" : "Exportación directa de reservas (.csv, .xlsx)"}
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 shadow-sm"
              >
                <Upload className="size-4" />
                {isEn ? "Select File" : "Seleccionar Archivo"}
              </button>
            </div>
          )}

          {/* Error and Success Alerts */}
          {error && (
            <div className="flex items-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {saveSuccessMsg && (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-4 pt-2">
              {/* KPIs & Controls */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">
                    {isEn ? `Detected rows (${parsedRows.length}):` : `Filas detectadas (${parsedRows.length}):`}
                  </span>
                  <div className="flex rounded-lg border border-border/80 bg-muted/30 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setFilterType("all")}
                      className={`rounded px-2.5 py-1 font-medium transition-colors ${
                        filterType === "all" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {isEn ? `All (${totals.count})` : `Todas (${totals.count})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType("commercial")}
                      className={`rounded px-2.5 py-1 font-medium transition-colors ${
                        filterType === "commercial" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {isEn
                        ? `Commercial (${parsedRows.filter((r) => r.isCommercial).length})`
                        : `Comercial (${parsedRows.filter((r) => r.isCommercial).length})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType("residential")}
                      className={`rounded px-2.5 py-1 font-medium transition-colors ${
                        filterType === "residential" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {isEn
                        ? `Residential (${parsedRows.filter((r) => !r.isCommercial).length})`
                        : `Residencial (${parsedRows.filter((r) => !r.isCommercial).length})`}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="size-3.5 text-primary" />
                    <span>{isEn ? "Total Hours:" : "Horas Totales:"} <strong>{totals.hrs.toFixed(1)}h</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span>{isEn ? "Payroll:" : "Nómina:"} <strong className="text-emerald-600 dark:text-emerald-400">${totals.pay.toFixed(2)}</strong></span>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder={isEn ? "Filter by client/cleaner..." : "Filtrar por cliente/limpiadora..."}
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="h-8 rounded-lg border border-border bg-background pl-8 pr-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="max-h-72 overflow-y-auto rounded-xl border border-border/80 bg-background/50 shadow-inner">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-muted/90 backdrop-blur-xs text-[11px] font-bold text-muted-foreground uppercase border-b border-border/60">
                    <tr>
                      <th className="px-3 py-2.5">{isEn ? "Type" : "Tipo"}</th>
                      <th className="px-3 py-2.5">{isEn ? "Date" : "Fecha"}</th>
                      <th className="px-3 py-2.5">{isEn ? "Client / Account" : "Cliente / Cuenta"}</th>
                      <th className="px-3 py-2.5">{isEn ? "Cleaner / Provider" : "Limpiadora / Proveedor"}</th>
                      <th className="px-3 py-2.5">{isEn ? "Service" : "Servicio"}</th>
                      <th className="px-3 py-2.5 text-right">{isEn ? "Hours" : "Horas"}</th>
                      <th className="px-3 py-2.5 text-right">{isEn ? "Client Charge" : "Cobro Cliente"}</th>
                      <th className="px-3 py-2.5 text-right">{isEn ? "Cleaner Pay (/h)" : "Pago Limpiadora (/h)"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredRows.map((row, i) => (
                      <tr key={i} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              row.isCommercial
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                                : "bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/20"
                            }`}
                          >
                            {row.isCommercial ? <Building2 className="size-2.5" /> : <Home className="size-2.5" />}
                            {row.isCommercial ? (isEn ? "Commercial" : "Comercial") : (isEn ? "Residential" : "Residencial")}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-foreground">{row.serviceDate}</td>
                        <td className="px-3 py-2 font-bold text-foreground">{row.customerName}</td>
                        <td className="px-3 py-2 text-foreground font-medium flex items-center gap-1.5">
                          <UserCheck className="size-3 text-primary" />
                          {row.cleanerName === "Unassigned" ? (isEn ? "Unassigned" : "Sin asignar") : row.cleanerName}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground text-[11px]">{row.serviceType}</td>
                        <td className="px-3 py-2 text-right font-mono font-medium">{row.hours > 0 ? `${row.hours}h` : "—"}</td>
                        <td className="px-3 py-2 text-right font-mono font-medium">${row.chargedAmount.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          ${row.cleanerPay.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-border/80 px-6 py-4 bg-muted/20">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            {isEn ? "Cancel" : "Cancelar"}
          </button>
          <div className="flex items-center gap-3">
            {parsedRows.length > 0 && (
              <button
                type="button"
                onClick={handleSaveToDatabase}
                disabled={saving || parsedRows.length === 0}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 shadow-md transition-all disabled:opacity-50"
              >
                <Database className="size-4" />
                {saving
                  ? isEn ? "Saving to Database..." : "Guardando en Base de Datos..."
                  : isEn
                    ? `Load ${parsedRows.length} Bookings to the Database`
                    : `Cargar ${parsedRows.length} Reservas a la Base de Datos`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
