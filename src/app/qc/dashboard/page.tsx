import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAreaAccess } from "@/lib/server-access";
import { QCDashboardClient } from "@/components/qc/qc-dashboard-client";

export const metadata: Metadata = { title: "QC Dashboard" };

export default async function QCDashboardPage() {
  const { role } = await requireAreaAccess("qc");
  if (role === "inspector") {
    redirect("/qc/inspector");
  }
  return <QCDashboardClient />;
}
