import {
  IconLayoutDashboard,
  IconCalendar,
  IconUsers,
  IconListDetails,
  IconWallet,
  IconSpeakerphone,
  IconBox,
  IconChartBar,
  IconSettings,
} from "@tabler/icons-react";
import type { OrgRole } from "@/lib/types";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  roles: OrgRole[];
};

const ALL: OrgRole[] = ["owner", "reception", "specialist", "accountant"];

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Panel", icon: IconLayoutDashboard, roles: ALL },
  {
    href: "/takvim",
    label: "Takvim",
    icon: IconCalendar,
    roles: ["owner", "reception", "specialist"],
  },
  { href: "/musteriler", label: "Müşteriler", icon: IconUsers, roles: ALL },
  {
    href: "/hizmetler",
    label: "Hizmetler",
    icon: IconListDetails,
    roles: ["owner"],
  },
  {
    href: "/finans",
    label: "Finans",
    icon: IconWallet,
    roles: ["owner", "reception", "accountant"],
  },
  {
    href: "/pazarlama",
    label: "Pazarlama",
    icon: IconSpeakerphone,
    roles: ["owner", "reception"],
  },
  {
    href: "/stok",
    label: "Stok",
    icon: IconBox,
    roles: ["owner", "reception"],
  },
  {
    href: "/raporlar",
    label: "Raporlar",
    icon: IconChartBar,
    roles: ["owner", "accountant"],
  },
  { href: "/ayarlar", label: "Ayarlar", icon: IconSettings, roles: ["owner"] },
];

export function navForRole(role: OrgRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
