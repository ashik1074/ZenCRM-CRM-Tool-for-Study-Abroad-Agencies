"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function VisaSheetButton({ sheet, studentName }: { sheet: string | null; studentName: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(sheet ?? "");
  const file = `visa-info-${slug(studentName)}`;

  async function pdf() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    const margin = 48, lineH = 14, pageH = doc.internal.pageSize.getHeight();
    let y = margin;
    for (const raw of text.split("\n")) {
      for (const line of doc.splitTextToSize(raw || " ", doc.internal.pageSize.getWidth() - margin * 2) as string[]) {
        if (y > pageH - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += lineH;
      }
    }
    doc.save(`${file}.pdf`);
  }

  function txt() {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${file}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <Button variant="outline" onClick={() => { setText(sheet ?? ""); setOpen(true); }} disabled={!sheet} title={!sheet ? "Add the 'Document Checklist for Visa Interview' entry to the Info Center first" : undefined}>
        <FileText /> Visa info sheet
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Visa interview information sheet</DialogTitle>
            <DialogDescription>Filled from {studentName}&apos;s profile using the Info Center checklist. You can edit before copying or downloading.</DialogDescription>
          </DialogHeader>
          <Textarea aria-label="Visa information sheet" value={text} onChange={(e) => setText(e.target.value)} className="h-[55vh] font-mono text-xs" />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={async () => { await navigator.clipboard.writeText(text); toast.success("Copied to clipboard"); }}><Copy /> Copy</Button>
            <Button variant="outline" onClick={txt}><Download /> .txt</Button>
            <Button onClick={pdf}><Download /> .pdf</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
