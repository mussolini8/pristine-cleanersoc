import { redirect } from "next/navigation";
import { requireAreaAccess } from "@/lib/server-access";

export default async function PaymentsPage() {
  await requireAreaAccess("workspace");
  redirect("/residential?tab=weekly_payments");
}
