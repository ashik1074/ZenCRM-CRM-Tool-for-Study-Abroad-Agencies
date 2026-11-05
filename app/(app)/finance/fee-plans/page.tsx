import { requirePagePermission } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { listParams, sp, type SearchParams } from "@/lib/url";
import { todayDhaka } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import type { FeePlanRow } from "@/components/finance/fee-plan-card";
import { FeePlansClient } from "./fee-plans-client";

export const metadata = { title: "Student fee plans" };

export default async function FeePlansPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePagePermission("finance");
  const { page, size, from, to } = listParams(searchParams, { sort: "created" });
  const overdueOnly = sp(searchParams, "overdue") === "1";
  let q = createClient()
    .from("fee_plans")
    .select(
      `id, title, total_amount, currency, notes, student_id, created_at, student:students!inner(id, full_name),
       installments:fee_installments(id, label, due_date, amount, paid_amount, sort_order)${overdueOnly ? ", od:fee_installments!inner(id)" : ""}`,
      { count: "exact" },
    )
    .is("deleted_at", null)
    .is("installments.deleted_at", null)
    .is("student.deleted_at", null);
  if (overdueOnly) q = q.lt("od.due_date", todayDhaka()).eq("od.is_settled", false).is("od.deleted_at", null);
  if (sp(searchParams, "student")) q = q.eq("student_id", sp(searchParams, "student")!);
  const { data, count } = await q.order("created_at", { ascending: false }).range(from, to);
  return (
    <>
      <PageHeader title="Student fee plans" description="Agreed packages, installments, paid vs due." />
      <FeePlansClient
        plans={(data ?? []) as unknown as FeePlanRow[]}
        total={count ?? 0}
        page={page}
        size={size}
        studentFilter={sp(searchParams, "student") ?? ""}
        overdueOnly={overdueOnly}
        perms={{ create: can(user.permissions, "finance", "create"), edit: can(user.permissions, "finance", "edit"), delete: can(user.permissions, "finance", "delete") }}
      />
    </>
  );
}
