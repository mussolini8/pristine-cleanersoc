import { redirect } from "next/navigation";
import { requireAreaAccess } from "@/lib/server-access";

export default async function TaskDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  await requireAreaAccess("tasks");
  const { id } = await params;
  redirect(`/tasks?task=${encodeURIComponent(id)}`);
}
