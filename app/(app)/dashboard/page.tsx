import { requireMembership } from "@/lib/auth/dal";
import { ROLE_LABELS } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";

const KPIS = [
  { label: "Bugünkü gelir", hint: "Faz 1" },
  { label: "Doluluk", hint: "Faz 1" },
  { label: "Yeni müşteri", hint: "Faz 1" },
  { label: "Gelmeyen oranı", hint: "Faz 1" },
];

export default async function DashboardPage() {
  const membership = await requireMembership();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Panel</h1>
        <p className="text-muted-foreground mt-1">
          {membership.organizations?.name} · {ROLE_LABELS[membership.role]}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="py-5">
              <p className="text-muted-foreground text-sm">{kpi.label}</p>
              <p className="mt-1 text-3xl font-medium tabular-nums">—</p>
              <p className="text-muted-foreground mt-1 text-xs">{kpi.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="text-muted-foreground py-8 text-center text-sm">
          Gerçek veriler (randevu, gelir, hatırlatmalar) Faz 1'de bağlanacak.
          Temel, kimlik ve role göre menü hazır.
        </CardContent>
      </Card>
    </div>
  );
}
