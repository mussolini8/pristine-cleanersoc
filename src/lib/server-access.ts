import { redirect } from "next/navigation";
import { canAccessArea, getDefaultPathForRole, normalizeAppRole, type AccessArea } from "@/lib/access-control";
import { createClient } from "@/lib/supabase/server";

export async function requireAreaAccess(area: AccessArea) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase.from("profiles").select("app_role").eq("id", user.id).maybeSingle();
  const role = normalizeAppRole(profile?.app_role);

  if (!canAccessArea(role, area)) {
    redirect(getDefaultPathForRole(role));
  }

  return { user, role };
}
