"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  upsertCustomer,
  type CustomerState,
} from "@/app/(app)/musteriler/actions";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type CustomerInput = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  gender: string | null;
  source: string | null;
  tags: string[];
  notes: string | null;
};

const selectClass =
  "border-input bg-transparent h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function CustomerFormDialog({
  trigger,
  customer,
}: {
  trigger: React.ReactElement;
  customer?: CustomerInput;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, formAction, pending] = useActionState<CustomerState, FormData>(
    upsertCustomer,
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
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {customer ? "Müşteriyi düzenle" : "Yeni müşteri"}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          {customer ? (
            <input type="hidden" name="id" defaultValue={customer.id} />
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="full_name">Ad soyad *</Label>
            <Input
              id="full_name"
              name="full_name"
              defaultValue={customer?.full_name ?? ""}
              placeholder="Ayşe Kaya"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={customer?.phone ?? ""}
                placeholder="+90 5__ ___ __ __"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={customer?.email ?? ""}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="birth_date">Doğum tarihi</Label>
              <Input
                id="birth_date"
                name="birth_date"
                type="date"
                defaultValue={customer?.birth_date ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gender">Cinsiyet</Label>
              <select
                id="gender"
                name="gender"
                defaultValue={customer?.gender ?? ""}
                className={selectClass}
              >
                <option value="">Belirtilmemiş</option>
                <option value="female">Kadın</option>
                <option value="male">Erkek</option>
                <option value="other">Diğer</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="source">Kaynak</Label>
            <Input
              id="source"
              name="source"
              defaultValue={customer?.source ?? ""}
              placeholder="Instagram, öneri, geçen müşteri…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tags">Etiketler (virgülle)</Label>
            <Input
              id="tags"
              name="tags"
              defaultValue={(customer?.tags ?? []).join(", ")}
              placeholder="vip, lazer, hamile"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Not</Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={customer?.notes ?? ""}
              rows={2}
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
