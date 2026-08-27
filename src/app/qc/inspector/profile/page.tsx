import { requireAreaAccess } from "@/lib/server-access";
import { QCInspectorProfileClient } from "@/components/qc/qc-inspector-profile-client";

export const metadata = { title: "My Profile | QC Inspector" };

export default async function QCInspectorProfilePage() {
  await requireAreaAccess("qc");
  return <QCInspectorProfileClient />;
}
