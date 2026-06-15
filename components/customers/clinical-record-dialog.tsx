"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  createTreatmentRecord,
  type CustomerState,
} from "@/app/(app)/musteriler/actions";
import type { SchemaField } from "@/lib/procedure-schema";
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

type ProcType = { id: string; name: string; parameter_schema: SchemaField[] };

const selectClass =
  "border-input bg-transparent h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

function DynamicField({ field }: { field: SchemaField }) {
  const name = `param_${field.key}`;
  if (field.type === "textarea") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={name}>{field.label}</Label>
        <Textarea id={name} name={name} rows={2} />
      </div>
    );
  }
  if (field.type === "select") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={name}>{field.label}</Label>
        <select id={name} name={name} className={selectClass} defaultValue="">
          <option value="">Seçin…</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {field.label}
        {field.unit ? (
          <span className="text-muted-foreground"> ({field.unit})</span>
        ) : null}
      </Label>
      <Input
        id={name}
        name={name}
        type={field.type === "number" ? "number" : "text"}
        step={field.type === "number" ? "any" : undefined}
      />
    </div>
  );
}

export function ClinicalRecordDialog({
  customerId,
  procedureTypes,
  staff,
}: {
  customerId: string;
  procedureTypes: ProcType[];
  staff: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [procId, setProcId] = React.useState("");
  const [state, formAction, pending] = useActionState<CustomerState, FormData>(
    createTreatmentRecord,
    undefined,
  );

  React.useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      setProcId("");
      router.refresh();
    }
  }, [state, router]);

  const selected = procedureTypes.find((p) => p.id === procId);
  const fields = selected?.parameter_schema ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ size: "sm" }))}>
        Klinik kayıt ekle
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Klinik kayıt</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="customer_id" value={customerId} />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tr_proc">İşlem türü</Label>
              <select
                id="tr_proc"
                name="procedure_type_id"
                value={procId}
                onChange={(e) => setProcId(e.target.value)}
                className={selectClass}
              >
                <option value="">Seçilmedi</option>
                {procedureTypes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tr_staff">Uygulayan</Label>
              <select id="tr_staff" name="staff_id" className={selectClass} defaultValue="">
                <option value="">Seçilmedi</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tr_area">Bölge</Label>
            <Input id="tr_area" name="area" placeholder="örn. yüz, bacak" />
          </div>

          {fields.length > 0 ? (
            <div className="border-border space-y-3 rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">
                {selected?.name} parametreleri
              </p>
              <div className="grid grid-cols-2 gap-3">
                {fields.map((f) => (
                  <DynamicField key={f.key} field={f} />
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-muted-foreground text-xs">SOAP notu</p>
            <Textarea name="soap_subjective" rows={2} placeholder="Subjektif (S)" />
            <Textarea name="soap_objective" rows={2} placeholder="Objektif (O)" />
            <Textarea name="soap_assessment" rows={2} placeholder="Değerlendirme (A)" />
            <Textarea name="soap_plan" rows={2} placeholder="Plan (P)" />
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
