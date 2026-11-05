import Link from "next/link";
import { AlarmClock, CalendarClock, CheckCircle2, CircleDashed, Hourglass, ListTodo, TriangleAlert } from "lucide-react";
import { requirePagePermission } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { daysUntil, fmtDate, fmtMoney, fmtRelative } from "@/lib/format";
import { PRIORITY_RANK, TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OptionBadge, StatusBadge } from "@/components/shared/status-badge";
import { DueBadge } from "@/components/tasks/task-list";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { getStaffOptions } from "@/server/queries/students";
import { QuickActions } from "./quick-actions";

export const metadata = { title: "Dashboard" };

type Stats = {
  pending: number; in_progress: number; due_today: number; overdue: number; completed_week: number;
  admin?: { students_this_month: number; offers_this_month: number; visa_approved: number; visa_rejected: number };
  finance?: { income: number; expense: number };
};

export default async function DashboardPage() {
  const user = await requirePagePermission("dashboard");
  const supabase = createClient();
  const [{ data: stats }, { data: myTasks }, { data: activity }, { data: deadlines }, { data: sprints }, users] = await Promise.all([
    supabase.rpc("dashboard_stats"),
    supabase
      .from("tasks")
      .select("id, title, status, priority, due_date, sprint:sprints(name, status), student:students(id, full_name)")
      .eq("assignee_id", user.id)
      .is("deleted_at", null)
      .not("status", "in", "(done,rejected)")
      .limit(60),
    supabase.rpc("my_recent_activity", { p_limit: 10 }),
    supabase.rpc("upcoming_deadlines", { p_limit: 10 }),
    supabase.from("sprints").select("id, name, status").is("deleted_at", null).order("start_date", { ascending: false }),
    getStaffOptions(),
  ]);
  const s = (stats ?? { pending: 0, in_progress: 0, due_today: 0, overdue: 0, completed_week: 0 }) as Stats;

  type T = { id: string; title: string; status: string; priority: string; due_date: string | null; sprint: { name: string; status: string } | null; student: { id: string; full_name: string } | null };
  const tasks = ((myTasks ?? []) as unknown as T[]).sort((a, b) => {
    const act = Number(b.sprint?.status === "active") - Number(a.sprint?.status === "active");
    if (act) return act;
    const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (pr) return pr;
    return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
  }).slice(0, 12);

  const counts = [
    { label: "Pending", value: s.pending, icon: CircleDashed, href: "/tasks?status=todo", tone: "" },
    { label: "In progress", value: s.in_progress, icon: Hourglass, href: "/tasks?status=in_progress", tone: "" },
    { label: "Due today", value: s.due_today, icon: AlarmClock, href: "/tasks", tone: s.due_today ? "text-warning" : "" },
    { label: "Overdue", value: s.overdue, icon: TriangleAlert, href: "/tasks", tone: s.overdue ? "text-destructive" : "" },
    { label: "Completed this week", value: s.completed_week, icon: CheckCircle2, href: "/tasks?status=done", tone: "text-success" },
  ];
  const visaTotal = (s.admin?.visa_approved ?? 0) + (s.admin?.visa_rejected ?? 0);
  const options = { users, sprints: (sprints ?? []) as { id: string; name: string; status: string }[] };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {user.full_name.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground">{fmtDate(new Date(), "EEEE, dd MMMM yyyy")} · {user.role_name}</p>
        </div>
        <QuickActions
          options={options}
          can={{
            student: can(user.permissions, "students", "create"),
            task: can(user.permissions, "tasks", "create"),
            offer: can(user.permissions, "offers", "create"),
            finance: can(user.permissions, "finance", "create"),
          }}
        />
      </div>

      <section aria-label="My task counts" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {counts.map((c) => (
          <Link key={c.label} href={c.href} className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">{c.label}<c.icon className={`h-4 w-4 ${c.tone}`} aria-hidden /></div>
                <p className={`mt-2 text-3xl font-semibold ${c.tone}`} data-testid={`count-${c.label}`}>{c.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      {(s.admin || s.finance) && (
        <section aria-label="Agency this month" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {s.admin && (
            <>
              <Stat label="Students enrolled this month" value={String(s.admin.students_this_month)} href="/students" />
              <Stat label="Offers received this month" value={String(s.admin.offers_this_month)} hint="accepted applications" href="/reports" />
              <Stat label="Visa success rate" value={visaTotal ? `${Math.round((100 * s.admin.visa_approved) / visaTotal)}%` : "—"} hint={`${s.admin.visa_approved} approved · ${s.admin.visa_rejected} rejected`} href="/reports?tab=visa" />
            </>
          )}
          {s.finance && (
            <Stat
              label="Revenue vs expense (month)"
              value={fmtMoney(s.finance.income, "BDT", { compact: true })}
              hint={`Expense ${fmtMoney(s.finance.expense, "BDT", { compact: true })} · Net ${fmtMoney(s.finance.income - s.finance.expense, "BDT", { compact: true })}`}
              href="/finance"
              tone={s.finance.income >= s.finance.expense ? "text-success" : "text-destructive"}
            />
          )}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><ListTodo className="h-4 w-4" aria-hidden /> My tasks</CardTitle>
            <Link href="/tasks" className="text-sm text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nothing assigned to you. 🎉</p>
            ) : (
              <ul className="divide-y">
                {tasks.map((t) => (
                  <li key={t.id} className={`flex flex-wrap items-center gap-2 py-2 ${t.sprint?.status === "active" ? "border-l-4 border-l-primary pl-2" : "pl-3"}`}>
                    <Link href={`/dashboard?task=${t.id}`} scroll={false} className="min-w-0 flex-1 truncate font-medium hover:underline">{t.title}</Link>
                    <OptionBadge list={TASK_PRIORITIES} value={t.priority} />
                    <OptionBadge list={TASK_STATUSES} value={t.status} />
                    <DueBadge date={t.due_date} status={t.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4" aria-hidden /> Upcoming deadlines</CardTitle></CardHeader>
          <CardContent>
            {(deadlines ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No upcoming deadlines.</p>
            ) : (
              <ul className="space-y-2">
                {((deadlines ?? []) as { kind: string; ref_id: string; title: string; due: string; link: string }[]).map((d) => {
                  const days = daysUntil(d.due) ?? 0;
                  return (
                    <li key={`${d.kind}-${d.ref_id}`} className="flex items-start justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <Link href={d.link} className="block truncate font-medium hover:underline">{d.title}</Link>
                        <span className="text-xs text-muted-foreground">{d.kind === "task" ? "Task due" : d.kind === "offer_deadline" ? "Application deadline" : "Passport expiry"} · {fmtDate(d.due)}</span>
                      </div>
                      <StatusBadge tone={days <= 7 ? "red" : days <= 30 ? "amber" : "gray"}>{days === 0 ? "today" : `${days}d`}</StatusBadge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Recent activity</CardTitle></CardHeader>
        <CardContent>
          {(activity ?? []).length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No recent activity.</p>
          ) : (
            <ul className="divide-y">
              {((activity ?? []) as { at: string; actor: string | null; summary: string; link: string | null }[]).map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    <b>{a.actor ?? "System"}</b> · {a.link ? <Link href={a.link} className="hover:underline">{a.summary}</Link> : a.summary}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{fmtRelative(a.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <TaskDrawer options={options} perms={{ edit: can(user.permissions, "tasks", "edit"), delete: can(user.permissions, "tasks", "delete") }} meId={user.id} />
    </div>
  );
}

function Stat({ label, value, hint, href, tone }: { label: string; value: string; hint?: string; href: string; tone?: string }) {
  return (
    <Link href={href} className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full transition-colors hover:bg-muted/50">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className={`mt-2 text-2xl font-semibold ${tone ?? ""}`}>{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </CardContent>
      </Card>
    </Link>
  );
}
