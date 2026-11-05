"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function SubNav({ items, label }: { items: { href: string; label: string }[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="-mx-3 overflow-x-auto px-3">
      <ul className="flex w-max gap-1 border-b">
        {items.map((i) => {
          const active = pathname === i.href;
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={cn("-mb-px inline-block border-b-2 px-3 py-2 text-sm font-medium", active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
              >
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
