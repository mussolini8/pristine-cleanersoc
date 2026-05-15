"use server";

import { redirect } from "next/navigation";
import { getDefaultPathForRole, normalizeAppRole, resolveLoginEmail } from "@/lib/access-control";
import { createClient } from "@/lib/supabase/server";
import { type AuthFormState, signInSchema } from "@/lib/validations/auth";

export async function signIn(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: resolveLoginEmail(parsed.data.email),
    password: parsed.data.password,
  });

  if (error) {
    return { message: error.message };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("app_role").eq("id", user.id).maybeSingle()
    : { data: null };

  redirect(getDefaultPathForRole(normalizeAppRole(profile?.app_role)));
}
