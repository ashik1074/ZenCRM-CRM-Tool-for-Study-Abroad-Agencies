import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_DOC_CATEGORIES, DEFAULT_LEAD_SOURCES } from "@/lib/constants";

export type AgencySettings = { name: string; logo_path: string | null; phone?: string; email?: string; address?: string };

export const getSettings = cache(async () => {
  const supabase = createClient();
  const { data } = await supabase.from("settings").select("key, value");
  const map = Object.fromEntries((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
  return map as Record<string, unknown>;
});

export async function getAgencySettings(): Promise<AgencySettings> {
  const s = await getSettings();
  return (s.agency as AgencySettings) ?? { name: "ZenCRM", logo_path: null };
}

export async function getLists() {
  const s = await getSettings();
  return {
    intakes: (s.intakes as string[]) ?? [],
    leadSources: (s.lead_sources as string[]) ?? DEFAULT_LEAD_SOURCES,
    documentCategories: (s.document_categories as string[]) ?? DEFAULT_DOC_CATEGORIES,
    requiredDocuments: (s.required_documents as string[]) ?? [],
    defaultCurrency: ((s.default_currency as string) ?? "BDT") as "BDT" | "CNY" | "USD",
  };
}
