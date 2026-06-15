"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  upsertAnamnesis,
  type CustomerState,
} from "@/app/(app)/musteriler/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type AnamnesisInput = {
  version: number;
  allergies: string | null;
  chronic_conditions: string | null;
  medications: string | null;
  pregnancy: boolean;
  fitzpatrick: string | null;
  skin_type: string | null;
  contraindications: string | null;
  notes: string | null;
};

const selectClass =
  "border-input bg-transparent h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function AnamnesisForm({
  customerId,
  current,
}: {
  customerId: string;
  current?: AnamnesisInput;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<CustomerState, FormData>(
    upsertAnamnesis,
    undefined,
  );

  React.useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="customer_id" value={customerId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="an_allergies">Alerjiler</Label>
          <Input
            id="an_allergies"
            name="allergies"
            defaultValue={current?.allergies ?? ""}
            placeholder="örn. lidokain, lateks"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="an_medications">İlaçlar</Label>
          <Input
            id="an_medications"
            name="medications"
            defaultValue={current?.medications ?? ""}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="an_chronic">Kronik hastalıklar</Label>
        <Input
          id="an_chronic"
          name="chronic_conditions"
          defaultValue={current?.chronic_conditions ?? ""}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="an_fitz">Fitzpatrick cilt tipi</Label>
          <select
            id="an_fitz"
            name="fitzpatrick"
            defaultValue={current?.fitzpatrick ?? ""}
            className={selectClass}
          >
            <option value="">Belirtilmemiş</option>
            {["I", "II", "III", "IV", "V", "VI"].map((f) => (
              <option key={f} value={f}>
                Tip {f}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="an_skin">Cilt tipi</Label>
          <Input
            id="an_skin"
            name="skin_type"
            defaultValue={current?.skin_type ?? ""}
            placeholder="kuru, yağlı, karma…"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="an_contra">Kontrendikasyonlar</Label>
        <Textarea
          id="an_contra"
          name="contraindications"
          rows={2}
          defaultValue={current?.contraindications ?? ""}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="pregnancy"
          defaultChecked={current?.pregnancy ?? false}
          className="size-4 accent-[var(--primary)]"
        />
        Gebelik / emzirme
      </label>

      <div className="space-y-1.5">
        <Label htmlFor="an_notes">Not</Label>
        <Textarea
          id="an_notes"
          name="notes"
          rows={2}
          defaultValue={current?.notes ?? ""}
        />
      </div>

      {state?.error ? (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">
          {current ? `Mevcut sürüm: v${current.version}` : "İlk kayıt"}
        </span>
        <Button type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Kaydet (yeni sürüm)"}
        </Button>
      </div>
    </form>
  );
}
