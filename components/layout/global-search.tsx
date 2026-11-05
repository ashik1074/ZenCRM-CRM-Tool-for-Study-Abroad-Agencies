"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BookOpen, FileBadge, GraduationCap, Landmark, ListTodo, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { globalSearch, type SearchHit } from "@/server/actions/search";

const META = {
  student: { label: "Students", icon: GraduationCap },
  offer: { label: "Offers", icon: FileBadge },
  university: { label: "Universities", icon: Landmark },
  task: { label: "Tasks", icon: ListTodo },
  kb: { label: "Info Center", icon: BookOpen },
} as const;

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      setHits(await globalSearch(q));
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const groups = (Object.keys(META) as (keyof typeof META)[]).map((k) => ({ k, items: hits.filter((h) => h.kind === k) })).filter((g) => g.items.length);

  return (
    <>
      <Button variant="outline" className="h-9 w-full max-w-sm justify-start gap-2 text-muted-foreground" onClick={() => setOpen(true)}>
        <Search aria-hidden />
        <span className="hidden sm:inline">Search students, offers, tasks…</span>
        <span className="sm:hidden">Search</span>
        <kbd className="ml-auto hidden rounded border bg-muted px-1.5 text-[10px] font-medium sm:inline">Ctrl K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false} title="Global search">
        <CommandInput placeholder="Search by name, phone, passport, offer, task…" value={q} onValueChange={setQ} />
        <CommandList>
          <CommandEmpty>{q.trim().length < 2 ? "Type at least 2 characters." : loading ? "Searching…" : "No results."}</CommandEmpty>
          {groups.map(({ k, items }) => {
            const Icon = META[k].icon;
            return (
              <CommandGroup key={k} heading={META[k].label}>
                {items.map((h) => (
                  <CommandItem
                    key={`${h.kind}-${h.id}`}
                    value={`${h.kind}-${h.id}-${h.title}`}
                    onSelect={() => {
                      setOpen(false);
                      setQ("");
                      router.push(h.link);
                    }}
                  >
                    <Icon className="text-muted-foreground" aria-hidden />
                    <div className="min-w-0">
                      <p className="truncate">{h.title}</p>
                      {h.subtitle && <p className="truncate text-xs text-muted-foreground">{h.subtitle}</p>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
