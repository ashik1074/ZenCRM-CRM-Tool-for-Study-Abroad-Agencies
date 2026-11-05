"use client";
import { toast } from "sonner";
import { getReceiptData } from "@/server/actions/finance";
import { fmtDate } from "@/lib/format";

const fmt = (n: number, cur: string) => `${cur} ${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;

/** Generates and downloads a money receipt PDF for a student payment. */
export async function downloadMoneyReceipt(transactionId: string) {
  const { txn, agency } = await getReceiptData(transactionId);
  if (!txn) {
    toast.error("Receipt not available for this transaction.");
    return;
  }
  const t = txn as unknown as {
    receipt_no: string | null; txn_date: string; amount: number; currency: string; exchange_rate: number; amount_bdt: number;
    payment_method: string; reference_no: string | null; note: string | null;
    category: { name: string } | null; student: { full_name: string; student_code: string; phone: string | null } | null;
    installment: { label: string } | null; creator: { full_name: string } | null;
  };
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a5", orientation: "landscape" });
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(10, 100, 150);
  doc.rect(0, 0, W, 56, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(agency.name, 32, 34);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text([agency.address, agency.phone, agency.email].filter(Boolean).join("  |  "), 32, 48);
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("MONEY RECEIPT", W / 2, 84, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Receipt No: ${t.receipt_no ?? "—"}`, 32, 108);
  doc.text(`Date: ${fmtDate(t.txn_date)}`, W - 32, 108, { align: "right" });

  const rows: [string, string][] = [
    ["Received from", `${t.student?.full_name ?? "—"}${t.student ? ` (${t.student.student_code})` : ""}`],
    ["Purpose", [t.category?.name, t.installment?.label].filter(Boolean).join(" — ")],
    ["Amount", fmt(Number(t.amount), t.currency) + (t.currency !== "BDT" ? `  (= ${fmt(Number(t.amount_bdt), "BDT")} @ ${t.exchange_rate})` : "")],
    ["Payment method", t.payment_method + (t.reference_no ? ` — Ref: ${t.reference_no}` : "")],
  ];
  if (t.note) rows.push(["Note", t.note]);
  let y = 136;
  for (const [k, v] of rows) {
    doc.setFont("helvetica", "bold");
    doc.text(k, 32, y);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(v, W - 200) as string[], 160, y);
    doc.setDrawColor(220);
    doc.line(160, y + 5, W - 32, y + 5);
    y += 26;
  }
  doc.setFontSize(9);
  doc.text(`Received by: ${t.creator?.full_name ?? ""}`, 32, y + 40);
  doc.line(W - 200, y + 36, W - 32, y + 36);
  doc.text("Authorised signature", W - 116, y + 48, { align: "center" });
  doc.setTextColor(120);
  doc.text("This is a computer-generated receipt.", W / 2, doc.internal.pageSize.getHeight() - 16, { align: "center" });
  doc.save(`${t.receipt_no ?? "receipt"}.pdf`);
}
