import { requirePagePermission } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { CategoriesClient } from "./categories-client";

export const metadata = { title: "Finance categories" };

export default async function CategoriesPage() {
  await requirePagePermission("finance_categories", "edit");
  const { data } = await createClient().from("transaction_categories").select("id, type, name, is_archived, sort_order").is("deleted_at", null).order("type").order("sort_order").order("name");
  return (
    <>
      <PageHeader title="Finance categories" description="Rename or archive categories. Archived categories stay on old transactions but can't be chosen for new ones." />
      <CategoriesClient rows={(data ?? []) as { id: string; type: "income" | "expense"; name: string; is_archived: boolean }[]} />
    </>
  );
}
