import type { SalesTrackItem } from "@/lib/export/sales-track-export";
import type { ServiceBookingRow } from "@/lib/sales-tracker/types";

export type GeminiImageData = {
  inlineData: {
    data: string; // Base64 string without data:image/... prefix
    mimeType: string;
  };
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

7. RESIDENTIAL & COMMERCIAL BOOKINGS (BookingKoala / Dispatch Ingest):
   - Client name can appear at the start (e.g. "Sonia Kim: Booking id 11479...").
   - Payment method CC / Credit Card / Stripe: automatically deduct 3.0% processing fee (merchantFee = subTotal * 0.03).
   - Cash / Check / Zelle: fee is $0.00.
   - pcEarnings = subTotal - providerPayment - merchantFee.

Return ONLY a valid JSON object matching this schema:
{
  "intent": "modify_sop" | "create_sales_account" | "generate_sales_track" | "general_query",
  "actionType": "occurrence_override" | "add_staff" | "modify_schedule" | "quote_commercial" | "dispatch_sms_quo" | "cleaner_audit" | "booking_ingest" | "general_query",
  "summary": "Clear Spanish summary explaining what action was identified and what is proposed.",
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
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-2.0-flash",
  "gemini-3.6-flash",
  "gemini-1.5-pro",
];

export async function callGeminiSopCopilot({
  prompt,
  images = [],
  apiKey,
}: {
  prompt: string;
  images?: GeminiImageData[];
  apiKey?: string;
}): Promise<SopCopilotResponse> {
  const resolvedKey = apiKey || process.env.GEMINI_API_KEY;

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

      try {
        const parsed: SopCopilotResponse = JSON.parse(textOutput);
        return parsed;
      } catch (err) {
        const match = textOutput.match(/\{[\s\S]*\}/);
        if (match) {
          return JSON.parse(match[0]);
        }
        throw new Error("No se pudo estructurar la respuesta JSON de Gemini: " + String(err));
      }
    } catch (err: any) {
      lastError = err?.message || String(err);
      console.warn(`[Gemini Fallback] Error with ${modelName}:`, err);
    }
  }

  throw new Error(`No se pudo conectar con los modelos de Gemini disponibles. Último error: ${lastError}`);
}
