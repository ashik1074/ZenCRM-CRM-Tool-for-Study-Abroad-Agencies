"use client";
import { useUrlState } from "@/components/shared/use-url-state";
import { cn } from "@/lib/utils";

export function GrainToggle({ grain }: { grain: string }) {
  const { set } = useUrlState();
  return (
    <div role="group" aria-label="Group by" className="inline-flex rounded-md border p-0.5 text-sm">
      {["month", "year"].map((g) => (
        <button key={g} type="button" aria-pressed={grain === g} onClick={() => set({ grain: g === "month" ? null : g })}
          className={cn("rounded px-3 py-1 capitalize", grain === g ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
          {g === "month" ? "Monthly" : "Yearly"}
        </button>
      ))}
    </div>
  );
}
