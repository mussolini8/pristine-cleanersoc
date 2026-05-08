"use server";

import { redirect } from "next/navigation";
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
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { message: error.message };
  }

  redirect("/dashboard");
}
