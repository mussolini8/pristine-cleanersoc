import { redirect } from "next/navigation";

export default async function LegacyCommercialPayrollPeriodRoute({ params }: { params: Promise<{ id: string }> }) {
  void await params;
  redirect("/dashboard");
}
