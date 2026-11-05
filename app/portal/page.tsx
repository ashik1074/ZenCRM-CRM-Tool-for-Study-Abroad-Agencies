import { Check, Circle, X } from "lucide-react";
import { requireUser } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { STUDENT_STATUSES, APPLICATION_STATUSES, labelOf } from "@/lib/constants";
import { daysUntil, fmtDate, fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OptionBadge } from "@/components/shared/status-badge";
import { ChecklistTracker, type ChecklistItem } from "@/components/students/documents-panel";
import { getLists } from "@/server/queries/settings";
import { PortalUpload } from "./portal-upload";
import { CopyButton } from "./copy-button";

export const metadata = { title: "My portal" };

const PATH = ["inquiry", "registered", "documents_collecting", "applied", "offer_received", "jw202_received", "visa_applied", "visa_approved", "departed", "enrolled"];

export default async function PortalPage() {
  const user = await requireUser();
  const supabase = createClient();
  // RLS limits every query below to the signed-in student's own data
  const { data: student } = await supabase
    .from("students")
    .select("id, student_code, full_name, status, intake, phone, email, passport_no, passport_expiry_date, counselor:profiles!students_counselor_id_fkey(full_name, phone, email)")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!student) {
    return (
      <Card><CardContent className="p-8 text-center">
        <p className="text-lg font-medium">Welcome, {user.full_name}</p>
        <p className="mt-2 text-sm text-muted-foreground">Your account isn&apos;t linked to a student profile yet. Please contact your counselor.</p>
      </CardContent></Card>
    );
  }
  const s = student as unknown as { id: string; student_code: string; full_name: string; status: string; intake: string | null; passport_no: string | null; passport_expiry_date: string | null; counselor: { full_name: string; phone: string | null; email: string } | null };

  const [{ data: history }, { data: checklist }, { data: docs }, { data: apps }, { data: plans }, { data: payments }, { data: kb }, lists] = await Promise.all([
    supabase.from("student_status_history").select("to_status, changed_at").eq("student_id", s.id).order("changed_at"),
    supabase.rpc("student_checklist", { p_student: s.id }),
    supabase.from("student_documents").select("id, category, file_name, created_at").eq("student_id", s.id).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("applications").select("id, status, applied_at, decision_at, offer:offers(title, program, intake), university:universities(name, city)").eq("student_id", s.id).is("deleted_at", null),
    supabase.from("fee_plans").select("id, title, total_amount, currency, installments:fee_installments(id, label, due_date, amount, paid_amount, sort_order)").eq("student_id", s.id).is("deleted_at", null),
    supabase.from("transactions").select("id, txn_date, amount, currency, payment_method, receipt_no").eq("student_id", s.id).eq("type", "income").is("deleted_at", null).order("txn_date", { ascending: false }),
    supabase.from("kb_entries").select("title, body").eq("title", "Document Checklist for Visa Interview").is("deleted_at", null).maybeSingle(),
    getLists(),
  ]);

  const reached = new Map((history ?? []).map((h: { to_status: string; changed_at: string }) => [h.to_status, h.changed_at]));
  const offPath = !PATH.includes(s.status);
  const currentIdx = PATH.indexOf(s.status);
  const expiry = daysUntil(s.passport_expiry_date);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Hello, {s.full_name.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">{s.student_code}{s.intake && ` · Intake ${s.intake}`} · Counselor: {s.counselor?.full_name ?? "not assigned yet"}{s.counselor?.phone && ` (${s.counselor.phone})`}</p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">My application progress</CardTitle>
          <OptionBadge list={STUDENT_STATUSES} value={s.status} />
        </CardHeader>
        <CardContent>
          {offPath && <p className="mb-3 text-sm">Current status: <b>{labelOf(STUDENT_STATUSES, s.status)}</b>{reached.get(s.status) && ` since ${fmtDate(reached.get(s.status))}`}</p>}
          <ol className="relative space-y-3 border-l pl-6" aria-label="Pipeline timeline">
            {PATH.map((st, i) => {
              const done = reached.has(st) && (i <= currentIdx || offPath);
              const current = st === s.status;
              return (
                <li key={st} className="relative">
                  <span className={cn("absolute -left-[33px] flex h-5 w-5 items-center justify-center rounded-full border-2 bg-background", done ? "border-success bg-success text-success-foreground" : current ? "border-primary" : "border-muted-foreground/30")} aria-hidden>
                    {done ? <Check className="h-3 w-3" /> : <Circle className="h-2 w-2" />}
                  </span>
                  <p className={cn("text-sm", current ? "font-semibold text-primary" : done ? "font-medium" : "text-muted-foreground")}>
                    {labelOf(STUDENT_STATUSES, st)}{current && " — current"}
                  </p>
                  {reached.get(st) && <p className="text-xs text-muted-foreground">{fmtDate(reached.get(st))}</p>}
                </li>
              );
            })}
            {s.status === "visa_rejected" && <li className="relative"><span className="absolute -left-[33px] flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"><X className="h-3 w-3" /></span><p className="text-sm font-semibold text-destructive">Visa rejected — your counselor will contact you about next steps.</p></li>}
          </ol>
        </CardContent>
      </Card>

      {expiry !== null && expiry < 183 && (
        <p role="alert" className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          Your passport {expiry < 0 ? "has expired" : `expires on ${fmtDate(s.passport_expiry_date)}`}. China requires at least 6 months&apos; validity — please renew it and upload the new copy.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChecklistTracker items={(checklist ?? []) as ChecklistItem[]} />
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Upload documents</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <PortalUpload studentId={s.id} categories={lists.documentCategories} />
            <ul className="divide-y text-sm">
              {(docs ?? []).map((d: { id: string; category: string; file_name: string; created_at: string }) => (
                <li key={d.id} className="flex justify-between gap-2 py-1.5"><span className="truncate">{d.file_name}</span><span className="shrink-0 text-xs text-muted-foreground">{d.category} · {fmtDate(d.created_at)}</span></li>
              ))}
              {(docs ?? []).length === 0 && <li className="py-2 text-muted-foreground">No documents uploaded yet.</li>}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">My applications & offers</CardTitle></CardHeader>
        <CardContent>
          {(apps ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No applications yet.</p> : (
            <ul className="divide-y">
              {((apps ?? []) as unknown as { id: string; status: string; applied_at: string; decision_at: string | null; offer: { title: string; program: string; intake: string | null } | null; university: { name: string; city: string | null } | null }[]).map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <p className="font-medium">{a.university?.name}{a.university?.city && `, ${a.university.city}`}</p>
                    <p className="text-xs text-muted-foreground">{a.offer?.title} · {a.offer?.program}{a.offer?.intake && ` · ${a.offer.intake}`} · applied {fmtDate(a.applied_at)}</p>
                  </div>
                  <OptionBadge list={APPLICATION_STATUSES} value={a.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Fees & dues</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(plans ?? []).length === 0 && <p className="text-sm text-muted-foreground">No fee plan yet.</p>}
            {((plans ?? []) as unknown as { id: string; title: string; total_amount: number; currency: string; installments: { id: string; label: string; due_date: string; amount: number; paid_amount: number; sort_order: number }[] }[]).map((p) => {
              const paid = p.installments.reduce((x, i) => x + Number(i.paid_amount), 0);
              return (
                <div key={p.id} className="space-y-1 text-sm">
                  <p className="font-medium">{p.title}: {fmtMoney(p.total_amount, p.currency)} · paid {fmtMoney(paid, p.currency)} · <b>due {fmtMoney(Number(p.total_amount) - paid, p.currency)}</b></p>
                  <ul className="text-xs">
                    {[...p.installments].sort((a, b) => a.sort_order - b.sort_order).map((i) => {
                      const left = Number(i.amount) - Number(i.paid_amount);
                      const late = left > 0 && (daysUntil(i.due_date) ?? 0) < 0;
                      return <li key={i.id} className={cn("flex justify-between border-t py-1", late && "font-medium text-destructive")}><span>{i.label} · due {fmtDate(i.due_date)}{late && " (overdue)"}</span><span>{left <= 0 ? "Paid" : `${fmtMoney(left, p.currency)} left`}</span></li>;
                    })}
                  </ul>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Payment history</CardTitle></CardHeader>
          <CardContent>
            {(payments ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No payments yet.</p> : (
              <ul className="divide-y text-sm">
                {(payments ?? []).map((p: { id: string; txn_date: string; amount: number; currency: string; payment_method: string; receipt_no: string | null }) => (
                  <li key={p.id} className="flex justify-between py-1.5"><span>{fmtDate(p.txn_date)} · {p.payment_method}{p.receipt_no && ` · ${p.receipt_no}`}</span><span className="font-medium">{fmtMoney(p.amount, p.currency)}</span></li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {kb && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">{kb.title}</CardTitle>
            <CopyButton text={kb.body} />
          </CardHeader>
          <CardContent><pre className="whitespace-pre-wrap break-words font-sans text-sm">{kb.body}</pre></CardContent>
        </Card>
      )}
    </div>
  );
}
