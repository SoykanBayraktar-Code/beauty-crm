import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/auth/dal";
import { PrintButton } from "@/components/payments/print-button";

const METHOD_LABELS: Record<string, string> = {
  cash: "Nakit",
  card: "Kart",
  transfer: "Havale",
  online: "Online",
};

const tl = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
});
const dtFmt = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  dateStyle: "long",
  timeStyle: "short",
});

function relName(rel: unknown): string {
  if (!rel) return "—";
  if (Array.isArray(rel)) return rel[0]?.name ?? rel[0]?.full_name ?? "—";
  const o = rel as { name?: string; full_name?: string };
  return o.name ?? o.full_name ?? "—";
}

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ receipt: string }>;
}) {
  await requireMembership();
  const { receipt } = await params;

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("payments")
    .select(
      "amount, method, type, paid_at, note, customers(full_name), organizations(name)",
    )
    .eq("receipt_no", receipt)
    .is("deleted_at", null)
    .order("created_at");

  if (!rows || rows.length === 0) notFound();

  const total = rows.reduce((sum, r) => sum + Number(r.amount), 0);
  const orgName = relName(rows[0].organizations);
  const customerName = relName(rows[0].customers);

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <div className="mb-4 flex items-center justify-between" data-no-print>
        <Link
          href="/musteriler"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <IconArrowLeft size={16} aria-hidden />
          Geri
        </Link>
        <PrintButton />
      </div>

      <div className="border-border bg-card rounded-xl border p-6">
        <div className="border-border mb-4 border-b pb-4 text-center">
          <p className="text-lg font-medium">{orgName}</p>
          <p className="text-muted-foreground text-sm">Ödeme Makbuzu</p>
        </div>

        <div className="mb-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Makbuz No</span>
            <span className="font-medium">{receipt}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tarih</span>
            <span>{dtFmt.format(new Date(rows[0].paid_at))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Müşteri</span>
            <span>{customerName}</span>
          </div>
        </div>

        <div className="border-border border-t pt-3">
          {rows.map((r, i) => (
            <div key={i} className="flex justify-between py-1 text-sm">
              <span className="text-muted-foreground">
                {METHOD_LABELS[r.method] ?? r.method}
              </span>
              <span className="tabular-nums">{tl.format(Number(r.amount))}</span>
            </div>
          ))}
        </div>

        <div className="border-border mt-3 flex justify-between border-t pt-3">
          <span className="font-medium">Toplam</span>
          <span className="text-lg font-medium tabular-nums">
            {tl.format(total)}
          </span>
        </div>

        {rows[0].note ? (
          <p className="text-muted-foreground mt-4 text-xs">{rows[0].note}</p>
        ) : null}
      </div>
    </div>
  );
}
