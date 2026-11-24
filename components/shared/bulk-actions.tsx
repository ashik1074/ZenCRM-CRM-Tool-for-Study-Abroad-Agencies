"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Download, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "./confirm-dialog";
import { cn } from "@/lib/utils";

type BulkActionResult = { ok: true; message?: string } | { ok: false; error: string };

/**
 * Checkbox selection over the rows currently on screen. Ids that leave the page (paging, filtering,
 * deletion) drop out of the selection automatically, so actions never touch rows the user can't see.
 */
export function useSelection(ids: string[]) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const key = ids.join(",");
  useEffect(() => {
    setSelected((prev) => {
      const visible = new Set(ids);
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const toggle = useCallback((id: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const toggleAll = useCallback((on: boolean) => setSelected(on ? new Set(ids) : new Set()), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const clear = useCallback(() => setSelected(new Set()), []);

  return useMemo(() => {
    const count = ids.filter((id) => selected.has(id)).length;
    return {
      ids: ids.filter((id) => selected.has(id)),
      count,
      has: (id: string) => selected.has(id),
      toggle,
      toggleAll,
      clear,
      headerState: (count > 0 && count === ids.length ? true : count > 0 ? "indeterminate" : false) as boolean | "indeterminate",
      empty: ids.length === 0,
    };
  }, [selected, key, toggle, toggleAll, clear]); // eslint-disable-line react-hooks/exhaustive-deps
}

export type Selection = ReturnType<typeof useSelection>;

export function SelectAllCheckbox({ selection, label = "Select all rows on this page" }: { selection: Selection; label?: string }) {
  return <Checkbox aria-label={label} disabled={selection.empty} checked={selection.headerState} onCheckedChange={(v) => selection.toggleAll(v === true)} />;
}

export function RowCheckbox({ selection, id, label }: { selection: Selection; id: string; label: string }) {
  return <Checkbox aria-label={label} checked={selection.has(id)} onCheckedChange={(v) => selection.toggle(id, v === true)} />;
}

/** Runs a bulk server action: toasts the result, clears the selection on success, refreshes server data. */
export function useBulkRun(selection: Selection) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const exec = useCallback(
    async (fn: (ids: string[]) => Promise<BulkActionResult>) => {
      setBusy(true);
      try {
        const r = await fn(selection.ids);
        if (r.ok) {
          toast.success(r.message ?? "Done");
          selection.clear();
        } else toast.error(r.error);
        router.refresh();
      } finally {
        setBusy(false);
      }
    },
    [selection, router],
  );
  return { busy, exec };
}

/** The bar that appears above a list while rows are selected. */
export function BulkBar({
  selection,
  busy,
  children,
  className,
  leading,
  idle,
}: {
  selection: Selection;
  busy?: boolean;
  children: React.ReactNode;
  className?: string;
  /** Rendered first in both states, e.g. a select-all checkbox. */
  leading?: React.ReactNode;
  /** Shown when nothing is selected; without it the bar is hidden until something is. */
  idle?: React.ReactNode;
}) {
  if (selection.count === 0) {
    if (!idle) return null;
    return <div className={cn("flex min-h-10 items-center gap-2 px-3 py-1.5 text-sm", className)}>{leading}{idle}</div>;
  }
  return (
    <div
      role="region"
      aria-label="Actions for selected rows"
      className={cn("flex min-h-10 flex-wrap items-center gap-2 border-b border-primary/20 bg-primary/5 px-3 py-1.5 text-sm dark:bg-primary/10", className)}
    >
      {leading}
      <span className="mr-1 font-medium" aria-live="polite">
        {selection.count} selected
      </span>
      {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Working" />}
      {children}
      <Button size="sm" variant="ghost" className="ml-auto" onClick={selection.clear} disabled={busy}>
        <X /> Clear
      </Button>
    </div>
  );
}

/** A "Set X ▾" dropdown that applies the picked value to every selected row. */
export function BulkMenu({
  label,
  icon: Icon,
  options,
  onPick,
  disabled,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  options: readonly { value: string; label: string }[];
  onPick: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          {Icon && <Icon />} {label} <ChevronDown className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((o) => (
          <DropdownMenuItem key={o.value} onSelect={() => onPick(o.value)}>
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Download only the selected rows through an existing export endpoint (`?ids=`). */
export function BulkExport({ endpoint, ids, disabled }: { endpoint: string; ids: string[]; disabled?: boolean }) {
  const q = `ids=${ids.join(",")}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          <Download /> Export <ChevronDown className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem asChild><a href={`${endpoint}?format=xlsx&${q}`}>Excel (.xlsx)</a></DropdownMenuItem>
        <DropdownMenuItem asChild><a href={`${endpoint}?format=csv&${q}`}>CSV</a></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Destructive bulk action with a confirmation step. */
export function BulkDelete({
  count,
  noun,
  onConfirm,
  disabled,
  label = "Delete",
  description = "They move to Deleted items, where an admin can restore them.",
}: {
  count: number;
  noun: [singular: string, plural: string];
  onConfirm: () => Promise<unknown>;
  disabled?: boolean;
  label?: string;
  description?: React.ReactNode;
}) {
  const what = `${count} ${count === 1 ? noun[0] : noun[1]}`;
  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={disabled}>
          <Trash2 /> {label}
        </Button>
      }
      title={`${label} ${what}?`}
      description={description}
      confirmLabel={`${label} ${what}`}
      onConfirm={onConfirm}
    />
  );
}
