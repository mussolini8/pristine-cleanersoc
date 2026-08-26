import type { Metadata } from "next";
import { requireAreaAccess } from "@/lib/server-access";
import { QCInspectorClient } from "@/components/qc/qc-inspector-client";

export const metadata: Metadata = { title: "QC Inspector" };

export default async function QCInspectorPage() {
  await requireAreaAccess("qc");
  return <QCInspectorClient />;
}
