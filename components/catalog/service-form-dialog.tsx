"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  upsertService,
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

export type ServiceInput = {
  id: string;
  name: string;
  category: string | null;
  duration_min: number;
  price: number;
};

export function ServiceFormDialog({
  service,
  children,
  variant,
  size,
  className,
}: {
  service?: ServiceInput;
  children: React.ReactNode;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, formAction, pending] = useActionState<CatalogState, FormData>(
    upsertService,
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
          <DialogTitle>
            {service ? "Hizmeti düzenle" : "Yeni hizmet"}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          {service ? (
            <input type="hidden" name="id" defaultValue={service.id} />
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="s_name">Hizmet adı *</Label>
            <Input
              id="s_name"
              name="name"
              defaultValue={service?.name ?? ""}
              placeholder="Lazer epilasyon — tüm vücut"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s_category">Kategori</Label>
            <Input
              id="s_category"
              name="category"
              defaultValue={service?.category ?? ""}
              placeholder="Lazer, Cilt bakımı, Enjeksiyon…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="s_duration">Süre (dk)</Label>
              <Input
                id="s_duration"
                name="duration_min"
                type="number"
                min={1}
                defaultValue={service?.duration_min ?? 30}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s_price">Fiyat (₺)</Label>
              <Input
                id="s_price"
                name="price"
                type="number"
                min={0}
                step="0.01"
                defaultValue={service?.price ?? 0}
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
