import type { Metadata } from "next";
import { requireAreaAccess } from "@/lib/server-access";
import { QCDashboardClient } from "@/components/qc/qc-dashboard-client";

export const metadata: Metadata = { title: "QC Dashboard" };

export default async function QCDashboardPage() {
  await requireAreaAccess("qc");
  return <QCDashboardClient />;
}
