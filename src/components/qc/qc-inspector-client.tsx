"use client";

/**
 * QCInspectorClient — mobile-first inspector field view.
 *
 * Three screens / states:
 *   1. "home"   — Daily route: list of today's scheduled inspections.
 *   2. "active" — Active inspection: multi-step checklist stepper.
 *   3. "sign"   — Score & sign: score summary, signature pad, submit.
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useTransition,
} from "react";
import {
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Mic,
  Camera,
  X,
  RefreshCw,
  Navigation,
  ClipboardList,
  Star,
  Send,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// ─── Types ────────────────────────────────────────────────────────────────────

type InspectionStatus = "pending" | "in_progress" | "submitted" | "completed";

interface ScheduledAccount {
  id: string;
  account_id: string;
  account_name: string;
  address?: string;
  city?: string;
  scheduled_time?: string;
  status: InspectionStatus;
  inspection_id?: string;
}

type ItemRating = "pass" | "attention" | "fail" | "na" | null;

interface ChecklistItem {
  id: string;
  label: string;
  rating: ItemRating;
  note: string;
  voice_note: string;
  photo_url?: string;
}

interface InspectionArea {
  id: string;
  name: string;
  items: ChecklistItem[];
}

interface ActiveInspection {
  inspection_id: string;
  account_id: string;
  account_name: string;
  areas: InspectionArea[];
}

type Screen = "home" | "active" | "sign";
type GpsStatus = "idle" | "getting" | "active" | "error";

// ─── Default checklist template ───────────────────────────────────────────────

function buildDefaultAreas(): InspectionArea[] {
  const template: Array<{ name: string; items: string[] }> = [
    {
      name: "Entrance & Lobby",
      items: [
        "Floors swept & mopped",
        "Mats clean & positioned",
        "Glass doors streak-free",
        "Light switches & outlets wiped",
        "Trash emptied & liner replaced",
      ],
    },
    {
      name: "Restrooms",
      items: [
        "Toilets & urinals sanitized",
        "Sinks & counters cleaned",
        "Mirrors streak-free",
        "Floors mopped & dry",
        "Supplies restocked (soap, paper)",
        "Trash emptied",
        "Odor-free",
      ],
    },
    {
      name: "Office / Work Areas",
      items: [
        "Desks & surfaces dusted",
        "Floors vacuumed or swept",
        "Trash emptied & liners replaced",
        "Common areas tidied",
        "Electronics dusted (exteriors)",
      ],
    },
    {
      name: "Break Room / Kitchen",
      items: [
        "Counters & surfaces sanitized",
        "Sink cleaned",
        "Microwave cleaned inside & out",
        "Floors swept & mopped",
        "Trash emptied",
        "Appliance exteriors wiped",
      ],
    },
    {
      name: "General / Wrap-up",
      items: [
        "All lights off in unoccupied rooms",
        "Supplies restocked in cart",
        "No equipment left behind",
        "Client sign-off obtained",
      ],
    },
  ];

  return template.map((area, ai) => ({
    id: `area-${ai}`,
    name: area.name,
    items: area.items.map((label, ii) => ({
      id: `area-${ai}-item-${ii}`,
      label,
      rating: null,
      note: "",
      voice_note: "",
      photo_url: undefined,
    })),
  }));
}

// ─── Score helpers ─────────────────────────────────────────────────────────────

function calcScore(areas: InspectionArea[]): number {
  const all = areas.flatMap((a) => a.items).filter((i) => i.rating !== "na" && i.rating !== null);
  if (all.length === 0) return 0;
  const total = all.reduce((acc, item) => {
    if (item.rating === "pass") return acc + 100;
    if (item.rating === "attention") return acc + 70;
    if (item.rating === "fail") return acc + 0;
    return acc;
  }, 0);
  return Math.round(total / all.length);
}

function calcGrade(score: number): "A" | "B" | "C" {
  if (score >= 95) return "A";
  if (score >= 85) return "B";
  return "C";
}

// ─── GPS Status Pill ──────────────────────────────────────────────────────────

function GpsPill({ status }: { status: GpsStatus }) {
  const label =
    status === "active"
      ? "GPS Active"
      : status === "getting"
        ? "Getting location\u2026"
        : status === "error"
          ? "GPS unavailable"
          : "GPS off";
  const dotClass =
    status === "active"
      ? "bg-emerald-500"
      : status === "getting"
        ? "bg-amber-400 animate-pulse"
        : "bg-slate-400";

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/80 px-3 py-1 text-xs font-semibold text-muted-foreground backdrop-blur">
      <span className={cn("size-2 rounded-full", dotClass)} />
      {label}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: InspectionStatus }) {
  const map: Record<InspectionStatus, { label: string; className: string }> = {
    pending: {
      label: "Pending",
      className:
        "border-amber-200 bg-amber-50 text-amber-700",
    },
    in_progress: {
      label: "In Progress",
      className:
        "border-blue-200 bg-blue-50 text-blue-700",
    },
    submitted: {
      label: "Submitted",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    completed: {
      label: "Completed",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
  };
  const { label, className } = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        className,
      )}
    >
      {label}
    </span>
  );
}

// ─── Rating Button ────────────────────────────────────────────────────────────

function RatingButton({
  type,
  selected,
  onSelect,
}: {
  type: "pass" | "attention" | "fail";
  selected: boolean;
  onSelect: () => void;
}) {
  const config = {
    pass: {
      label: "Pass",
      icon: <CheckCircle2 className="size-4" />,
      base: "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
      active:
        "border-emerald-500 bg-emerald-500 text-white shadow-[0_4px_14px_-4px_rgba(16,185,129,0.55)]",
    },
    attention: {
      label: "Attn",
      icon: <AlertCircle className="size-4" />,
      base: "border-amber-200 text-amber-700 hover:bg-amber-50",
      active:
        "border-amber-400 bg-amber-400 text-white shadow-[0_4px_14px_-4px_rgba(245,158,11,0.55)]",
    },
    fail: {
      label: "Fail",
      icon: <XCircle className="size-4" />,
      base: "border-red-200 text-red-600 hover:bg-red-50",
      active:
        "border-red-500 bg-red-500 text-white shadow-[0_4px_14px_-4px_rgba(239,68,68,0.55)]",
    },
  };
  const c = config[type];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-xl border text-sm font-semibold transition-all duration-150",
        selected ? c.active : cn("bg-card", c.base),
      )}
    >
      {c.icon}
      <span className="text-xs sm:text-sm">{c.label}</span>
    </button>
  );
}

// ─── Score Circle ─────────────────────────────────────────────────────────────

function ScoreCircle({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const grade = calcGrade(score);
  const gradeColor =
    grade === "A"
      ? "text-emerald-600"
      : grade === "B"
        ? "text-amber-500"
        : "text-red-500";

  return (
    <div className="relative flex items-center justify-center">
      <svg width="140" height="140" className="-rotate-90">
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="10"
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold tabular-nums text-foreground">
          {score}%
        </span>
        <span className={cn("text-2xl font-extrabold", gradeColor)}>
          {grade}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Pristine Index
        </span>
      </div>
    </div>
  );
}

// ─── Signature Pad ────────────────────────────────────────────────────────────

function SignaturePad({
  onSign,
}: {
  onSign: (dataUrl: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasSig = useRef(false);

  function getPos(
    e: React.MouseEvent | React.TouchEvent,
    canvas: HTMLCanvasElement,
  ) {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    const { x, y } = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e, canvas);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "hsl(var(--foreground))";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    hasSig.current = true;
  }

  function endDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas || !hasSig.current) return;
    onSign(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    hasSig.current = false;
    onSign(null);
  }

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-border bg-card">
        <canvas
          ref={canvasRef}
          width={340}
          height={140}
          className="w-full touch-none"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        <span className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs text-muted-foreground/40">
          Sign above
        </span>
      </div>
      <button
        type="button"
        onClick={clear}
        className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <RefreshCw className="size-3" /> Clear signature
      </button>
    </div>
  );
}

// ─── Voice Overlay ────────────────────────────────────────────────────────────

function VoiceOverlay({
  areaName,
  onClose,
  onTranscript,
}: {
  areaName: string;
  onClose: () => void;
  onTranscript: (text: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const globalWin = typeof window !== "undefined" ? (window as any) : null;
    const SR = globalWin ? (globalWin.SpeechRecognition || globalWin.webkitSpeechRecognition) : null;
    if (!SR) {
      setSupported(false);
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e: any) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      setTranscript(text);
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
  }, []);

  function toggle() {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      setTranscript("");
      rec.start();
      setListening(true);
    }
  }

  function save() {
    recognitionRef.current?.stop();
    if (transcript.trim()) onTranscript(transcript.trim());
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-lg">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
            Voice Note
          </p>
          <p className="text-sm font-semibold text-foreground">{areaName}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-2 hover:bg-muted"
        >
          <X className="size-5 text-muted-foreground" />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-10">
        {!supported ? (
          <p className="text-center text-sm text-muted-foreground">
            Voice recognition is not supported in your browser. Try Chrome on
            Android or Safari on iOS.
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={toggle}
              className={cn(
                "flex size-24 items-center justify-center rounded-full border-4 transition-all duration-200",
                listening
                  ? "animate-pulse border-primary bg-primary text-primary-foreground shadow-[0_0_32px_-4px_hsl(var(--primary)/0.6)]"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-primary",
              )}
            >
              <Mic className="size-10" />
            </button>

            <p className="text-sm font-medium text-muted-foreground">
              {listening ? "Listening\u2026 tap to stop" : "Tap mic to start"}
            </p>

            {transcript && (
              <div className="w-full rounded-2xl border border-border bg-muted/40 p-4">
                <p className="text-sm leading-relaxed text-foreground">
                  {transcript}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex gap-3 border-t border-border/60 px-4 py-4">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          onClick={save}
          disabled={!transcript.trim()}
        >
          Save note
        </Button>
      </div>
    </div>
  );
}

// ─── SCREEN 1: Home / Daily Route ─────────────────────────────────────────────

function HomeScreen({
  onStartInspection,
}: {
  onStartInspection: (account: ScheduledAccount) => void;
}) {
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("idle");
  const [schedules, setSchedules] = useState<ScheduledAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [today] = useState(() => {
    const d = new Date();
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  });

  useEffect(() => {
    setGpsStatus("getting");
    if (!navigator.geolocation) {
      setGpsStatus("error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setGpsStatus("active"),
      () => setGpsStatus("error"),
      { timeout: 8000 },
    );
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const supabase = createClient();

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setSchedules([]);
          setLoading(false);
          return;
        }

        const { data: inspector } = await supabase
          .from("qc_inspectors")
          .select("id")
          .eq("user_id", user.id)
          .eq("active", true)
          .maybeSingle();

        if (!inspector) {
          setSchedules([]);
          setLoading(false);
          return;
        }

        const todayDate = new Date().toISOString().split("T")[0];
        const todayDow = new Date().getDay();

        const { data: rows } = await supabase
          .from("qc_inspection_schedules")
          .select(
            `
            id,
            account_id,
            scheduled_time,
            frequency_type,
            days_of_week,
            specific_date,
            commercial_accounts ( name, city, address_line1 )
          `,
          )
          .eq("inspector_id", inspector.id)
          .eq("active", true);

        if (!rows || rows.length === 0) {
          setSchedules([]);
          setLoading(false);
          return;
        }

        const todayRows = rows.filter((r) => {
          if (r.frequency_type === "daily") return true;
          if (r.specific_date === todayDate) return true;
          if (
            Array.isArray(r.days_of_week) &&
            (r.days_of_week as number[]).includes(todayDow)
          )
            return true;
          return false;
        });

        const accountIds = todayRows.map((r) => r.account_id);
        const { data: existing } = await supabase
          .from("qc_inspections")
          .select("id, account_id, status")
          .in("account_id", accountIds)
          .gte("created_at", todayDate + "T00:00:00")
          .lte("created_at", todayDate + "T23:59:59");

        const existingMap = new Map<
          string,
          { id: string; status: InspectionStatus }
        >();
        (existing ?? []).forEach((e) => {
          existingMap.set(e.account_id, {
            id: e.id,
            status: e.status as InspectionStatus,
          });
        });

        function formatTime(t: string) {
          const [h, m] = t.split(":");
          const hour = parseInt(h, 10);
          const ampm = hour >= 12 ? "PM" : "AM";
          return ((hour % 12) || 12) + ":" + m + " " + ampm;
        }

        const built: ScheduledAccount[] = todayRows.map((r) => {
          const acct = r.commercial_accounts as unknown as {
            name?: string;
            city?: string;
            address_line1?: string;
          } | null;
          const ex = existingMap.get(r.account_id);
          return {
            id: r.id,
            account_id: r.account_id,
            account_name: acct?.name ?? "Unknown Account",
            address: acct?.address_line1,
            city: acct?.city,
            scheduled_time: r.scheduled_time
              ? formatTime(r.scheduled_time as string)
              : undefined,
            status: ex?.status ?? "pending",
            inspection_id: ex?.id,
          };
        });

        setSchedules(built);
      } catch {
        setSchedules([]);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const done = schedules.filter(
    (s) => s.status === "submitted" || s.status === "completed",
  ).length;

  return (
    <div className="flex flex-col gap-0 pb-4">
      <div className="sticky top-0 z-10 border-b border-border/50 bg-background/90 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
              Today's Route
            </p>
            <p className="text-base font-bold text-foreground">{today}</p>
          </div>
          <GpsPill status={gpsStatus} />
        </div>
        {schedules.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{
                  width: `${schedules.length > 0 ? (done / schedules.length) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {done}/{schedules.length}
            </span>
          </div>
        )}
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Loading your schedule\u2026
            </p>
          </div>
        ) : schedules.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <ClipboardList className="size-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">
                No inspections today
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                You have no inspections scheduled for today. Check back
                tomorrow!
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {schedules.map((s) => (
              <AccountCard
                key={s.id}
                account={s}
                onStart={() => onStartInspection(s)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AccountCard({
  account,
  onStart,
}: {
  account: ScheduledAccount;
  onStart: () => void;
}) {
  const done =
    account.status === "submitted" || account.status === "completed";
  const inProgress = account.status === "in_progress";

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-start gap-3 p-4">
          <div className="mt-1 size-3 shrink-0 rounded-full bg-teal-500" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-base font-bold leading-snug text-foreground">
                {account.account_name}
              </p>
              <StatusBadge status={account.status} />
            </div>
            {account.scheduled_time && (
              <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="size-3.5 shrink-0" />
                {account.scheduled_time}
              </div>
            )}
            {(account.address || account.city) && (
              <div className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="size-3.5 shrink-0" />
                {[account.address, account.city].filter(Boolean).join(", ")}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border/50 px-4 py-3">
          {done ? (
            <div className="flex items-center justify-center gap-2 py-1 text-sm font-semibold text-emerald-600">
              <CheckCircle2 className="size-4" /> Inspection complete
            </div>
          ) : (
            <Button
              className="w-full"
              onClick={onStart}
              variant={inProgress ? "outline" : "default"}
            >
              {inProgress ? (
                <>
                  <RefreshCw className="size-4" /> Resume Inspection
                </>
              ) : (
                <>
                  <Navigation className="size-4" /> Start Inspection
                  <ChevronRight className="size-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── SCREEN 2: Active Inspection ──────────────────────────────────────────────

function ActiveInspectionScreen({
  inspection,
  onAreaUpdate,
  onComplete,
  onBack,
}: {
  inspection: ActiveInspection;
  onAreaUpdate: (areaIdx: number, items: ChecklistItem[]) => void;
  onComplete: () => void;
  onBack: () => void;
}) {
  const [areaIdx, setAreaIdx] = useState(0);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const area = inspection.areas[areaIdx];
  const totalAreas = inspection.areas.length;
  const ratedAreas = inspection.areas.filter((a) =>
    a.items.every((i) => i.rating !== null),
  ).length;
  const allDone = ratedAreas === totalAreas;
  const currentAreaDone = area.items.every((i) => i.rating !== null);

  function updateItem(itemId: string, patch: Partial<ChecklistItem>) {
    const updated = area.items.map((it) =>
      it.id === itemId ? { ...it, ...patch } : it,
    );
    onAreaUpdate(areaIdx, updated);
  }

  function setRating(itemId: string, rating: ItemRating) {
    updateItem(itemId, { rating });
    if (rating === "fail" || rating === "attention") {
      setExpandedItem(itemId);
    } else if (expandedItem === itemId && rating === "pass") {
      setExpandedItem(null);
    }
  }

  async function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const itemId = uploadingItemId;
    if (!file || !itemId) return;
    e.target.value = "";
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `inspections/${inspection.inspection_id}/${itemId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("qc-media")
        .upload(path, file, { upsert: true });
      if (!error) {
        const { data: urlData } = supabase.storage
          .from("qc-media")
          .getPublicUrl(path);
        updateItem(itemId, { photo_url: urlData.publicUrl });
      }
    } catch {
      // Silently ignore — photo capture is best-effort
    }
    setUploadingItemId(null);
  }

  function handleVoiceNote(itemId: string, text: string) {
    updateItem(itemId, { voice_note: text });
  }

  function handleAreaVoiceNote(text: string) {
    if (area.items.length > 0) {
      const first = area.items[0];
      updateItem(first.id, {
        voice_note: first.voice_note
          ? first.voice_note + "\n" + text
          : text,
      });
    }
  }

  const progressPct = Math.round((ratedAreas / totalAreas) * 100);

  return (
    <div className="relative flex min-h-0 flex-col">
      <div className="sticky top-0 z-10 border-b border-border/50 bg-background/90 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl p-1.5 hover:bg-muted"
          >
            <ChevronLeft className="size-5 text-muted-foreground" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
              {inspection.account_name}
            </p>
            <p className="truncate text-sm font-bold text-foreground">
              {area.name}
            </p>
          </div>
          <span className="shrink-0 text-xs font-semibold text-muted-foreground">
            {areaIdx + 1} / {totalAreas}
          </span>
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-muted-foreground">
            {progressPct}%
          </span>
        </div>

        <div className="mt-2 flex gap-1.5">
          {inspection.areas.map((a, i) => {
            const areaComplete = a.items.every((it) => it.rating !== null);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAreaIdx(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-200",
                  i === areaIdx
                    ? "w-6 bg-primary"
                    : areaComplete
                      ? "w-3 bg-primary/40"
                      : "w-3 bg-muted-foreground/30",
                )}
              />
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 py-4 pb-32">
        {area.items.map((item) => (
          <ChecklistItemCard
            key={item.id}
            item={item}
            expanded={expandedItem === item.id}
            onToggleExpand={() =>
              setExpandedItem((prev) => (prev === item.id ? null : item.id))
            }
            onRating={(r) => setRating(item.id, r)}
            onNoteChange={(n) => updateItem(item.id, { note: n })}
            onVoiceNote={(t) => handleVoiceNote(item.id, t)}
            onCamera={() => {
              setUploadingItemId(item.id);
              startTransition(() => {
                fileInputRef.current?.click();
              });
            }}
          />
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoCapture}
      />

      <div className="fixed inset-x-0 bottom-[4.5rem] z-20 border-t border-border/50 bg-background/95 px-4 py-3 backdrop-blur-xl">
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            disabled={areaIdx === 0}
            onClick={() => setAreaIdx((i) => i - 1)}
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          {areaIdx < totalAreas - 1 ? (
            <Button
              className="flex-1"
              onClick={() => setAreaIdx((i) => i + 1)}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button
              className="flex-1"
              disabled={!allDone}
              onClick={onComplete}
            >
              <Star className="size-4" />
              {allDone ? "Review & Sign" : "Rate all items"}
            </Button>
          )}
        </div>
        {!currentAreaDone && (
          <p className="mt-2 text-center text-xs text-amber-600">
            Rate all items in this area to continue.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setVoiceOpen(true)}
        className="fixed bottom-[8.5rem] right-4 z-30 flex size-14 items-center justify-center rounded-full bg-primary shadow-[0_8px_24px_-6px_hsl(var(--primary)/0.55)] transition-transform active:scale-95"
        title="Area voice note"
      >
        <Mic className="size-6 text-primary-foreground" />
      </button>

      {voiceOpen && (
        <VoiceOverlay
          areaName={area.name}
          onClose={() => setVoiceOpen(false)}
          onTranscript={handleAreaVoiceNote}
        />
      )}
    </div>
  );
}

function ChecklistItemCard({
  item,
  expanded,
  onToggleExpand,
  onRating,
  onNoteChange,
  onVoiceNote,
  onCamera,
}: {
  item: ChecklistItem;
  expanded: boolean;
  onToggleExpand: () => void;
  onRating: (r: ItemRating) => void;
  onNoteChange: (n: string) => void;
  onVoiceNote: (t: string) => void;
  onCamera: () => void;
}) {
  const [itemVoiceOpen, setItemVoiceOpen] = useState(false);

  return (
    <>
      <div
        className={cn(
          "rounded-2xl border border-border/70 bg-card shadow-sm transition-all duration-150",
          item.rating === "pass" && "border-emerald-200/70 bg-emerald-50/40",
          item.rating === "fail" && "border-red-200/70 bg-red-50/40",
          item.rating === "attention" && "border-amber-200/70 bg-amber-50/40",
        )}
      >
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex w-full items-center gap-3 p-4 text-left"
        >
          <div
            className={cn(
              "size-2.5 shrink-0 rounded-full border",
              item.rating === "pass"
                ? "border-emerald-400 bg-emerald-400"
                : item.rating === "attention"
                  ? "border-amber-400 bg-amber-400"
                  : item.rating === "fail"
                    ? "border-red-400 bg-red-400"
                    : "border-muted-foreground/30 bg-transparent",
            )}
          />
          <span className="flex-1 text-base font-medium leading-snug text-foreground">
            {item.label}
          </span>
          <ChevronRight
            className={cn(
              "size-4 shrink-0 text-muted-foreground/50 transition-transform duration-200",
              expanded && "rotate-90",
            )}
          />
        </button>

        <div className="flex items-center gap-2 px-4 pb-3">
          <div className="flex flex-1 gap-2">
            <RatingButton
              type="pass"
              selected={item.rating === "pass"}
              onSelect={() => onRating("pass")}
            />
            <RatingButton
              type="attention"
              selected={item.rating === "attention"}
              onSelect={() => onRating("attention")}
            />
            <RatingButton
              type="fail"
              selected={item.rating === "fail"}
              onSelect={() => onRating("fail")}
            />
          </div>
          <button
            type="button"
            onClick={() => onRating("na")}
            className={cn(
              "rounded-xl border border-border/60 px-2.5 py-2 text-xs font-bold text-muted-foreground transition-all hover:border-border",
              item.rating === "na" && "border-foreground/30 bg-muted",
            )}
          >
            N/A
          </button>
        </div>

        {expanded && (
          <div className="space-y-3 border-t border-border/50 px-4 py-3">
            <textarea
              className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/30"
              rows={2}
              placeholder="Add a note\u2026"
              value={item.note}
              onChange={(e) => onNoteChange(e.target.value)}
            />

            {item.voice_note && (
              <div className="rounded-xl border border-border/60 bg-muted/50 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Voice note
                </p>
                <p className="mt-0.5 text-sm text-foreground">
                  {item.voice_note}
                </p>
              </div>
            )}

            {item.photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.photo_url}
                alt="Captured"
                className="h-28 w-full rounded-xl object-cover"
              />
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCamera}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-card text-sm font-semibold text-muted-foreground hover:border-border hover:text-foreground"
              >
                <Camera className="size-4" />
                Photo
              </button>
              <button
                type="button"
                onClick={() => setItemVoiceOpen(true)}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-card text-sm font-semibold text-muted-foreground hover:border-border hover:text-foreground"
              >
                <Mic className="size-4" />
                Voice
              </button>
            </div>
          </div>
        )}
      </div>

      {itemVoiceOpen && (
        <VoiceOverlay
          areaName={item.label}
          onClose={() => setItemVoiceOpen(false)}
          onTranscript={onVoiceNote}
        />
      )}
    </>
  );
}

// ─── SCREEN 3: Score & Sign ───────────────────────────────────────────────────

function ScoreSignScreen({
  inspection,
  onSubmit,
  onBack,
}: {
  inspection: ActiveInspection;
  onSubmit: (signatureDataUrl: string | null) => Promise<void>;
  onBack: () => void;
}) {
  const [signature, setSignature] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const score = calcScore(inspection.areas);
  const grade = calcGrade(score);
  const failItems = inspection.areas
    .flatMap((a) => a.items.map((i) => ({ ...i, areaName: a.name })))
    .filter((i) => i.rating === "fail");

  const areaScores = inspection.areas.map((a) => {
    const rated = a.items.filter((i) => i.rating !== "na" && i.rating !== null);
    if (rated.length === 0) return { name: a.name, score: 100 };
    const s = Math.round(
      rated.reduce(
        (acc, i) =>
          acc +
          (i.rating === "pass" ? 100 : i.rating === "attention" ? 70 : 0),
        0,
      ) / rated.length,
    );
    return { name: a.name, score: s };
  });

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmit(signature);
    } finally {
      setSubmitting(false);
    }
  }

  const gradeColor =
    grade === "A"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : grade === "B"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-red-200 bg-red-50 text-red-700";

  return (
    <div className="flex flex-col gap-0 pb-8">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/50 bg-background/90 px-4 py-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl p-1.5 hover:bg-muted"
        >
          <ChevronLeft className="size-5 text-muted-foreground" />
        </button>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
            Inspection Complete
          </p>
          <p className="text-sm font-bold text-foreground">
            {inspection.account_name}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5 px-4 pt-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-6">
            <ScoreCircle score={score} />
            <div
              className={cn(
                "inline-flex items-center rounded-full border px-5 py-1.5 text-2xl font-black tracking-tight",
                gradeColor,
              )}
            >
              Grade {grade}
            </div>
            <p className="text-sm text-muted-foreground">
              {score >= 95
                ? "Excellent! Pristine condition."
                : score >= 85
                  ? "Good work. Minor improvements needed."
                  : "Several areas need attention."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Area Breakdown
            </p>
            <div className="flex flex-col gap-3">
              {areaScores.map((a) => (
                <div key={a.name}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {a.name}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-bold",
                        a.score >= 95
                          ? "text-emerald-600"
                          : a.score >= 85
                            ? "text-amber-600"
                            : "text-red-600",
                      )}
                    >
                      {a.score}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-700",
                        a.score >= 95
                          ? "bg-emerald-500"
                          : a.score >= 85
                            ? "bg-amber-400"
                            : "bg-red-500",
                      )}
                      style={{ width: `${a.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {failItems.length > 0 && (
          <Card>
            <CardContent className="pt-4">
              <div className="mb-3 flex items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-widest text-red-600">
                  Action Items
                </p>
                <Badge className="border-red-200 bg-red-50 text-red-700">
                  {failItems.length}
                </Badge>
              </div>
              <div className="flex flex-col gap-2">
                {failItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50/60 px-3 py-2"
                  >
                    <XCircle className="mt-0.5 size-4 shrink-0 text-red-500" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {item.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.areaName}
                      </p>
                      {item.note && (
                        <p className="mt-0.5 text-xs italic text-muted-foreground">
                          {item.note}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Inspector Signature
            </p>
            <SignaturePad onSign={setSignature} />
          </CardContent>
        </Card>

        <Button
          size="lg"
          className="w-full text-base"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Submitting\u2026
            </>
          ) : (
            <>
              <Send className="size-4" />
              Submit Inspection
            </>
          )}
        </Button>

        {!signature && (
          <p className="text-center text-xs text-muted-foreground">
            Signature is optional but recommended.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed inset-x-4 bottom-24 z-50 flex animate-in items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg fade-in slide-in-from-bottom-4">
      <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
      <p className="text-sm font-semibold text-emerald-800">{message}</p>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

// ─── Distance helper ──────────────────────────────────────────────────────────

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function QCInspectorClient() {
  const [screen, setScreen] = useState<Screen>("home");
  const [activeInspection, setActiveInspection] =
    useState<ActiveInspection | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  
  // Geofence Warning state
  const [geofenceWarning, setGeofenceWarning] = useState<{
    accountName: string;
    distance: number;
    radius: number;
    onConfirm: () => void;
  } | null>(null);
  const [checkingGps, setCheckingGps] = useState(false);

  const startInspectionDb = useCallback(async (account: ScheduledAccount, lat?: number, lng?: number) => {
    const supabase = createClient();
    try {
      let inspectionId = account.inspection_id;
      if (!inspectionId) {
        const { data, error } = await supabase
          .from("qc_inspections")
          .insert({
            account_id: account.account_id,
            status: "in_progress",
            check_in_at: new Date().toISOString(),
            check_in_latitude: lat ?? null,
            check_in_longitude: lng ?? null,
          })
          .select("id")
          .single();

        if (error || !data) {
          inspectionId = `local-${Date.now()}`;
        } else {
          inspectionId = data.id as string;
          await supabase
            .from("qc_inspection_schedules")
            .update({ status: "in_progress" })
            .eq("id", account.id);
        }
      }
      setActiveInspection({
        inspection_id: inspectionId ?? `local-${Date.now()}`,
        account_id: account.account_id,
        account_name: account.account_name,
        areas: buildDefaultAreas(),
      });
      setScreen("active");
    } catch {
      setActiveInspection({
        inspection_id: `local-${Date.now()}`,
        account_id: account.account_id,
        account_name: account.account_name,
        areas: buildDefaultAreas(),
      });
      setScreen("active");
    }
  }, []);

  const handleStartInspection = useCallback(
    async (account: ScheduledAccount) => {
      setCheckingGps(true);
      const supabase = createClient();

      // 1. Fetch configured geofence
      const { data: geo } = await supabase
        .from("qc_property_geofences")
        .select("latitude, longitude, radius_meters")
        .eq("commercial_account_id", account.account_id)
        .eq("active", true)
        .maybeSingle();

      if (!geo || !geo.latitude || !geo.longitude) {
        setCheckingGps(false);
        await startInspectionDb(account);
        return;
      }

      // 2. Get current GPS position
      if (!navigator.geolocation) {
        setCheckingGps(false);
        await startInspectionDb(account);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          setCheckingGps(false);
          const currentLat = position.coords.latitude;
          const currentLng = position.coords.longitude;
          const targetLat = Number(geo.latitude);
          const targetLng = Number(geo.longitude);
          const radius = Number(geo.radius_meters || 75);

          const distance = getDistanceMeters(currentLat, currentLng, targetLat, targetLng);

          if (distance > radius) {
            setGeofenceWarning({
              accountName: account.account_name,
              distance: Math.round(distance),
              radius,
              onConfirm: () => {
                setGeofenceWarning(null);
                void startInspectionDb(account, currentLat, currentLng);
              },
            });
          } else {
            await startInspectionDb(account, currentLat, currentLng);
          }
        },
        async () => {
          setCheckingGps(false);
          await startInspectionDb(account);
        },
        { timeout: 6000 }
      );
    },
    [startInspectionDb]
  );

  const handleAreaUpdate = useCallback(
    (areaIdx: number, items: ChecklistItem[]) => {
      setActiveInspection((prev) => {
        if (!prev) return prev;
        const areas = prev.areas.map((a, i) =>
          i === areaIdx ? { ...a, items } : a,
        );
        return { ...prev, areas };
      });
    },
    [],
  );

  const handleComplete = useCallback(() => {
    setScreen("sign");
  }, []);

  const handleSubmit = useCallback(
    async (signatureDataUrl: string | null) => {
      if (!activeInspection) return;
      const supabase = createClient();
      const score = calcScore(activeInspection.areas);
      const grade = calcGrade(score);
      const isLocal = activeInspection.inspection_id.startsWith("local-");

      // Try capturing checkout GPS
      let checkOutLat: number | null = null;
      let checkOutLng: number | null = null;

      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
        });
        checkOutLat = pos.coords.latitude;
        checkOutLng = pos.coords.longitude;
      } catch {
        // Silent fallback
      }

      if (!isLocal) {
        await supabase
          .from("qc_inspections")
          .update({
            status: "submitted",
            check_out_at: new Date().toISOString(),
            score_percentage: score,
            grade,
            inspector_signature: signatureDataUrl ?? null,
            inspection_data: JSON.stringify(activeInspection.areas),
            check_out_latitude: checkOutLat,
            check_out_longitude: checkOutLng,
          })
          .eq("id", activeInspection.inspection_id);
      }

      setToast(`Inspection submitted! Score: ${score}% (${grade})`);
      setActiveInspection(null);
      setScreen("home");
    },
    [activeInspection],
  );

  return (
    <div className="relative min-h-full">
      {screen === "home" && (
        <HomeScreen onStartInspection={handleStartInspection} />
      )}
      {screen === "active" && activeInspection && (
        <ActiveInspectionScreen
          inspection={activeInspection}
          onAreaUpdate={handleAreaUpdate}
          onComplete={handleComplete}
          onBack={() => setScreen("home")}
        />
      )}
      {screen === "sign" && activeInspection && (
        <ScoreSignScreen
          inspection={activeInspection}
          onSubmit={handleSubmit}
          onBack={() => setScreen("active")}
        />
      )}

      {/* Checking GPS overlay loading */}
      {checkingGps && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="mt-3 text-sm font-semibold text-muted-foreground">Verifying GPS Location...</p>
        </div>
      )}

      {/* Geofence Warning Modal */}
      {geofenceWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-sm border-destructive/20 shadow-xl">
            <CardContent className="flex flex-col items-center p-6 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4 animate-pulse">
                <MapPin className="size-7" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Out of Geofence</h3>
              <p className="text-sm text-muted-foreground mt-2">
                You are currently <strong className="text-foreground">{geofenceWarning.distance} meters</strong> away from <strong>{geofenceWarning.accountName}</strong>. 
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                You must be on-site (within {geofenceWarning.radius} meters) to perform this audit.
              </p>

              <div className="flex gap-2 w-full mt-6">
                <Button variant="outline" className="flex-1" onClick={() => setGeofenceWarning(null)}>
                  Close
                </Button>
                <Button className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={geofenceWarning.onConfirm}>
                  Bypass (Demo)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
