"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { inviteMember, type SettingsState } from "@/app/(app)/ayarlar/actions";
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

function randomPassword() {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

export function MemberFormDialog({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pw, setPw] = React.useState("");
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    inviteMember,
    undefined,
  );

  React.useEffect(() => {
    if (open && !pw) setPw(randomPassword());
  }, [open, pw]);

  React.useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      setPw("");
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
          <DialogTitle>Personel ekle</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="mem_name">Ad soyad *</Label>
            <Input id="mem_name" name="full_name" required placeholder="örn. Dr. Elif Yılmaz" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mem_email">E-posta *</Label>
              <Input id="mem_email" name="email" type="email" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mem_role">Rol *</Label>
              <select id="mem_role" name="role" required className={selectClass} defaultValue="reception">
                <option value="reception">Resepsiyon</option>
                <option value="specialist">Uzman</option>
                <option value="accountant">Muhasebe</option>
                <option value="owner">Yönetici</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mem_pw">Geçici şifre *</Label>
            <div className="flex gap-2">
              <Input
                id="mem_pw"
                name="password"
                required
                minLength={8}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPw(randomPassword())}
              >
                Üret
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Bu şifreyi personele iletin; ilk girişte değiştirebilir.
            </p>
          </div>
          {state?.error ? (
            <p className="text-destructive text-sm" role="alert">
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Ekleniyor…" : "Personeli ekle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
