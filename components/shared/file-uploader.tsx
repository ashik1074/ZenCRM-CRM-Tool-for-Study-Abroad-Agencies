"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { ACCEPT_ATTR, ALLOWED_MIME, MAX_FILE_BYTES } from "@/lib/constants";
import type { Bucket } from "@/server/actions/files";

export type UploadedFile = { file_path: string; file_name: string; mime_type: string; size_bytes: number };

function safeName(name: string) {
  return name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").slice(-120);
}

/**
 * Uploads straight from the browser to a private bucket (storage RLS checks the user), then calls
 * `onUploaded` so a server action can record the file. Validates type and 10 MB limit up front.
 */
export function FileUploader({
  bucket,
  folder,
  onUploaded,
  accept = ACCEPT_ATTR,
  imagesOnly = false,
  multiple = true,
  label = "Drop files here or click to upload",
  disabled,
  compact,
}: {
  bucket: Bucket;
  folder: string;
  onUploaded: (f: UploadedFile) => Promise<boolean | void> | boolean | void;
  accept?: string;
  imagesOnly?: boolean;
  multiple?: boolean;
  label?: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [drag, setDrag] = useState(false);

  async function handle(files: FileList | File[]) {
    const list = Array.from(files);
    for (const f of list) {
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`${f.name} is larger than 10 MB.`);
        continue;
      }
      if (!ALLOWED_MIME.includes(f.type) || (imagesOnly && !f.type.startsWith("image/"))) {
        toast.error(`${f.name}: ${imagesOnly ? "choose an image file" : "use images, PDF, Word or Excel"}.`);
        continue;
      }
      setBusy((b) => b + 1);
      try {
        const path = `${folder}/${crypto.randomUUID()}-${safeName(f.name)}`;
        const { error } = await createClient().storage.from(bucket).upload(path, f, { contentType: f.type, upsert: false });
        if (error) throw error;
        const ok = await onUploaded({ file_path: path, file_name: f.name, mime_type: f.type, size_bytes: f.size });
        if (ok === false) await createClient().storage.from(bucket).remove([path]);
      } catch (e) {
        toast.error(`Upload failed for ${f.name}: ${(e as Error).message}`);
      } finally {
        setBusy((b) => b - 1);
      }
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (!disabled) handle(e.dataTransfer.files);
      }}
    >
      <button
        type="button"
        disabled={disabled || busy > 0}
        onClick={() => input.current?.click()}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
          compact ? "p-3" : "p-6",
          drag && "border-primary bg-accent",
        )}
      >
        {busy > 0 ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <UploadCloud className="h-5 w-5" aria-hidden />}
        <span>{busy > 0 ? `Uploading ${busy} file(s)…` : label}</span>
        {!compact && <span className="text-xs">Images, PDF, Word, Excel · max 10 MB</span>}
      </button>
      <input
        ref={input}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        accept={imagesOnly ? "image/*" : accept}
        multiple={multiple}
        onChange={(e) => {
          if (e.target.files) handle(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
