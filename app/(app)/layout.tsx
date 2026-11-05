import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth";
import { NAV } from "@/lib/nav";
import { can } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { getAgencySettings } from "@/server/queries/settings";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.portal === "student") redirect("/portal");

  // Filter on the server so items the role can't access never reach the browser.
  const nav = NAV.filter((n) => (n.systemAdminOnly ? user.role_key === "system_admin" : can(user.permissions, n.module, n.action ?? "view"))).map(
    ({ href, label, icon, group }) => ({ href, label, icon, group }),
  );
  const agency = await getAgencySettings();

  return (
    <AppShell
      nav={nav}
      agencyName={agency.name}
      user={{ id: user.id, name: user.full_name, email: user.email, role: user.role_name }}
      flags={{
        finance: can(user.permissions, "finance", "create"),
        assistant: can(user.permissions, "assistant", "view"),
      }}
    >
      {children}
    </AppShell>
  );
}
