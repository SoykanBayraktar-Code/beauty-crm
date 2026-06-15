"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { updateAppointmentStatus } from "@/app/(app)/takvim/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type ApptStatus =
  | "scheduled"
  | "confirmed"
  | "arrived"
  | "in_progress"
  | "completed"
  | "no_show"
  | "cancelled";

const STATUS_LABELS: Record<ApptStatus, string> = {
  scheduled: "Planlandı",
  confirmed: "Onaylandı",
  arrived: "Geldi",
  in_progress: "İşlemde",
  completed: "Tamamlandı",
  no_show: "Gelmedi",
  cancelled: "İptal",
};

const STATUS_STYLES: Record<ApptStatus, string> = {
  scheduled: "bg-secondary text-secondary-foreground border-border",
  confirmed:
    "bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/30",
  arrived: "bg-accent text-accent-foreground border-primary/40",
  in_progress: "bg-accent text-accent-foreground border-primary/40",
  completed: "bg-muted text-muted-foreground border-border",
  no_show: "bg-destructive/15 text-destructive border-destructive/30",
  cancelled:
    "bg-muted text-muted-foreground border-border line-through opacity-70",
};

const ORDER: ApptStatus[] = [
  "scheduled",
  "confirmed",
  "arrived",
  "in_progress",
  "completed",
  "no_show",
  "cancelled",
];

export function AppointmentBlock({
  id,
  topPx,
  heightPx,
  timeLabel,
  customerName,
  serviceName,
  status,
}: {
  id: string;
  topPx: number;
  heightPx: number;
  timeLabel: string;
  customerName: string;
  serviceName: string | null;
  status: ApptStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const pick = (s: ApptStatus) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("status", s);
      await updateAppointmentStatus(fd);
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        style={{ top: topPx, height: Math.max(heightPx, 22) }}
        className={cn(
          "absolute right-0.5 left-0.5 overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-xs leading-tight",
          pending && "opacity-60",
          STATUS_STYLES[status],
        )}
      >
        <span className="font-medium">{timeLabel}</span> {customerName}
        {serviceName ? (
          <span className="block truncate opacity-80">{serviceName}</span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <div className="text-muted-foreground px-2 py-1.5 text-xs">
          Durumu değiştir
        </div>
        <DropdownMenuSeparator />
        {ORDER.map((s) => (
          <DropdownMenuItem
            key={s}
            disabled={s === status}
            variant={s === "cancelled" || s === "no_show" ? "destructive" : "default"}
            onClick={() => pick(s)}
          >
            {STATUS_LABELS[s]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
