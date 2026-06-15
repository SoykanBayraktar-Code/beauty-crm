"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { addBatch, type StockState } from "@/app/(app)/stok/actions";
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

export function BatchFormDialog({
  productId,
  productName,
  unit,
}: {
  productId: string;
  productName: string;
  unit: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, formAction, pending] = useActionState<StockState, FormData>(
    addBatch,
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
      <DialogTrigger
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        Lot ekle
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lot ekle — {productName}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="product_id" value={productId} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="b_batch">Lot no</Label>
              <Input id="b_batch" name="batch_no" placeholder="örn. L240612" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b_qty">Miktar ({unit}) *</Label>
              <Input
                id="b_qty"
                name="quantity"
                type="number"
                min={0}
                step="any"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="b_exp">Son kullanma (SKT)</Label>
              <Input id="b_exp" name="expiry_date" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b_cost">Birim maliyet (₺)</Label>
              <Input
                id="b_cost"
                name="unit_cost"
                type="number"
                min={0}
                step="0.01"
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
              {pending ? "Ekleniyor…" : "Lotu ekle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
