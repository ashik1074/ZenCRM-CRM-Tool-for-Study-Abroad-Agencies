import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: { searchParams: { next?: string; error?: string } }) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground">Use the email and password your administrator gave you.</p>
      </div>
      {searchParams.error === "inactive" && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Your account is deactivated or your session ended. Contact your administrator.
        </p>
      )}
      {searchParams.error === "timeout" && (
        <p role="status" className="rounded-md border bg-muted p-3 text-sm">You were signed out after a period of inactivity.</p>
      )}
      <LoginForm next={searchParams.next} />
    </div>
  );
}
