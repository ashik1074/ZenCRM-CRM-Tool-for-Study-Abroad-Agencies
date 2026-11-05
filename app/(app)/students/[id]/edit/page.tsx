import { notFound } from "next/navigation";
import { requirePagePermission } from "@/server/auth";
import { PageHeader } from "@/components/shared/page-header";
import { StudentForm } from "@/components/students/student-form";
import { getStaffOptions, getStudent, toFormInput } from "@/server/queries/students";
import { getLists } from "@/server/queries/settings";

export const metadata = { title: "Edit student" };

export default async function EditStudentPage({ params }: { params: { id: string } }) {
  await requirePagePermission("students", "edit");
  const student = await getStudent(params.id);
  if (!student || student.deleted_at) notFound();
  const [counselors, lists] = await Promise.all([getStaffOptions(), getLists()]);
  return (
    <>
      <PageHeader title={`Edit ${student.full_name}`} description="Every change is recorded in the audit log." />
      <StudentForm mode="edit" initial={toFormInput(student)} counselors={counselors} lists={lists} />
    </>
  );
}
