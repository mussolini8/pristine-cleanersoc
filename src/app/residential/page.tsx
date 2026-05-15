import { redirect } from "next/navigation";
import { requireAreaAccess } from "@/lib/server-access";

export default async function ResidentialRoute() {
  await requireAreaAccess("residential");
  redirect("/dashboard");
}
