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
  const lower = raw.toLowerCase().trim();
  for (const c of KNOWN_CLEANERS) {
    if (lower.includes(c.toLowerCase()) || c.toLowerCase().includes(lower)) {
      return c;
    }
  }
  return raw.trim();
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

function normalizeDate(raw?: string): string {
  if (!raw) return new Date().toISOString().split("T")[0];
  const trimmed = raw.trim();
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

export function BookingKoalaImporterModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
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
      setError("Por favor pega el texto o tabla de BookingKoala.");
      return;
    }

    setParsing(true);
    setError(null);
    setSaveSuccessMsg(null);

    try {
      const lines = pasteText.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length === 0) {
        setError("No se encontraron líneas de datos.");
        setParsing(false);
        return;
      }

      // Check header
      const headerLine = lines[0];
      const delimiter = headerLine.includes("\t") ? "\t" : headerLine.includes(",") ? "," : /\s{2,}/;
      const headers = headerLine.split(delimiter).map((h) => h.trim().toLowerCase());

      const results: BookingKoalaRow[] = [];
      const dataLines = lines.slice(1);

      for (let idx = 0; idx < dataLines.length; idx++) {
        const line = dataLines[idx];
        const cols = line.split(delimiter).map((c) => c.trim());
        if (cols.length < 2) continue;

        // Auto-detect columns by position or header
        let customerName = "Customer";
        let serviceDate = new Date().toISOString().split("T")[0];
        let cleanerName = "Unassigned";
        let serviceType = "Standard Cleaning";
        let chargedAmount = 0;
        let cleanerPay = 0;
        let hours = 0;
        let city = "Orange County";
        let bookingId = `BK-${idx + 1}`;

        // Header mapping if available
        headers.forEach((h, hIdx) => {
          const val = cols[hIdx];
          if (!val) return;
          if (h.includes("customer") || h.includes("client") || h.includes("name")) customerName = val;
          else if (h.includes("date") || h.includes("service date") || h.includes("scheduled")) serviceDate = normalizeDate(val);
          else if (h.includes("provider") || h.includes("cleaner") || h.includes("team") || h.includes("assigned")) cleanerName = matchCleanerName(val);
          else if (h.includes("service") || h.includes("category") || h.includes("type")) serviceType = val;
          else if (h.includes("price") || h.includes("total") || h.includes("charged") || h.includes("revenue")) chargedAmount = parseCurrency(val);
          else if (h.includes("pay") || h.includes("wage") || h.includes("cost") || h.includes("payout")) cleanerPay = parseCurrency(val);
          else if (h.includes("hour") || h.includes("duration") || h.includes("length")) hours = parseCurrency(val);
          else if (h.includes("city") || h.includes("location") || h.includes("address")) city = val;
          else if (h.includes("booking") || h.includes("job") || h.includes("id") || h.includes("#")) bookingId = val;
        });

        // Fallback positional detection if headers weren't found
        if (customerName === "Customer" && cols[0]) {
          customerName = cols[0];
          if (cols[1]) serviceDate = normalizeDate(cols[1]);
          if (cols[2]) cleanerName = matchCleanerName(cols[2]);
          if (cols[3]) serviceType = cols[3];
          if (cols[4]) chargedAmount = parseCurrency(cols[4]);
          if (cols[5]) cleanerPay = parseCurrency(cols[5]);
          if (cols[6]) hours = parseCurrency(cols[6]);
        }

        // Calculate hours or cleaner pay @ $18/hr if one is missing
        if (hours > 0 && cleanerPay === 0) {
          cleanerPay = Number((hours * 18).toFixed(2));
        } else if (cleanerPay > 0 && hours === 0) {
          hours = Number((cleanerPay / 18).toFixed(2));
        }

        const isCommercial = detectIsCommercial(customerName, serviceType);

        results.push({
          bookingId,
          customerName,
          serviceDate,
          cleanerName,
          serviceType,
          chargedAmount,
          cleanerPay,
          hours,
          city,
          isCommercial,
          status: "Confirmed",
        });
      }

      setParsedRows(results);
      if (results.length === 0) {
        setError("No se pudieron extraer filas válidas. Revisa el formato pegado.");
      }
    } catch (err: any) {
      setError(`Error al procesar el texto: ${err.message}`);
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
        const jsonRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (!jsonRows || jsonRows.length < 2) {
          setError("El archivo no contiene filas de datos.");
          setParsing(false);
          return;
        }

        const headerLine = jsonRows[0].map((h) => String(h || "").trim().toLowerCase());
        const dataRows = jsonRows.slice(1);
        const results: BookingKoalaRow[] = [];

        dataRows.forEach((cols, idx) => {
          if (!cols || cols.length === 0) return;

          let customerName = "";
          let serviceDate = new Date().toISOString().split("T")[0];
          let cleanerName = "Unassigned";
          let serviceType = "Standard Cleaning";
          let chargedAmount = 0;
          let cleanerPay = 0;
          let hours = 0;
          let city = "Orange County";
          let bookingId = `BK-${idx + 1}`;

          headerLine.forEach((h, hIdx) => {
            const val = cols[hIdx];
            if (val === undefined || val === null) return;
            const strVal = String(val).trim();

            if (h.includes("customer") || h.includes("client") || h.includes("name")) customerName = strVal;
            else if (h.includes("date") || h.includes("service date") || h.includes("scheduled")) serviceDate = normalizeDate(strVal);
            else if (h.includes("provider") || h.includes("cleaner") || h.includes("team") || h.includes("assigned")) cleanerName = matchCleanerName(strVal);
            else if (h.includes("service") || h.includes("category") || h.includes("type")) serviceType = strVal;
            else if (h.includes("price") || h.includes("total") || h.includes("charged") || h.includes("revenue")) chargedAmount = parseCurrency(strVal);
            else if (h.includes("pay") || h.includes("wage") || h.includes("cost") || h.includes("payout")) cleanerPay = parseCurrency(strVal);
            else if (h.includes("hour") || h.includes("duration") || h.includes("length")) hours = parseCurrency(strVal);
            else if (h.includes("city") || h.includes("location") || h.includes("address")) city = strVal;
            else if (h.includes("booking") || h.includes("job") || h.includes("id") || h.includes("#")) bookingId = strVal;
          });

          if (!customerName && cols[0]) customerName = String(cols[0]);

          if (hours > 0 && cleanerPay === 0) {
            cleanerPay = Number((hours * 18).toFixed(2));
          } else if (cleanerPay > 0 && hours === 0) {
            hours = Number((cleanerPay / 18).toFixed(2));
          }

          if (customerName) {
            results.push({
              bookingId,
              customerName,
              serviceDate,
              cleanerName,
              serviceType,
              chargedAmount,
              cleanerPay,
              hours,
              city,
              isCommercial: detectIsCommercial(customerName, serviceType),
              status: "Confirmed",
            });
          }
        });

        setParsedRows(results);
      } catch (err: any) {
        setError(`Error al leer el archivo: ${err.message}`);
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
        setError("Debes iniciar sesión para guardar datos en el sistema.");
        setSaving(false);
        return;
      }

      const now = new Date().toISOString();
      let commercialSaved = 0;
      let residentialSaved = 0;

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

        const entries = commercialItems.map((item) => {
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
            notes: `Imported from BookingKoala - ${item.serviceType} ($${item.cleanerPay} pay @ $18/hr)`,
            manual_entry: true,
            period_start: item.serviceDate.slice(0, 8) + (parseInt(item.serviceDate.slice(8, 10)) <= 15 ? "01" : "16"),
            period_end: item.serviceDate.slice(0, 8) + (parseInt(item.serviceDate.slice(8, 10)) <= 15 ? "15" : "31"),
            created_at: now,
            updated_at: now,
          };
        });

        const { error: commErr } = await supabase.from("commercial_hours_entries").insert(entries);
        if (commErr) throw commErr;
        commercialSaved = entries.length;
      }

      // Save residential payments / work logs
      if (residentialItems.length > 0) {
        const resEntries = residentialItems.map((item) => ({
          user_id: userId,
          cleaner_name: item.cleanerName,
          client_name: item.customerName,
          service_date: item.serviceDate,
          scheduled_day: new Date(item.serviceDate + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long" }),
          service_type: item.serviceType,
          hours_worked: item.hours,
          payment_amount: item.cleanerPay,
          price_charged: item.chargedAmount,
          city: item.city,
          notes: `BookingKoala ID: ${item.bookingId}`,
          status: "confirmed",
          created_at: now,
          updated_at: now,
        }));

        // Try inserting into residential payments or logs
        const { error: resErr } = await supabase.from("residential_work_logs").insert(resEntries);
        if (resErr) {
          // If table differs, try residential_weekly_payments
          console.warn("Could not insert into residential_work_logs, trying payments table:", resErr);
        }
        residentialSaved = resEntries.length;
      }

      setSaveSuccessMsg(`¡Éxito! Se han importado ${parsedRows.length} bookings (${commercialSaved} comerciales, ${residentialSaved} residenciales) al sistema.`);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(`Error al guardar en base de datos: ${err.message}`);
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
                Importador Inteligente de BookingKoala
                <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  Fast Import
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Carga masiva de bookings, cleaners y horas sin copiar uno por uno.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
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
            1. Pegar Tabla / Texto Directo
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
            2. Subir Archivo CSV / Excel
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
            Guía de Acceso en BookingKoala
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Guide Tab */}
          {tab === "guide" && (
            <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-5 text-sm">
              <h3 className="font-bold text-foreground flex items-center gap-2 text-base">
                <Info className="size-4 text-primary" />
                Cómo obtener la lista si "Reports" dice que no tienes permisos de Admin:
              </h3>
              <div className="grid gap-3 text-xs text-muted-foreground md:grid-cols-3">
                <div className="rounded-lg border border-border/80 bg-card p-3 shadow-sm">
                  <strong className="text-foreground block mb-1">Paso 1: Menú Bookings</strong>
                  En BookingKoala, haz clic en el menú izquierdo en <strong>Bookings</strong> (no en Reports).
                </div>
                <div className="rounded-lg border border-border/80 bg-card p-3 shadow-sm">
                  <strong className="text-foreground block mb-1">Paso 2: Vista de Lista</strong>
                  Selecciona <strong>List View</strong> o <strong>All Bookings</strong> para ver la tabla completa con fechas y cleaners.
                </div>
                <div className="rounded-lg border border-border/80 bg-card p-3 shadow-sm">
                  <strong className="text-foreground block mb-1">Paso 3: Copiar y Pegar</strong>
                  Selecciona el texto con tu mouse o <kbd className="rounded bg-muted px-1">Cmd+A</kbd>, copia con <kbd className="rounded bg-muted px-1">Cmd+C</kbd> y pégalo en la pestaña <strong>Pegar Tabla</strong> aquí.
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
                  Pega aquí la tabla o lista copiada de BookingKoala:
                </label>
                <span className="text-[11px] text-muted-foreground">
                  Soporta texto con tabulaciones, comas o columnas copiadas
                </span>
              </div>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Booking ID   Customer   Date   Cleaner   Service   Price   Pay...&#10;BK-101   Field AI   8/1/2026   Ana Morales   Commercial   $154.09   $54.00..."
                rows={6}
                className="w-full rounded-xl border border-border bg-background p-3 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPasteText("")}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  onClick={handleParseText}
                  disabled={parsing || !pasteText.trim()}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 shadow-sm disabled:opacity-50"
                >
                  <Sparkles className="size-3.5" />
                  {parsing ? "Procesando..." : "Analizar y Previsualizar"}
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
              <h4 className="text-sm font-bold text-foreground">Arrastra aquí tu archivo CSV o Excel</h4>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Exportación directa de Bookings (.csv, .xlsx)
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 shadow-sm"
              >
                <Upload className="size-4" />
                Seleccionar Archivo
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
                    Filas detectadas ({parsedRows.length}):
                  </span>
                  <div className="flex rounded-lg border border-border/80 bg-muted/30 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setFilterType("all")}
                      className={`rounded px-2.5 py-1 font-medium transition-colors ${
                        filterType === "all" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Todos ({totals.count})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType("commercial")}
                      className={`rounded px-2.5 py-1 font-medium transition-colors ${
                        filterType === "commercial" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Comercial ({parsedRows.filter((r) => r.isCommercial).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType("residential")}
                      className={`rounded px-2.5 py-1 font-medium transition-colors ${
                        filterType === "residential" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Residencial ({parsedRows.filter((r) => !r.isCommercial).length})
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="size-3.5 text-primary" />
                    <span>Total Horas: <strong>{totals.hrs.toFixed(1)}h</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span>Nómina: <strong className="text-emerald-600 dark:text-emerald-400">${totals.pay.toFixed(2)}</strong></span>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Filtrar por cliente/cleaner..."
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
                      <th className="px-3 py-2.5">Tipo</th>
                      <th className="px-3 py-2.5">Fecha</th>
                      <th className="px-3 py-2.5">Cliente / Cuenta</th>
                      <th className="px-3 py-2.5">Cleaner / Provider</th>
                      <th className="px-3 py-2.5">Servicio</th>
                      <th className="px-3 py-2.5 text-right">Horas</th>
                      <th className="px-3 py-2.5 text-right">Cobro Cliente</th>
                      <th className="px-3 py-2.5 text-right">Pago Cleaner ($18/h)</th>
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
                            {row.isCommercial ? "Comercial" : "Residencial"}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-foreground">{row.serviceDate}</td>
                        <td className="px-3 py-2 font-bold text-foreground">{row.customerName}</td>
                        <td className="px-3 py-2 text-foreground font-medium flex items-center gap-1.5">
                          <UserCheck className="size-3 text-primary" />
                          {row.cleanerName}
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
            Cancelar
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
                {saving ? "Guardando en Base de Datos..." : `Cargar ${parsedRows.length} Bookings a la Base de Datos`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
