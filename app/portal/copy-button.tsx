"use client";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyButton({ text }: { text: string }) {
  return (
    <Button size="sm" variant="outline" onClick={async () => { await navigator.clipboard.writeText(text); toast.success("Copied"); }}>
      <Copy /> Copy
    </Button>
  );
}
