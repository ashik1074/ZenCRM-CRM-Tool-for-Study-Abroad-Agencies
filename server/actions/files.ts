"use server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/server/auth";

const BUCKETS = ["student-files", "offer-leaflets", "task-attachments", "kb-attachments", "receipts"] as const;
export type Bucket = (typeof BUCKETS)[number];

/**
 * Signed URLs (1 hour) created with the user's session, so storage RLS decides access.
 * `download` adds Content-Disposition so the browser saves the file.
 */
export async function getSignedUrls(bucket: Bucket, paths: string[], download = false): Promise<Record<string, string>> {
  if (!BUCKETS.includes(bucket) || !(await getCurrentUser())) return {};
  const clean = Array.from(new Set(paths.filter(Boolean))).slice(0, 200);
  if (!clean.length) return {};
  const supabase = createClient();
  if (download) {
    const out: Record<string, string> = {};
    await Promise.all(
      clean.map(async (p) => {
        const { data } = await supabase.storage.from(bucket).createSignedUrl(p, 3600, { download: p.split("/").pop()!.replace(/^[0-9a-f-]{36}-/, "") });
        if (data?.signedUrl) out[p] = data.signedUrl;
      }),
    );
    return out;
  }
  const { data } = await supabase.storage.from(bucket).createSignedUrls(clean, 3600);
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl as string]));
}
