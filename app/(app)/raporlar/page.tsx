import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/auth/dal";
import { Card, CardContent } from "@/components/ui/card";

const tl = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});
const METHOD_LABELS: Record<string, string> = {
  cash: "Nakit",
  card: "Kart",
  transfer: "Havale",
  online: "Online",
};

function relName(rel: unknown): string {
  if (!rel) return "—";
  if (Array.isArray(rel)) return rel[0]?.name ?? "—";
  return (rel as { name?: string }).name ?? "—";
}
function sum(rows: { amount: number | string }[] | null) {
  return (rows ?? []).reduce((s, r) => s + Number(r.amount), 0);
}

export default async function RaporlarPage() {
  const membership = await requireMembership();
  const role = membership.role;
  const allowed = role === "owner" || role === "accountant";

  if (!allowed) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-medium tracking-tight">Raporlar</h1>
        <p className="text-muted-foreground text-sm">
          Bu bölümü görüntüleme yetkiniz yok.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthIso = monthStart.toISOString();
  const monthDate = monthIso.slice(0, 10);
  const monthName = new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
  }).format(now);

  const [
    { data: pays },
    { data: exps },
    { data: appts },
    { data: newCust },
    { data: allCust },
  ] = await Promise.all([
    supabase
      .from("payments")
      .select("amount, method")
      .gte("paid_at", monthIso)
      .is("deleted_at", null),
    supabase
      .from("expenses")
      .select("amount")
      .gte("spent_on", monthDate)
      .is("deleted_at", null),
    supabase
      .from("appointments")
      .select("status, services(name)")
      .gte("start_at", monthIso)
      .is("deleted_at", null),
    supabase
      .from("customers")
      .select("id")
      .gte("created_at", monthIso)
      .is("deleted_at", null),
    supabase.from("customers").select("source").is("deleted_at", null),
  ]);

  const revenue = sum(pays);
  const expenses = sum(exps);
  const net = revenue - expenses;

  const byMethod: Record<string, number> = {};
  for (const p of pays ?? [])
    byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount);

  const appointments = appts ?? [];
  const notCancelled = appointments.filter((a) => a.status !== "cancelled");
  const noShow = appointments.filter((a) => a.status === "no_show").length;
  const noShowRate =
    notCancelled.length > 0
      ? Math.round((noShow / notCancelled.length) * 100)
      : 0;

  const byService: Record<string, number> = {};
  for (const a of notCancelled) {
    const name = relName(a.services);
    byService[name] = (byService[name] ?? 0) + 1;
  }
  const topServices = Object.entries(byService)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const bySource: Record<string, number> = {};
  for (const c of allCust ?? []) {
    const s = (c.source ?? "").trim() || "Bilinmiyor";
    bySource[s] = (bySource[s] ?? 0) + 1;
  }
  const sources = Object.entries(bySource).sort((a, b) => b[1] - a[1]);

  const kpis = [
    { label: `Gelir (${monthName})`, value: tl.format(revenue) },
    { label: `Net kâr (${monthName})`, value: tl.format(net), danger: net < 0 },
    { label: "Yeni müşteri", value: String((newCust ?? []).length) },
    { label: "Gelmeyen oranı", value: `%${noShowRate}` },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Raporlar</h1>
        <p className="text-muted-foreground text-sm">
          {monthName} — gelir, hizmet ve müşteri analizi
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="py-5">
              <p className="text-muted-foreground text-xs">{k.label}</p>
              <p
                className={`mt-1 text-2xl font-medium tabular-nums ${
                  k.danger ? "text-destructive" : ""
                }`}
              >
                {k.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="space-y-3 py-5">
            <h2 className="text-sm font-medium">Gelir — yöntem kırılımı</h2>
            {Object.keys(byMethod).length === 0 ? (
              <p className="text-muted-foreground text-sm">Bu ay ödeme yok.</p>
            ) : (
              <ul className="divide-border divide-y">
                {Object.entries(byMethod)
                  .sort((a, b) => b[1] - a[1])
                  .map(([method, amt]) => (
                    <li
                      key={method}
                      className="flex items-center justify-between py-2 text-sm"
                    >
                      <span>{METHOD_LABELS[method] ?? method}</span>
                      <span className="font-medium tabular-nums">
                        {tl.format(amt)}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 py-5">
            <h2 className="text-sm font-medium">En çok yapılan hizmetler</h2>
            {topServices.length === 0 ? (
              <p className="text-muted-foreground text-sm">Bu ay randevu yok.</p>
            ) : (
              <ul className="divide-border divide-y">
                {topServices.map(([name, count]) => (
                  <li
                    key={name}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <span className="truncate">{name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 py-5">
            <h2 className="text-sm font-medium">Müşteri kaynak dağılımı</h2>
            {sources.length === 0 ? (
              <p className="text-muted-foreground text-sm">Müşteri yok.</p>
            ) : (
              <ul className="divide-border divide-y">
                {sources.map(([src, count]) => (
                  <li
                    key={src}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <span className="truncate">{src}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
