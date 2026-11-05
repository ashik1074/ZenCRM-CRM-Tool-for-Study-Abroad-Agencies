import { requirePagePermission } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { listParams, sp, type SearchParams } from "@/lib/url";
import { PageHeader } from "@/components/shared/page-header";
import { getStaffOptions } from "@/server/queries/students";
import { AuditClient, type AuditRow } from "./audit-client";

export const metadata = { title: "Audit log" };

const AUDIT_TABLES = ["students", "student_education", "student_work_experience", "student_family_members", "student_travel_history", "student_documents", "student_notes", "applications", "offers", "universities", "tasks", "sprints", "transactions", "fee_plans", "fee_installments", "transaction_categories", "exchange_rates", "kb_entries", "profiles", "roles"];

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePagePermission("audit");
  const { page, size, from, to } = listParams(searchParams, { sort: "created" });
  let q = createClient()
    .from("audit_logs")
    .select("id, table_name, record_id, action, old_data, new_data, changed_fields, created_at, actor:profiles!audit_logs_actor_id_fkey(full_name)", { count: "exact" });
  if (sp(searchParams, "table")) q = q.eq("table_name", sp(searchParams, "table")!);
  if (sp(searchParams, "actor")) q = q.eq("actor_id", sp(searchParams, "actor")!);
  if (sp(searchParams, "action")) q = q.eq("action", sp(searchParams, "action")!);
  if (sp(searchParams, "record")) q = q.eq("record_id", sp(searchParams, "record")!);
  if (sp(searchParams, "from")) q = q.gte("created_at", `${sp(searchParams, "from")}T00:00:00+06:00`);
  if (sp(searchParams, "to")) q = q.lte("created_at", `${sp(searchParams, "to")}T23:59:59.999+06:00`);
  const { data, count } = await q.order("created_at", { ascending: false }).range(from, to);
  const users = await getStaffOptions();
  return (
    <>
      <PageHeader title="Audit log" description="Who changed what and when. Field-level old → new values are kept for every change." />
      <AuditClient rows={(data ?? []) as unknown as AuditRow[]} total={count ?? 0} page={page} size={size} users={users} tables={AUDIT_TABLES} />
    </>
  );
}
