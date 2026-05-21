import { SimpleOperationsClient } from "@/components/operations/simple-operations-client";
import { requireAreaAccess } from "@/lib/server-access";

export default async function StaffPage() {
  await requireAreaAccess("operations");
  return <SimpleOperationsClient view="staff" />;
}
