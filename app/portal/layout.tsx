import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { requireUser } from "@/server/auth";
import { can } from "@/lib/permissions";
import { getAgencySettings } from "@/server/queries/settings";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { SessionTimeout } from "@/components/layout/session-timeout";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.portal !== "student") redirect("/dashboard");
  if (!can(user.permissions, "portal", "view")) redirect("/403");
  const agency = await getAgencySettings();
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
          <Link href="/portal" className="flex items-center gap-2 font-semibold"><GraduationCap className="h-5 w-5 text-primary" aria-hidden />{agency.name}</Link>
          <span className="hidden text-sm text-muted-foreground sm:inline">· Student portal</span>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu user={{ name: user.full_name, email: user.email, role: user.role_name }} accountHref="/portal/account" />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-5xl p-4">{children}</main>
      <SessionTimeout />
    </div>
  );
}
