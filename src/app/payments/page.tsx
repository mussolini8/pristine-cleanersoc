import PaymentsClient from "./payments-client";
import { requireAreaAccess } from "@/lib/server-access";

export default async function PaymentsPage() {
  await requireAreaAccess("residential");
  return <PaymentsClient />;
}
