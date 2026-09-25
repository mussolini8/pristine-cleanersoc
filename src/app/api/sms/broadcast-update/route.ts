import { NextResponse } from "next/server";
import { sendQuoSms } from "@/lib/sms/quo-client";

// Commercial residential dispatch line per operational instructions
const RESIDENTIAL_FROM_PHONE = "(657) 220-6077";

export type BroadcastUpdateRecipient = {
  name: string;
  phone: string;
};

export type BroadcastUpdatePayload = {
  action: "taken" | "reminder";
  serviceType: "Express" | "Deep Clean" | "Move In/Out";
  bedrooms: number;
  bathrooms: number;
  pay: string;
  serviceDate: string;
  city: string;
  details?: string;
  takenByCleanerName?: string;
  recipients: BroadcastUpdateRecipient[];
};

export async function POST(req: Request) {
  try {
    const body: BroadcastUpdatePayload = await req.json();
    const {
      action,
      serviceType,
      bedrooms,
      bathrooms,
      pay,
      serviceDate,
      city,
      details,
      takenByCleanerName,
      recipients,
    } = body;

    if (!action || !serviceType || !serviceDate || !city) {
      return NextResponse.json(
        { error: "Missing required fields: action, serviceType, serviceDate, city." },
        { status: 400 }
      );
    }

    if (!recipients || recipients.length === 0) {
      return NextResponse.json(
        { error: "Please select at least one cleaner to notify." },
        { status: 400 }
      );
    }

    // Build the SMS message depending on action
    const smsBody =
      action === "taken"
        ? buildTakenSmsBody({ serviceType, pay, serviceDate, city, takenByCleanerName })
        : buildReminderSmsBody({ serviceType, bedrooms, bathrooms, pay, serviceDate, city, details });

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
        results.push({
          name: recipient.name,
          phone: recipient.phone,
          success: false,
          error: err?.message || "Unknown error",
        });
      }
    }

    const sentCount = results.filter((r) => r.success).length;
    const failCount = results.length - sentCount;

    return NextResponse.json({
      success: true,
      action,
      sentCount,
      failCount,
      results,
      smsBody,
      message: `${
        action === "taken" ? "Job taken notification" : "Still available reminder"
      } sent: ${sentCount} sent${failCount > 0 ? `, ${failCount} failed` : ""}.`,
    });
  } catch (error: any) {
    console.error("[Broadcast Update] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Error sending broadcast update SMS." },
      { status: 500 }
    );
  }
}

function getServiceLabel(serviceType: string): string {
  if (serviceType === "Move In/Out") return "Limpieza Move In/Out (Entrada/Salida)";
  if (serviceType === "Deep Clean") return "Limpieza Profunda (Deep Clean)";
  return "Limpieza Express";
}

function buildTakenSmsBody({
  serviceType,
  pay,
  serviceDate,
  city,
  takenByCleanerName,
}: {
  serviceType: string;
  pay: string;
  serviceDate: string;
  city: string;
  takenByCleanerName?: string;
}): string {
  const serviceLabel = getServiceLabel(serviceType);
  const lines = [
    `🏠 ACTUALIZACIÓN – Pristine Cleaners`,
    ``,
    `El trabajo de ${serviceLabel} en ${city} para ${serviceDate} (${pay}) YA NO ESTÁ DISPONIBLE (ya fue asignado).`,
    ``,
    `¡Muchas gracias por estar al pendiente! Te avisaremos en cuanto salgan nuevos trabajos.`,
  ];
  return lines.join("\n");
}

function buildReminderSmsBody({
  serviceType,
  bedrooms,
  bathrooms,
  pay,
  serviceDate,
  city,
  details,
}: {
  serviceType: string;
  bedrooms: number;
  bathrooms: number;
  pay: string;
  serviceDate: string;
  city: string;
  details?: string;
}): string {
  const serviceLabel = getServiceLabel(serviceType);
  const lines = [
    `🔔 RECORDATORIO: TRABAJO AÚN DISPONIBLE – Pristine Cleaners`,
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
