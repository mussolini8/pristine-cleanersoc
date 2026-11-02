"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { signIn } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageToggle, useLanguage } from "@/components/providers/language-provider";

const AUTH_ERROR_ES: Record<string, string> = {
  "Enter your username or email": "Ingresa tu usuario o correo electrónico",
  "Password must be at least 6 characters": "La contraseña debe tener al menos 6 caracteres",
  "Invalid login credentials": "Credenciales de acceso inválidas",
  "Email not confirmed": "Correo electrónico no confirmado",
};

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, {});
  const { isEn } = useLanguage();
  const translateAuthError = (msg: string) => (isEn ? msg : AUTH_ERROR_ES[msg] || msg);

  return (
    <main className="grid min-h-dvh place-items-center bg-[linear-gradient(180deg,#f8faf9,#edf3ef)] px-4 py-8 pt-[calc(2rem+env(safe-area-inset-top,0px))] pb-[calc(2rem+env(safe-area-inset-bottom,0px))] text-[#0f172a]">
      <section className="w-full max-w-[420px] rounded-lg border border-white/80 bg-white/95 p-7 shadow-[0_22px_70px_-48px_rgba(15,23,42,0.58)] backdrop-blur">
        <div className="mb-4 flex justify-end">
          <LanguageToggle />
        </div>
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            alt="Pristine Cleaners"
            className="h-auto w-[210px]"
            height={247}
            priority
            src="/logo-full.png"
            width={853}
          />
          <h1 className="mt-7 text-2xl font-semibold tracking-normal text-[#0f172a]">
            {isEn ? "Operations access" : "Acceso a operaciones"}
          </h1>
          <p className="mt-2 text-sm font-medium text-[#64748b]">
            {isEn ? "Pristine Cleaners SOP" : "SOP de Pristine Cleaners"}
          </p>
        </div>

        <form action={action} className="grid gap-5">
          <div className="grid gap-2">
            <Label className="text-[13px] font-semibold text-[#334155]" htmlFor="email">
              {isEn ? "Username or email" : "Usuario o correo electrónico"}
            </Label>
            <Input
              autoComplete="username"
              className="h-11 rounded-lg border-[#dbe3ea] bg-[#f8fafc] px-4 text-[15px] font-medium text-[#0f172a]"
              defaultValue="pristinecleaners"
              id="email"
              name="email"
              type="text"
            />
            {state.errors?.email?.map((error) => (
              <p className="text-sm font-semibold text-destructive" key={error}>
                {translateAuthError(error)}
              </p>
            ))}
          </div>

          <div className="grid gap-2">
            <Label className="text-[13px] font-semibold text-[#334155]" htmlFor="password">
              {isEn ? "Password" : "Contraseña"}
            </Label>
            <Input
              autoComplete="current-password"
              className="h-11 rounded-lg border-[#dbe3ea] bg-[#f8fafc] px-4 text-[15px] font-medium text-[#0f172a]"
              id="password"
              name="password"
              placeholder="000000"
              type="password"
            />
            {state.errors?.password?.map((error) => (
              <p className="text-sm font-semibold text-destructive" key={error}>
                {translateAuthError(error)}
              </p>
            ))}
          </div>

          {state.message ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {translateAuthError(state.message)}
            </p>
          ) : null}

          <Button
            className="h-11 rounded-lg bg-[#3f765f] text-[15px] font-semibold text-white shadow-[0_12px_28px_-18px_rgba(67,125,101,0.9)] hover:bg-[#356351]"
            disabled={pending}
            type="submit"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
            {isEn ? "Sign in" : "Iniciar sesión"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm font-medium text-[#64748b]">
          {isEn ? "Need a login?" : "¿Necesitas acceso?"}{" "}
          <Link className="font-semibold text-[#3f765f] hover:text-[#356351]" href="/signup">
            {isEn ? "Create account" : "Crear cuenta"}
          </Link>
        </p>
      </section>
    </main>
  );
}
