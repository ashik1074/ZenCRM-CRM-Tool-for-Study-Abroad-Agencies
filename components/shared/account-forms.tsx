"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/shared/field";
import { changeMyPassword, updateMyProfile } from "@/server/actions/account";

export function AccountForms({ user }: { user: { full_name: string; email: string; phone: string | null; role_name: string } }) {
  const [name, setName] = useState(user.full_name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [pw, setPw] = useState({ current: "", password: "", confirm: "" });
  const [p1, s1] = useTransition();
  const [p2, s2] = useTransition();
  return (
    <div className="grid max-w-3xl gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <Field label="Email">{(p) => <Input {...p} value={user.email} disabled />}</Field>
          <Field label="Role">{(p) => <Input {...p} value={user.role_name} disabled />}</Field>
          <Field label="Full name">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Phone">{(p) => <Input {...p} value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
          <Button
            disabled={p1}
            onClick={() => s1(async () => {
              const r = await updateMyProfile({ full_name: name, phone });
              r.ok ? toast.success(r.message) : toast.error(r.error);
            })}
          >
            {p1 && <Loader2 className="animate-spin" />} Save profile
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Change password</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <Field label="Current password">{(p) => <Input {...p} type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />}</Field>
          <Field label="New password" hint="At least 8 characters">{(p) => <Input {...p} type="password" autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} />}</Field>
          <Field label="Confirm new password">{(p) => <Input {...p} type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />}</Field>
          <Button
            disabled={p2}
            onClick={() => s2(async () => {
              const r = await changeMyPassword(pw);
              if (r.ok) {
                toast.success(r.message);
                setPw({ current: "", password: "", confirm: "" });
              } else toast.error(r.error);
            })}
          >
            {p2 && <Loader2 className="animate-spin" />} Change password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
