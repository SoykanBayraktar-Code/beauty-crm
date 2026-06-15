"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { upsertSupplier, type StockState } from "@/app/(app)/stok/actions";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { VariantProps } from "class-variance-authority";

export type SupplierInput = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

export function SupplierFormDialog({
  supplier,
  children,
  variant,
  size,
  className,
}: {
  supplier?: SupplierInput;
  children: React.ReactNode;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, formAction, pending] = useActionState<StockState, FormData>(
    upsertSupplier,
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
            {supplier ? "Tedarikçiyi düzenle" : "Yeni tedarikçi"}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          {supplier ? (
            <input type="hidden" name="id" defaultValue={supplier.id} />
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="sup_name">Ad *</Label>
            <Input
              id="sup_name"
              name="name"
              defaultValue={supplier?.name ?? ""}
              placeholder="örn. Medikal Estetik A.Ş."
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sup_phone">Telefon</Label>
              <Input
                id="sup_phone"
                name="phone"
                defaultValue={supplier?.phone ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sup_email">E-posta</Label>
              <Input
                id="sup_email"
                name="email"
                type="email"
                defaultValue={supplier?.email ?? ""}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sup_notes">Not</Label>
            <Textarea
              id="sup_notes"
              name="notes"
              rows={2}
              defaultValue={supplier?.notes ?? ""}
            />
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
