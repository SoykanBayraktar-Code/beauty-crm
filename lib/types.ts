export type OrgRole = "owner" | "reception" | "specialist" | "accountant";

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Yönetici",
  reception: "Resepsiyon",
  specialist: "Uzman",
  accountant: "Muhasebe",
};
