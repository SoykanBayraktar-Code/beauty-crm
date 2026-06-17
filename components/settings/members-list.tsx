"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconUserOff } from "@tabler/icons-react";
import {
  updateMemberRole,
  deactivateMember,
} from "@/app/(app)/ayarlar/actions";

export type MemberView = {
  memberId: string;
  name: string;
  email: string;
  role: string;
  isSelf: boolean;
};

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "owner", label: "Yönetici" },
  { value: "reception", label: "Resepsiyon" },
  { value: "specialist", label: "Uzman" },
  { value: "accountant", label: "Muhasebe" },
];
const selectClass =
  "border-input bg-transparent h-8 rounded-md border px-2 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function MembersList({ members }: { members: MemberView[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function changeRole(memberId: string, role: string) {
    const fd = new FormData();
    fd.set("member_id", memberId);
    fd.set("role", role);
    start(async () => {
      await updateMemberRole(fd);
      router.refresh();
    });
  }

  function deactivate(memberId: string, name: string) {
    if (!confirm(`${name} pasifleştirilsin mi? Erişimi kalkar.`)) return;
    const fd = new FormData();
    fd.set("member_id", memberId);
    start(async () => {
      await deactivateMember(fd);
      router.refresh();
    });
  }

  return (
    <ul className="divide-border divide-y">
      {members.map((mem) => (
        <li
          key={mem.memberId}
          className="flex items-center justify-between gap-3 py-2.5"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {mem.name}
              {mem.isSelf ? (
                <span className="text-muted-foreground font-normal"> (siz)</span>
              ) : null}
            </p>
            <p className="text-muted-foreground truncate text-xs">{mem.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              aria-label="Rol"
              className={selectClass}
              defaultValue={mem.role}
              disabled={pending || mem.isSelf}
              onChange={(e) => changeRole(mem.memberId, e.target.value)}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {mem.isSelf ? null : (
              <button
                type="button"
                aria-label="Pasifleştir"
                disabled={pending}
                onClick={() => deactivate(mem.memberId, mem.name)}
                className="text-muted-foreground hover:text-destructive rounded-md p-1 disabled:opacity-50"
              >
                <IconUserOff size={16} aria-hidden />
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
