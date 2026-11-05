import "server-only";
import * as XLSX from "xlsx";
import { NextResponse } from "next/server";

type Row = Record<string, unknown>;

/** Cell value exactly as stored: arrays joined with ", ", objects as JSON, null as empty. No reformatting. */
function raw(v: unknown): string | number | boolean {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return v as string | number | boolean;
}

export function exportResponse(rows: Row[], columns: string[], filename: string, format: "csv" | "xlsx") {
  const data = rows.map((r) => Object.fromEntries(columns.map((c) => [c, raw(r[c])])));
  const ws = XLSX.utils.json_to_sheet(data, { header: columns });
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "csv") {
    const csv = "﻿" + XLSX.utils.sheet_to_csv(ws); // BOM so Excel opens UTF-8 (Bangla names) correctly
    return new NextResponse(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}-${stamp}.csv"` },
    });
  }
  // keep values as text so Excel doesn't reformat phone numbers / passport numbers
  for (const key of Object.keys(ws)) {
    const cell = ws[key] as XLSX.CellObject | undefined;
    if (key[0] !== "!" && cell && cell.t === "s") cell.z = "@";
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, filename.slice(0, 31));
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}-${stamp}.xlsx"`,
    },
  });
}
