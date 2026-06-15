"use client";

import { useActionState } from "react";
import { setupOrg, type AuthState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SetupForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    setupOrg,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="orgName">Merkez adı</Label>
        <Input
          id="orgName"
          name="orgName"
          placeholder="Örn. Lumea Güzellik Merkezi"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fullName">Adınız soyadınız</Label>
        <Input id="fullName" name="fullName" placeholder="Soykan Bayraktar" />
      </div>

      {state?.error ? (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Oluşturuluyor…" : "Merkezi oluştur"}
      </Button>
    </form>
  );
}
