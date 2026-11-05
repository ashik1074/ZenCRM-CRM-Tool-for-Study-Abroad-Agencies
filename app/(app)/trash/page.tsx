import Link from "next/link";
import { requirePagePermission } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { listParams, sp, type SearchParams } from "@/lib/url";
import { cn } from "@/lib/utils";
import { fmtDateTime, fmtMoney } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { TrashList } from "./trash-list";

export const metadata = { title: "Deleted items" };

const TABS = { students: "Students", offers: "Offers", tasks: "Tasks", transactions: "Transactions" } as const;
type Tab = keyof typeof TABS;

export default async function TrashPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePagePermission("trash");
  const tab = (Object.keys(TABS).includes(sp(searchParams, "tab") ?? "") ? sp(searchParams, "tab") : "students") as Tab;
  const { page, size, from, to } = listParams(searchParams, { sort: "deleted" });
  const supabase = createClient();
  const select = {
    students: "id, full_name, student_code, phone, deleted_at",
    offers: "id, title, program, deleted_at, university:universities(name)",
    tasks: "id, title, status, deleted_at",
    transactions: "id, type, txn_date, amount, currency, note, deleted_at, category:transaction_categories(name)",
  }[tab];
  const { data, count } = await supabase.from(tab).select(select, { count: "exact" }).not("deleted_at", "is", null).order("deleted_at", { ascending: false }).range(from, to);
  const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    deleted_at: fmtDateTime(r.deleted_at as string),
    label:
      tab === "students" ? `${r.full_name} (${r.student_code})` :
      tab === "offers" ? `${r.title} — ${(r.university as { name: string } | null)?.name ?? ""}` :
      tab === "tasks" ? String(r.title) :
      `${r.type === "income" ? "Income" : "Expense"} ${fmtMoney(r.amount as number, r.currency as string)} · ${(r.category as { name: string } | null)?.name ?? ""} · ${r.txn_date}`,
  }));
  return (
    <>
      <PageHeader title="Deleted items" description="Soft-deleted records stay here and can be restored." />
      <nav aria-label="Record types" className="mb-3 overflow-x-auto">
        <ul className="flex w-max gap-1 border-b">
          {(Object.entries(TABS) as [Tab, string][]).map(([k, l]) => (
            <li key={k}><Link href={`/trash?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={cn("-mb-px inline-block border-b-2 px-3 py-2 text-sm font-medium", tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{l}</Link></li>
          ))}
        </ul>
      </nav>
      <TrashList table={tab} rows={rows} total={count ?? 0} page={page} size={size} canRestore={can(user.permissions, "trash", "edit")} />
    </>
  );
}
