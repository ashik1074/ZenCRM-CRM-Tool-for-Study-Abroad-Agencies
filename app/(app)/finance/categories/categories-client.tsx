"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Check, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/status-badge";
import { saveCategory } from "@/server/actions/finance";

type Row = { id: string; type: "income" | "expense"; name: string; is_archived: boolean };

export function CategoriesClient({ rows }: { rows: Row[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(["income", "expense"] as const).map((t) => <CategoryList key={t} type={t} rows={rows.filter((r) => r.type === t)} />)}
    </div>
  );
}

function CategoryList({ type, rows }: { type: "income" | "expense"; rows: Row[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [newName, setNewName] = useState("");
  const save = async (input: Parameters<typeof saveCategory>[0]) => {
    const r = await saveCategory(input);
    r.ok ? toast.success(r.message) : toast.error(r.error);
    router.refresh();
    return r.ok;
  };
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base capitalize">{type} categories</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <ul className="divide-y rounded-md border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-2 p-2">
              {editing === r.id ? (
                <>
                  <Input aria-label="Category name" value={name} onChange={(e) => setName(e.target.value)} className="h-8" autoFocus />
                  <Button size="icon" variant="ghost" aria-label="Save" onClick={async () => { if (await save({ id: r.id, type, name, is_archived: r.is_archived })) setEditing(null); }}><Check /></Button>
                </>
              ) : (
                <>
                  <span className={`flex-1 ${r.is_archived ? "text-muted-foreground line-through" : ""}`}>{r.name}</span>
                  {r.is_archived && <StatusBadge tone="gray">Archived</StatusBadge>}
                  <Button size="icon" variant="ghost" aria-label={`Rename ${r.name}`} onClick={() => { setEditing(r.id); setName(r.name); }}><Pencil /></Button>
                  <Button size="icon" variant="ghost" aria-label={r.is_archived ? `Restore ${r.name}` : `Archive ${r.name}`} onClick={() => save({ id: r.id, type, name: r.name, is_archived: !r.is_archived })}>
                    {r.is_archived ? <ArchiveRestore /> : <Archive />}
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
        <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (newName.trim() && (await save({ type, name: newName, is_archived: false }))) setNewName(""); }}>
          <Input aria-label={`New ${type} category`} placeholder={`New ${type} category`} value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button type="submit" variant="outline"><Plus /> Add</Button>
        </form>
      </CardContent>
    </Card>
  );
}
