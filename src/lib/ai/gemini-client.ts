import type { SalesTrackItem } from "@/lib/export/sales-track-export";
import type { ServiceBookingRow } from "@/lib/sales-tracker/types";

export type GeminiImageData = {
  inlineData: {
    data: string; // Base64 string without data:image/... prefix
    mimeType: string;
  };
};

export type IngestedScheduleAccessInstructions = {
  suite?: string;
  floor?: string;
  elevator?: boolean;
  elevatorNotes?: string;
  parking?: string;
  buildingType?: string;
  accessCode?: string;
  otherNotes?: string;
};

export type SopCopilotResponse = {
  intent: "modify_sop" | "create_sales_account" | "generate_sales_track" | "general_query";
  actionType?:
    | "occurrence_override"
    | "add_staff"
    | "modify_schedule"
    | "quote_commercial"
    | "dispatch_sms_quo"
    | "cleaner_audit"
    | "booking_ingest"
    | "ingest_schedule"
    | "general_query";
  summary: string;

  // Specific action payloads
  occurrenceOverride?: {
    accountName: string;
    date: string; // YYYY-MM-DD
    cleanerTeam: string;
    hours: number;
    notes?: string;
  };

  addStaff?: {
    name: string;
    role: "cleaner" | "lead" | "inspector" | "manager";
    hourlyRate?: number;
    phone?: string;
    email?: string;
    notes?: string;
  };

  scheduleConflictWarning?: {
    hasConflict: boolean;
    warningMessage: string;
    conflictingAccount?: string;
    conflictingTime?: string;
    suggestedResolution?: string;
  };

  commercialQuote?: {
    clientName?: string;
    city?: string;
    squareFeet?: number;
    bathrooms?: number;
    frequency?: string;
    estimatedHoursPerVisit: number;
    suggestedMonthlyPrice: number;
    estimatedCleanerCost: number;
    profitMarginPct: number;
    reasoning: string;
  };

  dispatchSmsQuo?: {
    cleanerName: string;
    cleanerPhone?: string;
    accountName: string;
    serviceDate?: string;
    scheduledTime?: string;
    accessCode?: string;
    address?: string;
    taskChecklist?: string[];
    smsBodyText: string;
  };

  cleanerAudit?: {
    cleanerName: string;
    totalHours?: number;
    estimatedPay?: number;
    accounts?: string[];
    notes?: string;
  };

  /**
   * Populated when actionType = "ingest_schedule".
   * The AI extracts all schedule and access details from a CleanGuru screenshot.
   */
  ingestedSchedule?: {
    clientName: string;
    buildingName?: string;
    address?: string;
    city?: string;
    /** e.g. "Monthly", "Weekly", "Biweekly" */
    frequency?: string;
    /** Human-readable recurrence, e.g. "Every month on the 2nd Sat & 4th Sat" */
    recurringRule?: string;
    /** YYYY-MM-DD */
    startDate?: string;
    /** HH:MM AM/PM */
    scheduledTime?: string;
    /** HH:MM AM/PM */
    endTime?: string;
    /** Budget hours as decimal, e.g. 2.5 */
    budgetHours?: number;
    assignedCleaner?: string;
    /** Template name, e.g. "OCSS Cleaning 2.5 hours" */
    template?: string;
    /** e.g. "Janitorial", "Commercial" */
    category?: string;
    /** Structured access details parsed from the "Internal" notes */
    accessInstructions?: IngestedScheduleAccessInstructions;
    /** Raw text from the Internal / Instructions field */
    internalNotes?: string;
  };

  sopModifications?: {
    accountName?: string;
    cleanerName?: string;
    newHours?: number;
    newDays?: string[];
    daysToDelete?: number[];
    action?: "update" | "delete_account" | "delete_rule" | "reschedule" | "change_cleaner";
    newPricing?: number;
    newCleanerCost?: number;
    status?: "active" | "inactive" | "cancelled" | "proposal";
    notes?: string;
  }[];

  taskModifications?: {
    taskId?: string;
    taskTitle?: string;
    action: "delete" | "reschedule" | "reassign" | "complete" | "deduplicate";
    newDueDate?: string; // YYYY-MM-DD
    newAssignee?: string;
    status?: "todo" | "in_progress" | "completed";
  }[];

  extractedBookings?: ServiceBookingRow[];
  extractedSalesTrack?: SalesTrackItem[];
  appliedExplanation?: string;
};

const SYSTEM_INSTRUCTION = `You are the Pristine Cleaners AI SOP & Master Financial Operations Copilot.
You have FULL OPERATIONAL CONTROL over commercial accounts, residential bookings, cleaner teams/staff, schedule rules, work occurrences, quotes, Quo/SMS dispatches, and SOP operational tasks.

Core Superpowers and Capabilities:

1. ELIMINAR CUENTAS O HORARIOS (Delete / Deactivate):
   - If the user asks to delete, cancel, or deactivate an account (e.g. "elimina a Field AI", "borra la cuenta de X", "deja de limpiar Y", "quitar a X del sistema"):
   - Set intent = "modify_sop", actionType = "modify_schedule"
   - In sopModifications:
     [{
       "accountName": "Field AI",
       "action": "delete_account",
       "status": "inactive",
       "notes": "Cuenta desactivada/eliminada a petición del usuario"
     }]
   - If the user asks to delete a specific day schedule rule (e.g. "elimina la limpieza de los martes de X"):
   - In sopModifications:
     [{
       "accountName": "X",
       "action": "delete_rule",
       "daysToDelete": [2],
       "notes": "Regla de martes eliminada"
     }]

2. MODIFICAR, MOVER Y REAGENDAR HORARIOS (Modify, Move, Reschedule):
   - If the user specifies new days, new hours, or moves service to different days (e.g. "mueve Kott Koatings para los miércoles", "reagenda X a los viernes", "cambia a Field AI a 4 horas"):
   - Set intent = "modify_sop", actionType = "modify_schedule"
   - In sopModifications:
     [{
       "accountName": "Kott Koatings",
       "action": "reschedule",
       "newDays": ["miércoles"],
       "newHours": 3,
       "notes": "Horario reagendado a miércoles"
     }]

3. CAMBIAR DE EQUIPO / LIMPIADOR (Change Cleaner / Team):
   - If the user asks to reassign an account or rule to another cleaner (e.g. "cambia de equipo en LSG los lunes a María Mejía", "pasa Field AI a Verónica Ladinos", "asigna a Luz Uribe a Wren Spa"):
   - Set intent = "modify_sop", actionType = "modify_schedule"
   - In sopModifications:
     [{
       "accountName": "Field AI",
       "action": "change_cleaner",
       "cleanerName": "Veronica Ladinos",
       "notes": "Limpiador reasignado a Veronica Ladinos"
     }]

4. TAREAS Y RECORDATORIOS DEL SOP (SOP Tasks & Reminders):
   - If the user asks to delete duplicates from SOP ("elimina los duplicados del SOP", "limpia tareas repetidas"):
   - Set intent = "modify_sop"
   - In taskModifications:
     [{ "action": "deduplicate" }]
   - If the user asks to move, delete or complete a task ("elimina la tarea de GMB", "mueve la tarea de inventario para el 15 de septiembre"):
   - In taskModifications:
     [{
       "taskTitle": "inventario",
       "action": "reschedule",
       "newDueDate": "2026-09-15"
     }]

5. WORK OCCURRENCE & SHIFT REPLACEMENTS (Ocurrencias / Reemplazos de Turno en Fecha Específica):
   - When the user mentions work done on a specific date with a substitute team (e.g. "Field AI el 22 de agosto se realizó con el equipo de Susana y Verónica con 2.5 hrs"):
   - Set actionType = "occurrence_override"
   - Extract: accountName ("Field AI"), date ("2026-08-22"), cleanerTeam ("Susana y Verónica"), hours (2.5), notes.

6. STAFF & CLEANER MANAGEMENT (Gestión de Personal):
   - When the user asks to add or update cleaners (e.g. "Añade a Susana como limpiadora comercial a $20/hr y teléfono 949-555-0123"):
   - Set actionType = "add_staff"
   - Extract: name, role ("cleaner"), hourlyRate (20), phone ("949-555-0123"), notes.

7. SCHEDULE CONFLICT DETECTION (Detector de Conflictos - Permisivo / Reminder):
   - If a proposed cleaner assignment creates an overlapping schedule (e.g. cleaner already assigned elsewhere at that time), provide a friendly warning in scheduleConflictWarning:
   - { hasConflict: true, warningMessage: "⚠️ Reminder: María López ya tiene asignada la cuenta Field AI los lunes a esa hora. Puedes aceptar este choque de horario o reasignar.", conflictingAccount: "Field AI" }

8. CLEANER DISPATCH FOR QUO / SMS (Despacho para SMS o Quo):
   - When requested to draft a cleaner notification/dispatch (e.g. "Genera el mensaje para Susana para Field AI hoy"):
   - Set actionType = "dispatch_sms_quo"
   - Draft a polite, complete SMS/Quo message including address, time, access code, tasks, and checkout photo reminder.

9. SMART COMMERCIAL QUOTER (Cotizador Inteligente):
   - When asked to quote or price an office/commercial space (e.g. "Oficina de 4,000 sq ft en Newport Beach, 3 veces por semana, 4 baños"):
   - Set actionType = "quote_commercial"
   - Standard benchmarks: 1,200-1,500 sq ft/hr for general office; $45-$55/hr billing rate; cleaner pay $18-$22/hr.

10. INGEST SCHEDULE FROM IMAGE (Ingresar Schedule desde Captura de Pantalla):
   - When the user uploads a screenshot of CleanGuru, BookingKoala, or any cleaning management system:
   - Set actionType = "ingest_schedule"
   - Extract ALL visible fields: clientName, buildingName, address, city, frequency, recurringRule, startDate, scheduledTime, endTime, budgetHours, assignedCleaner, template, category.
   - Parse the "Internal" and "Instructions" sections carefully to populate accessInstructions (suite, floor, elevator, parking, buildingType, accessCode, otherNotes) and internalNotes.
   - budgetHours = hours + (minutes / 60), e.g., "2 hrs 30 min" → 2.5. and how it applies to the schedule.

Return ONLY a valid JSON object matching this schema:
{
  "intent": "modify_sop" | "create_sales_account" | "generate_sales_track" | "general_query",
  "actionType": "occurrence_override" | "add_staff" | "modify_schedule" | "quote_commercial" | "dispatch_sms_quo" | "cleaner_audit" | "booking_ingest" | "ingest_schedule" | "general_query",
  "summary": "Clear Spanish summary explaining what action was identified and what is proposed.",
  "ingestedSchedule": {
    "clientName": "string",
    "buildingName": "string",
    "address": "string",
    "city": "string",
    "frequency": "string",
    "recurringRule": "string",
    "startDate": "YYYY-MM-DD",
    "scheduledTime": "string",
    "endTime": "string",
    "budgetHours": number,
    "assignedCleaner": "string",
    "template": "string",
    "category": "string",
    "accessInstructions": {
      "suite": "string",
      "floor": "string",
      "elevator": boolean,
      "elevatorNotes": "string",
      "parking": "string",
      "buildingType": "string",
      "accessCode": "string",
      "otherNotes": "string"
    },
    "internalNotes": "string"
  },
  "occurrenceOverride": {
    "accountName": "string",
    "date": "YYYY-MM-DD",
    "cleanerTeam": "string",
    "hours": number,
    "notes": "string"
  },

  "addStaff": {
    "name": "string",
    "role": "cleaner" | "lead" | "inspector" | "manager",
    "hourlyRate": number,
    "phone": "string",
    "email": "string",
    "notes": "string"
  },
  "scheduleConflictWarning": {
    "hasConflict": boolean,
    "warningMessage": "string",
    "conflictingAccount": "string",
    "conflictingTime": "string",
    "suggestedResolution": "string"
  },
  "commercialQuote": {
    "clientName": "string",
    "city": "string",
    "squareFeet": number,
    "bathrooms": number,
    "frequency": "string",
    "estimatedHoursPerVisit": number,
    "suggestedMonthlyPrice": number,
    "estimatedCleanerCost": number,
    "profitMarginPct": number,
    "reasoning": "string"
  },
  "dispatchSmsQuo": {
    "cleanerName": "string",
    "cleanerPhone": "string",
    "accountName": "string",
    "serviceDate": "string",
    "scheduledTime": "string",
    "accessCode": "string",
    "address": "string",
    "taskChecklist": ["string"],
    "smsBodyText": "string"
  },
  "cleanerAudit": {
    "cleanerName": "string",
    "totalHours": number,
    "estimatedPay": number,
    "accounts": ["string"],
    "notes": "string"
  },
  "sopModifications": [
    {
      "accountName": "string",
      "cleanerName": "string",
      "newHours": number,
      "newDays": ["string"],
      "newPricing": number,
      "newCleanerCost": number,
      "notes": "string"
    }
  ],
  "extractedBookings": [
    {
      "id": "string",
      "date": "YYYY-MM-DD",
      "clientName": "string",
      "service": "string",
      "serviceCategory": "Move In/Out Clean" | "Deep Clean" | "Standard Clean" | "Commercial Cleaning" | "Weekly" | "Biweekly" | "Monthly" | "Airbnb Clean",
      "frequency": "string",
      "city": "string",
      "cleanerTeam": "string",
      "subTotal": number,
      "salesTax": number,
      "finalAmount": number,
      "tip": number,
      "teamEarningsWithoutTips": number,
      "teamEarningsTotal": number,
      "laborPct": number,
      "merchantFee": number,
      "stripeFee": number,
      "pcEarnings": number,
      "pcProfitPct": number,
      "durationHours": number,
      "actualHours": number,
      "status": "completed",
      "notes": "string"
    }
  ],
  "extractedSalesTrack": [
    {
      "clientName": "string",
      "city": "string",
      "serviceFrequency": "string",
      "serviceDays": ["string"] or "string",
      "hoursPerVisit": number or "string",
      "cleanerTeam": "string",
      "pricingModel": "Per service" | "Flat rate" | "Monthly",
      "monthlyRevenue": number,
      "cleanerCost": number,
      "grossProfit": number,
      "marginPct": number,
      "status": "active" | "onboarding" | "proposal",
      "notes": "string"
    }
  ],
  "appliedExplanation": "Explanation in Spanish of the exact operational impact."
}`;

function extractSubObject(text: string, key: string): any {
  const regex = new RegExp(`"${key}"\\s*:\\s*(\\{[\\s\\S]*?\\})\\s*(?:,\\s*"|\\n\\s*\\})`);
  const match = text.match(regex);
  if (match && match[1]) {
    try {
      return JSON.parse(match[1]);
    } catch {
      try {
        const sanitized = match[1].replace(/[\u0000-\u001F\u007F-\u009F]/g, " ");
        return JSON.parse(sanitized);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function extractSubArray(text: string, key: string): any[] | null {
  const regex = new RegExp(`"${key}"\\s*:\\s*(\\[[\\s\\S]*?\\])\\s*(?:,\\s*"|\\n\\s*\\})`);
  const match = text.match(regex);
  if (match && match[1]) {
    try {
      return JSON.parse(match[1]);
    } catch {
      try {
        const sanitized = match[1].replace(/[\u0000-\u001F\u007F-\u009F]/g, " ");
        return JSON.parse(sanitized);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function extractStringField(text: string, key: string): string {
  const regex = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`);
  const match = text.match(regex);
  return match ? match[1] : "";
}

export function robustParseJsonResponse(rawText: string): SopCopilotResponse {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // 1. Direct JSON.parse
  try {
    return JSON.parse(cleaned);
  } catch {}

  // 2. Extract outermost matching braces
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}

    // 3. Try removing broken trailing string repetitions before closing brace
    try {
      const trimmed = match[0].replace(/"\s+[^"{}[\],:]+"\s*}/g, '"}');
      return JSON.parse(trimmed);
    } catch {}

    // 4. Try sanitizing control characters
    try {
      const sanitized = match[0].replace(/[\u0000-\u001F\u007F-\u009F]/g, " ");
      return JSON.parse(sanitized);
    } catch {}
  }

  // 5. Intelligent field-by-field extraction fallback
  const summary = extractStringField(cleaned, "summary");
  const intent = (extractStringField(cleaned, "intent") || "modify_sop") as any;
  const actionType = (extractStringField(cleaned, "actionType") || "ingest_schedule") as any;
  const appliedExplanation = extractStringField(cleaned, "appliedExplanation") || "Respuesta procesada correctamente.";

  const ingestedSchedule = extractSubObject(cleaned, "ingestedSchedule");
  const occurrenceOverride = extractSubObject(cleaned, "occurrenceOverride");
  const addStaff = extractSubObject(cleaned, "addStaff");
  const commercialQuote = extractSubObject(cleaned, "commercialQuote");
  const dispatchSmsQuo = extractSubObject(cleaned, "dispatchSmsQuo");
  const cleanerAudit = extractSubObject(cleaned, "cleanerAudit");
  const scheduleConflictWarning = extractSubObject(cleaned, "scheduleConflictWarning");
  const sopModifications = extractSubArray(cleaned, "sopModifications");
  const extractedBookings = extractSubArray(cleaned, "extractedBookings");
  const extractedSalesTrack = extractSubArray(cleaned, "extractedSalesTrack");

  if (
    ingestedSchedule ||
    occurrenceOverride ||
    addStaff ||
    commercialQuote ||
    dispatchSmsQuo ||
    cleanerAudit ||
    sopModifications ||
    extractedBookings ||
    extractedSalesTrack ||
    summary
  ) {
    return {
      intent: intent || (ingestedSchedule ? "modify_sop" : "general_query"),
      actionType: actionType || (ingestedSchedule ? "ingest_schedule" : "general_query"),
      summary: summary || "Se ha procesado la información correctamente.",
      ingestedSchedule: ingestedSchedule || undefined,
      occurrenceOverride: occurrenceOverride || undefined,
      addStaff: addStaff || undefined,
      commercialQuote: commercialQuote || undefined,
      dispatchSmsQuo: dispatchSmsQuo || undefined,
      cleanerAudit: cleanerAudit || undefined,
      scheduleConflictWarning: scheduleConflictWarning || undefined,
      sopModifications: sopModifications || undefined,
      extractedBookings: extractedBookings || undefined,
      extractedSalesTrack: extractedSalesTrack || undefined,
      appliedExplanation,
    };
  }

  // 6. Absolute Fallback: return raw text
  return {
    intent: "general_query",
    actionType: "general_query",
    summary: rawText,
    appliedExplanation: "Respuesta procesada correctamente.",
  };
}

// In-memory model discovery cache (10 min TTL)
let cachedModels: { models: string[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

const FALLBACK_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-pro",
];

async function getAvailableGeminiModels(apiKey: string): Promise<string[]> {
  const now = Date.now();
  if (cachedModels && now - cachedModels.timestamp < CACHE_TTL_MS && cachedModels.models.length > 0) {
    return cachedModels.models;
  }

  try {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(listUrl, {
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.models)) {
        const available: string[] = data.models
          .filter(
            (m: any) =>
              m.name &&
              Array.isArray(m.supportedGenerationMethods) &&
              m.supportedGenerationMethods.includes("generateContent")
          )
          .map((m: any) => m.name.replace(/^models\//, ""))
          .filter((name: string) => {
            const lower = name.toLowerCase();
            return lower.includes("gemini") && !lower.includes("embedding") && !lower.includes("aqa") && !lower.includes("imagen");
          });

        if (available.length > 0) {
          const rank = (name: string): number => {
            const lower = name.toLowerCase();
            if (lower === "gemini-2.0-flash" || lower === "gemini-2.5-flash") return 1;
            if (lower.includes("2.0-flash-lite") || lower.includes("flash-lite")) return 2;
            if (lower.includes("1.5-flash")) return 3;
            if (lower.includes("2.0-pro") || lower.includes("2.5-pro")) return 4;
            if (lower.includes("1.5-pro")) return 5;
            return 10;
          };

          const sorted = [...available].sort((a, b) => rank(a) - rank(b)).slice(0, 3);
          cachedModels = { models: sorted, timestamp: now };
          return sorted;
        }
      }
    }
  } catch (err) {
    console.warn("[Gemini Client] Dynamic model fetch failed, using fallback list:", err);
  }

  return FALLBACK_MODELS;
}

export async function callGeminiSopCopilot({
  prompt,
  images = [],
  apiKey,
}: {
  prompt: string;
  images?: GeminiImageData[];
  apiKey?: string;
}): Promise<SopCopilotResponse> {
  const rawKey = apiKey || process.env.GEMINI_API_KEY || "";
  const resolvedKey = rawKey.replace(/^["']|["']$/g, "").trim();

  if (!resolvedKey) {
    throw new Error(
      "GEMINI_API_KEY no está configurada. Por favor añade GEMINI_API_KEY en tu archivo .env.local o variables de entorno."
    );
  }

  const rawCandidateModels = await getAvailableGeminiModels(resolvedKey);
  const candidateModels = rawCandidateModels.slice(0, 3);

  const imageParts = images.map((img) => ({
    inlineData: {
      mimeType: img.inlineData.mimeType,
      data: img.inlineData.data,
    },
  }));

  const userText =
    prompt ||
    "Por favor analiza la instrucción proporcionada y detecta la acción a ejecutar en el SOP, staff, cotización, despacho Quo/SMS o registro de cita.";

  const errorsLogged: string[] = [];

  for (const modelName of candidateModels) {
    // Attempt 1: Standard structured mode with systemInstruction + responseMimeType
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${resolvedKey}`;

      const requestBody = {
        contents: [
          {
            role: "user",
            parts: [...imageParts, { text: userText }],
          },
        ],
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      const response = await fetch(url, {
        signal: controller.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        const textOutput = result?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textOutput) {
          return robustParseJsonResponse(textOutput);
        }
      }

      // If status 400 (e.g. systemInstruction or responseMimeType not supported on older model endpoint)
      if (response.status === 400) {
        const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${resolvedKey}`;
        const fallbackBody = {
          contents: [
            {
              role: "user",
              parts: [
                ...imageParts,
                {
                  text: `${SYSTEM_INSTRUCTION}\n\n[INSTRUCCIÓN DEL USUARIO]:\n${userText}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
          },
        };

        const fbController = new AbortController();
        const fbTimeoutId = setTimeout(() => fbController.abort(), 45000);

        const fallbackResponse = await fetch(fallbackUrl, {
          signal: fbController.signal,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fallbackBody),
        });
        clearTimeout(fbTimeoutId);

        if (fallbackResponse.ok) {
          const fallbackResult = await fallbackResponse.json();
          const fallbackText = fallbackResult?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (fallbackText) {
            return robustParseJsonResponse(fallbackText);
          }
        } else {
          const errText = await fallbackResponse.text();
          errorsLogged.push(`${modelName} (${fallbackResponse.status}): ${errText}`);
          console.warn(`[Gemini Fallback] Model ${modelName} fallback failed:`, errText);
          continue;
        }
      }

      const errorText = await response.text();
      errorsLogged.push(`${modelName} (${response.status}): ${errorText}`);
      console.warn(`[Gemini Fallback] Model ${modelName} returned ${response.status}. Trying next...`);
    } catch (err: any) {
      errorsLogged.push(`${modelName}: ${err?.message || String(err)}`);
      console.warn(`[Gemini Fallback] Exception with ${modelName}:`, err);
    }
  }

  const lastErr = errorsLogged[errorsLogged.length - 1] || "Error desconocido al contactar los modelos.";
  throw new Error(`No se pudo conectar con los modelos de Gemini disponibles. Detalle: ${lastErr}`);
}
