"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, nativeSelectClass } from "@/components/shared/field";
import { FileUploader } from "@/components/shared/file-uploader";
import { fmtDate, todayDhaka } from "@/lib/format";
import { addExchangeRate, saveSetting, type SettingKey } from "@/server/actions/settings";

type Agency = { name: string; phone?: string; email?: string; address?: string; logo_path?: string | null };

export function SettingsClient({ canEdit, agency, logoUrl, defaultCurrency, lists, rates }: {
  canEdit: boolean; agency: Agency; logoUrl: string | null; defaultCurrency: string;
  lists: Record<"intakes" | "lead_sources" | "document_categories" | "required_documents", string[]>;
  rates: { id: string; currency: string; rate_to_bdt: number; effective_date: string }[];
}) {
  const router = useRouter();
  const [a, setA] = useState<Agency>(agency);
  const [cur, setCur] = useState(defaultCurrency);
  const [pending, start] = useTransition();
  const save = (key: SettingKey, value: unknown) => start(async () => {
    const r = await saveSetting(key, value);
    r.ok ? toast.success(r.message) : toast.error(r.error);
    router.refresh();
  });

  return (
    <fieldset disabled={!canEdit} className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Agency</CardTitle><CardDescription>Shown in the app header and on money receipts.</CardDescription></CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {logoUrl ? <img src={logoUrl} alt="Agency logo" className="h-full w-full object-contain" /> : <span className="text-xs text-muted-foreground">No logo</span>}
            </div>
            {canEdit && <div className="flex-1"><FileUploader bucket="kb-attachments" folder="branding" imagesOnly multiple={false} compact label="Upload logo" onUploaded={(f) => { setA((x) => ({ ...x, logo_path: f.file_path })); save("agency", { ...a, logo_path: f.file_path }); }} /></div>}
          </div>
          <Field label="Agency name" required>{(p) => <Input {...p} value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} />}</Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Phone">{(p) => <Input {...p} value={a.phone ?? ""} onChange={(e) => setA({ ...a, phone: e.target.value })} />}</Field>
            <Field label="Email">{(p) => <Input {...p} value={a.email ?? ""} onChange={(e) => setA({ ...a, email: e.target.value })} />}</Field>
          </div>
          <Field label="Address">{(p) => <Textarea {...p} rows={2} value={a.address ?? ""} onChange={(e) => setA({ ...a, address: e.target.value })} />}</Field>
          {canEdit && <Button onClick={() => save("agency", a)} disabled={pending}>{pending && <Loader2 className="animate-spin" />} Save agency details</Button>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Currency & exchange rates</CardTitle><CardDescription>Reports convert to BDT using the rate stored on each transaction; these rates pre-fill new transactions.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-2">
            <Field label="Default currency" className="flex-1">
              {(p) => <select className={nativeSelectClass} {...p} value={cur} onChange={(e) => setCur(e.target.value)}>{["BDT", "CNY", "USD"].map((c) => <option key={c}>{c}</option>)}</select>}
            </Field>
            {canEdit && <Button variant="outline" onClick={() => save("default_currency", cur)}>Save</Button>}
          </div>
          {canEdit && <RateForm />}
          <table className="w-full text-sm">
            <caption className="sr-only">Exchange rate history</caption>
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1 font-medium">Currency</th><th className="font-medium">1 unit = BDT</th><th className="font-medium">Effective from</th></tr></thead>
            <tbody>{rates.map((r) => <tr key={r.id} className="border-t"><td className="py-1.5">{r.currency}</td><td>{Number(r.rate_to_bdt)}</td><td>{fmtDate(r.effective_date)}</td></tr>)}</tbody>
          </table>
        </CardContent>
      </Card>

      <ListEditor title="Intakes" description="Offered in student and offer forms." values={lists.intakes} onSave={(v) => save("intakes", v)} canEdit={canEdit} />
      <ListEditor title="Lead sources" description="Where students hear about you." values={lists.lead_sources} onSave={(v) => save("lead_sources", v)} canEdit={canEdit} />
      <ListEditor title="Document categories" description="Categories for student files." values={lists.document_categories} onSave={(v) => save("document_categories", v)} canEdit={canEdit} />
      <ListEditor title="Required visa documents" description="Drives the document checklist tracker. Use the same names as document categories." values={lists.required_documents} onSave={(v) => save("required_documents", v)} canEdit={canEdit} />
    </fieldset>
  );
}

function RateForm() {
  const router = useRouter();
  const [v, setV] = useState({ currency: "CNY" as "CNY" | "USD", rate_to_bdt: "", effective_date: todayDhaka() });
  const [pending, start] = useTransition();
  return (
    <div className="grid grid-cols-[90px_1fr_150px_auto] items-end gap-2">
      <Field label="Currency">{(p) => <select className={nativeSelectClass} {...p} value={v.currency} onChange={(e) => setV({ ...v, currency: e.target.value as "CNY" })}><option>CNY</option><option>USD</option></select>}</Field>
      <Field label="Rate to BDT">{(p) => <Input {...p} type="number" step="0.0001" value={v.rate_to_bdt} onChange={(e) => setV({ ...v, rate_to_bdt: e.target.value })} />}</Field>
      <Field label="From">{(p) => <Input {...p} type="date" value={v.effective_date} onChange={(e) => setV({ ...v, effective_date: e.target.value })} />}</Field>
      <Button disabled={pending || !v.rate_to_bdt} onClick={() => start(async () => {
        const r = await addExchangeRate(v);
        if (r.ok) { toast.success(r.message); setV({ ...v, rate_to_bdt: "" }); router.refresh(); } else toast.error(r.error);
      })}><Plus /> Add</Button>
    </div>
  );
}

function ListEditor({ title, description, values, onSave, canEdit }: { title: string; description: string; values: string[]; onSave: (v: string[]) => void; canEdit: boolean }) {
  const [items, setItems] = useState(values);
  const [add, setAdd] = useState("");
  const dirty = items.join("|") !== values.join("|");
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <ul className="flex flex-wrap gap-2">
          {items.map((it) => (
            <li key={it} className="inline-flex items-center gap-1 rounded-full border bg-muted/50 py-0.5 pl-3 pr-1 text-sm">
              {it}
              {canEdit && <button type="button" aria-label={`Remove ${it}`} className="rounded-full p-0.5 hover:bg-muted" onClick={() => setItems(items.filter((x) => x !== it))}><X className="h-3 w-3" /></button>}
            </li>
          ))}
        </ul>
        {canEdit && (
          <div className="flex gap-2">
            <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); if (add.trim() && !items.includes(add.trim())) setItems([...items, add.trim()]); setAdd(""); }}>
              <Input aria-label={`Add to ${title}`} placeholder="Add item" value={add} onChange={(e) => setAdd(e.target.value)} />
              <Button type="submit" variant="outline" size="icon" aria-label="Add"><Plus /></Button>
            </form>
            <Button disabled={!dirty} onClick={() => onSave(items)}>Save</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
