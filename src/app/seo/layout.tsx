import { requireAreaAccess } from "@/lib/server-access";

export default async function SeoLayout({ children }: { children: React.ReactNode }) {
  await requireAreaAccess("seo");
  return children;
}
