import { requirePagePermission } from "@/server/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { ImportWizard } from "./import-wizard";

export const metadata = { title: "Bulk import" };

export default async function ImportPage() {
  const user = await requirePagePermission("import");
  return (
    <>
      <PageHeader title="Bulk import" description="Import students or offers from Excel (.xlsx) or CSV. Map columns, review the validation preview, then import." />
      <ImportWizard canStudents={can(user.permissions, "students", "create")} canOffers={can(user.permissions, "offers", "create")} canImport={can(user.permissions, "import", "create")} />
    </>
  );
}
