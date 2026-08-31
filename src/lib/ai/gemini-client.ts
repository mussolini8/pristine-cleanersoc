import type { SalesTrackItem } from "@/lib/export/sales-track-export";

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
  appliedExplanation?: string;
};

const SYSTEM_INSTRUCTION = `You are the Pristine Cleaners AI SOP & Commercial Operations Copilot.
You specialize in commercial cleaning operations, sales track reporting, pricing, schedule parsing, cleaner team assignments, and SOP modifications.

Your duties:
1. Parse commercial cleaning schedules, contracts, invoices, WhatsApp messages, Excel screenshots, or plain text.
2. Extract client names, cities, service days (e.g., ["Monday", "Wednesday", "Friday"]), frequency ("5x per week", "Weekly", "Biweekly", "Monthly"), hours per visit, monthly revenue ($), cleaner cost ($), pricing model ("Monthly", "Flat rate", "Per visit"), assigned cleaners/teams, and start/end dates.
3. Handle SOP modifications: When the user asks to change hours, swap cleaner teams, adjust prices or accounts, extract the exact modifications requested.
4. Calculate profit margin % = (revenue - cost) / revenue * 100 whenever revenue and cost are present.

Return ONLY a valid JSON object matching this schema:
{
  "intent": "modify_sop" | "create_sales_account" | "generate_sales_track" | "general_query",
  "summary": "Clear Spanish summary explaining what you identified and what changes/report items are proposed.",
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
  "extractedSalesTrack": [
    {
      "clientName": "string",
      "city": "string",
      "serviceFrequency": "string",
      "serviceDays": ["string"] or "string",
      "hoursPerVisit": number or "string",
      "monthlyHours": number or "string",
      "cleanerTeam": "string",
      "pricingModel": "Monthly" | "Flat rate" | "Per service",
      "monthlyRevenue": number,
      "cleanerCost": number,
      "grossProfit": number,
      "marginPct": number,
      "contractStart": "YYYY-MM-DD",
      "contractEnd": "YYYY-MM-DD",
      "status": "active" | "onboarding" | "proposal" | "paused" | "inactive",
      "notes": "string"
    }
  ],
  "appliedExplanation": "Explanation in Spanish of the exact operational impact."
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

  // Construct request payload
  const contents: any[] = [];
  const parts: any[] = [];

  // Add images if present
  for (const img of images) {
    parts.push({
      inline_data: {
        mime_type: img.inlineData.mimeType,
        data: img.inlineData.data,
      },
    });
  }

  // Add user prompt
  parts.push({
    text: prompt || "Por favor analiza la información proporcionada y extrae los datos de schedule comercial, SOP y ventas.",
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
    // If json parse failed, try extracting json block
    const match = textOutput.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error("No se pudo estructurar la respuesta JSON de Gemini: " + String(err));
  }
}
