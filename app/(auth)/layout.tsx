import { GraduationCap } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <GraduationCap className="h-6 w-6" aria-hidden /> ZenCRM
        </div>
        <div className="space-y-3">
          <p className="text-3xl font-semibold leading-tight">From first inquiry to enrolment in China — in one place.</p>
          <p className="text-primary-foreground/80">Students, offers, visas, tasks and finance for your agency team.</p>
        </div>
        <p className="text-sm text-primary-foreground/70">Dhaka, Bangladesh</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </main>
  );
}
