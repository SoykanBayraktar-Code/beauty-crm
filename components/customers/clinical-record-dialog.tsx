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
type UsageProduct = {
  id: string;
  name: string;
  unit: string;
  batches: { id: string; label: string }[];
};

const selectClass =
  "border-input bg-transparent h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

const MAX_USAGE = 6;

function MaterialUsage({ products }: { products: UsageProduct[] }) {
  const [rows, setRows] = React.useState<{ key: number; productId: string }[]>(
    [],
  );
  const nextKey = React.useRef(0);

  if (products.length === 0) return null;

  return (
    <div className="border-border space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs">Kullanılan malzeme</p>
        {rows.length < MAX_USAGE ? (
          <button
            type="button"
            onClick={() =>
              setRows((r) => [...r, { key: nextKey.current++, productId: "" }])
            }
            className="text-xs text-[var(--accent-foreground)] hover:underline"
          >
            + Ürün ekle
          </button>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          İsteğe bağlı — eklenen ürünün stoğu lottan düşülür.
        </p>
      ) : null}
      {rows.map((row, i) => {
        const prod = products.find((p) => p.id === row.productId);
        return (
          <div key={row.key} className="grid grid-cols-[1fr_1fr_72px_28px] gap-2">
            <select
              name={`usage_product_${i}`}
              className={selectClass}
              value={row.productId}
              onChange={(e) =>
                setRows((r) =>
                  r.map((x) =>
                    x.key === row.key
                      ? { ...x, productId: e.target.value }
                      : x,
                  ),
                )
              }
            >
              <option value="">Ürün…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              key={`batch-${row.productId}`}
              name={`usage_batch_${i}`}
              className={selectClass}
              defaultValue=""
              disabled={!prod}
            >
              <option value="">Lot…</option>
              {(prod?.batches ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
            <Input
              name={`usage_qty_${i}`}
              type="number"
              min={0}
              step="any"
              placeholder={prod?.unit ?? "miktar"}
            />
            <button
              type="button"
              aria-label="Satırı kaldır"
              onClick={() =>
                setRows((r) => r.filter((x) => x.key !== row.key))
              }
              className="text-muted-foreground hover:text-destructive text-lg leading-none"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

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
  products = [],
}: {
  customerId: string;
  procedureTypes: ProcType[];
  staff: { id: string; full_name: string }[];
  products?: UsageProduct[];
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

          <MaterialUsage products={products} />

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
