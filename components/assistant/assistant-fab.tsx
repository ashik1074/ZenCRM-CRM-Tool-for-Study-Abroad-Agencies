"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Maximize2, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AssistantChat } from "./chat";

/** Floating AI button on every staff page; opens the chat in a side panel. */
export function AssistantFab() {
  const [open, setOpen] = useState(false);
  const [conv, setConv] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  if (usePathname().startsWith("/assistant")) return null;
  return (
    <>
      <Button onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-30 h-12 w-12 rounded-full shadow-lg" size="icon" aria-label="Open AI assistant" data-testid="assistant-fab">
        <Sparkles className="!size-5" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
          <SheetHeader className="flex-row items-center justify-between space-y-0 border-b px-4 py-3 pr-12">
            <SheetTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" aria-hidden /> AI Assistant</SheetTitle>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" aria-label="New conversation" onClick={() => { setConv(null); setKey((k) => k + 1); }}><Plus /></Button>
              <Button asChild size="icon" variant="ghost" aria-label="Open full page"><Link href={conv ? `/assistant?c=${conv}` : "/assistant"} onClick={() => setOpen(false)}><Maximize2 /></Link></Button>
            </div>
          </SheetHeader>
          <AssistantChat key={key} conversationId={conv} onConversation={setConv} compact />
        </SheetContent>
      </Sheet>
    </>
  );
}
