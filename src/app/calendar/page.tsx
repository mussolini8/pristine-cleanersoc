import { UnifiedOperationsClient } from "@/components/operations/unified-operations-client";
import { requireAreaAccess } from "@/lib/server-access";

export default async function CalendarPage() {
  await requireAreaAccess("workspace");
  return <UnifiedOperationsClient view="calendar" />;
}
