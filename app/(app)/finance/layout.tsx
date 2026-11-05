import { requirePagePermission } from "@/server/auth";
import { can } from "@/lib/permissions";
import { SubNav } from "@/components/shared/sub-nav";

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePagePermission("finance");
  const items = [
    { href: "/finance", label: "Overview" },
    { href: "/finance/transactions", label: "Transactions" },
    { href: "/finance/fee-plans", label: "Student fee plans" },
    ...(can(user.permissions, "finance_categories", "edit") ? [{ href: "/finance/categories", label: "Categories" }] : []),
  ];
  return (
    <div className="space-y-4">
      <SubNav items={items} label="Finance sections" />
      {children}
    </div>
  );
}
