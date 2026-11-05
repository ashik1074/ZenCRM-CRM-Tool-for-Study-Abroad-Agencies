import { requirePagePermission } from "@/server/auth";
import { PageHeader } from "@/components/shared/page-header";
import { StudentForm } from "@/components/students/student-form";
import { getStaffOptions } from "@/server/queries/students";
import { getLists } from "@/server/queries/settings";

export const metadata = { title: "Enroll student" };

export default async function NewStudentPage() {
  const user = await requirePagePermission("students", "create");
  const [counselors, lists] = await Promise.all([getStaffOptions(), getLists()]);
  return (
    <>
      <PageHeader title="Enroll student" description="Complete the steps below. You can save a draft at any point and finish later." />
      <StudentForm mode="create" counselors={counselors} lists={lists} initial={{ counselor_id: user.id } as never} />
    </>
  );
}
