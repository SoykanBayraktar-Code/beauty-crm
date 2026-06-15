"use client";

import { useRouter } from "next/navigation";
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

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Komut menüsü"
      description="Sayfa ara veya komut çalıştır"
    >
      <CommandInput placeholder="Sayfa ara…  (müşteri araması Faz 1'de)" />
      <CommandList>
        <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>
        <CommandGroup heading="Sayfalar">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.href}
                value={item.label}
                onSelect={() => {
                  onOpenChange(false);
                  router.push(item.href);
                }}
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
