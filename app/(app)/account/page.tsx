import { requireUser } from "@/server/auth";
import { PageHeader } from "@/components/shared/page-header";
import { AccountForms } from "@/components/shared/account-forms";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="My account" />
      <AccountForms user={user} />
    </>
  );
}
