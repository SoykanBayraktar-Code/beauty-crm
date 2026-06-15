"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  uploadTreatmentPhoto,
  type CustomerState,
} from "@/app/(app)/musteriler/actions";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const selectClass =
  "border-input bg-transparent h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function PhotoUploadDialog({
  customerId,
  treatments,
}: {
  customerId: string;
  treatments: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [state, formAction, pending] = useActionState<CustomerState, FormData>(
    uploadTreatmentPhoto,
    undefined,
  );

  React.useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      setPreview(null);
      router.refresh();
    }
  }, [state, router]);

  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ size: "sm" }))}>
        Fotoğraf ekle
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fotoğraf ekle</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="customer_id" value={customerId} />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ph_kind">Tür</Label>
              <select
                id="ph_kind"
                name="kind"
                required
                className={selectClass}
                defaultValue="before"
              >
                <option value="before">Öncesi</option>
                <option value="after">Sonrası</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ph_tr">İlişkili işlem</Label>
              <select
                id="ph_tr"
                name="treatment_record_id"
                className={selectClass}
                defaultValue=""
              >
                <option value="">— (isteğe bağlı)</option>
                {treatments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ph_file">Görsel (JPEG/PNG/WebP, ≤10MB)</Label>
            <Input
              id="ph_file"
              name="file"
              type="file"
              required
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setPreview((prev) => {
                  if (prev) URL.revokeObjectURL(prev);
                  return f ? URL.createObjectURL(f) : null;
                });
              }}
            />
          </div>

          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Önizleme"
              className="border-border max-h-48 w-full rounded-lg border object-contain"
            />
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="ph_caption">Açıklama</Label>
            <Input id="ph_caption" name="caption" placeholder="örn. 1. seans öncesi" />
          </div>

          {state?.error ? (
            <p className="text-destructive text-sm" role="alert">
              {state.error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Yükleniyor…" : "Yükle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
