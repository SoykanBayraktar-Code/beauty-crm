"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  upsertConsentTemplate,
  type SettingsState,
} from "@/app/(app)/ayarlar/actions";
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
import type { VariantProps } from "class-variance-authority";

export type TemplateInput = { id: string; name: string; body: string };

export function ConsentTemplateDialog({
  template,
  children,
  variant,
  size,
  className,
}: {
  template?: TemplateInput;
  children: React.ReactNode;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    upsertConsentTemplate,
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
      <DialogTrigger className={cn(buttonVariants({ variant, size }), className)}>
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {template ? "Onam metnini düzenle" : "Yeni onam metni"}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          {template ? (
            <input type="hidden" name="id" defaultValue={template.id} />
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="ct_name">Başlık</Label>
            <Input
              id="ct_name"
              name="name"
              defaultValue={template?.name ?? ""}
              placeholder="KVKK Aydınlatma ve Açık Rıza"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct_body">Metin</Label>
            <Textarea
              id="ct_body"
              name="body"
              defaultValue={template?.body ?? ""}
              rows={6}
              placeholder="Kişisel verilerinizin işlenmesine ilişkin…"
              required
            />
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
