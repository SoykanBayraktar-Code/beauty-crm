"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { addExpense, type FinanceState } from "@/app/(app)/finans/actions";
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

export const EXPENSE_LABELS: Record<string, string> = {
  rent: "Kira",
  supplies: "Malzeme",
  salary: "Maaş",
  utilities: "Fatura",
  other: "Diğer",
};

export function ExpenseFormDialog({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, action, pending] = useActionState<FinanceState, FormData>(
    addExpense,
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
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gider ekle</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="exp_cat">Kategori</Label>
              <select id="exp_cat" name="category" className={selectClass} defaultValue="other">
                {Object.entries(EXPENSE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp_amount">Tutar (₺) *</Label>
              <Input id="exp_amount" name="amount" type="number" min={0} step="0.01" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exp_date">Tarih</Label>
            <Input id="exp_date" name="spent_on" type="date" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exp_note">Açıklama</Label>
            <Input id="exp_note" name="note" placeholder="örn. Haziran kira" />
          </div>
          {state?.error ? (
            <p className="text-destructive text-sm" role="alert">
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Ekleniyor…" : "Gideri ekle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
