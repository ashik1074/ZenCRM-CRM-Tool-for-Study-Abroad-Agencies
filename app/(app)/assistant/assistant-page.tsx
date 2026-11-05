"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MessageSquare, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AssistantChat } from "@/components/assistant/chat";
import { cn } from "@/lib/utils";
import { fmtRelative } from "@/lib/format";
import { deleteConversation } from "@/server/actions/assistant";

export function AssistantPage({ conversations, initial }: { conversations: { id: string; title: string; updated_at: string }[]; initial: string | null }) {
  const router = useRouter();
  const [active, setActive] = useState<string | null>(initial);
  const [key, setKey] = useState(0);
  return (
    <div className="grid h-[calc(100vh-7.5rem)] gap-4 md:grid-cols-[260px_1fr]">
      <Card className="hidden flex-col overflow-hidden md:flex">
        <div className="flex items-center justify-between border-b p-3">
          <p className="text-sm font-semibold">Conversations</p>
          <Button size="sm" variant="outline" onClick={() => { setActive(null); setKey((k) => k + 1); }}><Plus /> New</Button>
        </div>
        <ul className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 && <li className="p-2 text-sm text-muted-foreground">No conversations yet.</li>}
          {conversations.map((c) => (
            <li key={c.id} className="group flex items-center">
              <button type="button" onClick={() => setActive(c.id)} className={cn("flex min-w-0 flex-1 items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted", active === c.id && "bg-accent")}>
                <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0"><span className="block truncate">{c.title}</span><span className="text-xs text-muted-foreground">{fmtRelative(c.updated_at)}</span></span>
              </button>
              <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Delete ${c.title}`}
                onClick={async () => { await deleteConversation(c.id); if (active === c.id) setActive(null); router.refresh(); }}><Trash2 className="h-3 w-3" /></Button>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          <h1 className="font-semibold">AI Assistant</h1>
          <span className="text-xs text-muted-foreground">Answers come from your agency&apos;s data. Every query is logged.</span>
        </div>
        <AssistantChat key={`${key}-${active}`} conversationId={active} onConversation={(id) => { setActive(id); router.refresh(); }} />
      </Card>
    </div>
  );
}
