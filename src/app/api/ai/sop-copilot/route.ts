import { NextResponse } from "next/server";
import { callGeminiSopCopilot } from "@/lib/ai/gemini-client";
import { getServerEnv } from "@/lib/env";
import { createClient } from "@supabase/supabase-js";
import { executeTool } from "@/lib/ai/tool-executors";
import { toGeminiFunctionDeclarations } from "@/lib/ai/copilot-tools";

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
        .or(`contract_end.is.null,contract_end.gte.${new Date().toISOString().split("T")[0]}`)
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

async function runGeminiFunctionCalling(
  apiKey: string,
  userPrompt: string,
  formattedHistory: any[]
): Promise<{ toolName: string; toolArgs: any; summary: string } | null> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          ...formattedHistory,
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        tools: [{ functionDeclarations: toGeminiFunctionDeclarations() }],
        toolConfig: {
          functionCallingConfig: {
            mode: "AUTO",
          },
        },
      }),
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const candidate = data.candidates?.[0];
      const functionCallPart = candidate?.content?.parts?.find((p: any) => p.functionCall);
      if (functionCallPart?.functionCall) {
        const { name, args } = functionCallPart.functionCall;
        const toolRes = await executeTool(name, args || {});
        return { toolName: name, toolArgs: args, summary: toolRes.summary };
      }
    }
    return null;
  } catch (err) {
    console.warn("[Gemini Function Calling] Dynamic tool call skipped/fallback:", err);
    return null;
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
        { success: false, error: "The request is too large. Try fewer images at a time (maximum 5)." },
        { status: 413 }
      );
    }

    let body: any;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return NextResponse.json(
        { success: false, error: "Error reading the request. If you uploaded many images, try fewer at a time (maximum 5)." },
        { status: 400 }
      );
    }

    const { prompt, images, customApiKey, apiKey: bodyApiKey, messages, conversationHistory, currentPath } = body;

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
          error: "Missing GEMINI_API_KEY. You can set it in .env.local or enter it directly in the Assistant panel.",
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
          error: `You sent images. The limit is 5 per request. Please send fewer images at a time.`,
        },
        { status: 400 }
      );
    }

    // Format images
    const formattedImages = rawImages.map((img: any) => {
      let base64Data = img.data || img;
      let mimeType = img.mimeType || "image/png";

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

    // 2. Prepare History
    const history = Array.isArray(messages) ? messages : Array.isArray(conversationHistory) ? conversationHistory : [];
    const formattedHistory = (history || [])
      .filter((m: any) => m && m.content && m.content.trim().length > 0)
      .map((m: any) => ({
        role: m.role === "assistant" || m.role === "model" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    // 3. Dynamic Tool Calling & Context Enrichment
    let liveQueryEnrichment = "";

    if (currentPath) {
      liveQueryEnrichment += `\n[PANTALLA ACTUAL DEL SISTEMA]: El usuario se encuentra en ${currentPath}\n`;
    }

    // Try Gemini Native Function Calling
    const toolCall = await runGeminiFunctionCalling(apiKey, prompt || "", formattedHistory);
    if (toolCall) {
      liveQueryEnrichment += `\n[DATOS EN VIVO OBTENIDOS POR HERRAMIENTA (${toolCall.toolName})]:\n${toolCall.summary}\n`;
    }

    // Heuristic fallbacks & multi-tool safety triggers
    const lowerPrompt = (prompt || "").toLowerCase();
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];

    // Audit Business Rules Trigger
    if (
      !toolCall && (
        lowerPrompt.includes("audita") ||
        lowerPrompt.includes("auditar") ||
        lowerPrompt.includes("reglas de negocio") ||
        lowerPrompt.includes("cumplimiento") ||
        lowerPrompt.includes("compliance") ||
        lowerPrompt.includes("revisa las reglas")
      )
    ) {
      const toolRes = await executeTool("audit_business_rules", {});
      if (toolRes.success) {
        liveQueryEnrichment += `\n[DATOS EN VIVO - AUDITORÍA DE REGLAS DE NEGOCIO]:\n${toolRes.summary}\n`;
      }
    }

    // Account Access Codes Trigger
    if (
      !toolCall && (
        lowerPrompt.includes("código") ||
        lowerPrompt.includes("codigo") ||
        lowerPrompt.includes("alarma") ||
        lowerPrompt.includes("lockbox") ||
        lowerPrompt.includes("llave") ||
        lowerPrompt.includes("cómo entrar") ||
        lowerPrompt.includes("como entrar") ||
        lowerPrompt.includes("acceso de")
      )
    ) {
      const allKnownAccs = [
        "MOXI3 Costa Mesa", "MOXI3 Dana Point", "Field AI", "Wren Spa", "Kott Koatings",
        "LSG Sky Chefs", "Miracle Minds", "Mama's Restaurant", "Swing Easy Golf Club",
        "Green Leaf Botanicals", "Sierra Analytical", "Kush Fine Art", "Posh Pooch",
        "Renewable Farms", "ILG Irvine Office", "ILG Corona Office", "ILG Westlake",
        "ILG Valencia Office", "Elevate Aerial HB", "VNTR Fitness", "MIWA Office",
        "13demarzo", "GLOBAR Medspa", "Cornerstone Rehab", "Lifted Dentistry",
        "MacArthur Dental Arts", "Steripax", "The Harper"
      ];
      const matched = allKnownAccs.find((a) => lowerPrompt.includes(a.toLowerCase()));
      if (matched) {
        const toolRes = await executeTool("query_account_access", { accountName: matched });
        if (toolRes.success) {
          liveQueryEnrichment += `\n[DATOS EN VIVO - ACCESO A CUENTA]:\n${toolRes.summary}\n`;
        }
      }
    }

    // Cleaner Hours Trigger
    if (
      !toolCall && (
        lowerPrompt.includes("cuántas horas") ||
        lowerPrompt.includes("cuantas horas") ||
        lowerPrompt.includes("horas hizo") ||
        lowerPrompt.includes("horas trabajo") ||
        lowerPrompt.includes("horas de")
      )
    ) {
      const allKnown = [
        "Luz Uribe", "Susana Bautista", "Lucia Portillo", "Maria Lopez",
        "Ana Morales", "Carlos Lopez", "Juan Romero", "Sandra Hernandez",
        "Lorena Benitez", "Kassandra Valentin", "Vanessa Ortega", "Mirna Contreras",
        "Esperanza Youseff", "Emmi Guerra"
      ];
      const matchedCleaner = allKnown.find((c) =>
        lowerPrompt.includes(c.toLowerCase()) ||
        lowerPrompt.includes(c.split(" ")[0].toLowerCase())
      );
      const toolRes = await executeTool("query_cleaner_hours", {
        cleanerName: matchedCleaner,
        startDate: firstDayOfMonth,
        endDate: todayStr,
      });
      if (toolRes.success) {
        liveQueryEnrichment += `\n[DATOS EN VIVO DE BASE DE DATOS - HORAS REGISTRADAS]:\n${toolRes.summary}\n`;
      }
    }

    // Unassigned Accounts Trigger
    if (
      !toolCall && (
        lowerPrompt.includes("sin cleaner") ||
        lowerPrompt.includes("sin limpiador") ||
        lowerPrompt.includes("sin asignar") ||
        lowerPrompt.includes("no tienen limpiador")
      )
    ) {
      const toolRes = await executeTool("query_unassigned_accounts", {});
      if (toolRes.success) {
        liveQueryEnrichment += `\n[DATOS EN VIVO DE BASE DE DATOS - CUENTAS SIN ASIGNAR]:\n${toolRes.summary}\n`;
      }
    }

    // Upcoming QC Trigger
    if (
      !toolCall && (
        lowerPrompt.includes("próximos qc") ||
        lowerPrompt.includes("proximos qc") ||
        lowerPrompt.includes("inspecciones pendientes")
      )
    ) {
      const toolRes = await executeTool("query_upcoming_qc", { days: 14 });
      if (toolRes.success) {
        liveQueryEnrichment += `\n[DATOS EN VIVO DE BASE DE DATOS - QC PROGRAMADOS]:\n${toolRes.summary}\n`;
      }
    }

    // Payroll Discrepancies Trigger
    if (
      !toolCall && (
        lowerPrompt.includes("discrepancia") ||
        lowerPrompt.includes("diferencia de horas") ||
        lowerPrompt.includes("horas faltantes") ||
        lowerPrompt.includes("revisar nómina") ||
        lowerPrompt.includes("revisar nomina")
      )
    ) {
      const toolRes = await executeTool("query_payroll_discrepancies", {
        startDate: firstDayOfMonth,
        endDate: todayStr,
      });
      if (toolRes.success) {
        liveQueryEnrichment += `\n[DATOS EN VIVO - DISCREPANCIAS DE NÓMINA]:\n${toolRes.summary}\n`;
      }
    }

    const finalPrompt = liveQueryEnrichment ? `${prompt}\n\n${liveQueryEnrichment}` : prompt || "";

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
        error: error?.message || "An error occurred while processing the request with Gemini.",
      },
      { status: 500 }
    );
  }
}
