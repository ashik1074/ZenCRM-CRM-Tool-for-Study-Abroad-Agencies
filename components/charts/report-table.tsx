import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** The table view that accompanies every chart (also the accessible fallback). */
export function ReportTable({ columns, rows, exportHref, caption }: { columns: { key: string; label: string; numeric?: boolean }[]; rows: Record<string, unknown>[]; exportHref?: string; caption: string }) {
  return (
    <div className="space-y-2">
      {exportHref && (
        <div className="flex justify-end gap-2">
          <Button asChild size="sm" variant="outline"><a href={`${exportHref}&format=xlsx`}><Download /> Excel</a></Button>
          <Button asChild size="sm" variant="outline"><a href={`${exportHref}&format=csv`}><Download /> CSV</a></Button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHeader>
            <TableRow>{columns.map((c) => <TableHead key={c.key} className={cn(c.numeric && "text-right")}>{c.label}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={columns.length} className="py-6 text-center text-muted-foreground">No data for this period.</TableCell></TableRow>
            ) : (
              rows.map((r, i) => (
                <TableRow key={i}>
                  {columns.map((c) => (
                    <TableCell key={c.key} className={cn(c.numeric && "text-right tabular-nums")}>
                      {r[c.key] === null || r[c.key] === undefined ? "—" : c.numeric ? new Intl.NumberFormat("en-IN").format(Number(r[c.key])) : String(r[c.key])}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
