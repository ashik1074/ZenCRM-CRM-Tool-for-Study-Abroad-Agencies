import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Access denied" };

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <ShieldAlert className="h-12 w-12 text-destructive" aria-hidden />
      <h1 className="text-2xl font-semibold">403 — Access denied</h1>
      <p className="max-w-md text-muted-foreground">
        Your role doesn&apos;t have permission to open this page. If you think this is a mistake, ask your System Administrator.
      </p>
      <Button asChild>
        <Link href="/">Go to my home page</Link>
      </Button>
    </main>
  );
}
