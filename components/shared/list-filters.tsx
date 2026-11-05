"use client";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUrlState } from "./use-url-state";

export function SearchFilter({ placeholder = "Search…", param = "q", className }: { placeholder?: string; param?: string; className?: string }) {
  const { get, set } = useUrlState();
  const [value, setValue] = useState(get(param));
  useEffect(() => {
    const t = setTimeout(() => {
      if (value !== get(param)) set({ [param]: value || null });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className={className ?? "relative w-full sm:w-72"}>
      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
      <Input aria-label={placeholder} placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} className="pl-8" />
    </div>
  );
}

const ALL = "__all__";
export function SelectFilter({
  param,
  label,
  options,
  width = "w-full sm:w-44",
}: {
  param: string;
  label: string;
  options: readonly { value: string; label: string }[] | readonly string[];
  width?: string;
}) {
  const { get, set } = useUrlState();
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <Select value={get(param) || ALL} onValueChange={(v) => set({ [param]: v === ALL ? null : v })}>
      <SelectTrigger className={width} aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All {label.toLowerCase()}</SelectItem>
        {opts.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DateRangeFilter({ fromParam = "from", toParam = "to", label = "Date" }: { fromParam?: string; toParam?: string; label?: string }) {
  const { get, set } = useUrlState();
  return (
    <div className="flex items-center gap-1" role="group" aria-label={`${label} range`}>
      <Input type="date" aria-label={`${label} from`} className="w-full sm:w-36" value={get(fromParam)} onChange={(e) => set({ [fromParam]: e.target.value || null })} />
      <span className="text-muted-foreground">–</span>
      <Input type="date" aria-label={`${label} to`} className="w-full sm:w-36" value={get(toParam)} onChange={(e) => set({ [toParam]: e.target.value || null })} />
    </div>
  );
}

export function ClearFilters({ keep = [] }: { keep?: string[] }) {
  const { params, set } = useUrlState();
  const keys = Array.from(params.keys()).filter((k) => !keep.includes(k) && k !== "sort" && k !== "dir");
  if (!keys.length) return null;
  return (
    <Button variant="ghost" size="sm" onClick={() => set(Object.fromEntries(keys.map((k) => [k, null])))}>
      <X /> Clear
    </Button>
  );
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 flex flex-col flex-wrap gap-2 sm:flex-row sm:items-center">{children}</div>;
}
