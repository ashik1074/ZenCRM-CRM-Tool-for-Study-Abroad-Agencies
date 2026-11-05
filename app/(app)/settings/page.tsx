import { requirePagePermission } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { getSettings } from "@/server/queries/settings";
import { getSignedUrls } from "@/server/actions/files";
import { SettingsClient } from "./settings-client";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requirePagePermission("settings");
  const [settings, { data: rates }] = await Promise.all([
    getSettings(),
    createClient().from("exchange_rates").select("id, currency, rate_to_bdt, effective_date").is("deleted_at", null).order("effective_date", { ascending: false }).limit(30),
  ]);
  const agency = (settings.agency ?? { name: "" }) as { name: string; phone?: string; email?: string; address?: string; logo_path?: string | null };
  const logoUrl = agency.logo_path ? (await getSignedUrls("kb-attachments", [agency.logo_path]))[agency.logo_path] ?? null : null;
  return (
    <>
      <PageHeader title="Settings" description="Agency details, currency & exchange rates, and the lists used across the app." />
      <SettingsClient
        canEdit={can(user.permissions, "settings", "edit")}
        agency={agency}
        logoUrl={logoUrl}
        defaultCurrency={(settings.default_currency as string) ?? "BDT"}
        lists={{
          intakes: (settings.intakes as string[]) ?? [],
          lead_sources: (settings.lead_sources as string[]) ?? [],
          document_categories: (settings.document_categories as string[]) ?? [],
          required_documents: (settings.required_documents as string[]) ?? [],
        }}
        rates={(rates ?? []) as { id: string; currency: string; rate_to_bdt: number; effective_date: string }[]}
      />
    </>
  );
}
