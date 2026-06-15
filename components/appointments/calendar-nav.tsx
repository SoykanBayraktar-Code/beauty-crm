"use client";

import { useRouter, usePathname } from "next/navigation";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function CalendarNav({ date, label }: { date: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();

  const go = (d: string) => router.push(`${pathname}?date=${d}`);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
  }).format(new Date());

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label="Önceki gün"
        onClick={() => go(shiftDate(date, -1))}
      >
        <IconChevronLeft size={16} aria-hidden />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label="Sonraki gün"
        onClick={() => go(shiftDate(date, 1))}
      >
        <IconChevronRight size={16} aria-hidden />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => go(today)}>
        Bugün
      </Button>
      <span className="ml-1 text-sm font-medium">{label}</span>
    </div>
  );
}
