"use client";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { nativeSelectClass } from "@/components/shared/field";
import { cn } from "@/lib/utils";
import { autoMap, OFFER_IMPORT, STUDENT_IMPORT } from "@/lib/import-specs";
import { checkStudentDuplicates, importOffers, importStudents, type ImportResult } from "@/server/actions/import";

type Kind = "students" | "offers";

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    const d = new Date(v.getTime() - v.getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 10);
  }
  return String(v).trim();
}

export function ImportWizard({ canStudents, canOffers, canImport }: { canStudents: boolean; canOffers: boolean; canImport: boolean }) {
  const [kind, setKind] = useState<Kind>(canStudents ? "students" : "offers");
  const spec = kind === "students" ? STUDENT_IMPORT : OFFER_IMPORT;
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [raw, setRaw] = useState<Record<string, unknown>[]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [dups, setDups] = useState<Record<number, string>>({});
  const [skipDups, setSkipDups] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();

  async function onFile(f: File) {
    setResult(null);
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await f.arrayBuffer(), { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true });
    if (!rows.length) return toast.error("The first sheet is empty.");
    if (rows.length > 2000) return toast.error("Import at most 2,000 rows at a time.");
    const h = Object.keys(rows[0]);
    setFileName(f.name);
    setHeaders(h);
    setRaw(rows);
    setMap(autoMap(h, spec.fields));
    setDups({});
  }

  const mapped = useMemo(
    () => raw.map((r) => Object.fromEntries(spec.fields.map((f) => [f.key, map[f.key] ? cellToString(r[map[f.key]]) : ""]))),
    [raw, map, spec],
  );
  const issues = useMemo(() => mapped.map((r, i) => {
    const p = spec.schema.safeParse(r);
    return p.success ? dups[i] ?? null : p.error.issues[0].message;
  }), [mapped, spec, dups]);
  const errorCount = issues.filter(Boolean).length;
  const missingRequired = spec.fields.filter((f) => f.required && !map[f.key]);

  function downloadTemplate() {
    import("xlsx").then((XLSX) => {
      const ws = XLSX.utils.aoa_to_sheet([spec.fields.map((f) => f.label)]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, kind);
      XLSX.writeFile(wb, `${kind}-import-template.xlsx`);
    });
  }

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="What to import" className="inline-flex rounded-md border p-0.5">
        {(["students", "offers"] as const).filter((k) => (k === "students" ? canStudents : canOffers)).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => { setKind(k); setRaw([]); setHeaders([]); setMap({}); setResult(null); setFileName(""); }}
            className={cn("rounded px-4 py-1.5 text-sm capitalize", kind === k ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>{k}</button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">1. Choose a file</CardTitle>
          <CardDescription>The first sheet is read; the first row must contain column headers. Dates should be real Excel dates or YYYY-MM-DD.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <label className="cursor-pointer">
              <Upload /> {fileName || "Select .xlsx or .csv"}
              <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
            </label>
          </Button>
          <Button variant="ghost" onClick={downloadTemplate}><Download /> Download template</Button>
          {raw.length > 0 && <span className="text-sm text-muted-foreground"><FileSpreadsheet className="mr-1 inline h-4 w-4" />{raw.length} rows</span>}
        </CardContent>
      </Card>

      {headers.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">2. Map columns</CardTitle><CardDescription>We matched what we could automatically. Required fields are marked *.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {spec.fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label htmlFor={`map-${f.key}`}>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
                <select id={`map-${f.key}`} className={nativeSelectClass} value={map[f.key] ?? ""} onChange={(e) => setMap({ ...map, [f.key]: e.target.value })}>
                  <option value="">— Not imported —</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {headers.length > 0 && (
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">3. Validation preview</CardTitle>
              <CardDescription>
                {missingRequired.length ? `Map required field(s): ${missingRequired.map((f) => f.label).join(", ")}` : `${raw.length - errorCount} ready · ${errorCount} with problems (these are skipped)`}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {kind === "students" && (
                <>
                  <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => setDups(await checkStudentDuplicates(mapped)))}>Check duplicates</Button>
                  <div className="flex items-center gap-2"><Checkbox id="skipdups" checked={skipDups} onCheckedChange={(v) => setSkipDups(v === true)} /><Label htmlFor="skipdups">Skip duplicates</Label></div>
                </>
              )}
              <Button
                disabled={!canImport || pending || !!missingRequired.length || errorCount === raw.length}
                onClick={() => start(async () => {
                  const rows = mapped.filter((_, i) => !issues[i] || (kind === "students" && !skipDups && dups[i] && issues[i] === dups[i]));
                  const r = kind === "students" ? await importStudents(rows, { skipDuplicates: skipDups }) : await importOffers(rows);
                  if (r.ok) { setResult(r.data); toast.success(`Imported ${r.data.imported} ${kind}`); } else toast.error(r.error);
                })}
              >
                {pending ? <Loader2 className="animate-spin" /> : <Upload />} Import {raw.length - errorCount} rows
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[50vh] overflow-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted text-left">
                  <tr><th className="px-2 py-1">Row</th><th className="px-2 py-1">Check</th>{spec.fields.filter((f) => map[f.key]).map((f) => <th key={f.key} className="whitespace-nowrap px-2 py-1">{f.label}</th>)}</tr>
                </thead>
                <tbody>
                  {mapped.slice(0, 300).map((r, i) => (
                    <tr key={i} className={cn("border-t", issues[i] && "bg-destructive/5")}>
                      <td className="px-2 py-1 text-muted-foreground">{i + 2}</td>
                      <td className="px-2 py-1">{issues[i] ? <span className="inline-flex items-center gap-1 text-destructive"><AlertTriangle className="h-3 w-3" />{issues[i]}</span> : <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-label="OK" />}</td>
                      {spec.fields.filter((f) => map[f.key]).map((f) => <td key={f.key} className="whitespace-nowrap px-2 py-1">{r[f.key]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {mapped.length > 300 && <p className="mt-1 text-xs text-muted-foreground">Previewing the first 300 rows; all {mapped.length} are validated.</p>}
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Import result</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><b>{result.imported}</b> imported, <b>{result.skipped.length}</b> skipped.</p>
            {result.created_universities.length > 0 && <p>New universities created: {result.created_universities.join(", ")}</p>}
            {result.skipped.length > 0 && <ul className="max-h-48 list-disc overflow-auto pl-5 text-xs">{result.skipped.map((s) => <li key={s.row}>Row {s.row}: {s.reason}</li>)}</ul>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
