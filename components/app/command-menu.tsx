"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { IconUser } from "@tabler/icons-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { navForRole } from "@/lib/nav";
import type { OrgRole } from "@/lib/types";

type CustomerHit = { id: string; full_name: string; phone: string | null };

export function CommandMenu({
  open,
  onOpenChange,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: OrgRole;
}) {
  const router = useRouter();
  const items = navForRole(role);
  const [query, setQuery] = React.useState("");
  const [customers, setCustomers] = React.useState<CustomerHit[]>([]);

  React.useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setCustomers([]);
      return;
    }
    let active = true;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/customers/search?q=${encodeURIComponent(q)}`,
        );
        const json = await res.json();
        if (active) setCustomers(json.customers ?? []);
      } catch {
        if (active) setCustomers([]);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, open]);

  const go = (href: string) => {
    onOpenChange(false);
    setQuery("");
    router.push(href);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Komut menüsü"
      description="Müşteri veya sayfa ara"
    >
      <CommandInput
        placeholder="Müşteri adı/telefonu veya sayfa ara…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>

        {customers.length > 0 ? (
          <CommandGroup heading="Müşteriler">
            {customers.map((c) => (
              <CommandItem
                key={c.id}
                value={`${c.full_name} ${c.phone ?? ""} ${c.id}`}
                onSelect={() => go(`/musteriler/${c.id}`)}
              >
                <IconUser size={16} aria-hidden />
                <span>{c.full_name}</span>
                {c.phone ? (
                  <span className="text-muted-foreground ml-auto text-xs">
                    {c.phone}
                  </span>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        <CommandGroup heading="Sayfalar">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.href}
                value={item.label}
                onSelect={() => go(item.href)}
              >
                <Icon size={16} aria-hidden />
                <span>{item.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
