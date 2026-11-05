import { requirePagePermission } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { ilikeTerm, listParams, sp, type SearchParams } from "@/lib/url";
import { PageHeader } from "@/components/shared/page-header";
import { getLists } from "@/server/queries/settings";
import { OffersClient, type OfferRow } from "./offers-client";

export const metadata = { title: "University offers" };

const SORTS: Record<string, string> = { title: "title", deadline: "application_deadline", created: "created_at", intake: "intake" };

export default async function OffersPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePagePermission("offers");
  const supabase = createClient();
  await supabase.rpc("expire_offers"); // auto-mark past-deadline offers as Expired
  const { page, size, sort, dir, q, from, to } = listParams(searchParams, { sort: "deadline", dir: "asc" });

  const city = sp(searchParams, "city");
  let query = supabase
    .from("offers")
    .select(
      `id, title, program, degree_level, intake, scholarship_type, application_deadline, status, tuition_fee, fee_currency, created_at,
       university:universities!inner(id, name, city), leaflets:offer_attachments(count)`,
      { count: "exact" },
    )
    .is("deleted_at", null);
  if (q) {
    const t = ilikeTerm(q);
    const { data: unis } = await supabase.from("universities").select("id").ilike("name", t).limit(50);
    const ids = (unis ?? []).map((u: { id: string }) => u.id);
    query = query.or([`title.ilike.${t}`, `program.ilike.${t}`, ids.length ? `university_id.in.(${ids.join(",")})` : null].filter(Boolean).join(","));
  }
  if (sp(searchParams, "university")) query = query.eq("university_id", sp(searchParams, "university")!);
  if (city) query = query.eq("university.city", city);
  if (sp(searchParams, "degree")) query = query.eq("degree_level", sp(searchParams, "degree")!);
  if (sp(searchParams, "intake")) query = query.eq("intake", sp(searchParams, "intake")!);
  if (sp(searchParams, "scholarship")) query = query.eq("scholarship_type", sp(searchParams, "scholarship")!);
  const status = sp(searchParams, "status") ?? "open";
  if (status !== "all") query = query.eq("status", status);
  if (sp(searchParams, "from")) query = query.gte("application_deadline", sp(searchParams, "from")!);
  if (sp(searchParams, "to")) query = query.lte("application_deadline", sp(searchParams, "to")!);
  query = query.order(SORTS[sort] ?? "application_deadline", { ascending: dir === "asc", nullsFirst: false });
  const { data, count } = await query.range(from, to);

  const [{ data: universities }, lists] = await Promise.all([
    supabase.from("universities").select("id, name, city").is("deleted_at", null).order("name"),
    getLists(),
  ]);
  const unis = (universities ?? []) as { id: string; name: string; city: string | null }[];

  return (
    <>
      <PageHeader title="University offers" description="Programs and scholarships currently on offer. Click an offer name for full details and leaflets." />
      <OffersClient
        rows={(data ?? []) as unknown as OfferRow[]}
        total={count ?? 0}
        page={page}
        size={size}
        sort={sort}
        dir={dir}
        universities={unis}
        cities={Array.from(new Set(unis.map((u) => u.city).filter(Boolean) as string[])).sort()}
        intakes={lists.intakes}
        perms={{
          create: can(user.permissions, "offers", "create"),
          edit: can(user.permissions, "offers", "edit"),
          delete: can(user.permissions, "offers", "delete"),
          export: can(user.permissions, "offers", "export"),
        }}
        initialOfferId={sp(searchParams, "offer")}
        openNew={sp(searchParams, "new") === "1"}
      />
    </>
  );
}
