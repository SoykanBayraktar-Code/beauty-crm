import Link from "next/link";
import { requireMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const TZ = "Europe/Istanbul";
const tl = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});
const timeFmt = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const APPT_STATUS: Record<string, string> = {
  scheduled: "Planlandı",
  confirmed: "Onaylandı",
  arrived: "Geldi",
  in_progress: "İşlemde",
  completed: "Tamamlandı",
  no_show: "Gelmedi",
  cancelled: "İptal",
};

function relName(rel: unknown): string {
  if (!rel) return "—";
  if (Array.isArray(rel)) return rel[0]?.name ?? rel[0]?.full_name ?? "—";
  const o = rel as { name?: string; full_name?: string };
  return o.name ?? o.full_name ?? "—";
}

export default async function DashboardPage() {
  const membership = await requireMembership();
  const supabase = await createClient();

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(
    new Date(),
  );
  const dayStart = new Date(`${today}T00:00:00+03:00`);
  const dayEnd = new Date(dayStart.getTime() + 86400000);
  const weekStart = new Date(dayStart.getTime() - 6 * 86400000);
  const monthStart = new Date(`${today.slice(0, 7)}-01T00:00:00+03:00`);

  const [
    { data: todayPayments },
    { data: todayAppts },
    { count: newCustomers },
    { data: monthAppts },
  ] = await Promise.all([
    supabase
      .from("payments")
      .select("amount")
      .is("deleted_at", null)
      .gte("paid_at", dayStart.toISOString())
      .lt("paid_at", dayEnd.toISOString()),
    supabase
      .from("appointments")
      .select(
        "id, start_at, status, customers(full_name), services(name), staff(full_name)",
      )
      .is("deleted_at", null)
      .gte("start_at", dayStart.toISOString())
      .lt("start_at", dayEnd.toISOString())
      .order("start_at"),
    supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null)
      .gte("created_at", weekStart.toISOString()),
    supabase
      .from("appointments")
      .select("status")
      .is("deleted_at", null)
      .gte("start_at", monthStart.toISOString()),
  ]);

  const revenue = (todayPayments ?? []).reduce(
    (s, p) => s + Number(p.amount),
    0,
  );
  const appts = todayAppts ?? [];
  const monthTotal = (monthAppts ?? []).length;
  const monthNoShow = (monthAppts ?? []).filter(
    (a) => a.status === "no_show",
  ).length;
  const noShowRate =
    monthTotal > 0 ? Math.round((monthNoShow / monthTotal) * 100) : 0;

  const kpis = [
    { label: "Bugünkü gelir", value: tl.format(revenue), hint: "tahsil edilen" },
    { label: "Bugün randevu", value: String(appts.length), hint: "toplam" },
    { label: "Yeni müşteri", value: String(newCustomers ?? 0), hint: "son 7 gün" },
    {
      label: "Gelmeyen oranı",
      value: `%${noShowRate}`,
      hint: "bu ay",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Panel</h1>
        <p className="text-muted-foreground mt-1">
          {membership.organizations?.name} · {ROLE_LABELS[membership.role]}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="py-5">
              <p className="text-muted-foreground text-sm">{kpi.label}</p>
              <p className="mt-1 text-3xl font-medium tabular-nums">
                {kpi.value}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">{kpi.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="py-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">Bugünün randevuları</h2>
            <Link
              href="/takvim"
              className="text-xs text-[var(--accent-foreground)] hover:underline"
            >
              Takvim
            </Link>
          </div>
          {appts.length === 0 ? (
            <p className="text-muted-foreground text-sm">Bugün randevu yok.</p>
          ) : (
            <ul className="divide-border divide-y">
              {appts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--accent-foreground)] w-12 text-sm tabular-nums">
                      {timeFmt.format(new Date(a.start_at))}
                    </span>
                    <div>
                      <p className="text-sm">{relName(a.customers)}</p>
                      <p className="text-muted-foreground text-xs">
                        {relName(a.services)} · {relName(a.staff)}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {APPT_STATUS[a.status] ?? a.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
