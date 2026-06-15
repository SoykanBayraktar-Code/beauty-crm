import { IconSparkles } from "@tabler/icons-react";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 flex items-center gap-3">
        <span className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-xl">
          <IconSparkles size={22} aria-hidden />
        </span>
        <div>
          <p className="text-lg font-medium tracking-tight">Lumea</p>
          <p className="text-muted-foreground text-xs">Güzellik Merkezi CRM</p>
        </div>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
