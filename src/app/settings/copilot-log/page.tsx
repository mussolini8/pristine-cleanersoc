"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Clock, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";

type LogEntry = {
  id: string;
  conversation_id: string | null;
  prompt: string | null;
  action_type: string | null;
  intent: string | null;
  result: string | null;
  success: boolean;
  duration_ms: number | null;
  created_at: string;
  payload: any;
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

export default function CopilotLogPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const supabase = getSupabase();
        const { data } = await supabase
          .from("copilot_action_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);
        setLogs(data || []);
      } catch (e) {
        console.error("Error fetching copilot action log:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const filtered = logs.filter(
    (l) =>
      !filter ||
      l.prompt?.toLowerCase().includes(filter.toLowerCase()) ||
      l.action_type?.toLowerCase().includes(filter.toLowerCase())
  );

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-foreground">📋 Audit Log del Copiloto</h1>
        <span className="text-xs text-muted-foreground">{filtered.length} registros</span>
      </div>

      <input
        type="text"
        placeholder="Filtrar por prompt o acción..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
      />

      {loading && (
        <div className="text-center py-8 text-muted-foreground text-sm">Cargando registros...</div>
      )}

      <div className="space-y-2">
        {filtered.map((log) => (
          <div key={log.id} className="rounded-xl border border-border bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => toggleExpand(log.id)}
              className="w-full flex items-start justify-between p-3 text-left hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-start gap-3 min-w-0">
                {log.success ? (
                  <CheckCircle className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">
                    {log.action_type || "general_query"}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {log.prompt?.slice(0, 120) || "Sin prompt"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {log.duration_ms && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="size-3" />{log.duration_ms}ms
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {new Date(log.created_at).toLocaleString("es-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
                {expanded.has(log.id) ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              </div>
            </button>

            {expanded.has(log.id) && (
              <div className="border-t border-border/60 p-3 space-y-2 bg-muted/20">
                {log.result && (
                  <div>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Resultado</p>
                    <p className="text-[11px] text-foreground">{log.result}</p>
                  </div>
                )}
                {log.payload && (
                  <div>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Payload</p>
                    <pre className="text-[10px] bg-background rounded p-2 overflow-x-auto text-muted-foreground max-h-40">
                      {JSON.stringify(log.payload, null, 2)}
                    </pre>
                  </div>
                )}
                {log.conversation_id && (
                  <p className="text-[10px] text-muted-foreground">Conversación: {log.conversation_id}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No hay registros aún.</p>
          <p className="text-xs mt-1">Los cambios aplicados por el Copiloto aparecerán aquí.</p>
        </div>
      )}
    </div>
  );
}
