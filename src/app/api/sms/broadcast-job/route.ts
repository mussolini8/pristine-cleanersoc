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
        { error: "Faltan campos obligatorios: serviceType, bedrooms, bathrooms, pay, serviceDate, city." },
        { status: 400 }
      );
    }

    if (!recipients || recipients.length === 0) {
      return NextResponse.json(
        { error: "Debes seleccionar al menos una limpiadora para enviar el mensaje." },
        { status: 400 }
      );
    }

    // Build the SMS body
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
        results.push({ name: recipient.name, phone: recipient.phone, success: false, error: err?.message || "Error desconocido" });
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
      message: `Difusión enviada: ${sentCount} enviados${failCount > 0 ? `, ${failCount} fallidos` : ""}.`,
    });
  } catch (error: any) {
    console.error("[Job Broadcast] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Error al enviar la difusión de trabajo." },
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
  const lines = [
    `🏠 *TRABAJO DISPONIBLE – Pristine Cleaners*`,
    ``,
    `📋 Tipo: ${serviceType === "Move In/Out" ? "Mudanza (Move In/Out)" : serviceType}`,
    `🛏 Habitaciones: ${bedrooms}`,
    `🚿 Baños: ${bathrooms}`,
    `💵 Pago: ${pay}`,
    `📅 Fecha: ${serviceDate}`,
    `📍 Ciudad: ${city}`,
  ];

  if (details && details.trim()) {
    lines.push(`📝 Detalles: ${details.trim()}`);
  }

  lines.push(``);
  lines.push(`✅ Si puedes tomar este trabajo, responde a este mensaje.`);

  return lines.join("\n");
}
