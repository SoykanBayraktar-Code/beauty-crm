"use client";

import * as React from "react";
import { IconLogout, IconUser } from "@tabler/icons-react";
import { signOut } from "@/app/(auth)/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(value: string) {
  const base = value.split("@")[0] ?? value;
  return base.slice(0, 2).toUpperCase();
}

export function UserMenu({ email }: { email: string }) {
  const formRef = React.useRef<HTMLFormElement>(null);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Kullanıcı menüsü"
        className="bg-accent text-accent-foreground flex size-8 items-center justify-center rounded-full text-xs font-medium"
      >
        {initials(email)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2 font-normal">
          <IconUser size={16} aria-hidden />
          <span className="truncate text-sm">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={(e) => {
            e.preventDefault();
            formRef.current?.requestSubmit();
          }}
        >
          <IconLogout size={16} aria-hidden />
          Çıkış yap
        </DropdownMenuItem>
      </DropdownMenuContent>
      <form ref={formRef} action={signOut} className="hidden" />
    </DropdownMenu>
  );
}
