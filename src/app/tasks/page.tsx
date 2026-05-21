import { SimpleOperationsClient } from "@/components/operations/simple-operations-client";
import { requireAreaAccess } from "@/lib/server-access";

export default async function TasksPage() {
  await requireAreaAccess("tasks");
  return <SimpleOperationsClient view="tasks" />;
}
