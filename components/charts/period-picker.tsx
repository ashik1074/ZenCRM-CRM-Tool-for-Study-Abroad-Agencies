"use client";
import { Input } from "@/components/ui/input";
import { nativeSelectClass } from "@/components/shared/field";
import { useUrlState } from "@/components/shared/use-url-state";
import { PERIODS } from "@/lib/period";
import { fmtDate } from "@/lib/format";

export function PeriodPicker({ period, from, to }: { period: string; from: string; to: string }) {
  const { set } = useUrlState();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Period" className={`${nativeSelectClass} w-40`} value={period} onChange={(e) => set(e.target.value === "custom" ? { period: "custom", from, to } : { period: e.target.value, from: null, to: null })}>
        {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
      </select>
      {period === "custom" ? (
        <>
          <Input type="date" aria-label="From" className="w-36" value={from} onChange={(e) => set({ from: e.target.value })} />
          <span className="text-muted-foreground">–</span>
          <Input type="date" aria-label="To" className="w-36" value={to} onChange={(e) => set({ to: e.target.value })} />
        </>
      ) : (
        <span className="text-sm text-muted-foreground">{fmtDate(from)} – {fmtDate(to)}</span>
      )}
    </div>
  );
}
