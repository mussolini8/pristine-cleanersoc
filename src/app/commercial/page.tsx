import { redirect } from "next/navigation";
import { requireAreaAccess } from "@/lib/server-access";

export default async function CommercialRoute() {
  await requireAreaAccess("commercial");
  redirect("/dashboard?unit=commercial");
}
