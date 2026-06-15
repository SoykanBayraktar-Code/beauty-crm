"use client";

import * as React from "react";
import { IconSearch, IconBell } from "@tabler/icons-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandMenu } from "@/components/app/command-menu";
import { UserMenu } from "@/components/app/user-menu";
import { Button } from "@/components/ui/button";
import type { OrgRole } from "@/lib/types";

export function AppTopbar({
  role,
  email,
}: {
  role: OrgRole;
  email: string;
}) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="border-border bg-background/80 sticky top-0 z-10 flex h-14 items-center gap-3 border-b px-4 backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-border bg-muted/40 text-muted-foreground hover:bg-muted flex h-9 max-w-md flex-1 items-center gap-2 rounded-lg border px-3 text-sm transition-colors"
      >
        <IconSearch size={16} aria-hidden />
        <span>Müşteri, randevu ara…</span>
        <kbd className="border-border bg-background ml-auto rounded border px-1.5 text-xs">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Bildirimler">
          <IconBell size={18} aria-hidden />
        </Button>
        <ThemeToggle />
        <UserMenu email={email} />
      </div>

      <CommandMenu open={open} onOpenChange={setOpen} role={role} />
    </header>
  );
}
