import { requireMembership, getUser } from "@/lib/auth/dal";
import { AppSidebar } from "@/components/app/app-sidebar";
import { AppTopbar } from "@/components/app/app-topbar";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const membership = await requireMembership();
  const user = await getUser();

  return (
    <div className="flex min-h-screen">
      <AppSidebar
        role={membership.role}
        orgName={membership.organizations?.name ?? "Merkez"}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar role={membership.role} email={user?.email ?? ""} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
