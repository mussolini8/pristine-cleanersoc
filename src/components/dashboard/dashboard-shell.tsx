"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, Building2, CheckSquare, ClipboardCheck, FileSpreadsheet, Home, LogOut, Settings, Sparkles, TrendingUp, Users, Wallet, PanelLeft, PanelLeftClose } from "lucide-react";
import { ThemeToggle } from "@/components/providers/theme-toggle";
import { Button } from "@/components/ui/button";
import { canAccessArea, normalizeAppRole, type AccessArea, type AppRole } from "@/lib/access-control";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { GlobalAiBubble } from "@/components/ai/global-ai-bubble";
import { BookingKoalaImporterModal } from "@/components/operations/bookingkoala-importer-modal";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: Home, area: "workspace" as AccessArea },
  { label: "Sales Track & AI Copilot", href: "/commercial/sales-track", icon: TrendingUp, area: "workspace" as AccessArea },
  { label: "Task Reminders", href: "/tasks", icon: CheckSquare, area: "tasks" as AccessArea },
  { label: "Residential payments / commercial hours", href: "/residential", icon: Wallet, area: "workspace" as AccessArea },
  { label: "Schedules (Comm & QC)", href: "/schedules", icon: CalendarDays, area: "workspace" as AccessArea },
  
  
  

  { label: "Commercial Accounts", href: "/commercial/accounts", icon: Building2, area: "workspace" as AccessArea },
  { label: "QC Inspections", href: "/qc/dashboard", icon: ClipboardCheck, area: "workspace" as AccessArea },
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
  const [isKoalaOpen, setIsKoalaOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    // Restore sidebar state from localStorage
    try {
      const saved = localStorage.getItem("pristine_sidebar_collapsed");
      if (saved === "true") setSidebarCollapsed(true);
    } catch {}
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem("pristine_sidebar_collapsed", String(next)); } catch {}
      return next;
    });
  }

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
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r border-border/70 bg-card/96 shadow-[18px_0_60px_-58px_hsl(215_40%_20%)] backdrop-blur-xl lg:flex lg:flex-col transition-[width,transform] duration-300 ease-in-out overflow-hidden",
          sidebarCollapsed ? "w-0 border-r-0" : "w-[16rem]"
        )}
      >
        {/* Logo */}
        <div className="flex h-[4.25rem] shrink-0 items-center justify-between border-b border-border/60 px-5">
          <Link className="group flex min-w-0 items-center" href="/dashboard" aria-label="Pristine Cleaners operations">
            <Image
              src="/logo-full.png"
              alt="Pristine Cleaners"
              width={853}
              height={247}
              priority
              className="h-auto w-[148px] transition-transform duration-200 group-hover:-translate-y-0.5"
            />
          </Link>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Collapse sidebar"
            className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all"
          >
            <PanelLeftClose size={15} />
          </button>
        </div>
        {/* Promo pills */}
        <div className="px-4 py-3 space-y-2 shrink-0">
          <div className="flex items-center gap-2 rounded-xl border border-primary/10 bg-primary/[0.06] px-3 py-2 text-xs font-semibold text-primary shadow-sm">
            <Sparkles className="size-[18px] shrink-0" />
            <span className="truncate">Premium cleaning SOP</span>
          </div>
          <button
            type="button"
            onClick={() => setIsKoalaOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/15 transition-all shadow-xs"
          >
            <FileSpreadsheet className="size-4 shrink-0" />
            <span className="truncate">Importar BookingKoala</span>
          </button>
        </div>
        {/* Nav */}
        <nav className="flex-1 overflow-y-auto space-y-1 px-3 pb-4">
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
                "size-[18px] shrink-0 transition-transform duration-200 group-hover:scale-105",
                (pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`))) ? "text-primary" : "text-muted-foreground/80 group-hover:text-foreground"
              )} />
              {item.label}
            </Link>
          ))}
        </nav>
        {/* User footer */}
        <div className="shrink-0 border-t border-border/60 p-4">
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

      {/* Main content area */}
      <div className={cn("transition-[padding-left] duration-300 ease-in-out", sidebarCollapsed ? "lg:pl-0" : "lg:pl-[16rem]")}>
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur-xl">
          <div className="flex h-[3.75rem] items-center justify-between px-4 sm:px-6">
            {/* Mobile branding */}
            <div className="lg:hidden">
              <p className="text-[11px] font-semibold text-primary">Pristine Cleaners</p>
              <p className="text-sm font-semibold text-foreground">Operations SOP</p>
            </div>
            {/* Desktop: sidebar toggle */}
            <div className="hidden lg:flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 border border-border/60 transition-all"
              >
                {sidebarCollapsed ? <PanelLeft size={15} /> : <PanelLeftClose size={15} />}
              </button>
            </div>
            {/* Right actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsKoalaOpen(true)}
                className="gap-2 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 font-bold"
              >
                <FileSpreadsheet className="size-4" />
                <span className="hidden sm:inline">Importar BookingKoala</span>
              </Button>
              <ThemeToggle />
              <form action="/auth/sign-out" method="post">
                <Button variant="outline" size="sm">
                  <LogOut />
                  Sign out
                </Button>
              </form>
            </div>
          </div>
          {/* Mobile nav */}
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
        <main className={cn("mx-auto p-4 sm:p-6 lg:p-8 transition-[max-width] duration-300", sidebarCollapsed ? "max-w-[1900px]" : "max-w-[1500px]")}>{children}</main>
      </div>

      {/* BookingKoala Smart Importer Modal */}
      <BookingKoalaImporterModal
        isOpen={isKoalaOpen}
        onClose={() => setIsKoalaOpen(false)}
        onSuccess={() => {
          // optionally refresh page or show feedback
        }}
      />

      {/* Global AI Copilot Floating Bubble */}
      <GlobalAiBubble />
    </div>
  );
}
