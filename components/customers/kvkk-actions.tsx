"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconDownload, IconUserX, IconTrash } from "@tabler/icons-react";
import {
  anonymizeCustomer,
  deleteCustomerPermanently,
} from "@/app/(app)/musteriler/actions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function KvkkActions({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function anonymize() {
    if (
      !confirm(
        "Müşterinin kimlik bilgileri (ad, telefon, e-posta…) kalıcı olarak silinecek. " +
          "Klinik/finans kayıtları yasal saklama için kalır ama kişi tanımlanamaz olur. Devam?",
      )
    )
      return;
    const fd = new FormData();
    fd.set("id", customerId);
    start(async () => {
      await anonymizeCustomer(fd);
      router.refresh();
    });
  }

  function destroy() {
    if (
      !confirm(
        `"${customerName}" ve TÜM kayıtları (randevu, ödeme, klinik, foto, onam) ` +
          "kalıcı olarak silinecek. Bu işlem GERİ ALINAMAZ. Devam?",
      )
    )
      return;
    if (!confirm("Son onay: kalıcı silme işlemini onaylıyor musunuz?")) return;
    const fd = new FormData();
    fd.set("id", customerId);
    start(async () => {
      await deleteCustomerPermanently(fd);
      router.push("/musteriler");
    });
  }

  return (
    <div className="border-destructive/30 space-y-3 rounded-lg border border-dashed p-4">
      <div>
        <h3 className="text-sm font-medium">KVKK / Veri sahibi hakları</h3>
        <p className="text-muted-foreground text-xs">
          Erişim talebi (dışa aktarma) ve unutulma hakkı (anonimleştir / kalıcı
          sil). Yalnız yönetici.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={`/api/customers/${customerId}/export`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <IconDownload size={15} aria-hidden />
          Veriyi dışa aktar (JSON)
        </a>
        <button
          type="button"
          disabled={pending}
          onClick={anonymize}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <IconUserX size={15} aria-hidden />
          Anonimleştir
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={destroy}
          className={cn(buttonVariants({ variant: "destructive", size: "sm" }))}
        >
          <IconTrash size={15} aria-hidden />
          Kalıcı sil
        </button>
      </div>
    </div>
  );
}
