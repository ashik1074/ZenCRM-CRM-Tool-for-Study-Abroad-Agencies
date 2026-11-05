"use client";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Lock, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field, nativeSelectClass } from "@/components/shared/field";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import { ACTIONS, LOCKED_MODULES, MODULES } from "@/lib/permissions";
import { deleteRole, saveRole, setRolePermissions } from "@/server/actions/users";

type Role = { id: string; key: string; name: string; description: string | null; is_system: boolean; portal: string };
type Perm = { id: string; module: string; action: string };

export function RolesClient({
  roles,
  permissions,
  grants,
  userCounts,
}: {
  roles: Role[];
  permissions: Perm[];
  grants: { role_id: string; permission_id: string }[];
  userCounts: Record<string, number>;
}) {
  const [selected, setSelected] = useState(roles.find((r) => r.key !== "system_admin")?.id ?? roles[0]?.id);
  const [creating, setCreating] = useState(false);
  const role = roles.find((r) => r.id === selected)!;
  const permId = useMemo(() => new Map(permissions.map((p) => [`${p.module}:${p.action}`, p.id])), [permissions]);
  const initial = useMemo(() => new Set(grants.filter((g) => g.role_id === selected).map((g) => g.permission_id)), [grants, selected]);
  const [checked, setChecked] = useState<Set<string>>(initial);
  const [lastRole, setLastRole] = useState(selected);
  if (lastRole !== selected) {
    setLastRole(selected);
    setChecked(initial);
  }
  const [pending, start] = useTransition();
  const isSysAdmin = role?.key === "system_admin";
  const dirty = checked.size !== initial.size || Array.from(checked).some((c) => !initial.has(c));

  const toggle = (id: string | undefined, on: boolean) => {
    if (!id) return;
    const next = new Set(checked);
    on ? next.add(id) : next.delete(id);
    setChecked(next);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Roles</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <Plus /> New
          </Button>
        </CardHeader>
        <CardContent className="space-y-1 p-2">
          {roles.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelected(r.id)}
              aria-pressed={r.id === selected}
              className={cn("flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted", r.id === selected && "bg-accent text-accent-foreground")}
            >
              <span className="font-medium">{r.name}</span>
              <span className="text-xs text-muted-foreground">{userCounts[r.id] ?? 0} users</span>
            </button>
          ))}
        </CardContent>
      </Card>

      {role && (
        <Card>
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                {role.name} {role.is_system && <StatusBadge tone="slate">Built-in</StatusBadge>}
                {role.portal === "student" && <StatusBadge tone="sky">Student portal</StatusBadge>}
              </CardTitle>
              {role.description && <p className="mt-1 text-sm text-muted-foreground">{role.description}</p>}
            </div>
            <div className="flex gap-2">
              {!role.is_system && (
                <ConfirmDialog
                  trigger={<Button variant="outline" size="sm"><Trash2 /> Delete role</Button>}
                  title={`Delete role "${role.name}"?`}
                  description="Roles with users assigned can't be deleted."
                  onConfirm={async () => {
                    const r = await deleteRole(role.id);
                    r.ok ? toast.success(r.message) : toast.error(r.error);
                  }}
                />
              )}
              {!isSysAdmin && (
                <Button
                  size="sm"
                  disabled={!dirty || pending}
                  onClick={() => start(async () => {
                    const r = await setRolePermissions(role.id, Array.from(checked));
                    r.ok ? toast.success(r.message) : toast.error(r.error);
                  })}
                >
                  {pending ? <Loader2 className="animate-spin" /> : <Save />} Save changes
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isSysAdmin ? (
              <p className="rounded-md border bg-muted p-4 text-sm">
                <Lock className="mr-2 inline h-4 w-4" aria-hidden />
                The System Administrator always has every permission, including users, roles and permissions. This can&apos;t be changed.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Module</TableHead>
                      {ACTIONS.map((a) => (
                        <TableHead key={a} className="text-center capitalize">{a}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MODULES.map((m) => {
                      const locked = LOCKED_MODULES.includes(m.key);
                      return (
                        <TableRow key={m.key} className={locked ? "opacity-60" : undefined}>
                          <TableCell className="font-medium">
                            {m.label}
                            {locked && <Lock className="ml-1 inline h-3 w-3" aria-label="System Administrator only" />}
                          </TableCell>
                          {ACTIONS.map((a) => {
                            const id = permId.get(`${m.key}:${a}`);
                            return (
                              <TableCell key={a} className="text-center">
                                <Checkbox
                                  aria-label={`${m.label}: ${a}`}
                                  disabled={locked || !id}
                                  checked={!!id && checked.has(id)}
                                  onCheckedChange={(v) => toggle(id, v === true)}
                                />
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {creating && <RoleDialog onClose={() => setCreating(false)} onCreated={(id) => setSelected(id)} />}
    </div>
  );
}

function RoleDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [portal, setPortal] = useState<"staff" | "student">("staff");
  const [pending, start] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New role</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Role name" required>{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Description">{(p) => <Textarea {...p} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
          <Field label="Portal" hint="Student-portal roles only see the student portal.">
            {(p) => (
              <select className={nativeSelectClass} {...p} value={portal} onChange={(e) => setPortal(e.target.value as "staff" | "student")}>
                <option value="staff">Staff app</option>
                <option value="student">Student portal</option>
              </select>
            )}
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={pending || name.trim().length < 2}
            onClick={() => start(async () => {
              const r = await saveRole({ name, description, portal });
              if (r.ok) {
                toast.success(r.message);
                onCreated(r.data.id);
                onClose();
              } else toast.error(r.error);
            })}
          >
            {pending && <Loader2 className="animate-spin" />} Create role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
