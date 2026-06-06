"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Building2, CheckSquare, Home, LogOut, Settings, Sparkles, Users, Wallet } from "lucide-react";
import { ThemeToggle } from "@/components/providers/theme-toggle";
import { Button } from "@/components/ui/button";
import { canAccessArea, normalizeAppRole, type AccessArea, type AppRole } from "@/lib/access-control";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: Home, area: "workspace" as AccessArea },
  { label: "Task Reminders", href: "/tasks", icon: CheckSquare, area: "tasks" as AccessArea },
  { label: "Residential payments / commercial hours", href: "/residential", icon: Wallet, area: "workspace" as AccessArea },
  { label: "Commercial Accounts", href: "/commercial/accounts", icon: Building2, area: "workspace" as AccessArea },
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[16rem] border-r border-border/70 bg-card/96 shadow-[18px_0_60px_-58px_hsl(215_40%_20%)] backdrop-blur-xl lg:block">
        <div className="flex h-[4.25rem] items-center justify-center border-b border-border/60 px-5">
          <Link className="group flex min-w-0 items-center" href="/dashboard" aria-label="Pristine Cleaners operations">
            <Image
              src="/logo-full.png"
              alt="Pristine Cleaners"
              width={853}
              height={247}
              priority
              className="h-auto w-[164px] transition-transform duration-200 group-hover:-translate-y-0.5"
            />
          </Link>
        </div>
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 rounded-xl border border-primary/10 bg-primary/[0.06] px-3 py-2 text-xs font-semibold text-primary shadow-sm">
            <Sparkles className="size-[18px]" />
            <span>Premium cleaning SOP</span>
          </div>
        </div>
        <nav className="space-y-1 px-3">
          {visibleNavItems.map((item) => (
            <Link
              className={cn(
                "group flex min-h-10 items-center gap-3 py-2 text-sm font-semibold transition-all duration-150",
                (pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`)))
                  ? "bg-primary/5 text-primary border-l-2 border-primary pl-2.5 pr-3 rounded-r-xl rounded-l-none font-semibold hover:bg-primary/10"
                  : "rounded-xl pl-3 pr-3 text-muted-foreground hover:bg-accent/55 hover:text-accent-foreground"
              )}
              href={item.href}
              key={item.href}
            >
              <item.icon className={cn(
                "size-[18px] transition-transform duration-200 group-hover:scale-105",
                (pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`))) ? "text-primary" : "text-muted-foreground/80 group-hover:text-foreground"
              )} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute inset-x-0 bottom-0 border-t border-border/60 p-4">
          <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/65 p-3 shadow-sm">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
              {(userEmail ?? "PC").substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Signed in</p>
              <p className="truncate text-xs font-semibold text-foreground">{userEmail ?? "Pristine Cleaners"}</p>
            </div>
          </div>
        </div>
      </aside>
      <div className="lg:pl-[16rem]">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur-xl">
          <div className="flex h-[3.75rem] items-center justify-between px-4 sm:px-6">
          <div className="lg:hidden">
            <p className="text-[11px] font-semibold text-primary">Pristine Cleaners</p>
            <p className="text-sm font-semibold text-foreground">Operations SOP</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action="/auth/sign-out" method="post">
              <Button variant="outline" size="sm">
                <LogOut />
                Sign out
              </Button>
            </form>
          </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto border-t border-border/50 px-4 py-2 lg:hidden" aria-label="SOP navigation">
            {visibleNavItems.map((item) => (
              <Link
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-xs font-semibold transition-all duration-150",
                  (pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`)))
                    ? "border-primary/30 bg-primary/[0.06] text-primary shadow-sm"
                    : "border-border/60 bg-card/85 text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                )}
                href={item.href}
                key={item.href}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
