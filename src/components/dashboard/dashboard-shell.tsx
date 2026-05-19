"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Building2, Home, LineChart, LogOut, Search, Settings, Users, Wallet } from "lucide-react";
import { ThemeToggle } from "@/components/providers/theme-toggle";
import { Button } from "@/components/ui/button";
import { canAccessArea, normalizeAppRole, type AccessArea, type AppRole } from "@/lib/access-control";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Residential", href: "/dashboard", icon: Home, area: "residential" as AccessArea },
  { label: "Residential Payments", href: "/payments", icon: Wallet, area: "residential" as AccessArea },
  { label: "Commercial", href: "/commercial", icon: Building2, area: "commercial" as AccessArea },
  { label: "SEO", href: "/seo", icon: LineChart, area: "seo" as AccessArea },
  { label: "Staff", href: "/staff", icon: Users, area: "operations" as AccessArea },
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-border/70 bg-card/92 shadow-[18px_0_60px_-56px_hsl(215_40%_20%)] backdrop-blur-xl lg:block">
        <div className="flex h-20 items-center justify-center border-b border-border/70 px-5">
          <Link className="group flex min-w-0 items-center" href="/dashboard" aria-label="Pristine Cleaners operations">
            <Image
              src="/logo-full.png"
              alt="Pristine Cleaners"
              width={853}
              height={247}
              priority
              className="h-auto w-[184px] transition-transform duration-200 group-hover:-translate-y-0.5"
            />
          </Link>
        </div>
        <div className="px-4 py-4">
          <div className="flex items-center gap-2 rounded-md border border-border/80 bg-background/70 px-3 py-2 text-sm text-muted-foreground shadow-sm">
            <Search className="size-4" />
            <span>Operations workspace</span>
          </div>
        </div>
        <nav className="space-y-1 px-3">
          {visibleNavItems.map((item) => (
            <Link
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-all duration-200 hover:bg-accent/70 hover:text-accent-foreground",
                (pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`))) && "bg-primary text-primary-foreground shadow-[0_14px_28px_-22px_hsl(var(--primary))] hover:bg-primary hover:text-primary-foreground",
              )}
              href={item.href}
              key={item.href}
            >
              <item.icon className="size-4 transition-transform duration-200 group-hover:scale-105" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute inset-x-0 bottom-0 border-t border-border/70 p-4">
          <div className="rounded-lg border border-border/80 bg-background/65 p-3 shadow-sm">
            <p className="text-[11px] font-bold uppercase text-muted-foreground">Signed in</p>
            <p className="mt-1 truncate text-sm font-semibold">{userEmail ?? "Pristine Cleaners"}</p>
          </div>
        </div>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border/70 bg-background/78 px-4 backdrop-blur-xl sm:px-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-normal text-primary">Pristine Cleaners</p>
            <p className="text-sm font-semibold text-foreground">Operations command center</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action="/auth/sign-out" method="post">
              <Button variant="outline">
                <LogOut className="size-4" />
                Sign out
              </Button>
            </form>
          </div>
        </header>
        <main className="mx-auto max-w-[1480px] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
