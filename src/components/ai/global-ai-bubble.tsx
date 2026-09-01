"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import {
  Sparkles,
  X,
  Upload,
  Send,
  Loader2,
  CheckCircle,
  Key,
  Info,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Clock,
  Users,
  DollarSign,
  Mic,
  MicOff,
  MessageSquare,
  Copy,
  Check,
  Building2,
  Calendar,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { SopCopilotResponse } from "@/lib/ai/gemini-client";
import {
  applyOccurrenceOverrideAction,
  applyAddStaffAction,
  applyCreateCommercialAccountAction,
  applyIngestScheduleAction,
  type SopActionResult,
} from "@/lib/ai/sop-actions-handler";

const QUICK_PROMPTS = [
  {
    label: "🔄 Turno / Reemplazo",
    text: "Field AI el 22 de agosto se realizó con el equipo de Susana y Verónica con 2.5 hrs.",
  },
  {
    label: "👤 Añadir Cleaner",
    text: "Añade a Susana como limpiadora comercial a $20/hr y teléfono 949-555-0123.",
  },
  {
    label: "📲 Despacho SMS / Quo",
    text: "Genera el mensaje de despacho para Susana para la limpieza de Field AI hoy.",
  },
  {
    label: "💡 Cotizar Oficina",
    text: "Cotiza una oficina de 4,000 sq ft en Newport Beach, 3 veces por semana, con 4 baños.",
  },
  {
    label: "📊 Auditar Cleaner",
    text: "Dame el resumen de desempeño y horas de Ana Morales este mes.",
  },
  {
    label: "📅 Ingresar Schedule",
    /** Special marker: clicking this will open the file picker automatically */
    text: "__OPEN_FILE_PICKER__",
  },
];

export function GlobalAiBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [response, setResponse] = useState<SopCopilotResponse | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const [savedActions, setSavedActions] = useState<Record<string, boolean>>({});
  const [isCopied, setIsCopied] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [smsSentSuccess, setSmsSentSuccess] = useState<string | null>(null);

  // Speech Recognition state
  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState<"es-US" | "en-US">("es-US");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem("pristine_gemini_api_key");
    if (stored) setApiKey(stored);
  }, []);

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem("pristine_gemini_api_key", key);
    setShowApiKeyInput(false);
  };

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

  const toggleListening = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Tu navegador no soporta reconocimiento de voz nativo. Por favor usa Chrome, Edge o Safari.");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = speechLang;

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
        if (event.error === "not-allowed") {
          setError("Permiso de micrófono denegado en el navegador.");
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setError("No se pudo iniciar el micrófono: " + (err.message || String(err)));
      setIsListening(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() && images.length === 0) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    // Guard: max 5 images at a time
    if (images.length > 5) {
      setError(`Tienes ${images.length} imágenes. El límite es 5 por solicitud. Elimina algunas y vuelve a intentarlo.`);
      return;
    }

    setLoading(true);
    setError(null);
    setActionSuccessMsg(null);
    setSavedActions({});

    try {
      const storedKey = typeof window !== "undefined" ? localStorage.getItem("pristine_gemini_api_key") : "";
      const effectiveKey = apiKey || storedKey || undefined;

      const res = await fetch("/api/ai/sop-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          images,
          apiKey: effectiveKey,
        }),
      });

      // Safely parse JSON — handle non-JSON (e.g. HTML 413 error pages)
      let data: any;
      try {
        data = await res.json();
      } catch {
        if (res.status === 413) {
          throw new Error("La solicitud es demasiado grande. Intenta con menos imágenes (máximo 5).");
        }
        throw new Error(`Error del servidor (${res.status}). Intenta con menos imágenes.`);
      }

      if (!res.ok) {
        throw new Error(data.error || "Ocurrió un error al procesar la instrucción.");
      }

      let parsedData = data.data;
      if (parsedData?.summary && typeof parsedData.summary === "string" && parsedData.summary.trim().startsWith("{")) {
        try {
          const innerMatch = parsedData.summary.match(/\{[\s\S]*\}/);
          if (innerMatch) {
            const innerParsed = JSON.parse(innerMatch[0]);
            parsedData = { ...parsedData, ...innerParsed };
          }
        } catch {
          // Keep as is
        }
      }

      setResponse(parsedData);
    } catch (err: any) {
      setError(err?.message || "Error al conectar con el Asistente IA.");
    } finally {
      setLoading(false);
    }
  };


  // Actions execution
  const handleApplyOccurrence = async () => {
    if (!response?.occurrenceOverride) return;
    setExecutingAction("occurrence");
    try {
      const res = await applyOccurrenceOverrideAction(response.occurrenceOverride);
      if (res.success) {
        setActionSuccessMsg(res.message);
        setSavedActions((prev) => ({ ...prev, occurrence: true }));
      } else {
        setError(res.message);
      }
    } finally {
      setExecutingAction(null);
    }
  };

  const handleApplyAddStaff = async () => {
    if (!response?.addStaff) return;
    setExecutingAction("staff");
    try {
      const res = await applyAddStaffAction(response.addStaff);
      if (res.success) {
        setActionSuccessMsg(res.message);
        setSavedActions((prev) => ({ ...prev, staff: true }));
      } else {
        setError(res.message);
      }
    } finally {
      setExecutingAction(null);
    }
  };

  const handleApplyCommercialQuote = async () => {
    if (!response?.commercialQuote) return;
    setExecutingAction("quote");
    try {
      const res = await applyCreateCommercialAccountAction(response.commercialQuote);
      if (res.success) {
        setActionSuccessMsg(res.message);
        setSavedActions((prev) => ({ ...prev, quote: true }));
      } else {
        setError(res.message);
      }
    } finally {
      setExecutingAction(null);
    }
  };

  const handleApplyIngestSchedule = async () => {
    if (!response?.ingestedSchedule) return;
    setExecutingAction("ingest");
    try {
      const res = await applyIngestScheduleAction(response.ingestedSchedule);
      if (res.success) {
        setActionSuccessMsg(res.message);
        setSavedActions((prev) => ({ ...prev, ingest: true }));
      } else {
        setError(res.message);
      }
    } finally {
      setExecutingAction(null);
    }
  };

  const handleCopySmsText = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSendQuoSms = async () => {
    if (!response?.dispatchSmsQuo) return;
    const phone = response.dispatchSmsQuo.cleanerPhone || "949-570-4521";
    const text = response.dispatchSmsQuo.smsBodyText;

    setIsSendingSms(true);
    setSmsSentSuccess(null);
    setError(null);

    try {
      const res = await fetch("/api/sms/send-quo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: phone,
          message: text,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al enviar SMS por Quo.");
      }

      setSmsSentSuccess(data.message || `SMS enviado exitosamente a ${phone} vía Quo.`);
    } catch (err: any) {
      setError(err?.message || "Error al conectar con el servicio de Quo.");
    } finally {
      setIsSendingSms(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Bubble Button (Bottom Right) */}
      {!isOpen && (
        <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2">
          <button
            onClick={() => setIsOpen(true)}
            className="group flex items-center gap-2.5 rounded-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-4 py-3 text-white shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-emerald-500/25 active:scale-95"
            title="Abrir Copiloto IA (SOP & Cuentas)"
          >
            <div className="relative flex size-6 items-center justify-center">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-40" />
              <Sparkles className="size-5 text-white" />
            </div>
            <span className="text-xs font-black tracking-wide pr-1">Copiloto SOP</span>
          </button>
        </div>
      )}

      {/* Expanded Floating Assistant Drawer / Modal */}
      {isOpen && (
        <div
          className={`fixed z-50 transition-all duration-300 ${
            isMinimized
              ? "bottom-5 right-5 w-80 shadow-xl"
              : "bottom-5 right-5 w-[94vw] max-w-xl max-h-[85vh] sm:w-[540px] shadow-2xl"
          } flex flex-col rounded-2xl border border-border/80 bg-card text-foreground overflow-hidden`}
          onPaste={handlePaste}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 bg-muted/50 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Sparkles className="size-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-foreground">Copiloto IA · Pristine Cleaners</h3>
                <p className="text-[10px] text-muted-foreground">Control total de cuentas, turnos y personal</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const next = speechLang === "es-US" ? "en-US" : "es-US";
                  setSpeechLang(next);
                  if (isListening && recognitionRef.current) recognitionRef.current.lang = next;
                }}
                className="h-6 rounded-md border border-border/80 bg-background px-1.5 text-[10px] font-bold text-foreground hover:bg-muted transition-colors"
                title="Cambiar idioma (Español / English)"
              >
                {speechLang === "es-US" ? "🇪🇸 ES" : "🇺🇸 EN"}
              </button>

              <button
                onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                className="size-6 rounded-md text-muted-foreground hover:text-foreground flex items-center justify-center"
                title="Configurar API Key"
              >
                <Key className="size-3.5" />
              </button>

              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="size-6 rounded-md text-muted-foreground hover:text-foreground flex items-center justify-center"
                title={isMinimized ? "Maximizar" : "Minimizar"}
              >
                {isMinimized ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="size-6 rounded-md text-muted-foreground hover:text-destructive flex items-center justify-center"
                title="Cerrar"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          {/* API Key Form */}
          {showApiKeyInput && (
            <div className="border-b border-border/60 bg-amber-500/10 p-3 text-xs space-y-2">
              <span className="font-bold text-[11px] text-amber-900 dark:text-amber-200">
                Clave de Google Gemini (GEMINI_API_KEY)
              </span>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Button size="sm" onClick={() => handleSaveApiKey(apiKey)} className="h-7 text-xs">
                  Guardar
                </Button>
              </div>
            </div>
          )}

          {/* Body Content (if not minimized) */}
          {!isMinimized && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* Quick Action Chips */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Acciones Rápidas
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {QUICK_PROMPTS.map((qp, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        if (qp.text === "__OPEN_FILE_PICKER__") {
                          // Special: set the ingestion prompt and open file picker
                          setPrompt("Analiza esta captura de CleanGuru e ingresa el schedule completo del cliente al sistema, incluyendo notas de acceso.");
                          setTimeout(() => fileInputRef.current?.click(), 50);
                        } else {
                          setPrompt(qp.text);
                        }
                      }}
                      className="whitespace-nowrap rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-primary/10 hover:border-primary/30 transition-colors"
                    >
                      {qp.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Drop zone contextual banner: image loaded but no prompt */}
              {images.length > 0 && !prompt.trim() && (
                <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                  <span className="text-foreground font-medium flex items-center gap-1.5">
                    🖼️ Imagen detectada — ¿Ingresar schedule desde esta captura?
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPrompt(
                        "Analiza esta captura de CleanGuru e ingresa el schedule completo del cliente al sistema, incluyendo notas de acceso."
                      )
                    }
                    className="ml-2 flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
                  >
                    Sí, analizar →
                  </button>
                </div>
              )}

              {/* Main Input Form */}
              <form onSubmit={handleSubmit} className="space-y-2.5">
                <div className="relative rounded-xl border border-border/80 bg-background p-2.5 focus-within:ring-2 focus-within:ring-primary/20">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Escribe o dicta por voz: 'Field AI el 22 de agosto lo hizo Susana con 2.5 hrs' o 'Añade a Susana como cleaner a $20/hr'..."
                    className="w-full min-h-[70px] resize-none bg-transparent text-xs placeholder:text-muted-foreground/60 focus:outline-none"
                  />

                  {/* Uploaded Images */}
                  {images.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5 pt-1.5 border-t border-border/50">
                      {images.map((img, idx) => (
                        <div key={idx} className="group relative size-12 rounded-md overflow-hidden border border-border bg-muted">
                          <img src={img} alt="Preview" className="size-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setImages(images.filter((_, i) => i !== idx))}
                            className="absolute right-0.5 top-0.5 rounded-full bg-black/70 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <X className="size-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions inside box */}
                  <div className="mt-2 flex items-center justify-between pt-1.5 border-t border-border/40">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        multiple
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-7 rounded-md border border-border/80 px-2 text-[11px] font-medium text-foreground hover:bg-muted transition-colors flex items-center gap-1"
                        title="Subir captura de pantalla"
                      >
                        <Upload className="size-3" />
                        Imagen
                      </button>

                      <button
                        type="button"
                        onClick={toggleListening}
                        className={`h-7 rounded-md px-2 text-[11px] font-bold transition-all flex items-center gap-1 ${
                          isListening
                            ? "animate-pulse bg-rose-600 text-white shadow-sm"
                            : "border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                        }`}
                      >
                        {isListening ? (
                          <>
                            <MicOff className="size-3" />
                            Detener
                          </>
                        ) : (
                          <>
                            <Mic className="size-3" />
                            Voz
                          </>
                        )}
                      </button>

                      {isListening && (
                        <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 animate-pulse">
                          Escuchando...
                        </span>
                      )}
                    </div>

                    <Button
                      type="submit"
                      disabled={loading || (!prompt.trim() && images.length === 0)}
                      size="sm"
                      className="h-7 text-xs gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="size-3 animate-spin" />
                          Analizando...
                        </>
                      ) : (
                        <>
                          <Send className="size-3" />
                          Ejecutar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>

              {/* Error Notice */}
              {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                  <div className="font-bold flex items-center gap-1.5 text-[11px]">
                    <AlertTriangle className="size-3.5" /> Error
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed">{error}</p>
                </div>
              )}

              {/* Success Notification */}
              {actionSuccessMsg && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-700 dark:text-emerald-300">
                  <div className="font-bold flex items-center gap-1.5 text-[11px]">
                    <CheckCircle className="size-3.5 text-emerald-600" /> Acción Ejecutada
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed font-medium">{actionSuccessMsg}</p>
                </div>
              )}

              {/* AI Response Preview Cards */}
              {response && (
                <div className="space-y-3 pt-2 border-t border-border/60">
                  {/* Summary Box */}
                  <div className="rounded-xl bg-muted/40 p-3 text-xs text-foreground space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Sparkles className="size-3 text-primary" /> Diagnóstico de la IA
                    </span>
                    <p className="leading-relaxed">{response.summary}</p>
                  </div>

                  {/* Schedule Conflict Warning (Reminder Permisivo) */}
                  {response.scheduleConflictWarning?.hasConflict && (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-amber-900 dark:text-amber-200 space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <AlertTriangle className="size-4 text-amber-600" />
                        Alerta de Conflicto de Horario (Reminder)
                      </div>
                      <p className="text-[11px] leading-relaxed">{response.scheduleConflictWarning.warningMessage}</p>
                      {response.scheduleConflictWarning.suggestedResolution && (
                        <p className="text-[11px] text-muted-foreground italic">
                          Sugerencia: {response.scheduleConflictWarning.suggestedResolution}
                        </p>
                      )}
                    </div>
                  )}

                  {/* ACTION 1: Work Occurrence / Shift Replacement */}
                  {response.occurrenceOverride && (
                    <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground flex items-center gap-1.5">
                          <Clock className="size-3.5 text-primary" /> Reemplazo / Turno Detectado
                        </span>
                        <Badge variant="outline" className="border-primary/30 text-primary text-[10px] font-bold">
                          {response.occurrenceOverride.date}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                        <div className="rounded-lg bg-muted/40 p-2">
                          <span className="text-[9px] uppercase font-bold text-muted-foreground">Cuenta</span>
                          <p className="font-bold text-foreground mt-0.5">{response.occurrenceOverride.accountName}</p>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-2">
                          <span className="text-[9px] uppercase font-bold text-muted-foreground">Equipo Asignado</span>
                          <p className="font-bold text-foreground mt-0.5">{response.occurrenceOverride.cleanerTeam}</p>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-2">
                          <span className="text-[9px] uppercase font-bold text-muted-foreground">Horas</span>
                          <p className="font-black text-foreground mt-0.5">{response.occurrenceOverride.hours}h</p>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={handleApplyOccurrence}
                        disabled={executingAction === "occurrence" || savedActions.occurrence}
                        className={`w-full h-8 text-xs gap-1.5 transition-all ${
                          savedActions.occurrence
                            ? "bg-emerald-700 text-white cursor-default"
                            : "bg-emerald-600 text-white hover:bg-emerald-700"
                        }`}
                      >
                        {executingAction === "occurrence" ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" /> Registrando turno...
                          </>
                        ) : savedActions.occurrence ? (
                          <>
                            <Check className="size-3.5 text-white" /> ¡Turno Registrado en SOP!
                          </>
                        ) : (
                          <>
                            <CheckCircle className="size-3.5" /> Confirmar & Registrar Turno en SOP
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* ACTION 2: Add Staff / Cleaner */}
                  {response.addStaff && (
                    <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground flex items-center gap-1.5">
                          <Users className="size-3.5 text-primary" /> Alta de Personal (Cleaner / Staff)
                        </span>
                        <Badge variant="outline" className="text-[10px] font-bold">
                          ${response.addStaff.hourlyRate || 20}/hr
                        </Badge>
                      </div>

                      <div className="rounded-lg bg-muted/40 p-2.5 space-y-1 text-[11px]">
                        <div>Nombre: <strong className="text-foreground">{response.addStaff.name}</strong></div>
                        <div>Rol: <span className="text-muted-foreground">{response.addStaff.role}</span></div>
                        {response.addStaff.phone && <div>Teléfono: <span className="font-mono text-foreground">{response.addStaff.phone}</span></div>}
                      </div>

                      <Button
                        size="sm"
                        onClick={handleApplyAddStaff}
                        disabled={executingAction === "staff" || savedActions.staff}
                        className={`w-full h-8 text-xs gap-1.5 transition-all ${
                          savedActions.staff
                            ? "bg-emerald-700 text-white cursor-default"
                            : "bg-emerald-600 text-white hover:bg-emerald-700"
                        }`}
                      >
                        {executingAction === "staff" ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" /> Añadiendo personal...
                          </>
                        ) : savedActions.staff ? (
                          <>
                            <Check className="size-3.5 text-white" /> ¡Personal Añadido al Sistema!
                          </>
                        ) : (
                          <>
                            <CheckCircle className="size-3.5" /> Confirmar & Añadir a Staff
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* ACTION 3: Dispatch SMS / Quo Generator */}
                  {response.dispatchSmsQuo && (
                    <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground flex items-center gap-1.5">
                          <MessageSquare className="size-3.5 text-primary" /> Despacho para SMS / Quo
                        </span>
                        {response.dispatchSmsQuo.cleanerPhone && (
                          <Badge variant="secondary" className="font-mono text-[10px]">
                            {response.dispatchSmsQuo.cleanerPhone}
                          </Badge>
                        )}
                      </div>

                      <div className="rounded-lg bg-muted/60 p-3 font-mono text-[11px] leading-relaxed text-foreground whitespace-pre-wrap select-all">
                        {response.dispatchSmsQuo.smsBodyText}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopySmsText(response.dispatchSmsQuo!.smsBodyText)}
                          className="flex-1 h-8 text-xs gap-1.5"
                        >
                          {isCopied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                          {isCopied ? "¡Copiado!" : "Copiar Texto"}
                        </Button>

                        <Button
                          size="sm"
                          onClick={handleSendQuoSms}
                          disabled={isSendingSms}
                          className="flex-1 h-8 text-xs gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700"
                        >
                          {isSendingSms ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" />
                              Enviando Quo...
                            </>
                          ) : (
                            <>
                              <Send className="size-3.5" />
                              🚀 Enviar SMS por Quo
                            </>
                          )}
                        </Button>
                      </div>

                      {smsSentSuccess && (
                        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium flex items-center gap-1.5">
                          <CheckCircle className="size-3.5 text-emerald-600" />
                          {smsSentSuccess}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ACTION 4: Commercial Quote */}
                  {response.commercialQuote && (
                    <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground flex items-center gap-1.5">
                          <Building2 className="size-3.5 text-primary" /> Cotización Comercial Inteligente
                        </span>
                        <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                          {response.commercialQuote.profitMarginPct.toFixed(1)}% Margen
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                        <div className="rounded-lg bg-muted/40 p-2">
                          <span className="text-[9px] uppercase font-bold text-muted-foreground">Precio / Mes</span>
                          <p className="font-black text-foreground mt-0.5">
                            ${response.commercialQuote.suggestedMonthlyPrice}
                          </p>
                        </div>
                        <div className="rounded-lg bg-amber-500/10 p-2">
                          <span className="text-[9px] uppercase font-bold text-amber-700 dark:text-amber-300">Costo Cleaner</span>
                          <p className="font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                            ${response.commercialQuote.estimatedCleanerCost}
                          </p>
                        </div>
                        <div className="rounded-lg bg-emerald-500/10 p-2">
                          <span className="text-[9px] uppercase font-bold text-emerald-700 dark:text-emerald-300">Horas / Visita</span>
                          <p className="font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                            {response.commercialQuote.estimatedHoursPerVisit}h
                          </p>
                        </div>
                      </div>

                      {response.commercialQuote.reasoning && (
                        <p className="text-[11px] text-muted-foreground italic bg-muted/20 p-2 rounded-md">
                          {response.commercialQuote.reasoning}
                        </p>
                      )}

                      <Button
                        size="sm"
                        onClick={handleApplyCommercialQuote}
                        disabled={executingAction === "quote" || savedActions.quote}
                        className={`w-full h-8 text-xs gap-1.5 transition-all ${
                          savedActions.quote
                            ? "bg-emerald-700 text-white cursor-default"
                            : "bg-emerald-600 text-white hover:bg-emerald-700"
                        }`}
                      >
                        {executingAction === "quote" ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" /> Creando cuenta...
                          </>
                        ) : savedActions.quote ? (
                          <>
                            <Check className="size-3.5 text-white" /> ¡Cuenta Comercial Creada!
                          </>
                        ) : (
                          <>
                            <CheckCircle className="size-3.5" /> Crear Cuenta Comercial con esta Cotización
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* ACTION 5: Cleaner Audit */}
                  {response.cleanerAudit && (
                    <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground flex items-center gap-1.5">
                          <ShieldCheck className="size-3.5 text-primary" /> Auditoría de Cleaner: {response.cleanerAudit.cleanerName}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-center text-[11px]">
                        <div className="rounded-lg bg-muted/40 p-2">
                          <span className="text-[9px] uppercase font-bold text-muted-foreground">Horas Acumuladas</span>
                          <p className="font-black text-foreground mt-0.5">{response.cleanerAudit.totalHours || 0} hrs</p>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-2">
                          <span className="text-[9px] uppercase font-bold text-muted-foreground">Pago Estimado</span>
                          <p className="font-black text-foreground mt-0.5">${response.cleanerAudit.estimatedPay || 0}</p>
                        </div>
                      </div>

                      {response.cleanerAudit.accounts && response.cleanerAudit.accounts.length > 0 && (
                        <div className="text-[11px] text-muted-foreground">
                          Cuentas Asignadas: <strong className="text-foreground">{response.cleanerAudit.accounts.join(", ")}</strong>
                        </div>
                      )}

                      {response.cleanerAudit.notes && (
                        <p className="text-[11px] text-muted-foreground italic bg-muted/20 p-2 rounded-md">
                          {response.cleanerAudit.notes}
                        </p>
                      )}
                    </div>
                  )}

                  {/* ACTION 6: Ingest Schedule from CleanGuru Image */}
                  {response.ingestedSchedule && (
                    <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground flex items-center gap-1.5">
                          <Calendar className="size-3.5 text-primary" /> Schedule Detectado en Imagen
                        </span>
                        {response.ingestedSchedule.frequency && (
                          <Badge variant="outline" className="border-primary/30 text-primary text-[10px] font-bold">
                            {response.ingestedSchedule.frequency}
                          </Badge>
                        )}
                      </div>

                      {/* Main fields grid */}
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="rounded-lg bg-muted/40 p-2 col-span-2">
                          <span className="text-[9px] uppercase font-bold text-muted-foreground">Cliente</span>
                          <p className="font-black text-foreground mt-0.5">{response.ingestedSchedule.clientName}</p>
                          {response.ingestedSchedule.buildingName && response.ingestedSchedule.buildingName !== response.ingestedSchedule.clientName && (
                            <p className="text-muted-foreground text-[10px]">{response.ingestedSchedule.buildingName}</p>
                          )}
                        </div>

                        {response.ingestedSchedule.address && (
                          <div className="rounded-lg bg-muted/40 p-2 col-span-2">
                            <span className="text-[9px] uppercase font-bold text-muted-foreground">Dirección</span>
                            <p className="font-medium text-foreground mt-0.5">{response.ingestedSchedule.address}{response.ingestedSchedule.city ? `, ${response.ingestedSchedule.city}` : ""}</p>
                          </div>
                        )}

                        {response.ingestedSchedule.recurringRule && (
                          <div className="rounded-lg bg-muted/40 p-2 col-span-2">
                            <span className="text-[9px] uppercase font-bold text-muted-foreground">Recurrencia</span>
                            <p className="font-medium text-foreground mt-0.5">{response.ingestedSchedule.recurringRule}</p>
                          </div>
                        )}

                        <div className="rounded-lg bg-muted/40 p-2">
                          <span className="text-[9px] uppercase font-bold text-muted-foreground">Horario</span>
                          <p className="font-bold text-foreground mt-0.5">
                            {response.ingestedSchedule.scheduledTime || "—"}{response.ingestedSchedule.endTime ? ` – ${response.ingestedSchedule.endTime}` : ""}
                          </p>
                        </div>

                        <div className="rounded-lg bg-muted/40 p-2">
                          <span className="text-[9px] uppercase font-bold text-muted-foreground">Presupuesto</span>
                          <p className="font-black text-foreground mt-0.5">{response.ingestedSchedule.budgetHours ? `${response.ingestedSchedule.budgetHours} hrs` : "—"}</p>
                        </div>

                        {response.ingestedSchedule.assignedCleaner && (
                          <div className="rounded-lg bg-muted/40 p-2 col-span-2">
                            <span className="text-[9px] uppercase font-bold text-muted-foreground">Cleaner Asignada</span>
                            <p className="font-bold text-foreground mt-0.5">{response.ingestedSchedule.assignedCleaner}</p>
                          </div>
                        )}
                      </div>

                      {/* Access Instructions */}
                      {response.ingestedSchedule.accessInstructions && (
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 p-2.5 space-y-1.5">
                          <span className="text-[9px] uppercase font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                            🔑 Acceso / Instrucciones de Entrada
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {response.ingestedSchedule.accessInstructions.suite && (
                              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">
                                Suite {response.ingestedSchedule.accessInstructions.suite}
                              </span>
                            )}
                            {response.ingestedSchedule.accessInstructions.floor && (
                              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">
                                Piso {response.ingestedSchedule.accessInstructions.floor}
                              </span>
                            )}
                            {response.ingestedSchedule.accessInstructions.elevator && (
                              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">
                                🛗 Elevador
                              </span>
                            )}
                            {response.ingestedSchedule.accessInstructions.parking && (
                              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">
                                🅿️ {response.ingestedSchedule.accessInstructions.parking}
                              </span>
                            )}
                            {response.ingestedSchedule.accessInstructions.buildingType && (
                              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">
                                🏢 {response.ingestedSchedule.accessInstructions.buildingType}
                              </span>
                            )}
                            {response.ingestedSchedule.accessInstructions.accessCode && (
                              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-800 dark:text-amber-200">
                                🔐 {response.ingestedSchedule.accessInstructions.accessCode}
                              </span>
                            )}
                          </div>
                          {response.ingestedSchedule.accessInstructions.elevatorNotes && (
                            <p className="text-[10px] text-amber-700 dark:text-amber-300 italic">
                              {response.ingestedSchedule.accessInstructions.elevatorNotes}
                            </p>
                          )}
                          {response.ingestedSchedule.accessInstructions.otherNotes && (
                            <p className="text-[10px] text-amber-700 dark:text-amber-300 italic">
                              {response.ingestedSchedule.accessInstructions.otherNotes}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Template info */}
                      {response.ingestedSchedule.template && (
                        <p className="text-[10px] text-muted-foreground italic">
                          Plantilla: {response.ingestedSchedule.template}
                        </p>
                      )}

                      <Button
                        size="sm"
                        onClick={handleApplyIngestSchedule}
                        disabled={executingAction === "ingest" || savedActions.ingest}
                        className={`w-full h-8 text-xs gap-1.5 transition-all ${
                          savedActions.ingest
                            ? "bg-emerald-700 text-white cursor-default"
                            : "bg-emerald-600 text-white hover:bg-emerald-700"
                        }`}
                      >
                        {executingAction === "ingest" ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" /> Guardando en SOP...
                          </>
                        ) : savedActions.ingest ? (
                          <>
                            <Check className="size-3.5 text-white" /> ¡Schedule Guardado en SOP con Éxito!
                          </>
                        ) : (
                          <>
                            <CheckCircle className="size-3.5" /> Guardar Schedule en SOP
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
