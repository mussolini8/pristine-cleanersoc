import { requireAreaAccess } from "@/lib/server-access";
import { SimpleOperationsClient } from "@/components/operations/simple-operations-client";

export default async function ResidentialRoute() {
  await requireAreaAccess("residential");
  return <SimpleOperationsClient view="residential" />;
}
