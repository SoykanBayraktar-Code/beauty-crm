import { IconPlus } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/auth/dal";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CashRegister, type OpenSession } from "@/components/finance/cash-register";
import { ExpenseFormDialog } from "@/components/finance/expense-form-dialog";
import { ExpenseList, type ExpenseView } from "@/components/finance/expense-list";
import { istanbulMonthStart } from "@/lib/date";

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

function sum(rows: { amount: number | string }[] | null) {
  return (rows ?? []).reduce((s, r) => s + Number(r.amount), 0);
}

export default async function FinansPage() {
  const membership = await requireMembership();
  const role = membership.role;
  const canManageFinance = role === "owner" || role === "accountant";
  const supabase = await createClient();

  // Kasa (tüm finans rolleri)
  const { data: open } = await supabase
    .from("cash_sessions")
    .select("id, opening_float, opened_at")
    .is("closed_at", null)
    .maybeSingle();
  const openSession = (open as OpenSession | null) ?? null;

  let cashSales = 0;
  if (openSession) {
    const { data: cp } = await supabase
      .from("payments")
      .select("amount")
      .eq("org_id", membership.org_id)
      .eq("method", "cash")
      .gte("paid_at", openSession.opened_at)
      .is("deleted_at", null);
    cashSales = sum(cp);
  }

  // Özet + Gider (owner/muhasebe). Ay sınırı Istanbul-saatine göre (M4).
  const { iso: monthStartIso, date: monthStartDate } = istanbulMonthStart();

  let monthRevenue = 0;
  const byMethod: Record<string, number> = {};
  let monthExpenses = 0;
  let expenseList: ExpenseView[] = [];

  if (canManageFinance) {
    const [{ data: pays }, { data: exps }] = await Promise.all([
      supabase
        .from("payments")
        .select("amount, method")
        .eq("org_id", membership.org_id)
        .gte("paid_at", monthStartIso)
        .is("deleted_at", null),
      supabase
        .from("expenses")
        .select("id, category, amount, spent_on, note")
        .eq("org_id", membership.org_id)
        .gte("spent_on", monthStartDate)
        .is("deleted_at", null)
        .order("spent_on", { ascending: false }),
    ]);
    monthRevenue = sum(pays);
    for (const p of pays ?? []) {
      byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount);
    }
    expenseList = (exps ?? []) as ExpenseView[];
    monthExpenses = sum(exps);
  }
  const net = monthRevenue - monthExpenses;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Finans</h1>
        <p className="text-muted-foreground text-sm">
          Kasa, gider ve gelir özeti.
        </p>
      </div>

      <Tabs defaultValue="kasa">
        <TabsList>
          <TabsTrigger value="kasa">Kasa</TabsTrigger>
          {canManageFinance ? <TabsTrigger value="gider">Gider</TabsTrigger> : null}
          {canManageFinance ? <TabsTrigger value="ozet">Özet</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="kasa">
          <Card>
            <CardContent className="py-5">
              <CashRegister session={openSession} cashSales={cashSales} />
            </CardContent>
          </Card>
        </TabsContent>

        {canManageFinance ? (
          <TabsContent value="gider">
            <Card>
              <CardContent className="space-y-3 py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-medium">Giderler (bu ay)</h2>
                    <p className="text-muted-foreground text-xs">
                      Toplam: {tl.format(monthExpenses)}
                    </p>
                  </div>
                  <ExpenseFormDialog>
                    <IconPlus size={16} aria-hidden />
                    Gider ekle
                  </ExpenseFormDialog>
                </div>
                <ExpenseList expenses={expenseList} />
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        {canManageFinance ? (
          <TabsContent value="ozet">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { label: "Gelir (bu ay)", value: monthRevenue },
                  { label: "Gider (bu ay)", value: monthExpenses },
                  { label: "Net kâr (bu ay)", value: net, accent: true },
                ].map((kpi) => (
                  <Card key={kpi.label}>
                    <CardContent className="py-5">
                      <p className="text-muted-foreground text-xs">{kpi.label}</p>
                      <p
                        className={`mt-1 text-2xl font-medium tabular-nums ${
                          kpi.accent && kpi.value < 0 ? "text-destructive" : ""
                        }`}
                      >
                        {tl.format(kpi.value)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card>
                <CardContent className="space-y-3 py-5">
                  <h2 className="text-sm font-medium">
                    Gelir — ödeme yöntemi kırılımı (bu ay)
                  </h2>
                  {Object.keys(byMethod).length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Bu ay ödeme yok.
                    </p>
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
            </div>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
