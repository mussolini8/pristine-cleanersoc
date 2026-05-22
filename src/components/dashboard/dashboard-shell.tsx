"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CheckSquare, Home, LogOut, Search, Settings, Users, Wallet } from "lucide-react";
import { ThemeToggle } from "@/components/providers/theme-toggle";
import { Button } from "@/components/ui/button";
import { canAccessArea, normalizeAppRole, type AccessArea, type AppRole } from "@/lib/access-control";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: Home, area: "workspace" as AccessArea },
  { label: "Task Reminders", href: "/tasks", icon: CheckSquare, area: "tasks" as AccessArea },
  { label: "Residential payments / commercial hours", href: "/residential", icon: Wallet, area: "workspace" as AccessArea },
  { label: "Staff / Teams", href: "/staff", icon: Users, area: "operations" as AccessArea },
  { label: "Reports", href: "/reports", icon: BarChart3, area: "operations" as AccessArea },
  { label: "Settings", href: "/settings", icon: Settings, area: "operations" as AccessArea },
];

export function DashboardShell({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail?: string | null;
}) {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [role, setRole] = useState<AppRole>("residential");

  useEffect(() => {
    let mounted = true;
    async function loadRole() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted || !user) return;
      const { data } = await supabase.from("profiles").select("app_role").eq("id", user.id).maybeSingle();
      if (mounted) setRole(normalizeAppRole(data?.app_role));
    }
    loadRole();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  const visibleNavItems = navItems.filter((item) => !item.area || canAccessArea(role, item.area));

  return (
    <div className="min-h-dvh bg-transparent">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[17rem] border-r border-border/70 bg-card/95 shadow-[18px_0_60px_-58px_hsl(215_40%_20%)] backdrop-blur-xl lg:block">
        <div className="flex h-[4.5rem] items-center justify-center border-b border-border/60 px-5">
          <Link className="group flex min-w-0 items-center" href="/dashboard" aria-label="Pristine Cleaners operations">
            <Image
              src="/logo-full.png"
              alt="Pristine Cleaners"
              width={853}
              height={247}
              priority
              className="h-auto w-[172px] transition-transform duration-200 group-hover:-translate-y-0.5"
            />
          </Link>
        </div>
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-sm font-medium text-muted-foreground shadow-sm">
            <Search className="size-4" />
            <span>Cleaning operations</span>
          </div>
        </div>
        <nav className="space-y-1 px-3">
          {visibleNavItems.map((item) => (
            <Link
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-all duration-200 hover:bg-accent/70 hover:text-accent-foreground",
                (pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`))) && "bg-primary/10 text-primary shadow-none ring-1 ring-primary/15 hover:bg-primary/15 hover:text-primary",
              )}
              href={item.href}
              key={item.href}
            >
              <item.icon className="size-4 transition-transform duration-200 group-hover:scale-105" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute inset-x-0 bottom-0 border-t border-border/60 p-4">
          <div className="rounded-xl border border-border/70 bg-background/65 p-3 shadow-sm">
            <p className="text-[11px] font-semibold text-muted-foreground">Signed in</p>
            <p className="mt-1 truncate text-sm font-semibold">{userEmail ?? "Pristine Cleaners"}</p>
          </div>
        </div>
      </aside>
      <div className="lg:pl-[17rem]">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <div>
            <p className="text-[11px] font-semibold text-primary">Pristine Cleaners</p>
            <p className="text-sm font-semibold text-foreground">Operations SOP</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action="/auth/sign-out" method="post">
              <Button className="h-9 rounded-md px-3 text-sm" variant="outline">
                <LogOut className="size-4" />
                Sign out
              </Button>
            </form>
          </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto border-t border-border/50 px-4 py-2 lg:hidden" aria-label="SOP navigation">
            {visibleNavItems.map((item) => (
              <Link
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-border/70 bg-card/80 px-3 text-xs font-semibold text-muted-foreground",
                  (pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`))) && "border-primary/20 bg-primary/10 text-primary",
                )}
                href={item.href}
                key={item.href}
              >
                <item.icon className="size-3.5" />
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-[1480px] p-4 sm:p-6 lg:p-7">{children}</main>
      </div>
    </div>
  );
}
