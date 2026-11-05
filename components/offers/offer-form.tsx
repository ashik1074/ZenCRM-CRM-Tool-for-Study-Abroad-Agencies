"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Field, nativeSelectClass } from "@/components/shared/field";
import { FileUploader, type UploadedFile } from "@/components/shared/file-uploader";
import { CURRENCIES, DEGREE_LEVELS, LANGUAGES_OF_INSTRUCTION, SCHOLARSHIP_TYPES } from "@/lib/constants";
import { offerSchema, type OfferInput } from "@/lib/validation/offers";
import { getOfferDetail, saveOffer } from "@/server/actions/offers";
import type { z } from "zod";

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function OfferFormSheet({
  id,
  universities,
  intakes,
  onClose,
}: {
  id: string | null;
  universities: { id: string; name: string }[];
  intakes: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [offerId] = useState(() => id ?? crypto.randomUUID());
  const [loading, setLoading] = useState(!!id);
  const [pending, start] = useTransition();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const form = useForm<OfferInput, unknown, z.output<typeof offerSchema>>({
    resolver: zodResolver(offerSchema),
    defaultValues: { source: "direct", status: "open", fee_currency: "CNY", stipend_currency: "CNY", degree_level: "Bachelor", covers_tuition: false, covers_accommodation: false },
  });
  const e = form.formState.errors;

  useEffect(() => {
    if (!id) return;
    getOfferDetail(id).then((d) => {
      const o = d as Record<string, unknown> | null;
      if (o) {
        form.reset({
          id: s(o.id), title: s(o.title), university_id: s(o.university_id), program: s(o.program), degree_level: o.degree_level as never,
          intake: s(o.intake), scholarship_type: s(o.scholarship_type) as never, covers_tuition: !!o.covers_tuition, covers_accommodation: !!o.covers_accommodation,
          stipend_amount: s(o.stipend_amount), stipend_currency: o.stipend_currency as never, tuition_fee: s(o.tuition_fee), accommodation_fee: s(o.accommodation_fee),
          fee_currency: o.fee_currency as never, application_deadline: s(o.application_deadline), language_of_instruction: s(o.language_of_instruction) as never,
          eligibility: s(o.eligibility), source: o.source as never, partner_name: s(o.partner_name), status: o.status as never,
        });
      }
      setLoading(false);
    });
  }, [id, form]);

  const source = form.watch("source");
  const reg = form.register;

  const submit = form.handleSubmit(() => {
    start(async () => {
      const values = { ...form.getValues(), id: id ?? offerId };
      const r = await saveOffer(id ? values : { ...values }, id ? [] : files);
      if (r.ok) {
        toast.success(r.message);
        onClose();
        router.refresh();
      } else toast.error(r.error);
    });
  });

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{id ? "Edit offer" : "Add offer"}</SheetTitle>
          <SheetDescription>Offers past their deadline are marked Expired automatically.</SheetDescription>
        </SheetHeader>
        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="animate-spin" /></div>
        ) : (
          <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2" noValidate>
            <Field label="Offer name / title" required error={e.title?.message} className="sm:col-span-2">{(p) => <Input {...p} {...reg("title")} placeholder="CSC Master – Software Engineering" />}</Field>
            <Field label="University" required error={e.university_id?.message} className="sm:col-span-2">
              {(p) => (
                <select className={nativeSelectClass} {...p} {...reg("university_id")}>
                  <option value="">Select a university…</option>
                  {universities.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              )}
            </Field>
            <Field label="Program / major" required error={e.program?.message}>{(p) => <Input {...p} {...reg("program")} />}</Field>
            <Field label="Degree level" required error={e.degree_level?.message}>
              {(p) => <select className={nativeSelectClass} {...p} {...reg("degree_level")}>{DEGREE_LEVELS.map((d) => <option key={d}>{d}</option>)}</select>}
            </Field>
            <Field label="Intake">
              {(p) => (<><Input list="offer-intakes" {...p} {...reg("intake")} /><datalist id="offer-intakes">{intakes.map((i) => <option key={i} value={i} />)}</datalist></>)}
            </Field>
            <Field label="Application deadline" error={e.application_deadline?.message}>{(p) => <Input type="date" {...p} {...reg("application_deadline")} />}</Field>
            <Field label="Scholarship type">
              {(p) => <select className={nativeSelectClass} {...p} {...reg("scholarship_type")}><option value="">None</option>{SCHOLARSHIP_TYPES.map((x) => <option key={x}>{x}</option>)}</select>}
            </Field>
            <Field label="Language of instruction">
              {(p) => <select className={nativeSelectClass} {...p} {...reg("language_of_instruction")}><option value="">—</option>{LANGUAGES_OF_INSTRUCTION.map((x) => <option key={x}>{x}</option>)}</select>}
            </Field>
            <fieldset className="grid gap-2 rounded-md border p-3 sm:col-span-2 sm:grid-cols-3">
              <legend className="px-1 text-sm font-medium">Scholarship coverage</legend>
              <div className="flex items-center gap-2">
                <Checkbox id="ct" checked={form.watch("covers_tuition")} onCheckedChange={(v) => form.setValue("covers_tuition", v === true)} />
                <Label htmlFor="ct">Tuition</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="ca" checked={form.watch("covers_accommodation")} onCheckedChange={(v) => form.setValue("covers_accommodation", v === true)} />
                <Label htmlFor="ca">Accommodation</Label>
              </div>
              <div className="grid grid-cols-[1fr_80px] gap-1">
                <Field label="Stipend / month" error={e.stipend_amount?.message}>{(p) => <Input type="number" min="0" {...p} {...reg("stipend_amount")} />}</Field>
                <Field label="Cur.">{(p) => <select className={nativeSelectClass} {...p} {...reg("stipend_currency")}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>}</Field>
              </div>
            </fieldset>
            <Field label="Tuition fee / year" error={e.tuition_fee?.message}>{(p) => <Input type="number" min="0" {...p} {...reg("tuition_fee")} />}</Field>
            <div className="grid grid-cols-[1fr_90px] gap-2">
              <Field label="Accommodation / year" error={e.accommodation_fee?.message}>{(p) => <Input type="number" min="0" {...p} {...reg("accommodation_fee")} />}</Field>
              <Field label="Currency">{(p) => <select className={nativeSelectClass} {...p} {...reg("fee_currency")}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>}</Field>
            </div>
            <Field label="Eligibility requirements" className="sm:col-span-2">{(p) => <Textarea rows={3} {...p} {...reg("eligibility")} />}</Field>
            <Field label="Offer source">
              {(p) => <select className={nativeSelectClass} {...p} {...reg("source")}><option value="direct">Direct</option><option value="partner_agent">Partner agent</option></select>}
            </Field>
            {source === "partner_agent" ? (
              <Field label="Partner agent name">{(p) => <Input {...p} {...reg("partner_name")} />}</Field>
            ) : <div />}
            <Field label="Status">
              {(p) => <select className={nativeSelectClass} {...p} {...reg("status")}><option value="open">Open</option><option value="closed">Closed</option></select>}
            </Field>
            {!id && (
              <div className="space-y-2 sm:col-span-2">
                <Label>Leaflets</Label>
                <FileUploader bucket="offer-leaflets" folder={offerId} compact label="Attach images or PDF leaflets" onUploaded={(f) => { setFiles((x) => [...x, f]); }} />
                {files.length > 0 && (
                  <ul className="space-y-1 text-sm">
                    {files.map((f) => (
                      <li key={f.file_path} className="flex items-center justify-between rounded border px-2 py-1">
                        <span className="truncate">{f.file_name}</span>
                        <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${f.file_name}`} onClick={() => setFiles((x) => x.filter((y) => y.file_path !== f.file_path))}><X /></Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <SheetFooter className="gap-2 sm:col-span-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={pending} data-testid="offer-submit">{pending && <Loader2 className="animate-spin" />} Save offer</Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
