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
  summary: string;
  sopModifications?: {
    accountName?: string;
    cleanerName?: string;
    newHours?: number;
    newDays?: string[];
    newPricing?: number;
    newCleanerCost?: number;
    notes?: string;
  }[];
  extractedSalesTrack?: SalesTrackItem[];
  extractedBookings?: ServiceBookingRow[];
  appliedExplanation?: string;
};

const SYSTEM_INSTRUCTION = `You are the Pristine Cleaners AI SOP & Master Financial Operations Copilot.
You specialize in both RESIDENTIAL (Home Cleaning: Move In/Out, Deep Clean, Express/Standard, AirBnB, Recurring) and COMMERCIAL cleaning operations, payroll rules, BookingKoala summaries, and sales tracking.

Key Input Formats you must handle with high precision:
1. BookingKoala / Dispatch Text or Screenshots containing:
   - Booking id (e.g. 11475)
   - Industry (e.g. Home Cleaning, Commercial)
   - Service (e.g. Move In/Out Clean, Deep Clean, Standard Clean, Commercial Cleaning)
   - Frequency (e.g. One-Time, Weekly, Every 2 weeks, Monthly)
   - Bedrooms, Bathrooms, Sq Ft
   - Length / Duration (e.g. 3 Hr 30 Min -> 3.5 hrs)
   - Service date & time (e.g. Saturday 08/01/2026 -> 2026-08-01)
   - Assigned to / Cleaner (e.g. Maria Lopez)
   - Provider payment / Cleaner pay (e.g. $350.00)
   - Location / Address / Town (e.g. 916 Gardenia Way, Corona Del Mar, CA -> City: Corona Del Mar)
   - Payment method (CC, Check, Cash, Zelle)
   - Price details / Sub-Total (e.g. $607.70)

PAYMENT PROCESSING FEE RULE (MANDATORY):
- If Payment method is "CC", "Credit Card", or "Stripe":
  merchantFee = subTotal * 0.03 (3.0% credit card processing fee).
- If Payment method is "Cash", "Check", or "Zelle":
  merchantFee = 0 (0.0%).

FINANCIAL FORMULAS:
- laborPct = providerPayment / subTotal
- pcEarnings = subTotal - providerPayment - merchantFee
- pcProfitPct = pcEarnings / subTotal

Return ONLY a valid JSON object matching this schema:
{
  "intent": "modify_sop" | "create_sales_account" | "generate_sales_track" | "general_query",
  "summary": "Clear Spanish summary explaining the parsed job/booking, revenue, cleaner payout, CC fee if applicable, and net profit margin.",
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
      "notes": "string (e.g. Booking #11475 - CC 3% fee deducted: $18.23)"
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
  "appliedExplanation": "Explanation in Spanish detailing the exact math (e.g. Cobro: $607.70, Cleaner: $350.00, Fee CC 3%: $18.23, Ganancia Pristine: $239.47 (39.4%))."
}`;

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
    text: prompt || "Por favor analiza la información proporcionada (texto o captura) y extrae los datos de la cita/servicio con cálculo de mano de obra y pasarela CC 3%.",
  });

  contents.push({
    role: "user",
    parts,
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${resolvedKey}`;

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
    throw new Error(`Error en API de Gemini (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const textOutput = result?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textOutput) {
    throw new Error("No se recibió respuesta válida del modelo Gemini.");
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
}
