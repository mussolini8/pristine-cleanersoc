"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, Home, LogOut, User } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { LanguageToggle, useLanguage } from "@/components/providers/language-provider";
import { ThemeToggle } from "@/components/providers/theme-toggle";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/access-control";

export function QCShell({ children, role }: { children: React.ReactNode; role: AppRole }) {
  const pathname = usePathname();
  const { isEn } = useLanguage();

  const inspectorNav = [
    { label: isEn ? "Today" : "Hoy", href: "/qc/inspector", icon: Home },
    { label: isEn ? "Profile" : "Perfil", href: "/qc/inspector/profile", icon: User },
  ];

  if (role === "inspector") {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b border-border/60 bg-background/90 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-xl sm:px-4">
          <div className="flex min-w-0 items-center gap-1.5">
            <ClipboardCheck className="size-5 shrink-0 text-primary" />
            <span className="truncate text-sm font-bold text-foreground">
              {isEn ? "Pristine QC" : "Control QC"}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <LanguageToggle className="origin-right scale-95 sm:scale-100" />
            <ThemeToggle />
            <form action="/auth/sign-out" method="post">
              <button
                type="submit"
                aria-label={isEn ? "Sign out" : "Cerrar sesión"}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-border/60 bg-card px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground sm:px-3"
              >
                <LogOut className="size-3.5 shrink-0" />
                <span>{isEn ? "Sign out" : "Cerrar sesión"}</span>
              </button>
            </form>
          </div>
        </header>

        {/* Main scrollable content */}
        <main className="flex-1 overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-2xl w-full px-4 md:px-0">
            {children}
          </div>
        </main>

        {/* Bottom nav bar — mobile ergonomic, thumb-friendly */}
        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
          {inspectorNav.map((item) => {
            const active =
              item.href === "/qc/inspector"
                ? pathname === "/qc/inspector"
                : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-3 text-[10px] font-semibold transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <item.icon
                  className={cn("size-5", active && "text-primary")}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    );
  }

  // For admin / owner / operations_manager: reuse the existing DashboardShell.
  // The QC route will be accessible via /qc — role-based nav filtering is
  // handled inside DashboardShell already.
  return <DashboardShell>{children}</DashboardShell>;
}
