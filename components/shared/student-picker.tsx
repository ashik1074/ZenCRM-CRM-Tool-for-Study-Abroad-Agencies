"use client";
import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { searchStudents, type StudentOption } from "@/server/actions/lookup";

/** Searchable student select (server-side typeahead). Value is the student id. */
export function StudentPicker({
  value,
  label,
  onChange,
  id,
  placeholder = "Search student…",
}: {
  value: string;
  label?: string | null;
  onChange: (id: string, s: StudentOption | null) => void;
  id?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<StudentOption[]>([]);
  const [selectedLabel, setSelectedLabel] = useState(label ?? "");
  useEffect(() => {
    setSelectedLabel(label ?? "");
  }, [label]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => setItems(await searchStudents(q)), 200);
    return () => clearTimeout(t);
  }, [q, open]);

  return (
    <div className="flex gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
            <span className={cn("truncate", !value && "text-muted-foreground")}>{value ? selectedLabel || "Selected student" : placeholder}</span>
            <ChevronsUpDown className="opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-72 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Name, phone, code, passport…" value={q} onValueChange={setQ} />
            <CommandList>
              <CommandEmpty>No students found.</CommandEmpty>
              {items.map((s) => (
                <CommandItem
                  key={s.id}
                  value={s.id}
                  onSelect={() => {
                    setSelectedLabel(s.full_name);
                    onChange(s.id, s);
                    setOpen(false);
                  }}
                >
                  <Check className={cn(value === s.id ? "opacity-100" : "opacity-0")} aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate">{s.full_name}</p>
                    <p className="text-xs text-muted-foreground">{s.student_code}{s.phone ? ` · ${s.phone}` : ""}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <Button type="button" variant="ghost" size="icon" aria-label="Clear student" onClick={() => { setSelectedLabel(""); onChange("", null); }}>
          <X />
        </Button>
      )}
    </div>
  );
}
