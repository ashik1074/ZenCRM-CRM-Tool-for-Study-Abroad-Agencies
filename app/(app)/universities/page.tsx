import { requirePagePermission } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { ilikeTerm, listParams, sp, type SearchParams } from "@/lib/url";
import { PageHeader } from "@/components/shared/page-header";
import { UniversitiesClient, type UniversityRow } from "./universities-client";

export const metadata = { title: "Universities" };

const SORTS: Record<string, string> = { name: "name", city: "city", ranking: "ranking" };

export default async function UniversitiesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePagePermission("universities");
  const supabase = createClient();
  const { page, size, sort, dir, q, from, to } = listParams(searchParams, { sort: "name", dir: "asc" });
  let query = supabase
    .from("universities")
    .select("id, name, city, province, ranking, website, contact_person, email, phone, notes, is_active, offers(count), applications(count)", { count: "exact" })
    .is("deleted_at", null);
  if (q) {
    const t = ilikeTerm(q);
    query = query.or(`name.ilike.${t},city.ilike.${t},province.ilike.${t},contact_person.ilike.${t}`);
  }
  if (sp(searchParams, "city")) query = query.eq("city", sp(searchParams, "city")!);
  const active = sp(searchParams, "active");
  if (active === "yes") query = query.eq("is_active", true);
  if (active === "no") query = query.eq("is_active", false);
  const { data, count } = await query.order(SORTS[sort] ?? "name", { ascending: dir === "asc", nullsFirst: false }).range(from, to);
  const { data: cities } = await supabase.from("universities").select("city").is("deleted_at", null);

  return (
    <>
      <PageHeader title="Universities" description="Partner universities in China." />
      <UniversitiesClient
        rows={(data ?? []) as unknown as UniversityRow[]}
        total={count ?? 0}
        page={page}
        size={size}
        sort={sort}
        dir={dir}
        cities={Array.from(new Set((cities ?? []).map((c: { city: string | null }) => c.city).filter(Boolean) as string[])).sort()}
        perms={{ create: can(user.permissions, "universities", "create"), edit: can(user.permissions, "universities", "edit"), delete: can(user.permissions, "universities", "delete") }}
        openId={sp(searchParams, "university")}
      />
    </>
  );
}
