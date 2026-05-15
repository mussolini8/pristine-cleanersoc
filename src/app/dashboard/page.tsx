import DashboardClient from "./dashboard-client";
import { requireAreaAccess } from "@/lib/server-access";

export default async function DashboardPage() {
  await requireAreaAccess("residential");
  return <DashboardClient />;
}
