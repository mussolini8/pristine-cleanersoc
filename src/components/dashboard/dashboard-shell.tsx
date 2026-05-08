import Image from "next/image";
import Link from "next/link";
import { BarChart3, Building2, Home, Settings, Users, Wallet } from "lucide-react";
import { ThemeToggle } from "@/components/providers/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Overview", href: "/dashboard", icon: Home },
  { label: "Payments", href: "/payments", icon: Wallet },
  { label: "Commercial Accounts", href: "/commercial", icon: Building2 },
  { label: "Staff", href: "/staff", icon: Users },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function DashboardShell({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail?: string | null;
}) {
  return (
    <div className="min-h-dvh bg-muted/30">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-background lg:block">
        <div className="flex h-16 items-center justify-center border-b px-4">
          <Link className="group flex min-w-0 items-center" href="/dashboard" aria-label="Pristine Cleaners operations">
            <Image
              src="/logo-full.png"
              alt="Pristine Cleaners"
              width={853}
              height={247}
              priority
              className="h-auto w-[170px] transition-transform duration-200 group-hover:-translate-y-0.5"
            />
          </Link>
        </div>
        <nav className="space-y-1 p-3">
          {navItems.map((item) => (
            <Link
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
              )}
              href={item.href}
              key={item.href}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Operations</p>
            <p className="text-sm font-semibold">{userEmail ?? "Signed in"}</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action="/auth/sign-out" method="post">
              <Button variant="outline">Sign out</Button>
            </form>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
