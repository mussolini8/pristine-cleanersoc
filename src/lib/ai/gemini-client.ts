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
    newPricing?: number;
    newCleanerCost?: number;
    notes?: string;
  }[];

  extractedBookings?: ServiceBookingRow[];
  extractedSalesTrack?: SalesTrackItem[];
  appliedExplanation?: string;
};

const SYSTEM_INSTRUCTION = `You are the Pristine Cleaners AI SOP & Master Financial Operations Copilot.
You have FULL OPERATIONAL CONTROL over commercial accounts, residential bookings, cleaner teams/staff, schedule rules, work occurrences, quotes, and Quo/SMS dispatches.

Core Superpowers and Capabilities:

1. WORK OCCURRENCE & SHIFT REPLACEMENTS (Ocurrencias / Reemplazos de Turno):
   - When the user mentions work done on a specific date with a substitute team (e.g. "Field AI el 22 de agosto se realizó con el equipo de Susana y Verónica con 2.5 hrs"):
   - Set actionType = "occurrence_override"
   - Extract: accountName ("Field AI"), date ("2026-08-22"), cleanerTeam ("Susana y Verónica"), hours (2.5), notes.

2. STAFF & CLEANER MANAGEMENT (Gestión de Personal):
   - When the user asks to add or update cleaners (e.g. "Añade a Susana como limpiadora comercial a $20/hr y teléfono 949-555-0123"):
   - Set actionType = "add_staff"
   - Extract: name, role ("cleaner"), hourlyRate (20), phone ("949-555-0123"), notes.

3. SCHEDULE CONFLICT DETECTION (Detector de Conflictos - Permisivo / Reminder):
   - If a proposed cleaner assignment creates an overlapping schedule (e.g. cleaner already assigned elsewhere at that time), provide a friendly warning in scheduleConflictWarning:
   - { hasConflict: true, warningMessage: "⚠️ Reminder: María López ya tiene asignada la cuenta Field AI los lunes a esa hora. Puedes aceptar este choque de horario o reasignar.", conflictingAccount: "Field AI" }

4. CLEANER DISPATCH FOR QUO / SMS (Despacho para SMS o Quo):
   - When requested to draft a cleaner notification/dispatch (e.g. "Genera el mensaje para Susana para Field AI hoy"):
   - Set actionType = "dispatch_sms_quo"
   - Draft a polite, complete SMS/Quo message including address, time, access code, tasks, and checkout photo reminder.
   - Include cleanerPhone if known or format placeholder.

5. SMART COMMERCIAL QUOTER (Cotizador Inteligente):
   - When asked to quote or price an office/commercial space (e.g. "Oficina de 4,000 sq ft en Newport Beach, 3 veces por semana, 4 baños"):
   - Set actionType = "quote_commercial"
   - Standard benchmarks: 1,200-1,500 sq ft/hr for general office; $45-$55/hr billing rate; cleaner pay $18-$22/hr.
   - Calculate estimatedHoursPerVisit, suggestedMonthlyPrice, estimatedCleanerCost, profitMarginPct, reasoning.

6. CLEANER PERFORMANCE AUDIT (Auditoría de Cleaner):
   - When asked about a cleaner's workload or history (e.g. "Dame el resumen de Ana Morales"):
   - Set actionType = "cleaner_audit"
   - Summarize accounts, hours, and payroll projection.

7. RESIDENTIAL VS COMMERCIAL CATEGORIZATION (CRITICAL):
   - COMMERCIAL CLEANING (Limpiezas Comerciales / Oficinas / Cuentas Comerciales):
     * Service Category is ALWAYS strictly "Commercial Cleaning".
     * Commercial cleaning does NOT mix into residential frequency buckets (Weekly, Biweekly, Triweekly, Deep Clean, etc.).
   - RESIDENTIAL / HOME CLEANING (Limpiezas de Casas):
     * Uses residential frequencies: "Weekly", "Biweekly", "Triweekly", "Monthly", "One-Time".
     * Uses residential service types: "Move In/Out Clean", "Deep Clean", "Standard Clean", "Airbnb Clean".
   - Client name can appear at the start (e.g. "Sonia Kim: Booking id 11479...").
   - Payment method CC / Credit Card / Stripe: automatically deduct 3.0% processing fee (merchantFee = subTotal * 0.03).
   - Cash / Check / Zelle: fee is $0.00.
   - pcEarnings = subTotal - providerPayment - merchantFee.

8. INGEST SCHEDULE FROM IMAGE (Ingresar Schedule desde Captura):
   - When the user uploads a screenshot of CleanGuru, BookingKoala, or any cleaning management system:
   - Set actionType = "ingest_schedule"
   - Extract ALL visible fields: clientName, buildingName, address, city, frequency, recurringRule, startDate, scheduledTime, endTime, budgetHours, assignedCleaner, template, category.
   - Parse the "Internal" and "Instructions" sections carefully to populate accessInstructions:
     * Look for suite/unit numbers → suite
     * Look for floor numbers → floor
     * Detect elevator mentions → elevator: true, elevatorNotes
     * Detect parking mentions (paid parking, street parking, lot) → parking
     * Detect building type (business center, medical, office) → buildingType
     * Look for access codes, key codes, alarm codes → accessCode
     * Any remaining important access notes → otherNotes
   - Set internalNotes to the full raw text of the Internal/Instructions field.
   - If both client name AND building name are visible, use the client name as clientName.
   - budgetHours = hours + (minutes / 60), e.g., "2 hrs 30 min" → 2.5.

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

const CANDIDATE_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-2.5-pro",
];

function extractSubObject(text: string, key: string): any {
  const regex = new RegExp(`"${key}"\\s*:\\s*(\\{[\\s\\S]*?\\})\\s*(?:,\\s*"|\\n\\s*\\})`);
  const match = text.match(regex);
  if (match && match[1]) {
    try {
      return JSON.parse(match[1]);
    } catch {
      // Try sanitizing
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

  if (ingestedSchedule || occurrenceOverride || addStaff || commercialQuote || dispatchSmsQuo || cleanerAudit || summary) {
    return {
      intent: intent || (ingestedSchedule ? "modify_sop" : "general_query"),
      actionType: actionType || (ingestedSchedule ? "ingest_schedule" : "general_query"),
      summary: summary || "Se ha extraído con éxito la información de la captura.",
      ingestedSchedule,
      occurrenceOverride,
      addStaff,
      commercialQuote,
      dispatchSmsQuo,
      cleanerAudit,
      scheduleConflictWarning,
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

  const contents: any[] = [];
  const parts: any[] = [];

  for (const img of images) {
    parts.push({
      inline_data: {
        mime_type: img.inlineData.mimeType,
        data: img.inlineData.data,
      },
    });
  }

  parts.push({
    text:
      prompt ||
      "Por favor analiza la instrucción proporcionada y detecta la acción a ejecutar en el SOP, staff, cotización, despacho Quo/SMS o registro de cita.",
  });

  contents.push({
    role: "user",
    parts,
  });

  let lastError: string | null = null;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${resolvedKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }],
          },
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        lastError = `Error con modelo ${modelName} (${response.status}): ${errorText}`;
        console.warn(`[Gemini Fallback] Model ${modelName} returned status ${response.status}. Trying next model...`);
        continue;
      }

      const result = await response.json();
      const textOutput = result?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textOutput) {
        lastError = `Modelo ${modelName} no devolvió texto de respuesta.`;
        continue;
      }

      return robustParseJsonResponse(textOutput);
    } catch (err: any) {
      lastError = err?.message || String(err);
      console.warn(`[Gemini Fallback] Error with ${modelName}:`, err);
    }
  }

  throw new Error(`No se pudo conectar con los modelos de Gemini disponibles. Último error: ${lastError}`);
}
