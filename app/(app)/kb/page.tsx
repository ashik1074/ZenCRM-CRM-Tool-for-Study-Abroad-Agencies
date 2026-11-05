import { requirePagePermission } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { ilikeTerm, listParams, sp, type SearchParams } from "@/lib/url";
import { PageHeader } from "@/components/shared/page-header";
import { KbClient, type KbRow } from "./kb-client";

export const metadata = { title: "Info Center" };

export default async function KbPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePagePermission("kb");
  const supabase = createClient();
  const { page, size, q, from, to } = listParams(searchParams, { sort: "updated" });
  let query = supabase
    .from("kb_entries")
    .select("id, title, category, body_format, body_text, tags, updated_at, editor:profiles!kb_entries_updated_by_fkey(full_name)", { count: "exact" })
    .is("deleted_at", null);
  if (q) {
    // full-text (title, tags, body) OR substring on title for partial words
    const words = q.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean).map((w) => `${w}:*`).join(" & ");
    query = words ? query.or(`search.fts(simple).${words},title.ilike.${ilikeTerm(q)}`) : query.ilike("title", ilikeTerm(q));
  }
  if (sp(searchParams, "category")) query = query.eq("category", sp(searchParams, "category")!);
  const { data, count } = await query.order("updated_at", { ascending: false }).range(from, to);
  const { data: cats } = await supabase.from("kb_entries").select("category").is("deleted_at", null);
  return (
    <>
      <PageHeader title="Info Center" description="Checklists, templates, SOPs, FAQs and university notes." />
      <KbClient
        rows={(data ?? []) as unknown as KbRow[]}
        total={count ?? 0}
        page={page}
        size={size}
        categories={Array.from(new Set((cats ?? []).map((c: { category: string }) => c.category))).sort()}
        perms={{ create: can(user.permissions, "kb", "create"), edit: can(user.permissions, "kb", "edit"), delete: can(user.permissions, "kb", "delete") }}
        openId={sp(searchParams, "entry")}
      />
    </>
  );
}
