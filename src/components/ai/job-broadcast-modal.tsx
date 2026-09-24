"use client";

import { useState } from "react";
import {
  X,
  Send,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Home,
  Users,
  Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CLEANER_CONTACTS } from "@/lib/cleaner-contacts";

// ─── Types ──────────────────────────────────────────────────────────────────

type ServiceType = "Express" | "Deep Clean" | "Move In/Out";

type SendResult = {
  name: string;
  phone: string;
  success: boolean;
  error?: string;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const SERVICE_TYPES: ServiceType[] = ["Express", "Deep Clean", "Move In/Out"];

// Cleaners residenciales activas (filtramos del directorio)
const RESIDENTIAL_CLEANERS = CLEANER_CONTACTS.filter((c) => c.status === "Active");

function inputCls(extra = "") {
  return (
    "w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground " +
    "focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/60 transition-colors " +
    extra
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function JobBroadcastModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  // Form fields
  const [serviceType, setServiceType] = useState<ServiceType | "">("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [pay, setPay] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [city, setCity] = useState("");
  const [details, setDetails] = useState("");

  // Recipients selection
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // Send state
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const [smsPreview, setSmsPreview] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // ── Derived ──────────────────────────────────────────────────────────────

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const allSelected = RESIDENTIAL_CLEANERS.length > 0 && selectedCount === RESIDENTIAL_CLEANERS.length;

  const isFormValid =
    serviceType !== "" &&
    bedrooms.trim() !== "" &&
    bathrooms.trim() !== "" &&
    pay.trim() !== "" &&
    serviceDate.trim() !== "" &&
    city.trim() !== "" &&
    selectedCount > 0;

  // ── Handlers ─────────────────────────────────────────────────────────────

  function toggleAll() {
    if (allSelected) {
      setSelected({});
    } else {
      const all: Record<string, boolean> = {};
      RESIDENTIAL_CLEANERS.forEach((c) => (all[c.phone] = true));
      setSelected(all);
    }
  }

  function toggleCleaner(phone: string) {
    setSelected((prev) => ({ ...prev, [phone]: !prev[phone] }));
  }

  function handleReset() {
    setServiceType("");
    setBedrooms("");
    setBathrooms("");
    setPay("");
    setServiceDate("");
    setCity("");
    setDetails("");
    setSelected({});
    setResults(null);
    setSmsPreview(null);
    setErrorMsg(null);
  }

  async function handleSend() {
    if (!isFormValid) return;
    setSending(true);
    setErrorMsg(null);
    setResults(null);
    setSmsPreview(null);

    const recipients = RESIDENTIAL_CLEANERS.filter((c) => selected[c.phone]).map((c) => ({
      name: c.name,
      phone: c.phone,
    }));

    try {
      const res = await fetch("/api/sms/broadcast-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType,
          bedrooms: Number(bedrooms),
          bathrooms: Number(bathrooms),
          pay: pay.startsWith("$") ? pay : `$${pay}`,
          serviceDate,
          city,
          details: details.trim() || undefined,
          recipients,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data?.error || "Error al enviar la difusión.");
      } else {
        setResults(data.results ?? []);
        setSmsPreview(data.smsBody ?? null);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Error de red al enviar.");
    } finally {
      setSending(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const sentCount = results ? results.filter((r) => r.success).length : 0;
  const failCount = results ? results.filter((r) => !r.success).length : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[92dvh] overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card shadow-2xl">
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/10">
              <Megaphone className="size-4 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Difusión de Trabajo Residencial</h2>
              <p className="text-[11px] text-muted-foreground">
                Envía por OpenPhone · <span className="font-mono font-semibold">(657) 220-6077</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Results panel */}
          {results && (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="size-4 text-emerald-500" />
                <span className="text-sm font-semibold text-foreground">
                  Difusión completada: {sentCount} enviados{failCount > 0 ? `, ${failCount} fallidos` : ""}
                </span>
              </div>
              <div className="space-y-1.5">
                {results.map((r) => (
                  <div key={r.phone} className="flex items-center gap-2 text-xs">
                    {r.success ? (
                      <CheckCircle className="size-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertTriangle className="size-3.5 text-destructive shrink-0" />
                    )}
                    <span className={r.success ? "text-foreground" : "text-destructive"}>
                      {r.name} · {r.phone}
                    </span>
                    {!r.success && r.error && (
                      <span className="text-muted-foreground">— {r.error}</span>
                    )}
                  </div>
                ))}
              </div>
              {smsPreview && (
                <details className="mt-2">
                  <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">
                    Ver mensaje enviado
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-background border border-border/60 p-3 text-[11px] font-mono text-foreground">
                    {smsPreview}
                  </pre>
                </details>
              )}
              <Button
                size="sm"
                variant="outline"
                className="mt-1"
                onClick={handleReset}
              >
                Nueva difusión
              </Button>
            </div>
          )}

          {!results && (
            <>
              {/* ── Section 1: Job Details ── */}
              <section className="space-y-3">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Home className="size-3.5" />
                  Detalles del Trabajo
                </h3>

                {/* Service Type */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Tipo de Limpieza <span className="text-destructive">*</span>
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {SERVICE_TYPES.map((type) => (
                      <button
                        key={type}
                        onClick={() => setServiceType(type)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                          serviceType === type
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                            : "bg-background text-muted-foreground border-border/70 hover:border-emerald-500/50 hover:text-foreground"
                        }`}
                      >
                        {type === "Express" ? "⚡ Express" : type === "Deep Clean" ? "🧹 Deep Clean" : "📦 Mudanza (Move In/Out)"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Beds & Baths row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      🛏 Habitaciones <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      placeholder="ej. 3"
                      value={bedrooms}
                      onChange={(e) => setBedrooms(e.target.value)}
                      className={inputCls()}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      🚿 Baños <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      placeholder="ej. 2"
                      value={bathrooms}
                      onChange={(e) => setBathrooms(e.target.value)}
                      className={inputCls()}
                    />
                  </div>
                </div>

                {/* Pay & City row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      💵 Pago al Cleaner <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <input
                        type="text"
                        placeholder="190.00"
                        value={pay}
                        onChange={(e) => setPay(e.target.value)}
                        className={inputCls("pl-7")}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      📍 Ciudad <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="ej. Newport Beach"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className={inputCls()}
                    />
                  </div>
                </div>

                {/* Service Date */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    📅 Fecha del Servicio <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Thursday 09/25/2026 10:00 AM"
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.target.value)}
                    className={inputCls()}
                  />
                </div>

                {/* Details (optional) */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    📝 Detalles{" "}
                    <span className="text-muted-foreground font-normal">(opcional)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="ej. Traer aspiradora, perro en casa, pedir código al llegar…"
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    className={inputCls("resize-none")}
                  />
                </div>
              </section>

              {/* ── Section 2: Cleaners Selection ── */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Users className="size-3.5" />
                    Limpiadoras a Notificar
                  </h3>
                  <button
                    onClick={toggleAll}
                    className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                  >
                    {allSelected ? "Deseleccionar todas" : "Seleccionar todas"}
                  </button>
                </div>

                <div className="rounded-xl border border-border/60 divide-y divide-border/40 overflow-hidden">
                  {RESIDENTIAL_CLEANERS.map((cleaner) => {
                    const checked = !!selected[cleaner.phone];
                    return (
                      <label
                        key={cleaner.phone}
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors select-none ${
                          checked ? "bg-emerald-500/8" : "bg-card hover:bg-muted/40"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCleaner(cleaner.phone)}
                          className="accent-emerald-600 size-4 rounded shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{cleaner.name}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">{cleaner.phone}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground bg-muted/60 rounded-full px-2 py-0.5 shrink-0">
                          {cleaner.type === "Staff/Support" ? "Staff" : "Residencial"}
                        </span>
                      </label>
                    );
                  })}
                </div>

                {selectedCount > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {selectedCount} limpiadora{selectedCount !== 1 ? "s" : ""} seleccionada{selectedCount !== 1 ? "s" : ""}
                  </p>
                )}
              </section>

              {/* Error */}
              {errorMsg && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  {errorMsg}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        {!results && (
          <div className="border-t border-border/60 bg-muted/30 px-5 py-3 flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">
              {selectedCount > 0 && isFormValid
                ? `Listo para enviar a ${selectedCount} limpiadora${selectedCount !== 1 ? "s" : ""}`
                : "Completa los campos y selecciona limpiadoras"}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onClose} disabled={sending}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSend}
                disabled={!isFormValid || sending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                {sending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Enviando…
                  </>
                ) : (
                  <>
                    <Send className="size-3.5" />
                    Enviar Cadena ({selectedCount})
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
