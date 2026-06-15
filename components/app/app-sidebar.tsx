"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconSparkles } from "@tabler/icons-react";
import { navForRole } from "@/lib/nav";
import { ROLE_LABELS, type OrgRole } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AppSidebar({
  role,
  orgName,
}: {
  role: OrgRole;
  orgName: string;
}) {
  const pathname = usePathname();
  const items = navForRole(role);

  return (
    <aside className="bg-sidebar text-sidebar-foreground hidden w-60 shrink-0 flex-col p-3 md:flex">
      <div className="flex items-center gap-2.5 px-2 py-2">
        <span className="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 items-center justify-center rounded-lg">
          <IconSparkles size={18} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sidebar-foreground truncate text-sm font-medium">
            {orgName}
          </p>
          <p className="text-sidebar-foreground/60 text-xs">
            {ROLE_LABELS[role]}
          </p>
        </div>
      </div>

      <nav className="mt-4 flex flex-col gap-0.5">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <Icon size={18} aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
