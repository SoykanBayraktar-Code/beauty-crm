"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { upsertProduct, type StockState } from "@/app/(app)/stok/actions";
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

const selectClass =
  "border-input bg-transparent h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export type ProductInput = {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  unit: string;
  supplier_id: string | null;
  reorder_level: number;
  sale_price: number | null;
};

export function ProductFormDialog({
  product,
  suppliers,
  children,
  variant,
  size,
  className,
}: {
  product?: ProductInput;
  suppliers: { id: string; name: string }[];
  children: React.ReactNode;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, formAction, pending] = useActionState<StockState, FormData>(
    upsertProduct,
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
          <DialogTitle>{product ? "Ürünü düzenle" : "Yeni ürün"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          {product ? (
            <input type="hidden" name="id" defaultValue={product.id} />
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="p_name">Ürün adı *</Label>
            <Input
              id="p_name"
              name="name"
              defaultValue={product?.name ?? ""}
              placeholder="örn. Hyaluronik dolgu 1ml"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p_category">Tür</Label>
              <select
                id="p_category"
                name="category"
                className={selectClass}
                defaultValue={product?.category ?? "consumable"}
              >
                <option value="consumable">Sarf malzeme</option>
                <option value="retail">Perakende (satış)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p_unit">Birim</Label>
              <Input
                id="p_unit"
                name="unit"
                defaultValue={product?.unit ?? "adet"}
                placeholder="adet, ml, kutu…"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p_reorder">Kritik stok eşiği</Label>
              <Input
                id="p_reorder"
                name="reorder_level"
                type="number"
                min={0}
                step="any"
                defaultValue={product?.reorder_level ?? 0}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p_price">Satış fiyatı (₺)</Label>
              <Input
                id="p_price"
                name="sale_price"
                type="number"
                min={0}
                step="0.01"
                defaultValue={product?.sale_price ?? ""}
                placeholder="perakende için"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p_sku">SKU / Kod</Label>
              <Input id="p_sku" name="sku" defaultValue={product?.sku ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p_supplier">Tedarikçi</Label>
              <select
                id="p_supplier"
                name="supplier_id"
                className={selectClass}
                defaultValue={product?.supplier_id ?? ""}
              >
                <option value="">—</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
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
