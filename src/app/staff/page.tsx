import { UnifiedOperationsClient } from "@/components/operations/unified-operations-client";
import { requireAreaAccess } from "@/lib/server-access";

export default async function StaffPage() {
  await requireAreaAccess("operations");
  return <UnifiedOperationsClient view="staff" />;
}
