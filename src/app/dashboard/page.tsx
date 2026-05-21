import { SimpleOperationsClient } from "@/components/operations/simple-operations-client";
import { requireAreaAccess } from "@/lib/server-access";

export default async function DashboardPage() {
  await requireAreaAccess("workspace");
  return <SimpleOperationsClient view="dashboard" />;
}
