"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  upsertPackage,
  type CatalogState,
} from "@/app/(app)/hizmetler/actions";
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
import type { VariantProps } from "class-variance-authority";

export type PackageInput = {
  id: string;
  name: string;
  service_id: string | null;
  total_sessions: number;
  price: number;
  valid_days: number | null;
};

const selectClass =
  "border-input bg-transparent h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function PackageFormDialog({
  pkg,
  services,
  children,
  variant,
  size,
  className,
}: {
  pkg?: PackageInput;
  services: { id: string; name: string }[];
  children: React.ReactNode;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, formAction, pending] = useActionState<CatalogState, FormData>(
    upsertPackage,
    undefined,
  );

  React.useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ variant, size }), className)}>
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pkg ? "Paketi düzenle" : "Yeni paket"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          {pkg ? (
            <input type="hidden" name="id" defaultValue={pkg.id} />
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="p_name">Paket adı *</Label>
            <Input
              id="p_name"
              name="name"
              defaultValue={pkg?.name ?? ""}
              placeholder="8 Seans Lazer Epilasyon"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p_service">Hizmet</Label>
            <select
              id="p_service"
              name="service_id"
              defaultValue={pkg?.service_id ?? ""}
              className={selectClass}
            >
              <option value="">Seçilmedi</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p_sessions">Seans</Label>
              <Input
                id="p_sessions"
                name="total_sessions"
                type="number"
                min={1}
                defaultValue={pkg?.total_sessions ?? 1}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p_price">Fiyat (₺)</Label>
              <Input
                id="p_price"
                name="price"
                type="number"
                min={0}
                step="0.01"
                defaultValue={pkg?.price ?? 0}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p_valid">Geçerlilik (gün)</Label>
              <Input
                id="p_valid"
                name="valid_days"
                type="number"
                min={1}
                defaultValue={pkg?.valid_days ?? ""}
                placeholder="—"
              />
            </div>
          </div>

          {state?.error ? (
            <p className="text-destructive text-sm" role="alert">
              {state.error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
