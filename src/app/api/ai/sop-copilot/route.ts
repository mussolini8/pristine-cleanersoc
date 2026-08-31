import { NextResponse } from "next/server";
import { callGeminiSopCopilot } from "@/lib/ai/gemini-client";
import { getServerEnv } from "@/lib/env";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, images, customApiKey } = body;

    let envKey: string | undefined;
    try {
      const env = getServerEnv();
      envKey = env.GEMINI_API_KEY;
    } catch {
      envKey = process.env.GEMINI_API_KEY;
    }

    const apiKey = customApiKey || envKey;

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

    // Format images if any
    const formattedImages = Array.isArray(images)
      ? images.map((img: any) => {
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
        })
      : [];

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
