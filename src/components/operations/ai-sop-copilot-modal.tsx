"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import {
  Sparkles,
  X,
  Upload,
  Image as ImageIcon,
  Send,
  Loader2,
  CheckCircle,
  FileSpreadsheet,
  FileText,
  Key,
  Info,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  Clock,
  Users,
  DollarSign,
  Mic,
  MicOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { exportSalesTrackToXLSX, exportSalesTrackToPDF, type SalesTrackItem } from "@/lib/export/sales-track-export";
import type { SopCopilotResponse } from "@/lib/ai/gemini-client";
import type { ServiceBookingRow } from "@/lib/sales-tracker/types";

interface AiSopCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplySalesTrack?: (items: SalesTrackItem[]) => void;
  onApplyBookings?: (bookings: ServiceBookingRow[]) => void;
  onApplySopModifications?: (modifications: NonNullable<SopCopilotResponse["sopModifications"]>) => void;
}

export function AiSopCopilotModal({
  isOpen,
  onClose,
  onApplySalesTrack,
  onApplyBookings,
  onApplySopModifications,
}: AiSopCopilotModalProps) {
  const [prompt, setPrompt] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [response, setResponse] = useState<SopCopilotResponse | null>(null);
  const [appliedSuccess, setAppliedSuccess] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState<"es-US" | "en-US">("es-US");
  const [speechSupported, setSpeechSupported] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const stored = localStorage.getItem("pristine_gemini_api_key");
    if (stored) setApiKey(stored);

    // Check Speech Recognition support
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setSpeechSupported(false);
      }
    }
  }, []);

  const toggleListening = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Tu navegador no soporta reconocimiento de voz nativo. Por favor usa Google Chrome, Edge o Safari.");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = speechLang; // "es-US" or "en-US"

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            setPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript));
          } else {
            currentTranscript += transcript;
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setError("Permiso de micrófono denegado. Permite el acceso al micrófono en tu navegador.");
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error("Error starting speech recognition:", err);
      setError("No se pudo iniciar el micrófono: " + (err.message || String(err)));
      setIsListening(false);
    }
  };

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem("pristine_gemini_api_key", key);
    setShowApiKeyInput(false);
  };

  // Support paste image anywhere in the modal
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              setImages((prev) => [...prev, event.target!.result as string]);
            }
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImages((prev) => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() && images.length === 0) return;

    setLoading(true);
    setError(null);
    setResponse(null);
    setAppliedSuccess(false);

    try {
      const res = await fetch("/api/ai/sop-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          images,
          customApiKey: apiKey || undefined,
        }),
      });

      let data: any;
      try {
        data = await res.json();
      } catch {
        if (res.status === 413) {
          throw new Error("La solicitud es demasiado grande. Intenta reducir las imágenes o el contenido.");
        }
        if (res.status === 504) {
          throw new Error("El servidor de IA tardó demasiado en responder (Tiempo de espera agotado - 504). Por favor intenta de nuevo.");
        }
        if (res.status === 502 || res.status === 503) {
          throw new Error(`El servicio de IA no está disponible en este momento (${res.status}). Por favor intenta en unos instantes.`);
        }
        throw new Error(`Error del servidor (${res.status}). Por favor intenta nuevamente.`);
      }

      if (!res.ok || !data.success) {
        if (data.needsApiKey) {
          setShowApiKeyInput(true);
        }
        throw new Error(data.error || "Ocurrió un error al procesar con Gemini.");
      }

      setResponse(data.data);
    } catch (err: any) {
      setError(err?.message || "Error al conectar con el Asistente IA.");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!response) return;

    if (response.extractedBookings && response.extractedBookings.length > 0 && onApplyBookings) {
      onApplyBookings(response.extractedBookings);
    }

    if (response.extractedSalesTrack && response.extractedSalesTrack.length > 0 && onApplySalesTrack) {
      onApplySalesTrack(response.extractedSalesTrack);
    }

    if (response.sopModifications && response.sopModifications.length > 0 && onApplySopModifications) {
      onApplySopModifications(response.sopModifications);
    } else if (response.ingestedSchedule && onApplySopModifications) {
      const is = response.ingestedSchedule;
      onApplySopModifications([
        {
          accountName: is.clientName || is.buildingName,
          cleanerName: is.assignedCleaner,
          newHours: is.budgetHours,
          newDays: is.recurringRule ? [is.recurringRule] : undefined,
          notes: is.internalNotes || (is.accessInstructions?.accessCode ? `Code: ${is.accessInstructions.accessCode}` : undefined),
        }
      ]);
    }

    setAppliedSuccess(true);
  };

  const handleExportXLSX = () => {
    if (response?.extractedSalesTrack) {
      exportSalesTrackToXLSX("Sales-Track-Report-AI", response.extractedSalesTrack);
    }
  };

  const handleExportPDF = () => {
    if (response?.extractedSalesTrack) {
      exportSalesTrackToPDF("Sales-Track-Report-AI", response.extractedSalesTrack);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onPaste={handlePaste}
    >
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-border/80 bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 p-1.5">
              <img src="/pristiner-logo.png" alt="Pristiner" className="size-7 object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">Pristiner (Copiloto IA)</h3>
                <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary text-[10px]">
                  Multimodal AI
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Ajusta horas, equipos, procesa schedules desde capturas de pantalla y crea el Sales Track Report.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowApiKeyInput(!showApiKeyInput)}
            >
              <Key className="mr-1.5 size-3.5" />
              {apiKey ? "API Key Configurada" : "Configurar API Key"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full text-muted-foreground hover:text-foreground"
              onClick={onClose}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* API Key Banner / Form */}
        {showApiKeyInput && (
          <div className="border-b border-border/60 bg-amber-500/10 p-4 text-xs">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-amber-900 dark:text-amber-200">
                  Clave de Google Gemini (GEMINI_API_KEY)
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Se guarda de forma segura en tu navegador local.
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Button size="sm" onClick={() => handleSaveApiKey(apiKey)} className="h-8 text-xs">
                  Guardar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Main Input Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative rounded-xl border border-border/80 bg-background p-3 focus-within:ring-2 focus-within:ring-primary/20">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ejemplo: 'Ajusta el schedule de Field AI a 3 horas los lunes y asigna a Ana Morales' o 'Extrae el schedule de esta captura y calcula margen de ganancia'..."
                className="w-full min-h-[90px] resize-none bg-transparent text-sm placeholder:text-muted-foreground/60 focus:outline-none"
              />

              {/* Uploaded Images Preview */}
              {images.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 pt-2 border-t border-border/50">
                  {images.map((img, idx) => (
                    <div key={idx} className="group relative size-16 rounded-lg overflow-hidden border border-border bg-muted">
                      <img src={img} alt="Preview" className="size-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute right-1 top-1 rounded-full bg-black/70 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Bar inside textarea container */}
              <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/40">
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    multiple
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="size-3.5" />
                    Subir Captura / Imagen
                  </Button>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant={isListening ? "default" : "outline"}
                      size="sm"
                      className={`h-8 text-xs gap-1.5 transition-all ${
                        isListening
                          ? "animate-pulse border-rose-500 bg-rose-600 text-white hover:bg-rose-700 shadow-md shadow-rose-500/20"
                          : "border-primary/30 text-primary hover:bg-primary/5"
                      }`}
                      onClick={toggleListening}
                    >
                      {isListening ? (
                        <>
                          <MicOff className="size-3.5" />
                          Detener Micrófono
                        </>
                      ) : (
                        <>
                          <Mic className="size-3.5 text-primary" />
                          Dictar por Voz
                        </>
                      )}
                    </Button>

                    <button
                      type="button"
                      onClick={() => {
                        const next = speechLang === "es-US" ? "en-US" : "es-US";
                        setSpeechLang(next);
                        if (isListening && recognitionRef.current) {
                          recognitionRef.current.lang = next;
                        }
                      }}
                      className="h-8 rounded-lg border border-border/80 bg-muted/50 px-2 text-[11px] font-bold text-foreground hover:bg-muted transition-colors flex items-center gap-1"
                      title="Cambiar idioma de dictado (Español / English)"
                    >
                      {speechLang === "es-US" ? "🇪🇸 ES" : "🇺🇸 EN"}
                    </button>
                  </div>

                  {isListening ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-600 dark:text-rose-400 animate-pulse">
                      <span className="size-2 rounded-full bg-rose-600" />
                      {speechLang === "es-US" ? "Escuchando en español... habla ahora" : "Listening in English... speak now"}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground hidden sm:inline">
                      (o pega con <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">Ctrl+V</kbd>)
                    </span>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={loading || (!prompt.trim() && images.length === 0)}
                  size="sm"
                  className="h-8 gap-1.5"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Analizando con Gemini...
                    </>
                  ) : (
                    <>
                      <Send className="size-3.5" />
                      Analizar & Procesar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>

          {/* Error notice */}
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">No se pudo completar la operación</p>
                <p className="mt-0.5 text-destructive/80">{error}</p>
              </div>
            </div>
          )}

          {/* AI Output Section */}
          {response && (
            <div className="space-y-4 animate-in fade-in-50 duration-300">
              {/* Summary Card */}
              <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider mb-2">
                  <Sparkles className="size-3.5" />
                  Diagnóstico y Análisis de Gemini
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {response.summary}
                </p>
                {response.appliedExplanation && (
                  <p className="mt-2 text-xs text-muted-foreground italic border-t border-border/50 pt-2">
                    {response.appliedExplanation}
                  </p>
                )}
              </div>

              {/* SOP Modifications Preview */}
              {response.sopModifications && response.sopModifications.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Clock className="size-3.5" /> Modificaciones Operativas / SOP Detectadas
                  </h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {response.sopModifications.map((mod, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-border/80 bg-card p-3 shadow-sm text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between font-bold text-foreground">
                          <span>{mod.accountName || "Cuenta Comercial"}</span>
                          {mod.newHours && (
                            <Badge variant="secondary" className="text-[10px]">
                              {mod.newHours} hrs/visita
                            </Badge>
                          )}
                        </div>
                        {mod.cleanerName && (
                          <div className="text-muted-foreground flex items-center gap-1">
                            <Users className="size-3" /> Cleaner: <strong className="text-foreground">{mod.cleanerName}</strong>
                          </div>
                        )}
                        {mod.newDays && mod.newDays.length > 0 && (
                          <div className="text-muted-foreground">
                            Días: <span className="text-foreground">{mod.newDays.join(", ")}</span>
                          </div>
                        )}
                        {mod.newPricing && (
                          <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            Precio: ${mod.newPricing.toFixed(2)}
                          </div>
                        )}
                        {mod.notes && <div className="text-[11px] text-muted-foreground italic">{mod.notes}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extracted Bookings (BookingKoala / Residential / Master Ledger) */}
              {response.extractedBookings && response.extractedBookings.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <FileText className="size-3.5 text-primary" /> Servicios / Citas Extraídas ({response.extractedBookings.length})
                    </h4>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-1">
                    {response.extractedBookings.map((b, i) => (
                      <div key={i} className="rounded-xl border border-border/80 bg-card p-4 shadow-sm text-xs space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-foreground">{b.clientName}</span>
                            <Badge variant="outline" className="border-primary/30 text-primary font-bold">
                              {b.service}
                            </Badge>
                            <span className="text-muted-foreground">· {b.city}</span>
                          </div>
                          <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                            <span>📅 {b.date}</span>
                            <span>⏱️ {b.actualHours}h</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
                          <div className="rounded-lg bg-muted/40 p-2">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground">Cleaner</span>
                            <p className="font-bold text-foreground mt-0.5">{b.cleanerTeam}</p>
                          </div>
                          <div className="rounded-lg bg-muted/40 p-2">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground">Cobro Subtotal</span>
                            <p className="font-black text-foreground mt-0.5">${b.subTotal.toFixed(2)}</p>
                          </div>
                          <div className="rounded-lg bg-amber-500/10 p-2">
                            <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300">Pago Cleaner</span>
                            <p className="font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                              ${b.teamEarningsWithoutTips.toFixed(2)} ({((b.teamEarningsWithoutTips / (b.subTotal || 1)) * 100).toFixed(0)}%)
                            </p>
                          </div>
                          <div className="rounded-lg bg-rose-500/10 p-2">
                            <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-300">Fee CC (3%)</span>
                            <p className="font-bold text-rose-700 dark:text-rose-300 mt-0.5">
                              ${b.merchantFee.toFixed(2)}
                            </p>
                          </div>
                          <div className="rounded-lg bg-emerald-500/10 p-2">
                            <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300">Ganancia Pristine</span>
                            <p className="font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                              ${b.pcEarnings.toFixed(2)} ({((b.pcEarnings / (b.subTotal || 1)) * 100).toFixed(0)}%)
                            </p>
                          </div>
                        </div>

                        {b.notes && (
                          <div className="text-[11px] text-muted-foreground italic bg-muted/20 rounded-md p-2">
                            {b.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extracted Sales Track Items */}
              {response.extractedSalesTrack && response.extractedSalesTrack.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <TrendingUp className="size-3.5" /> Items para Sales Track Report ({response.extractedSalesTrack.length})
                    </h4>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleExportXLSX}
                        className="h-7 text-xs gap-1 border-emerald-600/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                      >
                        <FileSpreadsheet className="size-3" />
                        Excel (.xlsx)
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleExportPDF}
                        className="h-7 text-xs gap-1 border-rose-600/30 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      >
                        <FileText className="size-3" />
                        PDF
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/80 overflow-hidden bg-card shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-border bg-muted/60 text-muted-foreground font-semibold">
                          <tr>
                            <th className="px-3 py-2">Cliente</th>
                            <th className="px-3 py-2">Ciudad</th>
                            <th className="px-3 py-2">Frecuencia / Días</th>
                            <th className="px-3 py-2">Cleaner</th>
                            <th className="px-3 py-2 text-right">Ingreso</th>
                            <th className="px-3 py-2 text-right">Costo</th>
                            <th className="px-3 py-2 text-right">Margen</th>
                            <th className="px-3 py-2 text-center">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {response.extractedSalesTrack.map((item, i) => {
                            const rev = Number(item.monthlyRevenue) || 0;
                            const cost = Number(item.cleanerCost) || 0;
                            const profit = item.grossProfit !== undefined ? item.grossProfit : rev - cost;
                            const margin = item.marginPct !== undefined ? item.marginPct : (rev > 0 ? Math.round((profit / rev) * 100) : 0);
                            const days = Array.isArray(item.serviceDays) ? item.serviceDays.join(", ") : item.serviceDays;

                            return (
                              <tr key={i} className="hover:bg-muted/30 transition-colors">
                                <td className="px-3 py-2.5 font-bold text-foreground">{item.clientName}</td>
                                <td className="px-3 py-2.5 text-muted-foreground">{item.city || "—"}</td>
                                <td className="px-3 py-2.5">
                                  <div className="font-medium text-foreground">{item.serviceFrequency || "Weekly"}</div>
                                  <div className="text-[10px] text-muted-foreground">{days || "Por definir"}</div>
                                </td>
                                <td className="px-3 py-2.5 text-foreground">{item.cleanerTeam || "Unassigned"}</td>
                                <td className="px-3 py-2.5 text-right font-bold text-foreground">${rev.toFixed(2)}</td>
                                <td className="px-3 py-2.5 text-right text-muted-foreground">${cost.toFixed(2)}</td>
                                <td className="px-3 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                  {margin}%
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <Badge variant="outline" className="text-[10px] uppercase font-bold py-0.5">
                                    {item.status || "ACTIVE"}
                                  </Badge>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Confirm / Apply Action Button */}
              <div className="flex items-center justify-between pt-3 border-t border-border/60">
                <div className="text-xs text-muted-foreground">
                  {appliedSuccess ? (
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <CheckCircle className="size-4" /> Cambios aplicados con éxito al sistema.
                    </span>
                  ) : (
                    "Revisa los datos antes de confirmar y aplicarlos a tu sistema."
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
                    Cerrar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleApply}
                    disabled={appliedSuccess}
                    className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <CheckCircle className="size-3.5" />
                    Confirmar & Aplicar al Sistema
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
