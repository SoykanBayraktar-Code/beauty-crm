import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft, IconEdit } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/auth/dal";
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
import { AnamnesisForm } from "@/components/customers/anamnesis-form";
import { ClinicalRecordDialog } from "@/components/customers/clinical-record-dialog";
import {
  ClinicalAccessManager,
  type Grant,
} from "@/components/customers/clinical-access-manager";
import { PhotoUploadDialog } from "@/components/customers/photo-upload-dialog";
import {
  PhotoGallery,
  type PhotoItem,
} from "@/components/customers/photo-gallery";
import type { SchemaField } from "@/lib/procedure-schema";

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
  const membership = await requireMembership();
  const isOwner = membership.role === "owner";
  const canWriteClinical =
    membership.role === "owner" || membership.role === "specialist";
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!customer) notFound();

  // Profil sekmelerinin tüm bağımsız verisi — tek turda (waterfall yerine paralel)
  const [
    { data: notes },
    { data: appointments },
    { data: custPackages },
    { data: catalogPackages },
    { data: payments },
    { data: consents },
    { data: consentTemplates },
    { data: anamnesis },
    { data: treatments },
    { data: procTypes },
    { data: clinicStaff },
    { data: invProducts },
    { data: invBatches },
    { data: photoRows },
    { data: specialistMembers },
    { data: staffNames },
    { data: accessGrants },
  ] = await Promise.all([
    supabase
      .from("customer_notes")
      .select("id, body, created_at")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("appointments")
      .select("id, start_at, status, services(name), staff(full_name)")
      .eq("customer_id", id)
      .is("deleted_at", null)
      .order("start_at", { ascending: false })
      .limit(50),
    supabase
      .from("customer_packages")
      .select("id, name, sessions_total, sessions_used, expires_at, status")
      .eq("customer_id", id)
      .is("deleted_at", null)
      .order("purchased_at", { ascending: false }),
    supabase
      .from("packages")
      .select("id, name")
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("payments")
      .select("receipt_no, amount, paid_at")
      .eq("customer_id", id)
      .is("deleted_at", null)
      .order("paid_at", { ascending: false }),
    supabase
      .from("customer_consents")
      .select("id, title, version, granted_at")
      .eq("customer_id", id)
      .order("granted_at", { ascending: false }),
    supabase
      .from("consent_templates")
      .select("id, name")
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("customer_anamnesis")
      .select(
        "version, allergies, chronic_conditions, medications, pregnancy, fitzpatrick, skin_type, contraindications, notes",
      )
      .eq("customer_id", id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("treatment_records")
      .select(
        "id, area, performed_at, soap_assessment, parameters, procedure_types(name), staff(full_name), treatment_product_usage(quantity, products(name, unit))",
      )
      .eq("customer_id", id)
      .is("deleted_at", null)
      .order("performed_at", { ascending: false }),
    supabase
      .from("procedure_types")
      .select("id, name, parameter_schema")
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("staff")
      .select("id, full_name")
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("products")
      .select("id, name, unit")
      .is("deleted_at", null)
      .eq("category", "consumable")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("product_batches")
      .select("id, product_id, batch_no, expiry_date, quantity")
      .is("deleted_at", null)
      .gt("quantity", 0)
      .order("expiry_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("treatment_photos")
      .select("id, kind, storage_path, caption, taken_at")
      .eq("customer_id", id)
      .is("deleted_at", null)
      .order("taken_at", { ascending: false }),
    supabase
      .from("org_members")
      .select("id")
      .eq("role", "specialist")
      .is("deleted_at", null),
    supabase.from("staff").select("member_id, full_name").is("deleted_at", null),
    supabase
      .from("clinical_access_grants")
      .select("id, grantee_id, reason, expires_at, created_at")
      .eq("customer_id", id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
  ]);

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

  const flags: string[] = [];
  if (anamnesis?.allergies) flags.push("Alerji");
  if (anamnesis?.pregnancy) flags.push("Gebelik");
  if (anamnesis?.contraindications) flags.push("Kontrendikasyon");

  // Sarf malzeme + lot (klinik kayıttan stok düşümü için) — yalnız stoğu olan lotlar
  const batchByProduct = new Map<string, { id: string; label: string }[]>();
  for (const b of invBatches ?? []) {
    const exp = b.expiry_date
      ? ` · SKT ${dateFmt.format(new Date(b.expiry_date))}`
      : "";
    const label = `Lot ${b.batch_no ?? "—"} · ${Number(b.quantity)}${exp}`;
    const arr = batchByProduct.get(b.product_id) ?? [];
    arr.push({ id: b.id, label });
    batchByProduct.set(b.product_id, arr);
  }
  const usageProducts = (invProducts ?? [])
    .map((p) => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      batches: batchByProduct.get(p.id) ?? [],
    }))
    .filter((p) => p.batches.length > 0);

  // Özel bucket → yalnız imzalı URL ile okunur (1 saat geçerli)
  const signedUrl = new Map<string, string>();
  const photoPaths = (photoRows ?? []).map((p) => p.storage_path);
  if (photoPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("treatment-photos")
      .createSignedUrls(photoPaths, 3600);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) signedUrl.set(s.path, s.signedUrl);
    }
  }
  const photos: PhotoItem[] = (photoRows ?? []).map((p) => ({
    id: p.id,
    kind: p.kind as "before" | "after",
    storage_path: p.storage_path,
    caption: p.caption,
    taken_at: p.taken_at,
    url: signedUrl.get(p.storage_path) ?? null,
  }));

  const treatmentOptions = (treatments ?? []).map((t) => ({
    id: t.id,
    label: `${relName(t.procedure_types)} · ${dateFmt.format(new Date(t.performed_at))}`,
  }));

  const hasConsent = (consents ?? []).length > 0;

  // Klinik erişim yetkilendirme (F-3) — uzman üye + ad eşlemesi + aktif grant'lar
  const staffByMember = new Map<string, string>();
  for (const s of staffNames ?? []) {
    if (s.member_id) staffByMember.set(s.member_id, s.full_name);
  }
  const specialists = (specialistMembers ?? []).map((mem) => ({
    memberId: mem.id,
    name: staffByMember.get(mem.id) ?? "Uzman",
  }));
  const grants: Grant[] = (accessGrants ?? []).map((g) => ({
    id: g.id,
    granteeName: staffByMember.get(g.grantee_id) ?? "Uzman",
    reason: g.reason,
    expiresAt: g.expires_at,
    createdAt: g.created_at,
  }));

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
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {flags.map((f) => (
                <Badge key={f} variant="destructive">
                  ⚠ {f}
                </Badge>
              ))}
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
          <TabsTrigger value="anamnez">Anamnez</TabsTrigger>
          <TabsTrigger value="klinik">Klinik</TabsTrigger>
          <TabsTrigger value="foto">Foto</TabsTrigger>
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

        <TabsContent value="anamnez">
          <Card>
            <CardContent className="py-5">
              <AnamnesisForm
                key={anamnesis?.version ?? "new"}
                customerId={id}
                current={anamnesis ?? undefined}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="klinik">
          <Card>
            <CardContent className="space-y-4 py-5">
              {isOwner ? (
                <ClinicalAccessManager
                  customerId={id}
                  specialists={specialists}
                  grants={grants}
                />
              ) : null}
              {canWriteClinical && (procTypes ?? []).length > 0 ? (
                <div className="flex justify-end">
                  <ClinicalRecordDialog
                    customerId={id}
                    staff={clinicStaff ?? []}
                    products={usageProducts}
                    procedureTypes={(procTypes ?? []).map((p) => ({
                      id: p.id,
                      name: p.name,
                      parameter_schema:
                        (p.parameter_schema as unknown as SchemaField[]) ?? [],
                    }))}
                  />
                </div>
              ) : canWriteClinical ? (
                <p className="text-muted-foreground text-sm">
                  Önce Hizmetler&apos;den işlem türü tanımlayın.
                </p>
              ) : null}
              {(treatments ?? []).length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Henüz klinik kayıt yok.
                </p>
              ) : (
                <ul className="space-y-3">
                  {(treatments ?? []).map((t) => {
                    const params = (t.parameters ?? {}) as Record<
                      string,
                      string
                    >;
                    const entries = Object.entries(params);
                    return (
                      <li
                        key={t.id}
                        className="border-border rounded-lg border p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">
                            {relName(t.procedure_types)}
                            {t.area ? (
                              <span className="text-muted-foreground font-normal">
                                {" "}
                                · {t.area}
                              </span>
                            ) : null}
                          </p>
                          <span className="text-muted-foreground text-xs">
                            {dateFmt.format(new Date(t.performed_at))}
                          </span>
                        </div>
                        {entries.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {entries.map(([k, v]) => (
                              <span
                                key={k}
                                className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs"
                              >
                                {k}: {v}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {t.soap_assessment ? (
                          <p className="text-muted-foreground mt-2 text-xs">
                            <span className="font-medium">A:</span>{" "}
                            {t.soap_assessment}
                          </p>
                        ) : null}
                        {((t.treatment_product_usage ?? []) as {
                          quantity: number;
                          products: unknown;
                        }[]).length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {(
                              (t.treatment_product_usage ?? []) as {
                                quantity: number;
                                products: unknown;
                              }[]
                            ).map((u, ui) => (
                              <span
                                key={ui}
                                className="bg-accent text-accent-foreground rounded px-1.5 py-0.5 text-xs"
                              >
                                {relName(u.products)} · {Number(u.quantity)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <p className="text-muted-foreground mt-1 text-xs">
                          {relName(t.staff)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="foto">
          <Card>
            <CardContent className="space-y-4 py-5">
              {hasConsent ? (
                <div className="flex justify-end">
                  <PhotoUploadDialog
                    customerId={id}
                    treatments={treatmentOptions}
                  />
                </div>
              ) : (
                <p className="text-muted-foreground rounded-lg border border-dashed border-[var(--border)] p-3 text-sm">
                  ⚠ Fotoğraf yüklemek için önce <strong>Onam</strong>{" "}
                  sekmesinden müşteriden onam alınmalı (KVKK).
                </p>
              )}
              <PhotoGallery customerId={id} photos={photos} />
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
