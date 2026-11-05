"use client";
import { useEffect, useState } from "react";
import { Download, Eye, FileSpreadsheet, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { bytes, fmtDate } from "@/lib/format";
import { getSignedUrls, type Bucket } from "@/server/actions/files";

export type GalleryFile = {
  id: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  category?: string | null;
  created_at?: string;
  expiry_date?: string | null;
};

const isImage = (m: string | null) => !!m?.startsWith("image/");
const isPdf = (m: string | null) => m === "application/pdf";

/** Image gallery + document list with inline preview (images & PDF), download and delete. */
export function FileGallery({
  bucket,
  files,
  onDelete,
  canDelete,
  emptyText = "No files yet.",
}: {
  bucket: Bucket;
  files: GalleryFile[];
  onDelete?: (f: GalleryFile) => Promise<void>;
  canDelete?: boolean;
  emptyText?: string;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<GalleryFile | null>(null);
  const key = files.map((f) => f.file_path).join("|");

  useEffect(() => {
    if (files.length) getSignedUrls(bucket, files.map((f) => f.file_path)).then(setUrls);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, key]);

  async function download(f: GalleryFile) {
    const r = await getSignedUrls(bucket, [f.file_path], true);
    const u = r[f.file_path];
    if (u) window.location.assign(u);
  }

  if (!files.length) return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  const images = files.filter((f) => isImage(f.mime_type));
  const docs = files.filter((f) => !isImage(f.mime_type));

  const actions = (f: GalleryFile) => (
    <div className="flex items-center gap-1">
      {(isImage(f.mime_type) || isPdf(f.mime_type)) && (
        <Button size="icon" variant="ghost" aria-label={`Preview ${f.file_name}`} onClick={() => setPreview(f)}>
          <Eye />
        </Button>
      )}
      <Button size="icon" variant="ghost" aria-label={`Download ${f.file_name}`} onClick={() => download(f)}>
        <Download />
      </Button>
      {canDelete && onDelete && (
        <ConfirmDialog
          trigger={<Button size="icon" variant="ghost" aria-label={`Delete ${f.file_name}`}><Trash2 className="text-destructive" /></Button>}
          title="Delete this file?"
          description={f.file_name}
          onConfirm={() => onDelete(f)}
        />
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((f) => (
            <li key={f.id} className="overflow-hidden rounded-lg border bg-card">
              <button type="button" className="block aspect-[4/3] w-full bg-muted" onClick={() => setPreview(f)} aria-label={`Open ${f.file_name}`}>
                {urls[f.file_path] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={urls[f.file_path]} alt={f.file_name} className="h-full w-full object-cover" loading="lazy" />
                ) : null}
              </button>
              <div className="flex items-center justify-between gap-1 p-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium" title={f.file_name}>{f.file_name}</p>
                  {f.category && <p className="text-xs text-muted-foreground">{f.category}</p>}
                </div>
                {actions(f)}
              </div>
            </li>
          ))}
        </ul>
      )}
      {docs.length > 0 && (
        <ul className="divide-y rounded-lg border bg-card">
          {docs.map((f) => (
            <li key={f.id} className="flex items-center gap-3 p-3">
              {f.mime_type?.includes("sheet") || f.mime_type?.includes("excel") ? (
                <FileSpreadsheet className="h-5 w-5 shrink-0 text-success" aria-hidden />
              ) : (
                <FileText className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={f.file_name}>{f.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {[f.category, bytes(f.size_bytes), f.created_at && fmtDate(f.created_at)].filter(Boolean).join(" · ")}
                  {f.expiry_date && <> · expires {fmtDate(f.expiry_date)}</>}
                </p>
              </div>
              {f.category && <StatusBadge tone="slate" className="hidden sm:inline-flex">{f.category}</StatusBadge>}
              {actions(f)}
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-6">{preview?.file_name}</DialogTitle>
          </DialogHeader>
          {preview && urls[preview.file_path] && (
            isImage(preview.mime_type) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urls[preview.file_path]} alt={preview.file_name} className="max-h-[75vh] w-full object-contain" />
            ) : (
              <iframe src={urls[preview.file_path]} title={preview.file_name} className="h-[75vh] w-full rounded border" />
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
