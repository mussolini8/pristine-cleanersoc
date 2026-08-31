import { NextResponse } from "next/server";
import { sendQuoSms } from "@/lib/sms/quo-client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { to, message, fromPhone } = body;

    if (!to || !message) {
      return NextResponse.json(
        { error: "Los campos 'to' (destinatario) y 'message' (mensaje) son obligatorios." },
        { status: 400 }
      );
    }

    const result = await sendQuoSms({
      to,
      message,
      fromPhone,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error sending Quo SMS:", error);
    return NextResponse.json(
      { error: error?.message || "Error al enviar el SMS por Quo." },
      { status: 500 }
    );
  }
}
