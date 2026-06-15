"use client";

import * as React from "react";
import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconTrash } from "@tabler/icons-react";
import {
  grantClinicalAccess,
  revokeClinicalAccess,
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type Grant = {
  id: string;
  granteeName: string;
  reason: string | null;
  expiresAt: string | null;
  createdAt: string;
};

const dateFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const selectClass =
  "border-input bg-transparent h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

function GrantDialog({
  customerId,
  specialists,
}: {
  customerId: string;
  specialists: { memberId: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, formAction, pending] = useActionState<CustomerState, FormData>(
    grantClinicalAccess,
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
      <DialogTrigger className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
        Erişim yetkilendir
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Klinik erişim yetkilendir</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="customer_id" value={customerId} />
          <div className="space-y-1.5">
            <Label htmlFor="cag_grantee">Uzman</Label>
            <select
              id="cag_grantee"
              name="grantee_id"
              required
              className={selectClass}
              defaultValue=""
            >
              <option value="">Seçin…</option>
              {specialists.map((s) => (
                <option key={s.memberId} value={s.memberId}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cag_days">Süre (gün)</Label>
              <Input
                id="cag_days"
                name="expires_days"
                type="number"
                min={1}
                placeholder="boş = süresiz"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cag_reason">Gerekçe</Label>
              <Input id="cag_reason" name="reason" placeholder="örn. konsültasyon" />
            </div>
          </div>
          {state?.error ? (
            <p className="text-destructive text-sm" role="alert">
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Açılıyor…" : "Erişimi aç"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ClinicalAccessManager({
  customerId,
  specialists,
  grants,
}: {
  customerId: string;
  specialists: { memberId: string; name: string }[];
  grants: Grant[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function revoke(id: string) {
    if (!confirm("Bu erişim yetkisi iptal edilsin mi?")) return;
    const fd = new FormData();
    fd.set("id", id);
    fd.set("customer_id", customerId);
    start(async () => {
      await revokeClinicalAccess(fd);
      router.refresh();
    });
  }

  return (
    <div className="border-border bg-muted/30 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Klinik erişim yetkileri</p>
          <p className="text-muted-foreground text-xs">
            Randevusu olmayan bir uzmana bu hastanın kaydına erişim açın (KVKK).
          </p>
        </div>
        <GrantDialog customerId={customerId} specialists={specialists} />
      </div>
      {grants.length > 0 ? (
        <ul className="divide-border mt-3 divide-y border-t">
          {grants.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between gap-3 py-2 text-xs"
            >
              <div>
                <span className="font-medium">{g.granteeName}</span>
                {g.reason ? (
                  <span className="text-muted-foreground"> · {g.reason}</span>
                ) : null}
                <span className="text-muted-foreground">
                  {" · "}
                  {g.expiresAt
                    ? `bitiş ${dateFmt.format(new Date(g.expiresAt))}`
                    : "süresiz"}
                </span>
              </div>
              <button
                type="button"
                aria-label="İptal et"
                disabled={pending}
                onClick={() => revoke(g.id)}
                className="text-muted-foreground hover:text-destructive rounded-md p-1 disabled:opacity-50"
              >
                <IconTrash size={15} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
