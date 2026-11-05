"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useFieldArray, useForm, type FieldPath, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, FileText, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Field, nativeSelectClass } from "@/components/shared/field";
import { FileUploader } from "@/components/shared/file-uploader";
import { cn } from "@/lib/utils";
import { bytes, daysUntil, fmtDate } from "@/lib/format";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { DEGREE_LEVELS, EDUCATION_LEVELS, GENDERS, HSK_LEVELS, SCHOLARSHIP_TYPES, STUDENT_STATUSES } from "@/lib/constants";
import { STEP_FIELDS, studentFinalSchema, studentSchema, type StudentFormInput, type StudentFormValues } from "@/lib/validation/student";
import { findDuplicates, saveStudent, type DuplicateHit } from "@/server/actions/students";
import { getSignedUrls } from "@/server/actions/files";

const STEPS = ["Personal", "Documents", "Family", "Education", "Work", "Language", "Preferences", "Travel", "Source"];

type Form = UseFormReturn<StudentFormInput, unknown, StudentFormValues>;
type Opt = { id: string; full_name: string };

export function StudentForm({
  initial,
  counselors,
  lists,
  mode,
}: {
  initial?: StudentFormInput;
  counselors: Opt[];
  lists: { intakes: string[]; leadSources: string[]; documentCategories: string[] };
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();
  const [dups, setDups] = useState<DuplicateHit[]>([]);
  const [studentId] = useState(() => initial?.id || crypto.randomUUID());
  const form: Form = useForm<StudentFormInput, unknown, StudentFormValues>({
    resolver: zodResolver(studentSchema),
    mode: "onBlur",
    defaultValues: {
      nationality: "Bangladeshi",
      status: "inquiry",
      father: { name: "", date_of_birth: "" },
      mother: { name: "", date_of_birth: "" },
      spouse: { name: "", date_of_birth: "" },
      children: [],
      documents: [],
      education: [],
      work: [],
      valid_visas: [],
      visits: [],
      ...initial,
      id: studentId,
    },
  });
  const { register, formState, watch } = form;
  const e = formState.errors;

  // duplicate detection (debounced on the three identity fields)
  const [phone, email, passport] = watch(["phone", "email", "passport_no"]);
  useEffect(() => {
    const t = setTimeout(async () => {
      if ((phone?.length ?? 0) < 6 && (email?.length ?? 0) < 5 && (passport?.length ?? 0) < 5) return setDups([]);
      setDups(await findDuplicates({ phone, email, passport, excludeId: mode === "edit" ? studentId : undefined }));
    }, 500);
    return () => clearTimeout(t);
  }, [phone, email, passport, mode, studentId]);

  const expiryDays = daysUntil(watch("passport_expiry_date") || null);

  async function goTo(next: number) {
    if (next > step) {
      const ok = await form.trigger(STEP_FIELDS[step] as FieldPath<StudentFormInput>[]);
      if (!ok) return;
    }
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submit(draft: boolean) {
    const values = form.getValues();
    if (!draft) {
      const r = studentFinalSchema.safeParse(values);
      if (!r.success) {
        r.error.issues.forEach((i) => form.setError(i.path.join(".") as FieldPath<StudentFormInput>, { message: i.message }));
        const first = r.error.issues[0]?.path[0] as string;
        const s = Number(Object.entries(STEP_FIELDS).find(([, f]) => f.includes(first))?.[0] ?? 0);
        setStep(s);
        toast.error(r.error.issues[0]?.message ?? "Please complete the required fields.");
        return;
      }
    } else if (!values.full_name?.trim()) {
      form.setError("full_name", { message: "Enter at least the full name to save a draft" });
      setStep(0);
      return;
    }
    start(async () => {
      const r = await saveStudent(values, { draft });
      if (!r.ok) {
        toast.error(r.error);
        if (r.fieldErrors) Object.entries(r.fieldErrors).forEach(([k, m]) => form.setError(k as FieldPath<StudentFormInput>, { message: m[0] }));
        return;
      }
      toast.success(r.message);
      if (draft && mode === "create") router.replace(`/students/${r.data.id}/edit`);
      else router.push(`/students/${r.data.id}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <ol className="flex gap-1 overflow-x-auto pb-1" aria-label="Enrollment steps">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => (i < step ? setStep(i) : goTo(i))}
              aria-current={i === step ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                i === step ? "border-primary bg-primary text-primary-foreground" : i < step ? "border-primary/40 bg-accent text-accent-foreground" : "text-muted-foreground",
              )}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-background/20 text-[10px]">{i < step ? <Check className="h-3 w-3" /> : i + 1}</span>
              {s}
            </button>
          </li>
        ))}
      </ol>

      {dups.length > 0 && (
        <div role="alert" className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 text-warning" aria-hidden /> Possible duplicate student
          </p>
          <ul className="mt-1 space-y-0.5">
            {dups.map((d) => (
              <li key={d.id}>
                <Link href={`/students/${d.id}`} target="_blank" className="font-medium text-primary underline">{d.full_name}</Link>{" "}
                <span className="text-muted-foreground">— same {d.match} ({[d.phone, d.email, d.passport_no].filter(Boolean).join(" · ")})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Card>
        <CardContent className="p-4 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold">
            {step + 1}. {STEPS[step]}
          </h2>

          {step === 0 && (
            <div className="grid gap-4 md:grid-cols-[160px_1fr]">
              <PhotoField form={form} studentId={studentId} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name (as in passport)" required error={e.full_name?.message} className="sm:col-span-2">{(p) => <Input {...p} {...register("full_name")} autoFocus />}</Field>
                <Field label="Gender" required error={e.gender?.message}>
                  {(p) => (
                    <select className={nativeSelectClass} {...p} {...register("gender")}>
                      <option value="">Select…</option>
                      {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                    </select>
                  )}
                </Field>
                <Field label="Date of birth" required error={e.date_of_birth?.message}>{(p) => <Input type="date" {...p} {...register("date_of_birth")} />}</Field>
                <Field label="Nationality" error={e.nationality?.message}>{(p) => <Input {...p} {...register("nationality")} />}</Field>
                <Field label="Phone" required error={e.phone?.message}>{(p) => <Input type="tel" {...p} {...register("phone")} placeholder="+8801…" />}</Field>
                <Field label="WhatsApp" error={e.whatsapp?.message}>{(p) => <Input type="tel" {...p} {...register("whatsapp")} />}</Field>
                <Field label="Email" error={e.email?.message}>{(p) => <Input type="email" {...p} {...register("email")} />}</Field>
                <Field label="Present address" error={e.present_address?.message} className="sm:col-span-2">{(p) => <Textarea rows={2} {...p} {...register("present_address")} />}</Field>
                <Field label="Permanent address" error={e.permanent_address?.message} className="sm:col-span-2">{(p) => <Textarea rows={2} {...p} {...register("permanent_address")} />}</Field>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Passport number" error={e.passport_no?.message}>{(p) => <Input {...p} {...register("passport_no")} className="uppercase" />}</Field>
              <Field label="Issue date" error={e.passport_issue_date?.message}>{(p) => <Input type="date" {...p} {...register("passport_issue_date")} />}</Field>
              <Field label="Expiry date" error={e.passport_expiry_date?.message}>{(p) => <Input type="date" {...p} {...register("passport_expiry_date")} />}</Field>
              {expiryDays !== null && expiryDays < 183 && (
                <p role="alert" className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm sm:col-span-3">
                  <AlertTriangle className="h-4 w-4 text-warning" aria-hidden />
                  {expiryDays < 0
                    ? `This passport expired on ${fmtDate(watch("passport_expiry_date"))}.`
                    : `This passport expires in ${expiryDays} days. China requires at least 6 months' validity — ask the student to renew.`}
                </p>
              )}
            </div>
            <SupportingDocuments form={form} studentId={studentId} categories={lists.documentCategories} mode={mode} />
            </div>
          )}

          {step === 2 && <FamilyStep form={form} />}
          {step === 3 && <EducationStep form={form} />}
          {step === 4 && <WorkStep form={form} />}

          {step === 5 && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="HSK level">
                {(p) => (
                  <select className={nativeSelectClass} {...p} {...register("hsk_level")}>
                    <option value="">None</option>
                    {HSK_LEVELS.map((h) => <option key={h}>{h}</option>)}
                  </select>
                )}
              </Field>
              <Field label="IELTS overall" error={e.ielts_score?.message}>{(p) => <Input type="number" step="0.5" min="0" max="9" {...p} {...register("ielts_score")} />}</Field>
              <Field label="Other scores" hint="e.g. TOEFL 85, Duolingo 110">{(p) => <Input {...p} {...register("other_language_scores")} />}</Field>
            </div>
          )}

          {step === 6 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Intended program level">
                {(p) => (
                  <select className={nativeSelectClass} {...p} {...register("intended_program_level")}>
                    <option value="">Select…</option>
                    {DEGREE_LEVELS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                )}
              </Field>
              <Field label="Intake">
                {(p) => (
                  <>
                    <Input list="intakes" {...p} {...register("intake")} placeholder="e.g. September 2027" />
                    <datalist id="intakes">{lists.intakes.map((i) => <option key={i} value={i} />)}</datalist>
                  </>
                )}
              </Field>
              <Field label="Preferred majors" hint="Separate with commas">{(p) => <Input {...p} {...register("preferred_majors")} />}</Field>
              <Field label="Preferred cities" hint="Separate with commas">{(p) => <Input {...p} {...register("preferred_cities")} />}</Field>
              <Field label="Preferred universities" hint="Separate with commas" className="sm:col-span-2">{(p) => <Input {...p} {...register("preferred_universities")} />}</Field>
              <Field label="Scholarship wanted">
                {(p) => (
                  <select className={nativeSelectClass} {...p} {...register("scholarship_type")}>
                    <option value="">Select…</option>
                    {SCHOLARSHIP_TYPES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                )}
              </Field>
            </div>
          )}

          {step === 7 && <TravelStep form={form} />}

          {step === 8 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Lead source">
                {(p) => (
                  <select className={nativeSelectClass} {...p} {...register("lead_source")}>
                    <option value="">Select…</option>
                    {lists.leadSources.map((s) => <option key={s}>{s}</option>)}
                  </select>
                )}
              </Field>
              <Field label="Referred by">{(p) => <Input {...p} {...register("referred_by")} />}</Field>
              <Field label="Assigned counselor">
                {(p) => (
                  <select className={nativeSelectClass} {...p} {...register("counselor_id")}>
                    <option value="">Unassigned</option>
                    {counselors.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                )}
              </Field>
              <Field label="Pipeline status">
                {(p) => (
                  <select className={nativeSelectClass} {...p} {...register("status")}>
                    {STUDENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                )}
              </Field>
              <Field label="Internal notes" className="sm:col-span-2">{(p) => <Textarea rows={3} {...p} {...register("notes")} />}</Field>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-3 flex flex-wrap items-center justify-between gap-2 border-t bg-background/95 px-3 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          <X /> Cancel
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={() => submit(true)}>
            <Save /> Save draft
          </Button>
          {step > 0 && (
            <Button type="button" variant="outline" onClick={() => goTo(step - 1)}>
              <ChevronLeft /> Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={() => goTo(step + 1)}>
              Next <ChevronRight />
            </Button>
          ) : (
            <Button type="button" disabled={pending} onClick={() => submit(false)} data-testid="student-submit">
              {pending ? <Loader2 className="animate-spin" /> : <Check />} {mode === "create" ? "Enroll student" : "Save changes"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function PhotoField({ form, studentId }: { form: Form; studentId: string }) {
  const path = form.watch("photo_path");
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (path) getSignedUrls("student-files", [path]).then((r) => setUrl(r[path] ?? null));
    else setUrl(null);
  }, [path]);
  return (
    <div className="space-y-2">
      <Label>Photo</Label>
      <div className="aspect-[3/4] w-full overflow-hidden rounded-lg border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? <img src={url} alt="Student" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No photo</div>}
      </div>
      <FileUploader
        bucket="student-files"
        folder={studentId}
        imagesOnly
        multiple={false}
        compact
        label={path ? "Replace photo" : "Upload photo"}
        onUploaded={(f) => form.setValue("photo_path", f.file_path, { shouldDirty: true })}
      />
      {path && (
        <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => form.setValue("photo_path", "", { shouldDirty: true })}>
          Remove photo
        </Button>
      )}
    </div>
  );
}

function PersonRow({ form, prefix, label }: { form: Form; prefix: "father" | "mother" | "spouse"; label: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
      <Field label={`${label} name`}>{(p) => <Input {...p} {...form.register(`${prefix}.name`)} />}</Field>
      <Field label={`${label} date of birth`}>{(p) => <Input type="date" {...p} {...form.register(`${prefix}.date_of_birth`)} />}</Field>
    </div>
  );
}

function FamilyStep({ form }: { form: Form }) {
  const children = useFieldArray({ control: form.control, name: "children" });
  return (
    <div className="space-y-4">
      <PersonRow form={form} prefix="father" label="Father" />
      <PersonRow form={form} prefix="mother" label="Mother" />
      <PersonRow form={form} prefix="spouse" label="Spouse (optional)" />
      <fieldset className="space-y-3 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">Children (optional)</legend>
        {children.fields.map((c, i) => (
          <div key={c.id} className="grid items-end gap-3 sm:grid-cols-[1fr_200px_auto]">
            <Field label={`Child ${i + 1} name`}>{(p) => <Input {...p} {...form.register(`children.${i}.name`)} />}</Field>
            <Field label="Date of birth">{(p) => <Input type="date" {...p} {...form.register(`children.${i}.date_of_birth`)} />}</Field>
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove child ${i + 1}`} onClick={() => children.remove(i)}><Trash2 /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => children.append({ name: "", date_of_birth: "" })}><Plus /> Add child</Button>
      </fieldset>
    </div>
  );
}

function EducationStep({ form }: { form: Form }) {
  const arr = useFieldArray({ control: form.control, name: "education" });
  const errs = form.formState.errors.education;
  return (
    <div className="space-y-3">
      {arr.fields.length === 0 && <p className="text-sm text-muted-foreground">Add SSC, HSC and any higher degrees.</p>}
      {arr.fields.map((f, i) => (
        <fieldset key={f.id} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
          <legend className="px-1 text-sm font-medium">Education {i + 1}</legend>
          <Field label="Level" required error={errs?.[i]?.level?.message}>
            {(p) => (
              <select className={nativeSelectClass} {...p} {...form.register(`education.${i}.level`)}>
                {EDUCATION_LEVELS.map((l) => <option key={l}>{l}</option>)}
              </select>
            )}
          </Field>
          <Field label="Institution" required error={errs?.[i]?.institution?.message} className="sm:col-span-2">{(p) => <Input {...p} {...form.register(`education.${i}.institution`)} />}</Field>
          <Field label="Degree / Diploma">{(p) => <Input {...p} {...form.register(`education.${i}.degree`)} />}</Field>
          <Field label="Major">{(p) => <Input {...p} {...form.register(`education.${i}.major`)} />}</Field>
          <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <Field label="Passing year" error={errs?.[i]?.passing_year?.message}>{(p) => <Input type="number" {...p} {...form.register(`education.${i}.passing_year`)} />}</Field>
            <Field label="GPA / CGPA">{(p) => <Input {...p} {...form.register(`education.${i}.gpa`)} />}</Field>
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove education ${i + 1}`} onClick={() => arr.remove(i)}><Trash2 /></Button>
          </div>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => arr.append({ level: (["SSC", "HSC", "Bachelor", "Master"][arr.fields.length] ?? "Bachelor") as never, institution: "", degree: "", major: "", passing_year: "", gpa: "" })}
      >
        <Plus /> Add education
      </Button>
    </div>
  );
}

function WorkStep({ form }: { form: Form }) {
  const arr = useFieldArray({ control: form.control, name: "work" });
  const errs = form.formState.errors.work;
  return (
    <div className="space-y-3">
      {arr.fields.length === 0 && <p className="text-sm text-muted-foreground">Optional. Add jobs held in Bangladesh — they appear on the visa information sheet.</p>}
      {arr.fields.map((f, i) => (
        <fieldset key={f.id} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
          <legend className="px-1 text-sm font-medium">Job {i + 1}</legend>
          <Field label="Company" required error={errs?.[i]?.company?.message}>{(p) => <Input {...p} {...form.register(`work.${i}.company`)} />}</Field>
          <Field label="Position">{(p) => <Input {...p} {...form.register(`work.${i}.position`)} />}</Field>
          <Field label="Employer address" className="sm:col-span-2">{(p) => <Input {...p} {...form.register(`work.${i}.address`)} />}</Field>
          <Field label="Employer phone">{(p) => <Input {...p} {...form.register(`work.${i}.employer_phone`)} />}</Field>
          <Field label="Duty">{(p) => <Input {...p} {...form.register(`work.${i}.duty`)} />}</Field>
          <Field label="Supervisor name">{(p) => <Input {...p} {...form.register(`work.${i}.supervisor_name`)} />}</Field>
          <Field label="Supervisor phone">{(p) => <Input {...p} {...form.register(`work.${i}.supervisor_phone`)} />}</Field>
          <Field label="Start date">{(p) => <Input type="date" {...p} {...form.register(`work.${i}.start_date`)} />}</Field>
          <div className="grid grid-cols-[1fr_auto] items-end gap-2">
            <Field label="End date" error={errs?.[i]?.end_date?.message}>{(p) => <Input type="date" {...p} {...form.register(`work.${i}.end_date`)} />}</Field>
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove job ${i + 1}`} onClick={() => arr.remove(i)}><Trash2 /></Button>
          </div>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => arr.append({ company: "", address: "", employer_phone: "", position: "", duty: "", supervisor_name: "", supervisor_phone: "", start_date: "", end_date: "" })}
      >
        <Plus /> Add work experience
      </Button>
    </div>
  );
}

function YesNo({ form, name, label }: { form: Form; name: "has_valid_foreign_visa" | "visited_countries_past_12m" | "previous_china_visa" | "previous_china_residence"; label: string }) {
  const v = form.watch(name);
  const id = `yn-${name}`;
  return (
    <div className="flex items-start gap-2">
      <Checkbox id={id} checked={!!v} onCheckedChange={(c) => form.setValue(name, c === true, { shouldDirty: true })} />
      <Label htmlFor={id} className="leading-snug">{label}</Label>
    </div>
  );
}

function TravelStep({ form }: { form: Form }) {
  const visas = useFieldArray({ control: form.control, name: "valid_visas" });
  const visits = useFieldArray({ control: form.control, name: "visits" });
  const [hasVisa, visited] = form.watch(["has_valid_foreign_visa", "visited_countries_past_12m"]);
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <YesNo form={form} name="has_valid_foreign_visa" label="Currently holds valid visas issued by other countries" />
        {hasVisa && (
          <div className="space-y-2 pl-6">
            {visas.fields.map((f, i) => (
              <div key={f.id} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_160px_auto]">
                <Field label="Country">{(p) => <Input {...p} {...form.register(`valid_visas.${i}.country`)} />}</Field>
                <Field label="Visa type">{(p) => <Input {...p} {...form.register(`valid_visas.${i}.visa_type`)} />}</Field>
                <Field label="Valid until">{(p) => <Input type="date" {...p} {...form.register(`valid_visas.${i}.valid_until`)} />}</Field>
                <Button type="button" variant="ghost" size="icon" aria-label="Remove visa" onClick={() => visas.remove(i)}><Trash2 /></Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => visas.append({ country: "", visa_type: "", valid_until: "", visited_from: "", visited_to: "" })}><Plus /> Add visa</Button>
          </div>
        )}
      </div>
      <div className="space-y-3">
        <YesNo form={form} name="visited_countries_past_12m" label="Travelled to other countries in the past 12 months" />
        {visited && (
          <div className="space-y-2 pl-6">
            {visits.fields.map((f, i) => (
              <div key={f.id} className="grid items-end gap-2 sm:grid-cols-[1fr_160px_160px_auto]">
                <Field label="Country">{(p) => <Input {...p} {...form.register(`visits.${i}.country`)} />}</Field>
                <Field label="From">{(p) => <Input type="date" {...p} {...form.register(`visits.${i}.visited_from`)} />}</Field>
                <Field label="To">{(p) => <Input type="date" {...p} {...form.register(`visits.${i}.visited_to`)} />}</Field>
                <Button type="button" variant="ghost" size="icon" aria-label="Remove visit" onClick={() => visits.remove(i)}><Trash2 /></Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => visits.append({ country: "", visa_type: "", valid_until: "", visited_from: "", visited_to: "" })}><Plus /> Add country</Button>
          </div>
        )}
      </div>
      <YesNo form={form} name="previous_china_visa" label="Has a previous China visa" />
      <YesNo form={form} name="previous_china_residence" label="Has a previous China residence permit" />
    </div>
  );
}

function SupportingDocuments({ form, studentId, categories, mode }: { form: Form; studentId: string; categories: string[]; mode: "create" | "edit" }) {
  const docs = useFieldArray({ control: form.control, name: "documents" });
  const cats = categories.length ? categories : ["Passport", "Other"];
  const [category, setCategory] = useState(cats[0]);
  const [expiry, setExpiry] = useState("");
  const errs = form.formState.errors.documents;
  return (
    <fieldset className="space-y-3 rounded-lg border p-4">
      <legend className="px-1 text-sm font-semibold">Supporting documents</legend>
      <p className="text-sm text-muted-foreground">
        Upload the passport scan and any other documents (photo, transcripts, certificates, bank statement…). Pick a category before uploading; you can change it per file below.
        {mode === "edit" && " Documents already on file are listed on the student's Documents & Files tab."}
      </p>
      <div className="grid gap-3 sm:grid-cols-[200px_170px_1fr] sm:items-end">
        <Field label="Category for next upload">
          {(p) => (
            <select className={nativeSelectClass} {...p} value={category} onChange={(e) => setCategory(e.target.value)}>
              {cats.map((c) => <option key={c}>{c}</option>)}
            </select>
          )}
        </Field>
        <Field label="Expiry date (optional)">{(p) => <Input type="date" {...p} value={expiry} onChange={(e) => setExpiry(e.target.value)} />}</Field>
        <FileUploader
          bucket="student-files"
          folder={studentId}
          compact
          label="Add documents (you can select several)"
          onUploaded={(f) => docs.append({ ...f, category, expiry_date: expiry })}
        />
      </div>
      {docs.fields.length > 0 && (
        <ul className="divide-y rounded-md border" aria-label="Documents to attach">
          {docs.fields.map((d, i) => (
            <li key={d.id} className="grid items-center gap-2 p-2 sm:grid-cols-[1fr_190px_160px_auto]">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="truncate text-sm" title={d.file_name}>{d.file_name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{bytes(d.size_bytes)}</span>
              </div>
              <select aria-label={`Category for ${d.file_name}`} className={nativeSelectClass} {...form.register(`documents.${i}.category`)}>
                {Array.from(new Set([...cats, d.category])).map((c) => <option key={c}>{c}</option>)}
              </select>
              <Input type="date" aria-label={`Expiry date for ${d.file_name}`} {...form.register(`documents.${i}.expiry_date`)} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${d.file_name}`}
                onClick={async () => {
                  docs.remove(i);
                  await createBrowserSupabase().storage.from("student-files").remove([d.file_path]);
                }}
              >
                <Trash2 />
              </Button>
              {errs?.[i] && (
                <p className="text-sm text-destructive sm:col-span-4">
                  {Object.values(errs[i] ?? {}).map((x) => (x as { message?: string })?.message).filter(Boolean).join(", ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {docs.fields.length > 0 && <p className="text-xs text-muted-foreground">{docs.fields.length} file(s) will be attached when you save the student (draft or final).</p>}
    </fieldset>
  );
}
