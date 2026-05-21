import { redirect } from "next/navigation";

export default async function CommercialLayout({ children }: { children: React.ReactNode }) {
  void children;
  redirect("/dashboard");
}
