"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export function InactiveSection({ count, defaultOpen, children }: { count: number; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-6 rounded-lg border bg-muted/30">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
        <span>Inactive — completed sprints, paused & rejected ({count})</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}
