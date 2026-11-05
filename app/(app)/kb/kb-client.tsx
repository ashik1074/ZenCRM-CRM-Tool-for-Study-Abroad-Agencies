"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { BookOpen, ChevronLeft, ChevronRight, Copy, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Field, nativeSelectClass } from "@/components/shared/field";
import { FileGallery } from "@/components/shared/file-gallery";
import { FileUploader } from "@/components/shared/file-uploader";
import { ClearFilters, FilterBar, SearchFilter, SelectFilter } from "@/components/shared/list-filters";
import { RichText, RichTextEditor } from "@/components/shared/rich-text-editor";
import { StatusBadge } from "@/components/shared/status-badge";
import { useUrlState } from "@/components/shared/use-url-state";
import { fmtDateTime } from "@/lib/format";
import { addKbAttachment, deleteKbAttachment, deleteKbEntry, getKbEntry, saveKbEntry } from "@/server/actions/kb";

export type KbRow = { id: string; title: string; category: string; body_format: string; body_text: string; tags: string[]; updated_at: string; editor: { full_name: string } | null };
type Perms = { create: boolean; edit: boolean; delete: boolean };
type Entry = NonNullable<Awaited<ReturnType<typeof getKbEntry>>> & {
  id: string; title: string; category: string; body: string; body_format: "html" | "text"; body_text: string; tags: string[]; updated_at: string;
  editor: { full_name: string } | null;
  attachments: { id: string; file_path: string; file_name: string; mime_type: string | null; size_bytes: number | null; created_at: string }[];
};

export async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
  toast.success("Copied to clipboard");
}

export function KbClient({ rows, total, page, size, categories, perms, openId }: { rows: KbRow[]; total: number; page: number; size: number; categories: string[]; perms: Perms; openId?: string }) {
  const [viewing, setViewing] = useState<string | null>(openId ?? null);
  const [editing, setEditing] = useState<Entry | "new" | null>(null);
  const { set } = useUrlState();
  useEffect(() => { if (openId) setViewing(openId); }, [openId]);
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <>
      <FilterBar>
        <SearchFilter placeholder="Search title, text and tags…" />
        <SelectFilter param="category" label="Categories" options={categories} />
        <ClearFilters />
        {perms.create && <Button className="sm:ml-auto" onClick={() => setEditing("new")}><Plus /> New entry</Button>}
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState icon={BookOpen} title="No entries found" description="Try another search, or add the first entry." action={perms.create && <Button onClick={() => setEditing("new")}><Plus /> New entry</Button>} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Card className="flex h-full flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">
                      <button type="button" onClick={() => setViewing(r.id)} className="text-left hover:underline">{r.title}</button>
                    </CardTitle>
                    <StatusBadge tone="sky">{r.category}</StatusBadge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="line-clamp-4 whitespace-pre-line text-sm text-muted-foreground">{r.body_text}</p>
                  {r.tags.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{r.tags.map((t) => `#${t}`).join(" ")}</p>}
                </CardContent>
                <CardFooter className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>Updated {fmtDateTime(r.updated_at)}{r.editor ? ` by ${r.editor.full_name}` : ""}</span>
                  <Button size="sm" variant="outline" onClick={() => copyText(r.body_text)} aria-label={`Copy ${r.title}`}><Copy /> Copy</Button>
                </CardFooter>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <span>Page {page} of {pages}</span>
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => set({ page: String(page - 1) }, { resetPage: false })} aria-label="Previous page"><ChevronLeft /></Button>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => set({ page: String(page + 1) }, { resetPage: false })} aria-label="Next page"><ChevronRight /></Button>
        </div>
      )}
      {viewing && <EntryView id={viewing} perms={perms} onClose={() => setViewing(null)} onEdit={(e) => { setViewing(null); setEditing(e); }} />}
      {editing && <EntryEditor entry={editing === "new" ? null : editing} categories={categories} onClose={() => setEditing(null)} />}
    </>
  );
}

function EntryView({ id, perms, onClose, onEdit }: { id: string; perms: Perms; onClose: () => void; onEdit: (e: Entry) => void }) {
  const router = useRouter();
  const [entry, setEntry] = useState<Entry | null | undefined>(undefined);
  const load = useCallback(async () => setEntry((await getKbEntry(id)) as Entry | null), [id]);
  useEffect(() => { load(); }, [load]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {entry === undefined ? (
          <div className="flex h-32 items-center justify-center"><Loader2 className="animate-spin" /><DialogTitle className="sr-only">Loading</DialogTitle></div>
        ) : entry === null ? (
          <DialogHeader><DialogTitle>Entry not found</DialogTitle></DialogHeader>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2"><StatusBadge tone="sky">{entry.category}</StatusBadge>{entry.tags.map((t: string) => <span key={t} className="text-xs text-muted-foreground">#{t}</span>)}</div>
              <DialogTitle className="text-xl">{entry.title}</DialogTitle>
              <DialogDescription>Last updated {fmtDateTime(entry.updated_at)}{entry.editor ? ` by ${entry.editor.full_name}` : ""}</DialogDescription>
            </DialogHeader>
            {entry.body_format === "text" ? (
              <pre className="whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-4 font-sans text-sm" data-testid="kb-body">{entry.body}</pre>
            ) : (
              <RichText html={entry.body} className="rounded-md border p-4" />
            )}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Attachments</h3>
              <FileGallery bucket="kb-attachments" files={entry.attachments} canDelete={perms.edit} emptyText="No attachments." onDelete={async (f) => {
                const r = await deleteKbAttachment(f.id);
                r.ok ? toast.success(r.message) : toast.error(r.error);
                load();
              }} />
              {perms.edit && <FileUploader bucket="kb-attachments" folder={entry.id} compact onUploaded={async (f) => {
                const r = await addKbAttachment(entry.id, f);
                if (!r.ok) { toast.error(r.error); return false; }
                load();
              }} />}
            </div>
            <DialogFooter className="gap-2">
              {perms.delete && (
                <ConfirmDialog trigger={<Button variant="outline" className="text-destructive"><Trash2 /> Delete</Button>} title="Delete this entry?" onConfirm={async () => {
                  const r = await deleteKbEntry(entry.id);
                  if (r.ok) { toast.success(r.message); onClose(); router.refresh(); } else toast.error(r.error);
                }} />
              )}
              {perms.edit && <Button variant="outline" onClick={() => onEdit(entry)}><Pencil /> Edit</Button>}
              <Button onClick={() => copyText(entry.body_format === "text" ? entry.body : entry.body_text)}><Copy /> Copy to clipboard</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EntryEditor({ entry, categories, onClose }: { entry: Entry | null; categories: string[]; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({
    title: entry?.title ?? "",
    category: entry?.category ?? categories[0] ?? "General",
    body_format: (entry?.body_format ?? "html") as "html" | "text",
    body: entry?.body ?? "",
    tags: entry?.tags.join(", ") ?? "",
  });
  const [pending, start] = useTransition();
  const cats = Array.from(new Set([...categories, "Visa", "SOP", "FAQ", "Templates", "University notes", "Checklists"])).sort();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{entry ? "Edit entry" : "New entry"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title" required className="sm:col-span-2">{(p) => <Input {...p} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />}</Field>
          <Field label="Category" required>
            {(p) => (<><Input list="kb-cats" {...p} value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} /><datalist id="kb-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist></>)}
          </Field>
          <Field label="Format" hint="Plain text keeps line breaks and spacing exactly as typed">
            {(p) => (
              <select className={nativeSelectClass} {...p} value={v.body_format} onChange={(e) => setV({ ...v, body_format: e.target.value as "html" | "text" })}>
                <option value="html">Rich text</option>
                <option value="text">Plain text (verbatim)</option>
              </select>
            )}
          </Field>
          <Field label="Body" className="sm:col-span-2">
            {(p) => v.body_format === "html"
              ? <RichTextEditor id={p.id} value={v.body} onChange={(body) => setV((x) => ({ ...x, body }))} />
              : <Textarea {...p} rows={16} className="font-mono text-sm" value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} />}
          </Field>
          <Field label="Tags" hint="Comma separated" className="sm:col-span-2">{(p) => <Input {...p} value={v.tags} onChange={(e) => setV({ ...v, tags: e.target.value })} />}</Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={pending} onClick={() => start(async () => {
            const r = await saveKbEntry({ ...v, id: entry?.id ?? "" });
            if (r.ok) { toast.success(r.message); onClose(); router.refresh(); } else toast.error(r.error);
          })}>{pending && <Loader2 className="animate-spin" />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
