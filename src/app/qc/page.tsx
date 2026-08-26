import { redirect } from "next/navigation";
import { requireAreaAccess } from "@/lib/server-access";

export default async function QCPage() {
  const { role } = await requireAreaAccess("qc");
  if (role === "inspector") redirect("/qc/inspector");
  redirect("/qc/dashboard");
}
