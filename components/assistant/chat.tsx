"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Copy, Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { loadConversation, type ChatMessage } from "@/server/actions/assistant";

const EXAMPLES = [
  "How many students registered this year?",
  "How many students got visa rejected in 2026?",
  "Give me the document checklist for visa interview",
  "Which university has the most acceptances?",
  "Show students whose passport expires in the next 6 months",
  "What was our profit last month?",
];

type Msg = Pick<ChatMessage, "role" | "content" | "meta"> & { id: string; pending?: boolean };

function ResultTable({ columns, rows }: { columns: string[]; rows: unknown[][] }) {
  const shown = rows.slice(0, 50);
  return (
    <div className="max-h-72 overflow-auto rounded-md border">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-muted text-left">
          <tr>{columns.map((c) => <th key={c} className="whitespace-nowrap px-2 py-1 font-medium">{c}</th>)}</tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={i} className="border-t">
              {r.map((v, j) => <td key={j} className="whitespace-nowrap px-2 py-1">{v === null ? "—" : Array.isArray(v) ? v.join(", ") : String(v)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > shown.length && <p className="border-t px-2 py-1 text-xs text-muted-foreground">Showing {shown.length} of {rows.length} rows.</p>}
    </div>
  );
}

function AssistantMessage({ m }: { m: Msg }) {
  const queries = m.meta?.queries ?? [];
  const kb = m.meta?.kb ?? [];
  const tabular = queries.filter((q) => !q.error && q.rows.length > 0 && !(q.rows.length === 1 && q.columns.length === 1));
  return (
    <div className="space-y-2">
      <p className="whitespace-pre-wrap text-sm">{m.content}</p>
      {kb.map((k) => (
        <div key={k.id} className="rounded-md border bg-muted/40">
          <div className="flex items-center justify-between border-b px-3 py-1.5">
            <span className="text-xs font-medium">{k.title}</span>
            <Button size="sm" variant="ghost" className="h-7" onClick={async () => { await navigator.clipboard.writeText(k.body); toast.success("Copied"); }}><Copy /> Copy</Button>
          </div>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words p-3 font-sans text-sm" data-testid="kb-verbatim">{k.body}</pre>
        </div>
      ))}
      {tabular.map((q, i) => <ResultTable key={i} columns={q.columns} rows={q.rows} />)}
      {queries.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            Show {queries.length > 1 ? `${queries.length} queries` : "query"} <ChevronDown className="h-3 w-3" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1 space-y-1">
            {queries.map((q, i) => (
              <div key={i}>
                <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">{q.sql}</pre>
                <p className="text-xs text-muted-foreground">{q.error ? `Rejected/failed: ${q.error}` : `${q.rowCount} row(s)`}</p>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export function AssistantChat({ conversationId, onConversation, compact }: { conversationId: string | null; onConversation?: (id: string) => void; compact?: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [convId, setConvId] = useState(conversationId);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setConvId(conversationId);
    if (conversationId) loadConversation(conversationId).then((m) => setMessages(m as Msg[]));
    else setMessages([]);
  }, [conversationId]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    const tmp = crypto.randomUUID();
    setMessages((m) => [...m, { id: `u-${tmp}`, role: "user", content: q, meta: {} }, { id: `a-${tmp}`, role: "assistant", content: "", meta: {}, pending: true }]);
    try {
      const res = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: q, conversationId: convId ?? undefined }) });
      const data = await res.json();
      if (data.conversationId && data.conversationId !== convId) {
        setConvId(data.conversationId);
        onConversation?.(data.conversationId);
      }
      setMessages((m) => m.map((x) => (x.id === `a-${tmp}` ? { ...x, pending: false, content: res.ok ? data.answer : data.error, meta: res.ok ? { queries: data.queries, kb: data.kb } : {} } : x)));
    } catch {
      setMessages((m) => m.map((x) => (x.id === `a-${tmp}` ? { ...x, pending: false, content: "Network error. Please try again." } : x)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Sparkles className="h-4 w-4 text-primary" aria-hidden /> Ask about students, applications, offers, tasks{compact ? "" : ", finance (if your role allows)"} or the Info Center.</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((e) => (
                <button key={e} type="button" onClick={() => send(e)} className="rounded-full border px-3 py-1 text-left text-xs hover:bg-muted">{e}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[92%] rounded-lg px-3 py-2", m.role === "user" ? "bg-primary text-primary-foreground" : "border bg-card")} data-testid={m.role === "assistant" ? "assistant-message" : undefined}>
              {m.pending ? <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Looking that up…</span> : m.role === "user" ? <p className="whitespace-pre-wrap text-sm">{m.content}</p> : <AssistantMessage m={m} />}
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form className="flex gap-2 border-t p-3" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <Textarea
          aria-label="Ask the assistant"
          placeholder="Ask a question…"
          rows={1}
          className="min-h-9 resize-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          data-testid="assistant-input"
        />
        <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send"><Send /></Button>
      </form>
    </div>
  );
}
