import { redirect } from "next/navigation";
import { requireAreaAccess } from "@/lib/server-access";

export default async function CommercialPayrollRoute() {
  await requireAreaAccess("commercial");
  redirect("/payments?unit=commercial");
}
