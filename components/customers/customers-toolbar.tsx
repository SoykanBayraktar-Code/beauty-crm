"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { IconSearch, IconPlus } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CustomerFormDialog } from "./customer-form-dialog";

const selectClass =
  "border-input bg-card h-9 rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function CustomersToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = React.useState(searchParams.get("q") ?? "");

  const pushParam = React.useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(window.location.search);
      if (value) params.set(key, value);
      else params.delete(key);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname],
  );

  React.useEffect(() => {
    const t = setTimeout(() => pushParam("q", q), 300);
    return () => clearTimeout(t);
  }, [q, pushParam]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative max-w-xs flex-1">
        <IconSearch
          size={16}
          aria-hidden
          className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2"
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ad veya telefon ara…"
          className="pl-9"
          aria-label="Müşteri ara"
        />
      </div>

      <select
        defaultValue={searchParams.get("gender") ?? ""}
        onChange={(e) => pushParam("gender", e.target.value)}
        className={selectClass}
        aria-label="Cinsiyet filtresi"
      >
        <option value="">Tüm cinsiyetler</option>
        <option value="female">Kadın</option>
        <option value="male">Erkek</option>
        <option value="other">Diğer</option>
      </select>

      <CustomerFormDialog
        trigger={
          <Button className="ml-auto">
            <IconPlus size={16} aria-hidden />
            Yeni müşteri
          </Button>
        }
      />
    </div>
  );
}
