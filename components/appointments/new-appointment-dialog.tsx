"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  createAppointment,
  type ApptState,
} from "@/app/(app)/takvim/actions";
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

type Opt = { id: string; full_name?: string; name?: string };
type Pkg = {
  id: string;
  name: string;
  sessions_total: number;
  sessions_used: number;
};

const selectClass =
  "border-input bg-transparent h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function NewAppointmentDialog({
  customers,
  services,
  staff,
  defaultDate,
  children,
  variant,
  size,
  className,
}: {
  customers: Opt[];
  services: { id: string; name: string }[];
  staff: { id: string; full_name: string }[];
  defaultDate: string;
  children: React.ReactNode;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [customerId, setCustomerId] = React.useState("");
  const [packages, setPackages] = React.useState<Pkg[]>([]);
  const [state, formAction, pending] = useActionState<ApptState, FormData>(
    createAppointment,
    undefined,
  );

  React.useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  React.useEffect(() => {
    if (!customerId) {
      setPackages([]);
      return;
    }
    let active = true;
    fetch(`/api/customers/${customerId}/packages`)
      .then((r) => r.json())
      .then((j) => active && setPackages(j.packages ?? []))
      .catch(() => active && setPackages([]));
    return () => {
      active = false;
    };
  }, [customerId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ variant, size }), className)}>
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni randevu</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="a_customer">Müşteri *</Label>
            <select
              id="a_customer"
              name="customer_id"
              required
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className={selectClass}
            >
              <option value="">Seçin…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="a_service">Hizmet</Label>
            <select id="a_service" name="service_id" className={selectClass}>
              <option value="">Seçilmedi</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="a_staff">Uzman *</Label>
            <select id="a_staff" name="staff_id" required className={selectClass}>
              <option value="">Seçin…</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="a_date">Tarih *</Label>
              <Input
                id="a_date"
                name="date"
                type="date"
                defaultValue={defaultDate}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a_time">Saat *</Label>
              <Input id="a_time" name="time" type="time" defaultValue="10:00" required />
            </div>
          </div>

          {packages.length > 0 ? (
            <div className="space-y-1.5">
              <Label htmlFor="a_package">Paketten düş (opsiyonel)</Label>
              <select
                id="a_package"
                name="customer_package_id"
                className={selectClass}
              >
                <option value="">Paket kullanma</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sessions_total - p.sessions_used} seans kaldı)
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {state?.error ? (
            <p className="text-destructive text-sm" role="alert">
              {state.error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Kaydediliyor…" : "Randevu oluştur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
