"use client";

import { useState, useEffect } from "react";
import {
  X,
  Send,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Home,
  Users,
  Megaphone,
  FlaskConical,
  Clock,
  Bell,
  CheckCheck,
  RotateCcw,
  Trash2,
  ListOrdered,
  PlusCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RESIDENTIAL_CLEANER_CONTACTS } from "@/lib/cleaner-contacts";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ServiceType = "Express" | "Deep Clean" | "Move In/Out";

export type BroadcastRecipient = {
  name: string;
  phone: string;
};

export type BroadcastJobRecord = {
  id: string;
  serviceType: ServiceType;
  bedrooms: number;
  bathrooms: number;
  pay: string;
  serviceDate: string;
  city: string;
  details?: string;
  status: "available" | "taken";
  takenBy?: string;
  recipients: BroadcastRecipient[];
  createdAt: string;
  updatedAt?: string;
  remindersCount?: number;
};

type SendResult = {
  name: string;
  phone: string;
  success: boolean;
  error?: string;
};

const SERVICE_TYPES: ServiceType[] = ["Express", "Deep Clean", "Move In/Out"];

const JAKE_TEST_CONTACT = {
  name: "Jake Ivan-Pal (Owner Test)",
  phone: "+12039091380",
};

const STORAGE_KEY = "pristine_broadcast_jobs_history";

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
  // Navigation tab
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");

  // Form fields for New Broadcast
  const [serviceType, setServiceType] = useState<ServiceType | "">("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [pay, setPay] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [city, setCity] = useState("");
  const [details, setDetails] = useState("");

  // Recipients selection
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // Send state for New Broadcast
  const [sending, setSending] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const [smsPreview, setSmsPreview] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [testSuccessMsg, setTestSuccessMsg] = useState<string | null>(null);

  // History state
  const [historyJobs, setHistoryJobs] = useState<BroadcastJobRecord[]>([]);

  // History action modals/states
  const [actionJob, setActionJob] = useState<BroadcastJobRecord | null>(null);
  const [actionType, setActionType] = useState<"mark_taken" | "send_reminder" | null>(null);
  const [takenByCleaner, setTakenByCleaner] = useState<string>("");
  const [notifyOtherCleaners, setNotifyOtherCleaners] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionFeedbackMsg, setActionFeedbackMsg] = useState<string | null>(null);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setHistoryJobs(JSON.parse(saved));
      }
    } catch (e) {
      console.error("[Broadcast] Failed to load history from localStorage:", e);
    }
  }, []);

  function saveHistory(updated: BroadcastJobRecord[]) {
    setHistoryJobs(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("[Broadcast] Failed to save history to localStorage:", e);
    }
  }

  if (!isOpen) return null;

  // ── Derived ──────────────────────────────────────────────────────────────

  const activeJobsCount = historyJobs.filter((j) => j.status === "available").length;

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const allSelected =
    RESIDENTIAL_CLEANER_CONTACTS.length > 0 &&
    selectedCount === RESIDENTIAL_CLEANER_CONTACTS.length;

  const isFormValid =
    serviceType !== "" &&
    bedrooms.trim() !== "" &&
    bathrooms.trim() !== "" &&
    pay.trim() !== "" &&
    serviceDate.trim() !== "" &&
    city.trim() !== "";

  // ── Handlers ─────────────────────────────────────────────────────────────

  function toggleAll() {
    if (allSelected) {
      setSelected({});
    } else {
      const all: Record<string, boolean> = {};
      RESIDENTIAL_CLEANER_CONTACTS.forEach((c) => (all[c.phone] = true));
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
    setTestSuccessMsg(null);
  }

  function handlePrefillSample() {
    setServiceType("Move In/Out");
    setBedrooms("3");
    setBathrooms("2");
    setPay("190.00");
    setServiceDate("Thursday 09/24/2026 10:00 AM");
    setCity("Newport Beach");
    setDetails("One-Time clean, 1000-1499 sq ft, ~2 hr 45 min.");
  }

  async function handleSendTestToJake() {
    if (!isFormValid) {
      setErrorMsg("Please fill out all required fields before sending a test to Jake.");
      return;
    }
    setSendingTest(true);
    setErrorMsg(null);
    setTestSuccessMsg(null);

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
          recipients: [{ name: JAKE_TEST_CONTACT.name, phone: JAKE_TEST_CONTACT.phone }],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.error || "Failed to send test SMS to Jake.");
      } else {
        setTestSuccessMsg(`✅ Test SMS sent to Jake (${JAKE_TEST_CONTACT.phone}) via OpenPhone (657) 220-6077!`);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Network error while sending test.");
    } finally {
      setSendingTest(false);
    }
  }

  async function handleSend() {
    if (!isFormValid || selectedCount === 0) return;
    setSending(true);
    setErrorMsg(null);
    setResults(null);
    setSmsPreview(null);
    setTestSuccessMsg(null);

    const recipients = RESIDENTIAL_CLEANER_CONTACTS.filter((c) => selected[c.phone]).map((c) => ({
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
        setErrorMsg(data?.error || "Error broadcasting job SMS.");
      } else {
        setResults(data.results ?? []);
        setSmsPreview(data.smsBody ?? null);

        // Add to history
        const newRecord: BroadcastJobRecord = {
          id: "job-" + Date.now(),
          serviceType: serviceType as ServiceType,
          bedrooms: Number(bedrooms),
          bathrooms: Number(bathrooms),
          pay: pay.startsWith("$") ? pay : `$${pay}`,
          serviceDate,
          city,
          details: details.trim() || undefined,
          status: "available",
          recipients,
          createdAt: new Date().toISOString(),
          remindersCount: 0,
        };

        saveHistory([newRecord, ...historyJobs]);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Network error sending broadcast.");
    } finally {
      setSending(false);
    }
  }

  // ── History Actions ───────────────────────────────────────────────────────

  function openMarkAsTakenModal(job: BroadcastJobRecord) {
    setActionJob(job);
    setActionType("mark_taken");
    setTakenByCleaner(job.recipients[0]?.name || "");
    setNotifyOtherCleaners(true);
    setActionFeedbackMsg(null);
  }

  function openSendReminderModal(job: BroadcastJobRecord) {
    setActionJob(job);
    setActionType("send_reminder");
    setActionFeedbackMsg(null);
  }

  async function handleConfirmMarkTaken() {
    if (!actionJob) return;
    setActionLoading(true);
    setActionFeedbackMsg(null);

    try {
      // Determine which cleaners to notify (everyone except the one who took it, or everyone if not specified)
      let recipientsToNotify = actionJob.recipients;
      if (takenByCleaner.trim()) {
        recipientsToNotify = actionJob.recipients.filter(
          (r) => r.name.toLowerCase().trim() !== takenByCleaner.toLowerCase().trim()
        );
      }

      if (notifyOtherCleaners && recipientsToNotify.length > 0) {
        await fetch("/api/sms/broadcast-update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "taken",
            serviceType: actionJob.serviceType,
            bedrooms: actionJob.bedrooms,
            bathrooms: actionJob.bathrooms,
            pay: actionJob.pay,
            serviceDate: actionJob.serviceDate,
            city: actionJob.city,
            takenByCleanerName: takenByCleaner.trim() || undefined,
            recipients: recipientsToNotify,
          }),
        });
      }

      // Update record in history
      const updated = historyJobs.map((j) =>
        j.id === actionJob.id
          ? {
              ...j,
              status: "taken" as const,
              takenBy: takenByCleaner.trim() || "Assigned",
              updatedAt: new Date().toISOString(),
            }
          : j
      );
      saveHistory(updated);
      setActionFeedbackMsg("✅ Job marked as taken! Cleaners have been notified.");
      setTimeout(() => {
        setActionJob(null);
        setActionType(null);
        setActionFeedbackMsg(null);
      }, 1500);
    } catch (err: any) {
      setActionFeedbackMsg("Error: " + (err?.message || "Failed to notify cleaners"));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConfirmSendReminder() {
    if (!actionJob) return;
    setActionLoading(true);
    setActionFeedbackMsg(null);

    try {
      const res = await fetch("/api/sms/broadcast-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reminder",
          serviceType: actionJob.serviceType,
          bedrooms: actionJob.bedrooms,
          bathrooms: actionJob.bathrooms,
          pay: actionJob.pay,
          serviceDate: actionJob.serviceDate,
          city: actionJob.city,
          details: actionJob.details,
          recipients: actionJob.recipients,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setActionFeedbackMsg("Error: " + (data?.error || "Failed to send reminder"));
      } else {
        // Increment reminder count
        const updated = historyJobs.map((j) =>
          j.id === actionJob.id
            ? {
                ...j,
                remindersCount: (j.remindersCount || 0) + 1,
                updatedAt: new Date().toISOString(),
              }
            : j
        );
        saveHistory(updated);
        setActionFeedbackMsg(`✅ Reminder sent to ${actionJob.recipients.length} cleaners!`);
        setTimeout(() => {
          setActionJob(null);
          setActionType(null);
          setActionFeedbackMsg(null);
        }, 1500);
      }
    } catch (err: any) {
      setActionFeedbackMsg("Error: " + (err?.message || "Network error sending reminder"));
    } finally {
      setActionLoading(false);
    }
  }

  function handleReopenJob(jobId: string) {
    const updated = historyJobs.map((j) =>
      j.id === jobId ? { ...j, status: "available" as const, takenBy: undefined, updatedAt: new Date().toISOString() } : j
    );
    saveHistory(updated);
  }

  function handleDeleteJob(jobId: string) {
    const updated = historyJobs.filter((j) => j.id !== jobId);
    saveHistory(updated);
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const sentCount = results ? results.filter((r) => r.success).length : 0;
  const failCount = results ? results.filter((r) => !r.success).length : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[92dvh] overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card shadow-2xl">
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 sm:px-5 py-3.5">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/10">
              <Megaphone className="size-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Residential Job Broadcast</h2>
              <p className="text-[11px] text-muted-foreground">
                OpenPhone Commercial Line · <span className="font-mono font-semibold">(657) 220-6077</span>
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

        {/* ── Tabs Bar ── */}
        <div className="flex items-center border-b border-border/60 bg-muted/20 px-4 sm:px-5">
          <button
            type="button"
            onClick={() => setActiveTab("new")}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "new"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <PlusCircle className="size-3.5" />
            <span>Broadcast New Job</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "history"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ListOrdered className="size-3.5" />
            <span>Tracked Jobs History</span>
            {activeJobsCount > 0 && (
              <span className="ml-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.2 text-[10px] font-bold">
                {activeJobsCount} Active
              </span>
            )}
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-5">
          {/* TAB 1: NEW BROADCAST */}
          {activeTab === "new" && (
            <>
              {/* Results panel */}
              {results && (
                <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="size-4 text-emerald-500" />
                    <span className="text-sm font-semibold text-foreground">
                      Broadcast Complete: {sentCount} sent{failCount > 0 ? `, ${failCount} failed` : ""}
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
                        View sent SMS message
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-background border border-border/60 p-3 text-[11px] font-mono text-foreground">
                        {smsPreview}
                      </pre>
                    </details>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={handleReset}>
                      Broadcast Another Job
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setActiveTab("history")}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 cursor-pointer"
                    >
                      <ListOrdered className="size-3.5" />
                      View in Tracked History
                    </Button>
                  </div>
                </div>
              )}

              {!results && (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Home className="size-3.5" />
                      Job Details
                    </h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handlePrefillSample}
                      className="text-[11px] text-muted-foreground hover:text-foreground h-7 px-2"
                      title="Pre-fill sample job details"
                    >
                      Sample Data
                    </Button>
                  </div>

                  {/* Service Type */}
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      Cleaning Type <span className="text-destructive">*</span>
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {SERVICE_TYPES.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setServiceType(type)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                            serviceType === type
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                              : "bg-background text-muted-foreground border-border/70 hover:border-emerald-500/50 hover:text-foreground"
                          }`}
                        >
                          {type === "Express"
                            ? "⚡ Express"
                            : type === "Deep Clean"
                            ? "🧹 Deep Clean"
                            : "📦 Move In/Out"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Beds & Baths row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5">
                        🛏 Bedrooms <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        placeholder="e.g. 3"
                        value={bedrooms}
                        onChange={(e) => setBedrooms(e.target.value)}
                        className={inputCls()}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5">
                        🚿 Bathrooms <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        placeholder="e.g. 2"
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
                        💵 Cleaner Pay <span className="text-destructive">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                          $
                        </span>
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
                        📍 City <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Newport Beach"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className={inputCls()}
                      />
                    </div>
                  </div>

                  {/* Service Date */}
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      📅 Service Date <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Thursday 09/24/2026 10:00 AM"
                      value={serviceDate}
                      onChange={(e) => setServiceDate(e.target.value)}
                      className={inputCls()}
                    />
                  </div>

                  {/* Details (optional) */}
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      📝 Details{" "}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Bring vacuum, pets on site, call on arrival…"
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      className={inputCls("resize-none")}
                    />
                  </div>

                  {/* Cleaners Selection */}
                  <section className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <Users className="size-3.5" />
                        Residential Cleaners to Notify ({RESIDENTIAL_CLEANER_CONTACTS.length})
                      </h3>
                      <button
                        type="button"
                        onClick={toggleAll}
                        className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline transition-colors cursor-pointer"
                      >
                        {allSelected ? "Deselect all" : "Select all"}
                      </button>
                    </div>

                    <div className="rounded-xl border border-border/60 divide-y divide-border/40 overflow-hidden">
                      {RESIDENTIAL_CLEANER_CONTACTS.map((cleaner) => {
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
                              className="accent-emerald-600 size-4 rounded shrink-0 cursor-pointer"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{cleaner.name}</p>
                              <p className="text-[11px] text-muted-foreground font-mono">{cleaner.phone}</p>
                            </div>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-full px-2 py-0.5 shrink-0 font-medium">
                              Residential
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    {selectedCount > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        {selectedCount} cleaner{selectedCount !== 1 ? "s" : ""} selected
                      </p>
                    )}
                  </section>

                  {/* Test Message to Jake button */}
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <FlaskConical className="size-3.5 text-teal-600 dark:text-teal-400" />
                        <span>Send Test to Jake</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Test the SMS layout on Jake (+1 203-909-1380) before broadcasting.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleSendTestToJake}
                      disabled={!isFormValid || sendingTest || sending}
                      className="gap-1.5 text-xs h-8 border-teal-500/40 text-teal-700 dark:text-teal-300 hover:bg-teal-500/10 shrink-0 cursor-pointer"
                    >
                      {sendingTest ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Sending test…
                        </>
                      ) : (
                        <>
                          <FlaskConical className="size-3.5" />
                          Test to Jake
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Feedback messages */}
                  {testSuccessMsg && (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                      <CheckCircle className="size-3.5 shrink-0" />
                      {testSuccessMsg}
                    </div>
                  )}

                  {errorMsg && (
                    <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      <AlertTriangle className="size-3.5 shrink-0" />
                      {errorMsg}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* TAB 2: TRACKED JOBS HISTORY */}
          {activeTab === "history" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-foreground">Tracked Broadcast History</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Independent log of broadcasted jobs. Manage availability & send updates in 1 click.
                  </p>
                </div>
                {historyJobs.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {historyJobs.length} job{historyJobs.length !== 1 ? "s" : ""} logged
                  </span>
                )}
              </div>

              {historyJobs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/80 p-8 text-center space-y-2">
                  <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
                    <ListOrdered className="size-5 text-muted-foreground" />
                  </div>
                  <h4 className="text-xs font-semibold text-foreground">No broadcasted jobs yet</h4>
                  <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                    When you broadcast a job to residential cleaners, it will appear here so you can easily mark it as taken or send reminders.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab("new")}
                    className="mt-2 text-xs cursor-pointer"
                  >
                    Broadcast a Job Now
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyJobs.map((job) => {
                    const isAvailable = job.status === "available";
                    return (
                      <div
                        key={job.id}
                        className={`rounded-xl border transition-all p-4 space-y-3 ${
                          isAvailable
                            ? "border-emerald-500/40 bg-emerald-500/5 shadow-xs"
                            : "border-border/60 bg-muted/20 opacity-85"
                        }`}
                      >
                        {/* Top row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[10px] font-bold rounded-full px-2 py-0.5 border ${
                                isAvailable
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                  : "bg-muted text-muted-foreground border-border/60"
                              }`}
                            >
                              {isAvailable ? "🟢 Still Available" : `⚪ Taken (${job.takenBy || "Assigned"})`}
                            </span>
                            <span className="text-[10px] font-semibold bg-primary/10 text-primary rounded-full px-2 py-0.5">
                              {job.serviceType}
                            </span>
                            <span className="text-[11px] font-bold text-foreground">
                              {job.city} · {job.pay}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {new Date(job.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteJob(job.id)}
                              className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                              title="Delete record from history"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Specs grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Bedrooms / Baths:</span>
                            <span className="font-semibold">{job.bedrooms} bed / {job.bathrooms} bath</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Service Date:</span>
                            <span className="font-semibold truncate block" title={job.serviceDate}>
                              {job.serviceDate}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Pay Offered:</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{job.pay}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Sent To:</span>
                            <span className="font-semibold">{job.recipients.length} cleaners</span>
                          </div>
                        </div>

                        {/* Details if any */}
                        {job.details && (
                          <p className="text-[11px] text-muted-foreground bg-background/50 rounded-lg p-2 border border-border/40 font-mono">
                            📝 {job.details}
                          </p>
                        )}

                        {/* Reminders count */}
                        {(job.remindersCount || 0) > 0 && (
                          <div className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                            <Bell className="size-3" />
                            <span>{job.remindersCount} reminder SMS sent for this job</span>
                          </div>
                        )}

                        {/* Actions bar */}
                        <div className="flex items-center justify-between pt-1 border-t border-border/40 gap-2 flex-wrap">
                          {isAvailable ? (
                            <>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => openSendReminderModal(job)}
                                  className="h-7 text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 gap-1 cursor-pointer"
                                >
                                  <Bell className="size-3" />
                                  <span>Send Reminder (Still Available)</span>
                                </Button>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => openMarkAsTakenModal(job)}
                                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 cursor-pointer"
                              >
                                <CheckCheck className="size-3.5" />
                                <span>Mark as Taken & Notify</span>
                              </Button>
                            </>
                          ) : (
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[11px] text-muted-foreground italic">
                                Closed (Assigned to {job.takenBy})
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleReopenJob(job.id)}
                                className="h-7 text-xs gap-1 cursor-pointer"
                              >
                                <RotateCcw className="size-3" />
                                <span>Reopen as Available</span>
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Sub-Modal / Dialog: Action Popup (Mark as Taken or Send Reminder) ── */}
        {actionJob && actionType && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 animate-in fade-in-50">
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  {actionType === "mark_taken" ? (
                    <>
                      <CheckCheck className="size-4 text-emerald-500" />
                      <span>Mark Job as Taken & Notify Cleaners</span>
                    </>
                  ) : (
                    <>
                      <Bell className="size-4 text-amber-500" />
                      <span>Send Still Available Reminder SMS</span>
                    </>
                  )}
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setActionJob(null);
                    setActionType(null);
                  }}
                  className="rounded p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              {/* Action content */}
              {actionType === "mark_taken" && (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Who accepted this job?
                    </label>
                    <select
                      value={takenByCleaner}
                      onChange={(e) => setTakenByCleaner(e.target.value)}
                      className={inputCls()}
                    >
                      <option value="">-- Select cleaner or other --</option>
                      {actionJob.recipients.map((r) => (
                        <option key={r.phone} value={r.name}>
                          {r.name} ({r.phone})
                        </option>
                      ))}
                      <option value="Other Cleaner">Other Cleaner</option>
                    </select>
                  </div>

                  <label className="flex items-start gap-2 cursor-pointer select-none bg-muted/30 p-2.5 rounded-lg border border-border/60">
                    <input
                      type="checkbox"
                      checked={notifyOtherCleaners}
                      onChange={(e) => setNotifyOtherCleaners(e.target.checked)}
                      className="accent-emerald-600 size-4 mt-0.5 rounded"
                    />
                    <div className="text-[11px] leading-snug">
                      <span className="font-semibold text-foreground block">
                        Send "No Longer Available" SMS to other cleaners
                      </span>
                      <span className="text-muted-foreground">
                        Notifies the other cleaners that the {actionJob.serviceType} in {actionJob.city} has been assigned.
                      </span>
                    </div>
                  </label>
                </div>
              )}

              {actionType === "send_reminder" && (
                <div className="space-y-2 text-xs">
                  <p className="text-muted-foreground">
                    This will send a reminder SMS to all <strong className="text-foreground">{actionJob.recipients.length} cleaners</strong> that the <strong className="text-foreground">{actionJob.serviceType}</strong> in <strong className="text-foreground">{actionJob.city}</strong> ({actionJob.pay}) is still available.
                  </p>
                  <div className="rounded-lg bg-muted/40 p-2.5 font-mono text-[11px] border border-border/50 text-foreground whitespace-pre-wrap">
                    🔔 *REMINDER: JOB STILL AVAILABLE – Pristine Cleaners*
                    {"\n\n"}📋 Service: {actionJob.serviceType}
                    {"\n"}🛏 Bedrooms: {actionJob.bedrooms} · 🚿 Bathrooms: {actionJob.bathrooms}
                    {"\n"}💵 Pay: {actionJob.pay}
                    {"\n"}📍 City: {actionJob.city}
                    {"\n\n"}✅ Reply to this message if you can take this job.
                  </div>
                </div>
              )}

              {actionFeedbackMsg && (
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {actionFeedbackMsg}
                </p>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActionJob(null);
                    setActionType(null);
                  }}
                  disabled={actionLoading}
                >
                  Cancel
                </Button>
                {actionType === "mark_taken" ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleConfirmMarkTaken}
                    disabled={actionLoading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 cursor-pointer"
                  >
                    {actionLoading ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Updating…
                      </>
                    ) : (
                      <>
                        <CheckCheck className="size-3.5" />
                        Confirm & Notify
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleConfirmSendReminder}
                    disabled={actionLoading}
                    className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 cursor-pointer"
                  >
                    {actionLoading ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <Send className="size-3.5" />
                        Send Reminder SMS
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        {activeTab === "new" && !results && (
          <div className="border-t border-border/60 bg-muted/30 px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">
              {selectedCount > 0 && isFormValid
                ? `Ready to broadcast to ${selectedCount} cleaner${selectedCount !== 1 ? "s" : ""}`
                : "Fill required fields and select cleaners"}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onClose} disabled={sending || sendingTest}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSend}
                disabled={!isFormValid || selectedCount === 0 || sending || sendingTest}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 cursor-pointer"
              >
                {sending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="size-3.5" />
                    Send Broadcast ({selectedCount})
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
