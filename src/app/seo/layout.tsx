import { redirect } from "next/navigation";

export default async function SeoLayout({ children }: { children: React.ReactNode }) {
  void children;
  redirect("/dashboard");
}
