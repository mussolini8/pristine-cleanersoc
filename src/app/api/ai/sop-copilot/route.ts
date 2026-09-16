import { NextResponse } from "next/server";
import { callGeminiSopCopilot } from "@/lib/ai/gemini-client";
import { getServerEnv } from "@/lib/env";
import { createClient } from "@supabase/supabase-js";
import { executeTool } from "@/lib/ai/tool-executors";

// Allow up to 50 MB request bodies for this route (multiple base64 images)
export const maxDuration = 60;

let cachedDirectory: { content: string; timestamp: number } | null = null;
const DIR_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

async function getLiveOperationalDirectory(): Promise<string> {
  const now = Date.now();
  if (cachedDirectory && now - cachedDirectory.timestamp < DIR_CACHE_TTL) {
    return cachedDirectory.content;
  }

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    if (!url || !key) return "";

    const supabase = createClient(url, key);

    const [accsRes, rulesRes, staffRes, resAccsRes] = await Promise.all([
      supabase
        .from("commercial_accounts")
        .select("id, name, city, cleaner_name, hours, frequency, pricing_model")
        .is("contract_end", null)
        .order("name")
        .limit(150),
      supabase
        .from("commercial_account_schedule_rules")
        .select("commercial_account_id, day_of_week, paid_hours, assigned_cleaner_name, active")
        .eq("active", true)
        .limit(300),
      supabase
        .from("staff_members")
        .select("name, role, team_scope")
        .eq("active", true)
        .is("deleted_at", null)
        .limit(100),
      supabase
        .from("residential_recurring_cleaning_accounts")
        .select("account_name, assigned_team_name, frequency, scheduled_hours, city")
        .eq("active", true)
        .is("deleted_at", null)
        .limit(100),
    ]);

    const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const rulesByAcc: Record<string, string[]> = {};

    for (const r of (rulesRes.data || []) as any[]) {
      if (!rulesByAcc[r.commercial_account_id]) rulesByAcc[r.commercial_account_id] = [];
      rulesByAcc[r.commercial_account_id].push(
        `${DAY_NAMES[r.day_of_week] || r.day_of_week} ${r.paid_hours}h (${r.assigned_cleaner_name || "Sin asignar"})`
      );
    }

    const lines: string[] = [];
    lines.push("### COMMERCIAL ACCOUNTS (LIVE SUPABASE DB):");
    for (const acc of (accsRes.data || []) as any[]) {
      const rules = (rulesByAcc[acc.id] || []).join(", ");
      lines.push(
        `- "${acc.name}" (${acc.city || "OC"}) | Cleaner: "${acc.cleaner_name || "Sin asignar"}" | Horas: ${acc.hours || 2.5}h | Frecuencia: ${acc.frequency || "Weekly"} | Turnos: [${rules || "Por definir"}]`
      );
    }

    if (resAccsRes.data && resAccsRes.data.length > 0) {
      lines.push("\n### RESIDENTIAL RECURRING ACCOUNTS (LIVE SUPABASE DB):");
      for (const r of resAccsRes.data as any[]) {
        lines.push(
          `- "${r.account_name}" (${r.city || "OC"}) | Equipo: "${r.assigned_team_name || "Carlos Lopez"}" | Frecuencia: ${r.frequency} | Horas: ${r.scheduled_hours}h`
        );
      }
    }

    if (staffRes.data && staffRes.data.length > 0) {
      lines.push("\n### ACTIVE STAFF MEMBERS:");
      lines.push(staffRes.data.map((s: any) => `${s.name} (${s.role || s.team_scope})`).join(", "));
    }

    const output = lines.join("\n");
    cachedDirectory = { content: output, timestamp: now };
    return output;
  } catch (err) {
    console.warn("[Copilot Live Directory] Fallback to static directory:", err);
    return "";
  }
}

export async function POST(req: Request) {
  try {
    // Manually read the body text first so we can give a clear JSON error on parse failure
    let bodyText: string;
    try {
      bodyText = await req.text();
    } catch {
      return NextResponse.json(
        { success: false, error: "La solicitud es demasiado grande. Intenta con menos imágenes a la vez (máximo 5)." },
        { status: 413 }
      );
    }

    let body: any;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return NextResponse.json(
        { success: false, error: "Error al leer la solicitud. Si subiste muchas imágenes, intenta con menos a la vez (máximo 5)." },
        { status: 400 }
      );
    }

    const { prompt, images, customApiKey, apiKey: bodyApiKey, messages, conversationHistory } = body;

    let envKey: string | undefined;
    try {
      const env = getServerEnv();
      envKey = env.GEMINI_API_KEY;
    } catch {
      envKey = process.env.GEMINI_API_KEY;
    }

    const apiKey = customApiKey || bodyApiKey || envKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Falta la clave GEMINI_API_KEY. Puedes configurarla en el archivo .env.local o ingresarla directamente en el panel del Asistente.",
          needsApiKey: true,
        },
        { status: 400 }
      );
    }

    // Guard: limit images to 5 per request to avoid Gemini payload limits
    const rawImages = Array.isArray(images) ? images : [];
    if (rawImages.length > 5) {
      return NextResponse.json(
        {
          success: false,
          error: `Recibiste ${rawImages.length} imágenes. El límite es 5 por solicitud. Por favor envía menos imágenes a la vez.`,
        },
        { status: 400 }
      );
    }

    // Format images
    const formattedImages = rawImages.map((img: any) => {
      let base64Data = img.data || img;
      let mimeType = img.mimeType || "image/png";

      // If data URI provided (e.g. data:image/png;base64,...), extract raw base64 and mime
      if (typeof base64Data === "string" && base64Data.startsWith("data:")) {
        const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          base64Data = matches[2];
        }
      }

      return {
        inlineData: {
          data: base64Data,
          mimeType,
        },
      };
    });

    // 1. Fetch live operational directory from Supabase
    const liveDirectory = await getLiveOperationalDirectory();

    // 2. Pre-query live DB tools if the user is asking questions about real metrics
    let liveQueryEnrichment = "";
    const lowerPrompt = (prompt || "").toLowerCase();
    if (
      lowerPrompt.includes("cuántas horas") ||
      lowerPrompt.includes("cuantas horas") ||
      lowerPrompt.includes("horas hizo") ||
      lowerPrompt.includes("horas trabajo") ||
      lowerPrompt.includes("horas de")
    ) {
      const knownCleaners = ["Luz Uribe", "Susana", "Lucia Portillo", "Maria", "Ana", "Carlos Lopez", "Juan Romero"];
      const matchedCleaner = knownCleaners.find((c) => lowerPrompt.includes(c.toLowerCase()));
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
      const todayStr = today.toISOString().split("T")[0];
      const toolRes = await executeTool("query_cleaner_hours", {
        cleanerName: matchedCleaner,
        startDate: firstDayOfMonth,
        endDate: todayStr,
      });
      if (toolRes.success) {
        liveQueryEnrichment += `\n[DATOS EN VIVO DE BASE DE DATOS - HORAS REGISTRADAS]:\n${toolRes.summary}\n`;
      }
    } else if (
      lowerPrompt.includes("sin cleaner") ||
      lowerPrompt.includes("sin limpiador") ||
      lowerPrompt.includes("sin asignar") ||
      lowerPrompt.includes("no tienen limpiador")
    ) {
      const toolRes = await executeTool("query_unassigned_accounts", {});
      if (toolRes.success) {
        liveQueryEnrichment += `\n[DATOS EN VIVO DE BASE DE DATOS - CUENTAS SIN ASIGNAR]:\n${toolRes.summary}\n`;
      }
    } else if (
      lowerPrompt.includes("próximos qc") ||
      lowerPrompt.includes("proximos qc") ||
      lowerPrompt.includes("inspecciones pendientes")
    ) {
      const toolRes = await executeTool("query_upcoming_qc", { days: 14 });
      if (toolRes.success) {
        liveQueryEnrichment += `\n[DATOS EN VIVO DE BASE DE DATOS - QC PROGRAMADOS]:\n${toolRes.summary}\n`;
      }
    }

    const finalPrompt = liveQueryEnrichment ? `${prompt}\n\n${liveQueryEnrichment}` : prompt || "";

    const history = Array.isArray(messages) ? messages : Array.isArray(conversationHistory) ? conversationHistory : [];

    const result = await callGeminiSopCopilot({
      prompt: finalPrompt,
      images: formattedImages,
      apiKey,
      conversationHistory: history,
      liveDirectory: liveDirectory || undefined,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Error in /api/ai/sop-copilot:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Ocurrió un error al procesar la solicitud con Gemini.",
      },
      { status: 500 }
    );
  }
}
