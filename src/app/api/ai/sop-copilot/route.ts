import { NextResponse } from "next/server";
import { callGeminiSopCopilot } from "@/lib/ai/gemini-client";
import { getServerEnv } from "@/lib/env";

// Allow up to 50 MB request bodies for this route (multiple base64 images)
export const maxDuration = 60;


export async function POST(req: Request) {
  try {
    // Manually read the body text first so we can give a clear JSON error on parse failure
    let bodyText: string;
    try {
      bodyText = await req.text();
    } catch {
      return NextResponse.json(
        { success: false, error: "La solicitud es demasiado grande. Intenta con menos imágenes a la vez (máximo 5)." },
        { status: 413 }
      );
    }

    let body: any;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return NextResponse.json(
        { success: false, error: "Error al leer la solicitud. Si subiste muchas imágenes, intenta con menos a la vez (máximo 5)." },
        { status: 400 }
      );
    }

    const { prompt, images, customApiKey, apiKey: bodyApiKey } = body;

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
          error: "Falta la clave GEMINI_API_KEY. Puedes configurarla en el archivo .env.local o ingresarla directamente en el panel del Asistente.",
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
          error: `Recibiste ${rawImages.length} imágenes. El límite es 5 por solicitud. Por favor envía menos imágenes a la vez.`,
        },
        { status: 400 }
      );
    }

    // Format images
    const formattedImages = rawImages.map((img: any) => {
      let base64Data = img.data || img;
      let mimeType = img.mimeType || "image/png";

      // If data URI provided (e.g. data:image/png;base64,...), extract raw base64 and mime
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

    const result = await callGeminiSopCopilot({
      prompt: prompt || "",
      images: formattedImages,
      apiKey,
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
        error: error?.message || "Ocurrió un error al procesar la solicitud con Gemini.",
      },
      { status: 500 }
    );
  }
}
