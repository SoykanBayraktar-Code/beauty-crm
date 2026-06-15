"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { IconTrash, IconPlus } from "@tabler/icons-react";
import {
  upsertProcedureType,
  type CatalogState,
} from "@/app/(app)/hizmetler/actions";
import {
  PROCEDURE_TEMPLATES,
  FIELD_TYPE_LABELS,
  slugifyKey,
  type SchemaField,
  type SchemaFieldType,
} from "@/lib/procedure-schema";
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

export type ProcedureTypeInput = {
  id: string;
  name: string;
  category: string | null;
  is_medical: boolean;
  requires_consent: boolean;
  parameter_schema: SchemaField[];
  default_session_count: number;
  recommended_interval_days: number | null;
};

const selectClass =
  "border-input bg-transparent h-9 rounded-md border px-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function ProcedureTypeDialog({
  procedure,
  children,
  variant,
  size,
  className,
}: {
  procedure?: ProcedureTypeInput;
  children: React.ReactNode;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(procedure?.name ?? "");
  const [category, setCategory] = React.useState(procedure?.category ?? "");
  const [isMedical, setIsMedical] = React.useState(
    procedure?.is_medical ?? false,
  );
  const [requiresConsent, setRequiresConsent] = React.useState(
    procedure?.requires_consent ?? false,
  );
  const [fields, setFields] = React.useState<SchemaField[]>(
    procedure?.parameter_schema ?? [],
  );
  const [state, formAction, pending] = useActionState<CatalogState, FormData>(
    upsertProcedureType,
    undefined,
  );

  React.useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  const loadTemplate = (idx: number) => {
    const t = PROCEDURE_TEMPLATES[idx];
    if (!t) return;
    setName(t.name);
    setCategory(t.category);
    setIsMedical(t.is_medical);
    setRequiresConsent(t.requires_consent);
    setFields(t.fields.map((f) => ({ ...f })));
  };

  const updateField = (i: number, patch: Partial<SchemaField>) =>
    setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const addField = () =>
    setFields((fs) => [...fs, { key: "", label: "", type: "text" }]);
  const removeField = (i: number) =>
    setFields((fs) => fs.filter((_, j) => j !== i));

  const builtSchema = fields
    .filter((f) => f.label.trim())
    .map((f) => ({
      key: slugifyKey(f.label),
      label: f.label.trim(),
      type: f.type,
      ...(f.type === "number" && f.unit ? { unit: f.unit } : {}),
      ...(f.type === "select" && f.options?.length
        ? { options: f.options }
        : {}),
    }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ variant, size }), className)}>
        {children}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {procedure ? "İşlem türünü düzenle" : "Yeni işlem türü"}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          {procedure ? (
            <input type="hidden" name="id" defaultValue={procedure.id} />
          ) : null}
          <input
            type="hidden"
            name="parameter_schema"
            value={JSON.stringify(builtSchema)}
          />

          {!procedure ? (
            <div className="space-y-1.5">
              <Label htmlFor="pt_tpl">Hazır şablon yükle</Label>
              <select
                id="pt_tpl"
                className={cn(selectClass, "w-full")}
                defaultValue=""
                onChange={(e) =>
                  e.target.value !== "" && loadTemplate(Number(e.target.value))
                }
              >
                <option value="">Boş başla…</option>
                {PROCEDURE_TEMPLATES.map((t, i) => (
                  <option key={t.name} value={i}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pt_name">İşlem adı *</Label>
              <Input
                id="pt_name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pt_cat">Kategori</Label>
              <Input
                id="pt_cat"
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pt_sessions">Varsayılan seans</Label>
              <Input
                id="pt_sessions"
                name="default_session_count"
                type="number"
                min={1}
                defaultValue={procedure?.default_session_count ?? 1}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pt_interval">Önerilen aralık (gün)</Label>
              <Input
                id="pt_interval"
                name="recommended_interval_days"
                type="number"
                min={1}
                defaultValue={procedure?.recommended_interval_days ?? ""}
                placeholder="örn. 28"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_medical"
                checked={isMedical}
                onChange={(e) => setIsMedical(e.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              Medikal (hekim)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="requires_consent"
                checked={requiresConsent}
                onChange={(e) => setRequiresConsent(e.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              Onam gerekli
            </label>
          </div>

          <div className="space-y-2">
            <Label>Parametre alanları (klinik form)</Label>
            {fields.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                Henüz alan yok. Aşağıdan ekleyin veya hazır şablon yükleyin.
              </p>
            ) : null}
            {fields.map((f, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Input
                  value={f.label}
                  onChange={(e) => updateField(i, { label: e.target.value })}
                  placeholder="Alan adı"
                  className="h-9 flex-1"
                />
                <select
                  value={f.type}
                  onChange={(e) =>
                    updateField(i, { type: e.target.value as SchemaFieldType })
                  }
                  className={selectClass}
                >
                  {(
                    Object.keys(FIELD_TYPE_LABELS) as SchemaFieldType[]
                  ).map((t) => (
                    <option key={t} value={t}>
                      {FIELD_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
                {f.type === "number" ? (
                  <Input
                    value={f.unit ?? ""}
                    onChange={(e) => updateField(i, { unit: e.target.value })}
                    placeholder="birim"
                    className="h-9 w-20"
                  />
                ) : null}
                {f.type === "select" ? (
                  <Input
                    value={(f.options ?? []).join(", ")}
                    onChange={(e) =>
                      updateField(i, {
                        options: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="seçenekler (virgül)"
                    className="h-9 w-40"
                  />
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Alanı sil"
                  onClick={() => removeField(i)}
                >
                  <IconTrash size={16} aria-hidden />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addField}>
              <IconPlus size={16} aria-hidden />
              Alan ekle
            </Button>
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
