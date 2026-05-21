import { SimpleOperationsClient } from "@/components/operations/simple-operations-client";
import { requireAreaAccess } from "@/lib/server-access";

type ResidentialSearchParams = Promise<{ tab?: string | string[] }>;

function normalizeTab(value: string | string[] | undefined) {
  const tab = Array.isArray(value) ? value[0] : value;
  if (tab === "work_logs" || tab === "weekly_payments") return tab;
  return "accounts";
}

export default async function ResidentialRoute({ searchParams }: { searchParams: ResidentialSearchParams }) {
  await requireAreaAccess("residential");
  const params = await searchParams;
  return <SimpleOperationsClient view="residential" initialResidentialTab={normalizeTab(params.tab)} />;
}
