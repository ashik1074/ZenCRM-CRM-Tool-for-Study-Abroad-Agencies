"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FileGallery } from "@/components/shared/file-gallery";
import { FileUploader } from "@/components/shared/file-uploader";
import { OptionBadge, StatusBadge } from "@/components/shared/status-badge";
import { OFFER_STATUSES } from "@/lib/constants";
import { fmtDate, fmtMoney } from "@/lib/format";
import { addOfferAttachment, deleteOffer, deleteOfferAttachment, getOfferDetail } from "@/server/actions/offers";

type Detail = NonNullable<Awaited<ReturnType<typeof getOfferDetail>>> & Record<string, never>;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children || "—"}</dd>
    </div>
  );
}

export function OfferModal({ id, perms, onClose, onEdit }: { id: string; perms: { edit: boolean; delete: boolean }; onClose: () => void; onEdit: (id: string) => void }) {
  const router = useRouter();
  const [offer, setOffer] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setOffer((await getOfferDetail(id)) as Detail | null);
    setLoading(false);
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const o = offer as unknown as Record<string, unknown> & {
    university: { name: string; city: string | null; province: string | null; website: string | null };
    attachments: { id: string; file_path: string; file_name: string; mime_type: string | null; size_bytes: number | null; created_at: string }[];
    apps: { count: number }[];
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" data-testid="offer-modal">
        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="animate-spin" aria-label="Loading" /><DialogTitle className="sr-only">Loading offer</DialogTitle></div>
        ) : !offer ? (
          <DialogHeader><DialogTitle>Offer not found</DialogTitle><DialogDescription>It may have been deleted.</DialogDescription></DialogHeader>
        ) : (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <OptionBadge list={OFFER_STATUSES} value={o.status as string} />
                {o.scholarship_type ? <StatusBadge tone="violet">{o.scholarship_type as string}</StatusBadge> : null}
                <StatusBadge tone="slate">{o.degree_level as string}</StatusBadge>
              </div>
              <DialogTitle className="text-xl">{o.title as string}</DialogTitle>
              <DialogDescription>
                {o.university.name}{o.university.city ? ` · ${o.university.city}` : ""}{o.university.province ? `, ${o.university.province}` : ""}
              </DialogDescription>
            </DialogHeader>
            <dl className="divide-y">
              <Row label="Program / major">{o.program as string}</Row>
              <Row label="Intake">{o.intake as string}</Row>
              <Row label="Application deadline">{fmtDate(o.application_deadline as string)}</Row>
              <Row label="Language">{o.language_of_instruction as string}</Row>
              <Row label="Scholarship covers">
                {[o.covers_tuition && "Tuition", o.covers_accommodation && "Accommodation", o.stipend_amount && `Stipend ${fmtMoney(o.stipend_amount as number, o.stipend_currency as string)}/month`].filter(Boolean).join(" · ") || "None"}
              </Row>
              <Row label="Tuition fee">{fmtMoney(o.tuition_fee as number, o.fee_currency as string)} / year</Row>
              <Row label="Accommodation fee">{fmtMoney(o.accommodation_fee as number, o.fee_currency as string)} / year</Row>
              <Row label="Source">{o.source === "partner_agent" ? `Partner agent${o.partner_name ? ` — ${o.partner_name}` : ""}` : "Direct"}</Row>
              <Row label="Applications">{o.apps?.[0]?.count ?? 0}</Row>
              {o.university.website && (
                <Row label="Website">
                  <a href={o.university.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">{o.university.website}<ExternalLink className="h-3 w-3" /></a>
                </Row>
              )}
            </dl>
            {o.eligibility ? (
              <div>
                <h3 className="mb-1 text-sm font-semibold">Eligibility requirements</h3>
                <p className="whitespace-pre-wrap text-sm">{o.eligibility as string}</p>
              </div>
            ) : null}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Leaflets</h3>
              <FileGallery
                bucket="offer-leaflets"
                files={o.attachments}
                canDelete={perms.edit}
                emptyText="No leaflets attached."
                onDelete={async (f) => {
                  const r = await deleteOfferAttachment(f.id);
                  r.ok ? toast.success(r.message) : toast.error(r.error);
                  load();
                }}
              />
              {perms.edit && (
                <FileUploader
                  bucket="offer-leaflets"
                  folder={id}
                  compact
                  label="Add leaflet (image or PDF)"
                  onUploaded={async (f) => {
                    const r = await addOfferAttachment(id, f);
                    if (!r.ok) { toast.error(r.error); return false; }
                    load();
                  }}
                />
              )}
            </div>
            {(perms.edit || perms.delete) && (
              <DialogFooter className="gap-2">
                {perms.delete && (
                  <ConfirmDialog
                    trigger={<Button variant="outline" className="text-destructive"><Trash2 /> Delete</Button>}
                    title="Delete this offer?"
                    description="It moves to Deleted items; existing applications are kept."
                    onConfirm={async () => {
                      const r = await deleteOffer(id);
                      if (r.ok) { toast.success(r.message); onClose(); router.refresh(); } else toast.error(r.error);
                    }}
                  />
                )}
                {perms.edit && <Button onClick={() => onEdit(id)}><Pencil /> Edit</Button>}
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
