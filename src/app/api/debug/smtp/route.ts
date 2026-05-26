import { NextResponse } from "next/server";
import { probeSmtpTcp, sendSmtpDiagnosticEmail, verifyGmailSmtp } from "@/lib/task-notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const shouldSend = url.searchParams.get("send") === "1";
  const sendPort = url.searchParams.get("port") === "587" ? 587 : 465;
  const sendTo = url.searchParams.get("to");
  const [tcp465, tcp587, verify465, verify587] = await Promise.all([
    probeSmtpTcp(465),
    probeSmtpTcp(587),
    verifyGmailSmtp(465),
    verifyGmailSmtp(587),
  ]);
  const send = shouldSend ? await sendSmtpDiagnosticEmail(sendPort, sendTo) : null;

  return NextResponse.json({
    ok: true,
    host: "smtp.gmail.com",
    credentialsConfigured: {
      gmailUser: Boolean(process.env.GMAIL_USER),
      gmailAppPassword: Boolean(process.env.GMAIL_APP_PASSWORD),
    },
    tests: {
      tcp: {
        "465": tcp465,
        "587": tcp587,
      },
      verify: {
        "465": verify465,
        "587": verify587,
      },
      send,
    },
  });
}
