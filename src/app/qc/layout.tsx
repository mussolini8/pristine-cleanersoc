import type { Metadata } from "next";
import { requireAreaAccess } from "@/lib/server-access";
import { QCShell } from "@/components/qc/qc-shell";

export const metadata: Metadata = { title: "QC Inspections" };

export default async function QCLayout({ children }: { children: React.ReactNode }) {
  const { role } = await requireAreaAccess("qc");
  return <QCShell role={role}>{children}</QCShell>;
}
