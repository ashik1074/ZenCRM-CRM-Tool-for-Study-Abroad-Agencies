"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/empty-state";
import { ClearFilters, FilterBar } from "@/components/shared/list-filters";
import { StudentPicker } from "@/components/shared/student-picker";
import { useUrlState } from "@/components/shared/use-url-state";
import { FeePlanCard, type FeePlanRow } from "@/components/finance/fee-plan-card";
import { FeePlanDialog } from "@/components/finance/fee-plan-dialog";

export function FeePlansClient({ plans, total, page, size, studentFilter, overdueOnly, perms }: {
  plans: FeePlanRow[]; total: number; page: number; size: number; studentFilter: string; overdueOnly: boolean; perms: { create: boolean; edit: boolean; delete: boolean };
}) {
  const { set } = useUrlState();
  const [adding, setAdding] = useState(false);
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <>
      <FilterBar>
        <div className="w-full sm:w-64"><StudentPicker value={studentFilter} placeholder="Filter by student…" onChange={(id) => set({ student: id || null })} /></div>
        <div className="flex items-center gap-2">
          <Checkbox id="od" checked={overdueOnly} onCheckedChange={(v) => set({ overdue: v === true ? "1" : null })} />
          <Label htmlFor="od">Overdue only</Label>
        </div>
        <ClearFilters />
        {perms.create && <Button className="sm:ml-auto" onClick={() => setAdding(true)}><Plus /> New fee plan</Button>}
      </FilterBar>
      {plans.length === 0 ? (
        <EmptyState icon={Wallet} title="No fee plans" description="Create a package for a student to track installments and dues." action={perms.create && <Button onClick={() => setAdding(true)}><Plus /> New fee plan</Button>} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">{plans.map((p) => <FeePlanCard key={p.id} plan={p} perms={perms} showStudent />)}</div>
      )}
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <span>{total} plans · page {page} of {pages}</span>
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => set({ page: String(page - 1) }, { resetPage: false })} aria-label="Previous page"><ChevronLeft /></Button>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => set({ page: String(page + 1) }, { resetPage: false })} aria-label="Next page"><ChevronRight /></Button>
        </div>
      )}
      {adding && <FeePlanDialog plan={null} onClose={() => setAdding(false)} />}
    </>
  );
}
