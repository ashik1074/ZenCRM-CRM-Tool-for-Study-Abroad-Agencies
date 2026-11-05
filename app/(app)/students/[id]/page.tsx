import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Mail, MessageCircle, Pencil, Phone, Trash2 } from "lucide-react";
import { requirePagePermission } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { STUDENT_STATUSES } from "@/lib/constants";
import { daysUntil, fmtDate, humanize, initials } from "@/lib/format";
import { fillVisaSheet, type VisaSheetStudent } from "@/lib/visa-sheet";
import { getStudent } from "@/server/queries/students";
import { getLists } from "@/server/queries/settings";
import { getSignedUrls } from "@/server/actions/files";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OptionBadge, StatusBadge } from "@/components/shared/status-badge";
import { StatusChanger } from "@/components/students/status-changer";
import { VisaSheetButton } from "@/components/students/visa-sheet-button";
import { ChecklistTracker, DocumentsPanel, type ChecklistItem } from "@/components/students/documents-panel";
import { NotesPanel } from "@/components/students/notes-panel";
import { DeleteStudentButton } from "@/components/students/delete-student-button";
import { ApplicationsTab } from "@/components/students/tabs/applications-tab";
import { PaymentsTab } from "@/components/students/tabs/payments-tab";
import { TasksTab } from "@/components/students/tabs/tasks-tab";

export const metadata = { title: "Student" };

const TABS = [
  ["overview", "Overview"], ["education", "Education"], ["work", "Work"], ["family", "Family"], ["travel", "Travel History"],
  ["applications", "Applications & Offers"], ["documents", "Documents & Files"], ["payments", "Payments"], ["tasks", "Tasks"], ["notes", "Notes & Activity"],
] as const;

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value === null || value === undefined || value === "" ? "—" : value}</dd>
    </div>
  );
}

export default async function StudentDetailsPage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string } }) {
  const user = await requirePagePermission("students");
  const student = await getStudent(params.id);
  if (!student) notFound();
  const tab = TABS.some(([k]) => k === searchParams.tab) ? searchParams.tab! : "overview";
  const supabase = createClient();
  const canEdit = can(user.permissions, "students", "edit");
  const photo = student.photo_path ? (await getSignedUrls("student-files", [student.photo_path]))[student.photo_path] : null;
  const expiryDays = daysUntil(student.passport_expiry_date);

  // KB template for the visa info sheet
  const { data: kb } = await supabase.from("kb_entries").select("body_text").eq("title", "Document Checklist for Visa Interview").is("deleted_at", null).maybeSingle();
  const sheet = kb?.body_text ? fillVisaSheet(kb.body_text, student as unknown as VisaSheetStudent) : null;

  const base = `/students/${student.id}`;
  return (
    <div className="space-y-4">
      {student.deleted_at && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">This student is in Deleted items. Restore it from the Deleted items page.</p>
      )}
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-6">
          <Avatar className="h-20 w-20 rounded-lg">
            {photo && <AvatarImage src={photo} alt={student.full_name} className="object-cover" />}
            <AvatarFallback className="rounded-lg text-lg">{initials(student.full_name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{student.full_name}</h1>
              <OptionBadge list={STUDENT_STATUSES} value={student.status} />
              {student.is_draft && <StatusBadge tone="amber">Draft</StatusBadge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {student.student_code} · Counselor: <span className="font-medium text-foreground">{student.counselor?.full_name ?? "Unassigned"}</span>
              {student.intake && <> · Intake {student.intake}</>}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {student.phone && <a href={`tel:${student.phone}`} className="inline-flex items-center gap-1 hover:underline"><Phone className="h-3.5 w-3.5" aria-hidden />{student.phone}</a>}
              {student.whatsapp && <a href={`https://wa.me/${student.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline"><MessageCircle className="h-3.5 w-3.5" aria-hidden />WhatsApp</a>}
              {student.email && <a href={`mailto:${student.email}`} className="inline-flex items-center gap-1 hover:underline"><Mail className="h-3.5 w-3.5" aria-hidden />{student.email}</a>}
            </div>
            {expiryDays !== null && expiryDays < 183 && (
              <p className="inline-flex items-center gap-1 text-sm text-warning"><AlertTriangle className="h-4 w-4" aria-hidden />
                {expiryDays < 0 ? `Passport expired ${fmtDate(student.passport_expiry_date)}` : `Passport expires in ${expiryDays} days (${fmtDate(student.passport_expiry_date)})`}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {canEdit && !student.deleted_at && (
              <>
                <Button asChild><Link href={`${base}/edit`}><Pencil /> Edit</Link></Button>
                <StatusChanger id={student.id} status={student.status} />
              </>
            )}
            <VisaSheetButton sheet={sheet} studentName={student.full_name} />
            {can(user.permissions, "students", "delete") && !student.deleted_at && <DeleteStudentButton id={student.id} name={student.full_name} />}
          </div>
        </CardContent>
      </Card>

      <nav aria-label="Student sections" className="-mx-3 overflow-x-auto px-3">
        <ul className="flex w-max gap-1 border-b">
          {TABS.map(([k, label]) => (
            <li key={k}>
              <Link
                href={k === "overview" ? base : `${base}?tab=${k}`}
                scroll={false}
                aria-current={tab === k ? "page" : undefined}
                className={cn("-mb-px inline-block border-b-2 px-3 py-2 text-sm font-medium", tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-base">Personal & passport</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-3">
                <Info label="Gender" value={humanize(student.gender)} />
                <Info label="Date of birth" value={fmtDate(student.date_of_birth)} />
                <Info label="Nationality" value={student.nationality as string} />
                <Info label="Passport no." value={student.passport_no} />
                <Info label="Passport issued" value={fmtDate(student.passport_issue_date)} />
                <Info label="Passport expiry" value={fmtDate(student.passport_expiry_date)} />
                <Info label="Present address" value={student.present_address as string} />
                <Info label="Permanent address" value={student.permanent_address as string} />
                <Info label="Lead source" value={[student.lead_source, student.referred_by && `ref. ${student.referred_by}`].filter(Boolean).join(" · ")} />
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Study preferences & language</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-3">
                <Info label="Program level" value={student.intended_program_level as string} />
                <Info label="Majors" value={(student.preferred_majors as string[]).join(", ")} />
                <Info label="Cities / universities" value={[...(student.preferred_cities as string[]), ...(student.preferred_universities as string[])].join(", ")} />
                <Info label="Scholarship wanted" value={student.scholarship_type as string} />
                <Info label="Language" value={[student.hsk_level, student.ielts_score && `IELTS ${student.ielts_score}`, student.other_language_scores].filter(Boolean).join(" · ")} />
              </dl>
            </CardContent>
          </Card>
          {student.notes ? (
            <Card className="lg:col-span-3">
              <CardHeader className="pb-2"><CardTitle className="text-base">Internal notes</CardTitle></CardHeader>
              <CardContent><p className="whitespace-pre-wrap text-sm">{student.notes as string}</p></CardContent>
            </Card>
          ) : null}
        </div>
      )}

      {tab === "education" && (
        <Card><CardContent className="p-0">
          <SimpleTable
            empty="No education records."
            head={["Level", "Institution", "Degree", "Major", "Year", "GPA"]}
            rows={student.education.map((e) => [e.level, e.institution, e.degree, e.major, e.passing_year, e.gpa] as React.ReactNode[])}
          />
        </CardContent></Card>
      )}

      {tab === "work" && (
        <div className="grid gap-3 md:grid-cols-2">
          {student.work.length === 0 && <p className="text-sm text-muted-foreground">No work experience.</p>}
          {student.work.map((w) => (
            <Card key={w.id as string}>
              <CardHeader className="pb-2"><CardTitle className="text-base">{w.company as string}</CardTitle></CardHeader>
              <CardContent>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Info label="Position" value={w.position as string} />
                  <Info label="Period" value={`${fmtDate(w.start_date as string)} – ${w.end_date ? fmtDate(w.end_date as string) : "present"}`} />
                  <Info label="Duty" value={w.duty as string} />
                  <Info label="Address" value={w.address as string} />
                  <Info label="Employer phone" value={w.employer_phone as string} />
                  <Info label="Supervisor" value={[w.supervisor_name, w.supervisor_phone].filter(Boolean).join(" · ")} />
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === "family" && (
        <Card><CardContent className="p-0">
          <SimpleTable empty="No family members recorded." head={["Relation", "Name", "Date of birth"]} rows={student.family.map((f) => [humanize(f.relation), f.name, fmtDate(f.date_of_birth)])} />
        </CardContent></Card>
      )}

      {tab === "travel" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Visa & China history</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-2">
                <Info label="Valid foreign visas" value={student.has_valid_foreign_visa ? "Yes" : "No"} />
                <Info label="Travelled in past 12 months" value={student.visited_countries_past_12m ? "Yes" : "No"} />
                <Info label="Previous China visa" value={student.previous_china_visa ? "Yes" : "No"} />
                <Info label="Previous China residence" value={student.previous_china_residence ? "Yes" : "No"} />
              </dl>
            </CardContent>
          </Card>
          <Card><CardContent className="p-0">
            <SimpleTable
              empty="No visas or trips recorded."
              head={["Type", "Country", "Details"]}
              rows={student.travel.map((t) => [
                t.kind === "valid_visa" ? "Valid visa" : "Visit",
                t.country,
                t.kind === "valid_visa" ? [t.visa_type, t.valid_until && `until ${fmtDate(t.valid_until)}`].filter(Boolean).join(" ") : `${fmtDate(t.visited_from)} – ${fmtDate(t.visited_to)}`,
              ])}
            />
          </CardContent></Card>
        </div>
      )}

      {tab === "applications" && <ApplicationsTab studentId={student.id} user={user} />}
      {tab === "documents" && <DocumentsTab studentId={student.id} canEdit={canEdit} />}
      {tab === "payments" && <PaymentsTab studentId={student.id} studentName={student.full_name} user={user} />}
      {tab === "tasks" && <TasksTab studentId={student.id} user={user} />}
      {tab === "notes" && <NotesTab studentId={student.id} meId={user.id} />}
    </div>
  );
}

function SimpleTable({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (!rows.length) return <p className="p-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>{head.map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-0">{r.map((c, j) => <td key={j} className="px-4 py-2">{c ?? "—"}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function DocumentsTab({ studentId, canEdit }: { studentId: string; canEdit: boolean }) {
  const supabase = createClient();
  const [{ data: docs }, { data: checklist }, lists] = await Promise.all([
    supabase.from("student_documents").select("id, category, file_path, file_name, mime_type, size_bytes, expiry_date, created_at").eq("student_id", studentId).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.rpc("student_checklist", { p_student: studentId }),
    getLists(),
  ]);
  return (
    <div className="space-y-4">
      <ChecklistTracker items={(checklist ?? []) as ChecklistItem[]} />
      <DocumentsPanel studentId={studentId} files={docs ?? []} categories={lists.documentCategories} canUpload={canEdit} canDelete={canEdit} />
    </div>
  );
}

async function NotesTab({ studentId, meId }: { studentId: string; meId: string }) {
  const supabase = createClient();
  const [{ data: notes }, { data: activity }] = await Promise.all([
    supabase.from("student_notes").select("id, body, created_at, author_id, author:profiles!student_notes_author_id_fkey(full_name)").eq("student_id", studentId).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.rpc("student_activity", { p_student: studentId, p_limit: 60 }),
  ]);
  return <NotesPanel studentId={studentId} notes={(notes ?? []) as never} activity={(activity ?? []) as never} meId={meId} />;
}
