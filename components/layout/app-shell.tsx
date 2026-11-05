"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3, BookOpen, Circle, FileBadge, GraduationCap, History, Landmark, LayoutDashboard, ListTodo, Menu, PieChart,
  Settings, ShieldCheck, Sparkles, Trash2, Upload, Users, Wallet, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  BarChart3, BookOpen, FileBadge, GraduationCap, History, Landmark, LayoutDashboard, ListTodo, PieChart, Settings,
  ShieldCheck, Sparkles, Trash2, Upload, Users, Wallet,
};
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { UserMenu } from "./user-menu";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "./notification-bell";
import { GlobalSearch } from "./global-search";
import { SessionTimeout } from "./session-timeout";
import { AddTransactionButton } from "@/components/finance/add-transaction-button";
import { AssistantFab } from "@/components/assistant/assistant-fab";

type NavLink = { href: string; label: string; icon: string; group: "main" | "manage" | "admin" };

const GROUP_LABEL = { main: null, manage: "Manage", admin: "System administration" } as const;

function NavList({ nav, onNavigate }: { nav: NavLink[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  // most specific match wins so /reports/finance doesn't also highlight /reports
  const active = nav
    .filter((n) => pathname === n.href || pathname.startsWith(n.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav aria-label="Main" className="flex flex-col gap-4 px-3 py-4">
      {(["main", "manage", "admin"] as const).map((g) => {
        const items = nav.filter((n) => n.group === g);
        if (!items.length) return null;
        return (
          <div key={g} className="space-y-1">
            {GROUP_LABEL[g] && <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{GROUP_LABEL[g]}</p>}
            {items.map((n) => {
              const Icon = ICONS[n.icon] ?? Circle;
              const isActive = active === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {n.label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

export function AppShell({
  children,
  nav,
  user,
  agencyName,
  flags,
}: {
  children: React.ReactNode;
  nav: NavLink[];
  user: { id: string; name: string; email: string; role: string };
  agencyName: string;
  flags: { finance: boolean; assistant: boolean };
}) {
  const [open, setOpen] = useState(false);
  const brand = (
    <Link href="/dashboard" className="flex items-center gap-2 px-6 font-semibold">
      <GraduationCap className="h-5 w-5 text-primary" aria-hidden />
      <span className="truncate">{agencyName}</span>
    </Link>
  );
  return (
    <div className="min-h-screen bg-muted/30">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-background focus:p-2">
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-background lg:flex">
        <div className="flex h-14 items-center border-b">{brand}</div>
        <div className="flex-1 overflow-y-auto">
          <NavList nav={nav} />
        </div>
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="flex h-14 items-center border-b">{brand}</SheetTitle>
          <NavList nav={nav} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu />
          </Button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-1">
            {flags.finance && <AddTransactionButton />}
            <NotificationBell />
            <ThemeToggle />
            <UserMenu user={user} />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1600px] p-3 sm:p-6">
          {children}
        </main>
      </div>
      {flags.assistant && <AssistantFab />}
      <SessionTimeout />
    </div>
  );
}
