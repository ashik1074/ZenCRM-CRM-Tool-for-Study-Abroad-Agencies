import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePagePermission } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { listParams, type SearchParams } from "@/lib/url";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { studentsQuery, getStaffOptions } from "@/server/queries/students";
import { getLists } from "@/server/queries/settings";
import { getSignedUrls } from "@/server/actions/files";
import { StudentsTable, type StudentListRow } from "./students-table";
import { StudentFilters } from "./student-filters";

export const metadata = { title: "Students" };

export default async function StudentsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePagePermission("students");
  const { page, size, sort, dir, from, to } = listParams(searchParams, { sort: "created" });
  const { data, count } = await studentsQuery(
    searchParams,
    `id, student_code, full_name, phone, photo_path, status, is_draft, intake, created_at,
     counselor:profiles!students_counselor_id_fkey(full_name), apps:applications(count)`,
    { count: true, meId: user.id },
  ).range(from, to);

  const rows = (data ?? []) as unknown as StudentListRow[];
  const photos = await getSignedUrls("student-files", rows.map((r) => r.photo_path!).filter(Boolean));
  const [counselors, lists, { data: universities }] = await Promise.all([
    getStaffOptions(),
    getLists(),
    createClient().from("universities").select("id, name").is("deleted_at", null).order("name"),
  ]);

  return (
    <>
      <PageHeader
        title="Students"
        description={`${count ?? 0} students`}
        actions={
          can(user.permissions, "students", "create") && (
            <Button asChild>
              <Link href="/students/new"><Plus /> Enroll student</Link>
            </Button>
          )
        }
      />
      <StudentFilters
        counselors={counselors}
        intakes={lists.intakes}
        sources={lists.leadSources}
        universities={(universities ?? []) as { id: string; name: string }[]}
        canExport={can(user.permissions, "students", "export")}
      />
      <StudentsTable
        rows={rows.map((r) => ({ ...r, photo_url: r.photo_path ? photos[r.photo_path] ?? null : null }))}
        total={count ?? 0}
        page={page}
        size={size}
        sort={sort}
        dir={dir}
        canCreate={can(user.permissions, "students", "create")}
      />
    </>
  );
}
