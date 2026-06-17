"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconTrash } from "@tabler/icons-react";
import { deleteExpense } from "@/app/(app)/finans/actions";
import { Badge } from "@/components/ui/badge";
import { EXPENSE_LABELS } from "@/components/finance/expense-form-dialog";

export type ExpenseView = {
  id: string;
  category: string;
  amount: number;
  spent_on: string;
  note: string | null;
};

const tl = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});
const dateFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function ExpenseList({ expenses }: { expenses: ExpenseView[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function remove(id: string) {
    if (!confirm("Bu gider silinsin mi?")) return;
    const fd = new FormData();
    fd.set("id", id);
    start(async () => {
      await deleteExpense(fd);
      router.refresh();
    });
  }

  if (expenses.length === 0) {
    return <p className="text-muted-foreground text-sm">Henüz gider yok.</p>;
  }

  return (
    <ul className="divide-border divide-y">
      {expenses.map((e) => (
        <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {EXPENSE_LABELS[e.category] ?? e.category}
            </Badge>
            <div>
              <p className="text-sm font-medium tabular-nums">
                {tl.format(Number(e.amount))}
              </p>
              <p className="text-muted-foreground text-xs">
                {dateFmt.format(new Date(e.spent_on))}
                {e.note ? ` · ${e.note}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Sil"
            disabled={pending}
            onClick={() => remove(e.id)}
            className="text-muted-foreground hover:text-destructive rounded-md p-1 disabled:opacity-50"
          >
            <IconTrash size={15} aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
