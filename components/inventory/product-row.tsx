"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconEdit, IconTrash } from "@tabler/icons-react";
import { deleteProduct, deleteBatch } from "@/app/(app)/stok/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductFormDialog } from "@/components/inventory/product-form-dialog";
import { BatchFormDialog } from "@/components/inventory/batch-form-dialog";
import type { ExpiryStatus } from "@/lib/inventory";
import { EXPIRY_LABEL } from "@/lib/inventory";

export type BatchView = {
  id: string;
  batch_no: string | null;
  expiry_date: string | null;
  quantity: number;
  expiry: ExpiryStatus;
};

export type ProductView = {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  unit: string;
  supplier_id: string | null;
  supplier_name: string | null;
  reorder_level: number;
  sale_price: number | null;
  total: number;
  isLow: boolean;
  batches: BatchView[];
};

const dateFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const qty = (n: number) =>
  Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");

function DeleteButton({
  label,
  onConfirm,
  confirmText,
}: {
  label: string;
  onConfirm: () => Promise<void>;
  confirmText: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={label}
      disabled={pending}
      onClick={() => {
        if (!confirm(confirmText)) return;
        start(async () => {
          await onConfirm();
        });
      }}
      className="text-muted-foreground hover:text-destructive rounded-md p-1 disabled:opacity-50"
    >
      <IconTrash size={15} aria-hidden />
    </button>
  );
}

export function ProductRow({
  product,
  suppliers,
}: {
  product: ProductView;
  suppliers: { id: string; name: string }[];
}) {
  const router = useRouter();

  async function onDeleteProduct() {
    const fd = new FormData();
    fd.set("id", product.id);
    await deleteProduct(fd);
    router.refresh();
  }
  async function onDeleteBatch(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    await deleteBatch(fd);
    router.refresh();
  }

  return (
    <div className="border-border rounded-lg border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{product.name}</p>
            <Badge variant="secondary">
              {product.category === "retail" ? "Perakende" : "Sarf"}
            </Badge>
            {product.isLow ? (
              <Badge variant="destructive">⚠ Kritik stok</Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Toplam: <span className="text-foreground font-medium">
              {qty(product.total)} {product.unit}
            </span>
            {product.reorder_level > 0
              ? ` · eşik ${qty(product.reorder_level)}`
              : ""}
            {product.supplier_name ? ` · ${product.supplier_name}` : ""}
            {product.sku ? ` · ${product.sku}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <BatchFormDialog
            productId={product.id}
            productName={product.name}
            unit={product.unit}
          />
          <ProductFormDialog
            product={{
              id: product.id,
              name: product.name,
              sku: product.sku,
              category: product.category,
              unit: product.unit,
              supplier_id: product.supplier_id,
              reorder_level: product.reorder_level,
              sale_price: product.sale_price,
            }}
            suppliers={suppliers}
            variant="ghost"
            size="icon"
          >
            <IconEdit size={15} aria-hidden />
          </ProductFormDialog>
          <DeleteButton
            label="Ürünü sil"
            confirmText={`${product.name} silinsin mi?`}
            onConfirm={onDeleteProduct}
          />
        </div>
      </div>

      {product.batches.length > 0 ? (
        <ul className="divide-border mt-2 divide-y border-t pt-1">
          {product.batches.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-2 py-1.5 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {qty(b.quantity)} {product.unit}
                </span>
                <span className="text-muted-foreground">
                  {b.batch_no ? `Lot ${b.batch_no}` : "Lot —"}
                </span>
                {b.expiry_date ? (
                  <span
                    className={
                      b.expiry === "expired"
                        ? "text-destructive"
                        : b.expiry === "soon"
                          ? "text-[var(--accent-foreground)]"
                          : "text-muted-foreground"
                    }
                  >
                    SKT {dateFmt.format(new Date(b.expiry_date))}
                  </span>
                ) : null}
                {b.expiry === "expired" || b.expiry === "soon" ? (
                  <Badge
                    variant={b.expiry === "expired" ? "destructive" : "outline"}
                  >
                    {EXPIRY_LABEL[b.expiry]}
                  </Badge>
                ) : null}
              </div>
              <DeleteButton
                label="Lotu sil"
                confirmText="Bu lot silinsin mi?"
                onConfirm={() => onDeleteBatch(b.id)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground mt-2 border-t pt-2 text-xs">
          Henüz lot yok — “Lot ekle” ile stok girin.
        </p>
      )}
    </div>
  );
}
