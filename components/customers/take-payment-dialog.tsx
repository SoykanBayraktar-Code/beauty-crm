"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { takePayment, type CustomerState } from "@/app/(app)/musteriler/actions";
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

export function TakePaymentDialog({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [lines, setLines] = React.useState(1);
  const [state, formAction, pending] = useActionState<CustomerState, FormData>(
    takePayment,
    undefined,
  );

  React.useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      setLines(1);
      router.refresh();
    }
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ size: "sm" }))}>
        Ödeme al
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ödeme al</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="customer_id" value={customerId} />

          <div className="space-y-1.5">
            <Label htmlFor="pay_type">Tür</Label>
            <select id="pay_type" name="type" className={selectClass} defaultValue="service">
              <option value="service">Hizmet</option>
              <option value="package">Paket</option>
              <option value="product">Ürün</option>
              <option value="other">Diğer</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Ödeme satırları (bölünebilir)</Label>
            {Array.from({ length: lines }).map((_, i) => (
              <div key={i} className="flex gap-2">
                <select
                  name={`method_${i}`}
                  className={selectClass}
                  defaultValue="cash"
                  aria-label="Ödeme yöntemi"
                >
                  <option value="cash">Nakit</option>
                  <option value="card">Kart</option>
                  <option value="transfer">Havale</option>
                  <option value="online">Online</option>
                </select>
                <Input
                  name={`amount_${i}`}
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Tutar ₺"
                  className="w-32"
                />
              </div>
            ))}
            {lines < 3 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setLines((n) => Math.min(3, n + 1))}
              >
                + Bölünmüş ödeme satırı
              </Button>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay_note">Not</Label>
            <Input id="pay_note" name="note" placeholder="Opsiyonel" />
          </div>

          {state?.error ? (
            <p className="text-destructive text-sm" role="alert">
              {state.error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Kaydediliyor…" : "Tahsil et"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
