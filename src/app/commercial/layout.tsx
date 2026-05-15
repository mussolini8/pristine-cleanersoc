import { requireAreaAccess } from "@/lib/server-access";

export default async function CommercialLayout({ children }: { children: React.ReactNode }) {
  await requireAreaAccess("commercial");
  return children;
}
