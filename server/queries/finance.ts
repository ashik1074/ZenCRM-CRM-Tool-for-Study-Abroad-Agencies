import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ilikeTerm, listParams, sp, type SearchParams } from "@/lib/url";

const SORTS: Record<string, string> = { date: "txn_date", amount: "amount_bdt", created: "created_at" };

export function transactionsQuery(params: SearchParams, select: string, count = false) {
  const { q, sort, dir } = listParams(params, { sort: "date" });
  let query = createClient().from("transactions").select(select, count ? { count: "exact" } : undefined).is("deleted_at", null);
  if (sp(params, "type")) query = query.eq("type", sp(params, "type")!);
  if (sp(params, "category")) query = query.eq("category_id", sp(params, "category")!);
  if (sp(params, "student")) query = query.eq("student_id", sp(params, "student")!);
  if (sp(params, "method")) query = query.eq("payment_method", sp(params, "method")!);
  if (sp(params, "from")) query = query.gte("txn_date", sp(params, "from")!);
  if (sp(params, "to")) query = query.lte("txn_date", sp(params, "to")!);
  if (q) {
    const t = ilikeTerm(q);
    query = query.or(`reference_no.ilike.${t},vendor.ilike.${t},note.ilike.${t},receipt_no.ilike.${t}`);
  }
  return query.order(SORTS[sort] ?? "txn_date", { ascending: dir === "asc" }).order("created_at", { ascending: false });
}
