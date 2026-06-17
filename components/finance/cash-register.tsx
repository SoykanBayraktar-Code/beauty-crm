"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  openCashSession,
  closeCashSession,
  type FinanceState,
} from "@/app/(app)/finans/actions";
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

const tl = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 2,
});
const dtFmt = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export type OpenSession = {
  id: string;
  opening_float: number;
  opened_at: string;
};

function OpenDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, action, pending] = useActionState<FinanceState, FormData>(
    openCashSession,
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
      <DialogTrigger className={cn(buttonVariants({ size: "sm" }))}>
        Kasa aç
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kasa aç</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="opening_float">Açılış kasası (₺)</Label>
            <Input
              id="opening_float"
              name="opening_float"
              type="number"
              min={0}
              step="0.01"
              defaultValue={0}
            />
          </div>
          {state?.error ? (
            <p className="text-destructive text-sm" role="alert">
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Açılıyor…" : "Kasayı aç"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CloseDialog({
  session,
  expected,
}: {
  session: OpenSession;
  expected: number;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [counted, setCounted] = React.useState("");
  const [state, action, pending] = useActionState<FinanceState, FormData>(
    closeCashSession,
    undefined,
  );
  React.useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);
  const variance =
    counted.trim() === ""
      ? null
      : Math.round((Number(counted.replace(",", ".")) - expected) * 100) / 100;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
        Kasayı kapat
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kasa kapanış mutabakatı</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-3">
          <input type="hidden" name="session_id" value={session.id} />
          <div className="text-muted-foreground flex justify-between text-sm">
            <span>Beklenen nakit</span>
            <span className="text-foreground font-medium tabular-nums">
              {tl.format(expected)}
            </span>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="counted_amount">Sayılan nakit (₺)</Label>
            <Input
              id="counted_amount"
              name="counted_amount"
              type="number"
              min={0}
              step="0.01"
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
              required
            />
          </div>
          {variance !== null ? (
            <div
              className={cn(
                "flex justify-between rounded-md px-2.5 py-1.5 text-sm",
                variance === 0
                  ? "bg-muted text-muted-foreground"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              <span>Fark</span>
              <span className="font-medium tabular-nums">
                {variance > 0 ? "+" : ""}
                {tl.format(variance)}
              </span>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="note">Not</Label>
            <Textarea id="note" name="note" rows={2} />
          </div>
          {state?.error ? (
            <p className="text-destructive text-sm" role="alert">
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Kapatılıyor…" : "Kasayı kapat"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CashRegister({
  session,
  cashSales,
}: {
  session: OpenSession | null;
  cashSales: number;
}) {
  if (!session) {
    return (
      <div className="border-border flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="text-sm font-medium">Kasa kapalı</p>
          <p className="text-muted-foreground text-xs">
            Güne başlamak için kasayı açın.
          </p>
        </div>
        <OpenDialog />
      </div>
    );
  }
  const expected =
    Math.round((Number(session.opening_float) + cashSales) * 100) / 100;
  return (
    <div className="border-border space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Kasa açık</p>
          <p className="text-muted-foreground text-xs">
            {dtFmt.format(new Date(session.opened_at))}&apos;den beri
          </p>
        </div>
        <CloseDialog session={session} expected={expected} />
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground text-xs">Açılış</p>
          <p className="font-medium tabular-nums">
            {tl.format(Number(session.opening_float))}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Nakit satış</p>
          <p className="font-medium tabular-nums">{tl.format(cashSales)}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Beklenen</p>
          <p className="font-medium tabular-nums">{tl.format(expected)}</p>
        </div>
      </div>
    </div>
  );
}
