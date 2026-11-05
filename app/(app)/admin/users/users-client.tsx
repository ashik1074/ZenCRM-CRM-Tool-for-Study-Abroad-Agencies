"use client";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { KeyRound, Loader2, MoreHorizontal, Pencil, Plus, Power, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Field, nativeSelectClass } from "@/components/shared/field";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { fmtDateTime } from "@/lib/format";
import { createUser, resetUserPassword, sendResetEmail, setUserActive, updateUser } from "@/server/actions/users";

export type UserRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  role_id: string;
  roles: { name: string; key: string } | null;
};
type Role = { id: string; name: string; key: string; portal: string };
type Student = { id: string; full_name: string; student_code: string; user_id: string | null };

const formSchema = z.object({
  full_name: z.string().trim().min(2, "Enter the full name"),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().optional(),
  role_id: z.string().uuid("Choose a role"),
  password: z.string().optional(),
  student_id: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

const PAGE = 20;

export function UsersClient({ users, roles, students }: { users: UserRow[]; roles: Role[]; students: Student[] }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<UserRow | "new" | null>(null);
  const [resetting, setResetting] = useState<UserRow | null>(null);

  const filtered = useMemo(() => {
    const t = q.toLowerCase();
    return users.filter((u) => !t || u.full_name.toLowerCase().includes(t) || u.email.toLowerCase().includes(t) || u.roles?.name.toLowerCase().includes(t));
  }, [users, q]);
  const rows = filtered.slice((page - 1) * PAGE, page * PAGE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));

  return (
    <>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input aria-label="Search users" placeholder="Search name, email, role…" className="pl-8" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus /> New user
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.id} className={!u.is_active ? "opacity-60" : undefined}>
                <TableCell className="font-medium">{u.full_name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.roles?.name}</TableCell>
                <TableCell>{u.is_active ? <StatusBadge tone="green">Active</StatusBadge> : <StatusBadge tone="red">Deactivated</StatusBadge>}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{u.last_login_at ? fmtDateTime(u.last_login_at) : "Never"}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Actions for ${u.full_name}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing(u)}>
                        <Pencil /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setResetting(u)}>
                        <KeyRound /> Reset password
                      </DropdownMenuItem>
                      <ActiveToggle user={u} />
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No users match your search.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t px-4 py-2 text-sm text-muted-foreground">
          <span>{filtered.length} users</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <span>Page {page} of {pages}</span>
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      </div>
      {editing && <UserDialog user={editing === "new" ? null : editing} roles={roles} students={students} onClose={() => setEditing(null)} />}
      {resetting && <ResetDialog user={resetting} onClose={() => setResetting(null)} />}
    </>
  );
}

function ActiveToggle({ user }: { user: UserRow }) {
  return (
    <ConfirmDialog
      trigger={
        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className={user.is_active ? "text-destructive" : undefined}>
          <Power /> {user.is_active ? "Deactivate" : "Reactivate"}
        </DropdownMenuItem>
      }
      title={user.is_active ? `Deactivate ${user.full_name}?` : `Reactivate ${user.full_name}?`}
      description={user.is_active ? "They will be signed out and won't be able to log in. Their data and history are kept." : "They will be able to log in again."}
      confirmLabel={user.is_active ? "Deactivate" : "Reactivate"}
      destructive={user.is_active}
      onConfirm={async () => {
        const r = await setUserActive(user.id, !user.is_active);
        r.ok ? toast.success(r.message) : toast.error(r.error);
      }}
    />
  );
}

function UserDialog({ user, roles, students, onClose }: { user: UserRow | null; roles: Role[]; students: Student[]; onClose: () => void }) {
  const [pending, start] = useTransition();
  const linked = students.find((s) => s.user_id === user?.id);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      full_name: user?.full_name ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
      role_id: user?.role_id ?? roles.find((r) => r.key === "operator")?.id ?? "",
      password: "",
      student_id: linked?.id ?? "",
    },
  });
  const roleId = form.watch("role_id");
  const isStudentRole = roles.find((r) => r.id === roleId)?.portal === "student";
  const e = form.formState.errors;

  const submit = form.handleSubmit((v) => {
    if (!user && (!v.password || v.password.length < 8)) {
      form.setError("password", { message: "Use at least 8 characters" });
      return;
    }
    start(async () => {
      const payload = { ...v, student_id: isStudentRole ? v.student_id : "" };
      const r = user ? await updateUser({ ...payload, id: user.id }) : await createUser({ ...payload, password: v.password! });
      if (r.ok) {
        toast.success(r.message);
        onClose();
      } else toast.error(r.error);
    });
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? "Edit user" : "New user"}</DialogTitle>
          <DialogDescription>{user ? "Update details and role." : "The user can sign in immediately with this password."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3" noValidate>
          <Field label="Full name" required error={e.full_name?.message}>{(p) => <Input {...p} {...form.register("full_name")} />}</Field>
          <Field label="Email" required error={e.email?.message}>{(p) => <Input type="email" disabled={!!user} {...p} {...form.register("email")} />}</Field>
          <Field label="Phone" error={e.phone?.message}>{(p) => <Input {...p} {...form.register("phone")} />}</Field>
          <Field label="Role" required error={e.role_id?.message}>
            {(p) => (
              <select className={nativeSelectClass} {...p} {...form.register("role_id")}>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            )}
          </Field>
          {isStudentRole && (
            <Field label="Linked student record" hint="The portal shows this student's profile, documents and payments.">
              {(p) => (
                <select className={nativeSelectClass} {...p} {...form.register("student_id")}>
                  <option value="">— Not linked —</option>
                  {students.filter((s) => !s.user_id || s.user_id === user?.id).map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name} ({s.student_code})</option>
                  ))}
                </select>
              )}
            </Field>
          )}
          {!user && <Field label="Initial password" required error={e.password?.message}>{(p) => <Input type="text" autoComplete="new-password" {...p} {...form.register("password")} />}</Field>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />} {user ? "Save" : "Create user"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [pending, start] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password for {user.full_name}</DialogTitle>
          <DialogDescription>Set a new password now, or email the user a reset link.</DialogDescription>
        </DialogHeader>
        <Field label="New password" hint="At least 8 characters">{(p) => <Input {...p} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />}</Field>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => start(async () => {
              const r = await sendResetEmail(user.email);
              r.ok ? toast.success(r.message) : toast.error(r.error);
              if (r.ok) onClose();
            })}
          >
            Email reset link
          </Button>
          <Button
            disabled={pending || password.length < 8}
            onClick={() => start(async () => {
              const r = await resetUserPassword({ id: user.id, password });
              r.ok ? toast.success(r.message) : toast.error(r.error);
              if (r.ok) onClose();
            })}
          >
            {pending && <Loader2 className="animate-spin" />} Set password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
