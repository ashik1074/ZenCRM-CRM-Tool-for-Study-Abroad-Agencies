"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { fmtDateTime, humanize } from "@/lib/format";
import { addStudentNote, deleteStudentNote } from "@/server/actions/student-notes";

type Note = { id: string; body: string; created_at: string; author_id: string | null; author: { full_name: string } | null };
type Activity = { at: string; actor: string | null; kind: string; summary: string; details: { old?: Record<string, unknown>; new?: Record<string, unknown> } | null };

export function NotesPanel({ studentId, notes, activity, meId }: { studentId: string; notes: Note[]; activity: Activity[]; meId: string }) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Notes</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Textarea aria-label="New note" placeholder="Write a note about a call, meeting or follow-up…" value={body} onChange={(e) => setBody(e.target.value)} />
            <Button
              size="sm"
              disabled={pending || !body.trim()}
              onClick={() => start(async () => {
                const r = await addStudentNote({ student_id: studentId, body });
                if (r.ok) { setBody(""); toast.success(r.message); } else toast.error(r.error);
              })}
            >
              {pending && <Loader2 className="animate-spin" />} Add note
            </Button>
          </div>
          {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-md border p-3">
                <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{n.author?.full_name ?? "Unknown"} · {fmtDateTime(n.created_at)}</span>
                  {n.author_id === meId && (
                    <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Delete note" onClick={async () => {
                      const r = await deleteStudentNote(n.id, studentId);
                      r.ok ? toast.success(r.message) : toast.error(r.error);
                    }}><Trash2 className="h-3 w-3" /></Button>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm">{n.body}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Activity</CardTitle></CardHeader>
        <CardContent>
          {activity.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
          <ol className="relative space-y-3 border-l pl-4">
            {activity.map((a, i) => (
              <li key={i} className="relative">
                <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ${a.kind === "status" ? "bg-primary" : "bg-muted-foreground/50"}`} aria-hidden />
                <p className="text-sm"><span className="font-medium">{a.actor ?? "System"}</span> — {a.kind === "status" ? "status: " : ""}{humanize(a.summary).replace(/ → /g, " → ")}</p>
                <p className="text-xs text-muted-foreground">{fmtDateTime(a.at)}</p>
                {a.details?.new && a.kind !== "status" && a.kind !== "insert" && (
                  <Collapsible>
                    <CollapsibleTrigger className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">Show changes <ChevronDown className="h-3 w-3" /></CollapsibleTrigger>
                    <CollapsibleContent>
                      <table className="mt-1 w-full text-xs">
                        <tbody>
                          {Object.keys(a.details.new).filter((k) => k !== "student_id").map((k) => (
                            <tr key={k} className="border-t">
                              <td className="py-1 pr-2 font-medium">{humanize(k)}</td>
                              <td className="py-1 pr-2 text-muted-foreground line-through">{JSON.stringify(a.details?.old?.[k] ?? null)}</td>
                              <td className="py-1">{JSON.stringify(a.details?.new?.[k] ?? null)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
