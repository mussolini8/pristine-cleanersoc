import { redirect } from "next/navigation";
import { requireAreaAccess } from "@/lib/server-access";

export default async function CalendarPage() {
  await requireAreaAccess("workspace");
  redirect("/tasks");
}
