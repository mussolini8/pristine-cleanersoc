import { redirect } from "next/navigation";

export default async function LegacyCommercialPayrollPeriodRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/commercial/payroll/${id}`);
}
