"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  addCustomerNote,
  type CustomerState,
} from "@/app/(app)/musteriler/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Note = { id: string; body: string; created_at: string };

const fmt = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function CustomerNotes({
  customerId,
  notes,
}: {
  customerId: string;
  notes: Note[];
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<CustomerState, FormData>(
    addCustomerNote,
    undefined,
  );

  React.useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <div className="space-y-4">
      <form ref={formRef} action={action} className="space-y-2">
        <input type="hidden" name="customer_id" value={customerId} />
        <Textarea name="body" rows={2} placeholder="Not ekle…" required />
        {state?.error ? (
          <p className="text-destructive text-sm">{state.error}</p>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Ekleniyor…" : "Not ekle"}
          </Button>
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="text-muted-foreground text-sm">Henüz not yok.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="border-border rounded-lg border p-3">
              <p className="text-sm whitespace-pre-wrap">{n.body}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {fmt.format(new Date(n.created_at))}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
