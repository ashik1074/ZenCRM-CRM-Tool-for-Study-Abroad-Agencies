import { requirePagePermission } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { listParams, sp, type SearchParams } from "@/lib/url";
import { PageHeader } from "@/components/shared/page-header";
import { transactionsQuery } from "@/server/queries/finance";
import { TransactionsClient, type TxnRow } from "./transactions-client";

export const metadata = { title: "Transactions" };

export default async function TransactionsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePagePermission("finance");
  const { page, size, sort, dir, from, to } = listParams(searchParams, { sort: "date" });
  const { data, count } = await transactionsQuery(
    searchParams,
    `id, type, txn_date, amount, currency, exchange_rate, amount_bdt, payment_method, reference_no, vendor, note, receipt_path, receipt_no, category_id,
     category:transaction_categories(name), student:students(id, full_name)`,
    true,
  ).range(from, to);
  const { data: cats } = await createClient().from("transaction_categories").select("id, type, name").is("deleted_at", null).order("type").order("sort_order");
  return (
    <>
      <PageHeader title="Transactions" description={`${count ?? 0} transactions`} />
      <TransactionsClient
        rows={(data ?? []) as unknown as TxnRow[]}
        total={count ?? 0}
        page={page}
        size={size}
        sort={sort}
        dir={dir}
        categories={(cats ?? []) as { id: string; type: string; name: string }[]}
        studentFilter={sp(searchParams, "student") ?? ""}
        perms={{ edit: can(user.permissions, "finance", "edit"), delete: can(user.permissions, "finance", "delete"), export: can(user.permissions, "finance", "export") }}
      />
    </>
  );
}
