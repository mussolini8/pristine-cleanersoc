import { NextResponse } from "next/server";
import { sendQuoSms } from "@/lib/sms/quo-client";

// Commercial residential dispatch line per operational instructions
const RESIDENTIAL_FROM_PHONE = "(657) 220-6077";

export type BroadcastRecipient = {
  name: string;
  phone: string;
};

export type BroadcastJobPayload = {
  serviceType: "Express" | "Deep Clean" | "Move In/Out";
  bedrooms: number;
  bathrooms: number;
  pay: string; // e.g. "$190"
  serviceDate: string; // e.g. "Thursday 09/25/2026 10:00 AM"
  city: string;
  details?: string;
  recipients: BroadcastRecipient[];
};

export async function POST(req: Request) {
  try {
    const body: BroadcastJobPayload = await req.json();
    const { serviceType, bedrooms, bathrooms, pay, serviceDate, city, details, recipients } = body;

    if (!serviceType || !bedrooms || !bathrooms || !pay || !serviceDate || !city) {
      return NextResponse.json(
        { error: "Missing required fields: serviceType, bedrooms, bathrooms, pay, serviceDate, city." },
        { status: 400 }
      );
    }

    if (!recipients || recipients.length === 0) {
      return NextResponse.json(
        { error: "Please select at least one cleaner to receive the message." },
        { status: 400 }
      );
    }

    // Build the SMS body in English
    const smsBody = buildSmsBody({ serviceType, bedrooms, bathrooms, pay, serviceDate, city, details });

    const results: { name: string; phone: string; success: boolean; error?: string }[] = [];

    for (const recipient of recipients) {
      try {
        await sendQuoSms({
          to: recipient.phone,
          message: smsBody,
          fromPhone: RESIDENTIAL_FROM_PHONE,
        });
        results.push({ name: recipient.name, phone: recipient.phone, success: true });
      } catch (err: any) {
        results.push({ name: recipient.name, phone: recipient.phone, success: false, error: err?.message || "Unknown error" });
      }
    }

    const sentCount = results.filter((r) => r.success).length;
    const failCount = results.length - sentCount;

    return NextResponse.json({
      success: true,
      sentCount,
      failCount,
      results,
      smsBody,
      message: `Broadcast complete: ${sentCount} sent${failCount > 0 ? `, ${failCount} failed` : ""}.`,
    });
  } catch (error: any) {
    console.error("[Job Broadcast] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Error sending job broadcast SMS." },
      { status: 500 }
    );
  }
}

function buildSmsBody({
  serviceType,
  bedrooms,
  bathrooms,
  pay,
  serviceDate,
  city,
  details,
}: Omit<BroadcastJobPayload, "recipients">): string {
  const serviceLabel =
    serviceType === "Move In/Out"
      ? "Limpieza Move In/Out (Entrada/Salida)"
      : serviceType === "Deep Clean"
      ? "Limpieza Profunda (Deep Clean)"
      : "Limpieza Express";

  const lines = [
    `🏠 *TRABAJO DISPONIBLE – Pristine Cleaners*`,
    ``,
    `📋 Servicio: ${serviceLabel}`,
    `🛏 Recámaras: ${bedrooms}`,
    `🚿 Baños: ${bathrooms}`,
    `💵 Pago: ${pay}`,
    `📅 Fecha: ${serviceDate}`,
    `📍 Ciudad: ${city}`,
  ];

  if (details && details.trim()) {
    lines.push(`📝 Detalles: ${details.trim()}`);
  }

  lines.push(``);
  lines.push(`✅ Responde a este mensaje si puedes tomar este trabajo.`);

  return lines.join("\n");
}
