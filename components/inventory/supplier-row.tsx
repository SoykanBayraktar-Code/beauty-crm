"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconEdit, IconTrash } from "@tabler/icons-react";
import { deleteSupplier } from "@/app/(app)/stok/actions";
import {
  SupplierFormDialog,
  type SupplierInput,
} from "@/components/inventory/supplier-form-dialog";

export function SupplierRow({ supplier }: { supplier: SupplierInput }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const contact = [supplier.phone, supplier.email].filter(Boolean).join(" · ");

  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{supplier.name}</p>
        {contact ? (
          <p className="text-muted-foreground text-xs">{contact}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <SupplierFormDialog supplier={supplier} variant="ghost" size="icon">
          <IconEdit size={15} aria-hidden />
        </SupplierFormDialog>
        <button
          type="button"
          aria-label="Tedarikçiyi sil"
          disabled={pending}
          onClick={() => {
            if (!confirm(`${supplier.name} silinsin mi?`)) return;
            const fd = new FormData();
            fd.set("id", supplier.id);
            start(async () => {
              await deleteSupplier(fd);
              router.refresh();
            });
          }}
          className="text-muted-foreground hover:text-destructive rounded-md p-1 disabled:opacity-50"
        >
          <IconTrash size={15} aria-hidden />
        </button>
      </div>
    </li>
  );
}
