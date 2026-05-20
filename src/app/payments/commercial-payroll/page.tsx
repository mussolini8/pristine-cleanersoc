import { redirect } from "next/navigation";

export default function LegacyCommercialPayrollRoute() {
  redirect("/payments?unit=commercial");
}
