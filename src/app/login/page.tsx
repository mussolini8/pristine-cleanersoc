"use client";

import Image from "next/image";
import { useActionState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { signIn } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const accessEmail = "pristinecleanersoc@gmail.com";

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, {});

  return (
    <main className="grid min-h-dvh place-items-center bg-[radial-gradient(circle_at_top_left,rgba(67,125,101,0.13),transparent_34rem),linear-gradient(180deg,#f8fafc,#eef3f1)] px-4 py-10 text-[#0f172a]">
      <section className="w-full max-w-[420px] rounded-lg border border-white/80 bg-white/92 p-8 shadow-[0_26px_80px_-46px_rgba(15,23,42,0.58)] backdrop-blur">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            alt="Pristine Cleaners"
            className="h-auto w-[210px]"
            height={247}
            priority
            src="/logo-full.png"
            width={853}
          />
          <h1 className="mt-7 text-3xl font-extrabold tracking-normal text-[#0f172a]">
            Panel de acceso
          </h1>
          <p className="mt-2 text-sm font-medium text-[#64748b]">
            Pristine Cleaners Operations
          </p>
        </div>

        <form action={action} className="grid gap-5">
          <div className="grid gap-2">
            <Label className="text-[13px] font-bold text-[#334155]" htmlFor="email">
              Correo
            </Label>
            <Input
              autoComplete="email"
              className="h-12 rounded-md border-[#dbe3ea] bg-[#f8fafc] px-4 text-[15px] font-semibold text-[#0f172a]"
              defaultValue={accessEmail}
              id="email"
              name="email"
              type="email"
            />
            {state.errors?.email?.map((error) => (
              <p className="text-sm font-semibold text-destructive" key={error}>
                {error}
              </p>
            ))}
          </div>

          <div className="grid gap-2">
            <Label className="text-[13px] font-bold text-[#334155]" htmlFor="password">
              Contraseña
            </Label>
            <Input
              autoComplete="current-password"
              className="h-12 rounded-md border-[#dbe3ea] bg-[#f8fafc] px-4 text-[15px] font-semibold text-[#0f172a]"
              id="password"
              name="password"
              placeholder="000000"
              type="password"
            />
            {state.errors?.password?.map((error) => (
              <p className="text-sm font-semibold text-destructive" key={error}>
                {error}
              </p>
            ))}
          </div>

          {state.message ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {state.message}
            </p>
          ) : null}

          <Button
            className="h-12 rounded-md bg-[#437d65] text-[15px] font-bold text-white shadow-[0_12px_28px_-14px_rgba(67,125,101,0.9)] hover:bg-[#356351]"
            disabled={pending}
            type="submit"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
            Acceder
          </Button>
        </form>
      </section>
    </main>
  );
}
