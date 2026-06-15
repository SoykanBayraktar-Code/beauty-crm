import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft, IconEdit } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CustomerFormDialog,
  type CustomerInput,
} from "@/components/customers/customer-form-dialog";
import { CustomerNotes } from "@/components/customers/customer-notes";
import { SellPackageDialog } from "@/components/customers/sell-package-dialog";
import { TakePaymentDialog } from "@/components/customers/take-payment-dialog";
import { GrantConsentDialog } from "@/components/customers/grant-consent-dialog";

const GENDER_LABELS: Record<string, string> = {
  female: "Kadın",
  male: "Erkek",
  other: "Diğer",
};

const APPT_STATUS: Record<string, string> = {
  scheduled: "Planlandı",
  confirmed: "Onaylandı",
  arrived: "Geldi",
  in_progress: "İşlemde",
  completed: "Tamamlandı",
  no_show: "Gelmedi",
  cancelled: "İptal",
};

const dateFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});
const dateTimeFmt = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function relName(rel: unknown): string {
  if (!rel) return "—";
  if (Array.isArray(rel)) return rel[0]?.name ?? rel[0]?.full_name ?? "—";
  const o = rel as { name?: string; full_name?: string };
  return o.name ?? o.full_name ?? "—";
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

export default async function CustomerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!customer) notFound();

  const { data: notes } = await supabase
    .from("customer_notes")
    .select("id, body, created_at")
    .eq("customer_id", id)
    .order("created_at", { ascending: false });

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, start_at, status, services(name), staff(full_name)")
    .eq("customer_id", id)
    .is("deleted_at", null)
    .order("start_at", { ascending: false })
    .limit(50);

  const { data: custPackages } = await supabase
    .from("customer_packages")
    .select("id, name, sessions_total, sessions_used, expires_at, status")
    .eq("customer_id", id)
    .is("deleted_at", null)
    .order("purchased_at", { ascending: false });

  const { data: catalogPackages } = await supabase
    .from("packages")
    .select("id, name")
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("name");

  const { data: payments } = await supabase
    .from("payments")
    .select("receipt_no, amount, paid_at")
    .eq("customer_id", id)
    .is("deleted_at", null)
    .order("paid_at", { ascending: false });

  const receipts = Object.values(
    (payments ?? []).reduce<
      Record<string, { receipt_no: string; total: number; paid_at: string }>
    >((acc, p) => {
      const k = p.receipt_no;
      acc[k] ??= { receipt_no: k, total: 0, paid_at: p.paid_at };
      acc[k].total += Number(p.amount);
      return acc;
    }, {}),
  ).sort((a, b) => (a.paid_at < b.paid_at ? 1 : -1));

  const tl = new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  });

  const { data: consents } = await supabase
    .from("customer_consents")
    .select("id, title, version, granted_at")
    .eq("customer_id", id)
    .order("granted_at", { ascending: false });

  const { data: consentTemplates } = await supabase
    .from("consent_templates")
    .select("id, name")
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("name");

  const initials = customer.full_name.slice(0, 2).toUpperCase();

  return (
    <div className="space-y-5">
      <Link
        href="/musteriler"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <IconArrowLeft size={16} aria-hidden />
        Müşteriler
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="bg-accent text-accent-foreground flex size-12 items-center justify-center rounded-full text-sm font-medium">
            {initials}
          </span>
          <div>
            <h1 className="text-2xl font-medium tracking-tight">
              {customer.full_name}
            </h1>
            <div className="mt-1 flex flex-wrap gap-1">
              {(customer.tags ?? []).map((t: string) => (
                <Badge key={t} variant="secondary">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <CustomerFormDialog
          customer={customer as CustomerInput}
          variant="outline"
          size="sm"
        >
          <IconEdit size={16} aria-hidden />
          Düzenle
        </CustomerFormDialog>
      </div>

      <Tabs defaultValue="genel">
        <TabsList>
          <TabsTrigger value="genel">Genel</TabsTrigger>
          <TabsTrigger value="randevular">Randevular</TabsTrigger>
          <TabsTrigger value="paketler">Paket/Seans</TabsTrigger>
          <TabsTrigger value="odemeler">Ödemeler</TabsTrigger>
          <TabsTrigger value="onam">Onam</TabsTrigger>
          <TabsTrigger value="notlar">Notlar</TabsTrigger>
        </TabsList>

        <TabsContent value="genel">
          <Card>
            <CardContent className="grid grid-cols-2 gap-4 py-5 sm:grid-cols-3">
              <Field label="Telefon" value={customer.phone ?? "—"} />
              <Field label="E-posta" value={customer.email ?? "—"} />
              <Field
                label="Cinsiyet"
                value={
                  customer.gender
                    ? (GENDER_LABELS[customer.gender] ?? "—")
                    : "—"
                }
              />
              <Field
                label="Doğum tarihi"
                value={
                  customer.birth_date
                    ? dateFmt.format(new Date(customer.birth_date))
                    : "—"
                }
              />
              <Field label="Kaynak" value={customer.source ?? "—"} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="randevular">
          <Card>
            <CardContent className="py-5">
              {(appointments ?? []).length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Henüz randevu yok.
                </p>
              ) : (
                <ul className="divide-border divide-y">
                  {(appointments ?? []).map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <div>
                        <p className="text-sm">{relName(a.services)}</p>
                        <p className="text-muted-foreground text-xs">
                          {dateTimeFmt.format(new Date(a.start_at))} ·{" "}
                          {relName(a.staff)}
                        </p>
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
        </TabsContent>

        <TabsContent value="paketler">
          <Card>
            <CardContent className="space-y-4 py-5">
              {(catalogPackages ?? []).length > 0 ? (
                <div className="flex justify-end">
                  <SellPackageDialog
                    customerId={id}
                    packages={catalogPackages ?? []}
                  />
                </div>
              ) : null}
              {(custPackages ?? []).length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Henüz paket yok.
                </p>
              ) : (
                <ul className="space-y-2">
                  {(custPackages ?? []).map((p) => {
                    const remaining = p.sessions_total - p.sessions_used;
                    return (
                      <li
                        key={p.id}
                        className="border-border rounded-lg border p-3"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{p.name}</p>
                          <Badge variant={remaining > 0 ? "secondary" : "outline"}>
                            {remaining}/{p.sessions_total} kaldı
                          </Badge>
                        </div>
                        {p.expires_at ? (
                          <p className="text-muted-foreground mt-1 text-xs">
                            Son kullanım: {dateFmt.format(new Date(p.expires_at))}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="odemeler">
          <Card>
            <CardContent className="space-y-4 py-5">
              <div className="flex justify-end">
                <TakePaymentDialog customerId={id} />
              </div>
              {receipts.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Henüz ödeme yok.
                </p>
              ) : (
                <ul className="divide-border divide-y">
                  {receipts.map((r) => (
                    <li
                      key={r.receipt_no}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium tabular-nums">
                          {tl.format(r.total)}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {dateFmt.format(new Date(r.paid_at))} · {r.receipt_no}
                        </p>
                      </div>
                      <Link
                        href={`/makbuz/${r.receipt_no}`}
                        className="text-xs text-[var(--accent-foreground)] hover:underline"
                      >
                        Makbuz
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="onam">
          <Card>
            <CardContent className="space-y-4 py-5">
              {(consentTemplates ?? []).length > 0 ? (
                <div className="flex justify-end">
                  <GrantConsentDialog
                    customerId={id}
                    templates={consentTemplates ?? []}
                  />
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Önce Ayarlar&apos;dan onam metni ekleyin.
                </p>
              )}
              {(consents ?? []).length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Henüz alınmış onam yok.
                </p>
              ) : (
                <ul className="divide-border divide-y">
                  {(consents ?? []).map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <div>
                        <p className="text-sm">{c.title}</p>
                        <p className="text-muted-foreground text-xs">
                          v{c.version} · {dateFmt.format(new Date(c.granted_at))}
                        </p>
                      </div>
                      <Badge variant="secondary">Alındı</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notlar">
          <Card>
            <CardContent className="py-5">
              <CustomerNotes customerId={id} notes={notes ?? []} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
