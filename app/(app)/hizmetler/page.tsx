import { IconPlus, IconEdit } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/auth/dal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ServiceFormDialog } from "@/components/catalog/service-form-dialog";
import { PackageFormDialog } from "@/components/catalog/package-form-dialog";
import {
  ProcedureTypeDialog,
  type ProcedureTypeInput,
} from "@/components/catalog/procedure-type-dialog";
import type { SchemaField } from "@/lib/procedure-schema";

const tl = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});
const money = (v: unknown) => tl.format(Number(v ?? 0));

function relName(rel: unknown): string {
  if (!rel) return "—";
  if (Array.isArray(rel)) return rel[0]?.name ?? "—";
  return (rel as { name?: string }).name ?? "—";
}

export default async function HizmetlerPage() {
  const membership = await requireMembership();
  const isOwner = membership.role === "owner";
  const supabase = await createClient();

  const [{ data: services }, { data: packages }, { data: procedures }] =
    await Promise.all([
      supabase
        .from("services")
        .select("id, name, category, duration_min, price")
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("packages")
        .select(
          "id, name, service_id, total_sessions, price, valid_days, services(name)",
        )
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("procedure_types")
        .select(
          "id, name, category, is_medical, requires_consent, parameter_schema, default_session_count, recommended_interval_days",
        )
        .is("deleted_at", null)
        .order("name"),
    ]);

  const svc = services ?? [];
  const pkg = packages ?? [];
  const proc = procedures ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">
          Hizmetler &amp; Paketler
        </h1>
        <p className="text-muted-foreground mt-1">
          Hizmet kataloğu ve seans paketleri
        </p>
      </div>

      <Tabs defaultValue="hizmetler">
        <TabsList>
          <TabsTrigger value="hizmetler">Hizmetler ({svc.length})</TabsTrigger>
          <TabsTrigger value="paketler">Paketler ({pkg.length})</TabsTrigger>
          <TabsTrigger value="islemler">İşlem Türleri ({proc.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="hizmetler" className="space-y-3">
          {isOwner ? (
            <div className="flex justify-end">
              <ServiceFormDialog>
                <IconPlus size={16} aria-hidden />
                Yeni hizmet
              </ServiceFormDialog>
            </div>
          ) : null}

          {svc.length === 0 ? (
            <Card>
              <CardContent className="text-muted-foreground py-12 text-center text-sm">
                Henüz hizmet yok.
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead className="text-right">Süre</TableHead>
                    <TableHead className="text-right">Fiyat</TableHead>
                    {isOwner ? <TableHead className="w-10" /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {svc.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.category ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right">
                        {s.duration_min} dk
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(s.price)}
                      </TableCell>
                      {isOwner ? (
                        <TableCell className="text-right">
                          <ServiceFormDialog
                            service={s}
                            variant="ghost"
                            size="icon"
                          >
                            <IconEdit size={16} aria-hidden />
                            <span className="sr-only">Düzenle</span>
                          </ServiceFormDialog>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="paketler" className="space-y-3">
          {isOwner ? (
            <div className="flex justify-end">
              <PackageFormDialog
                services={svc.map((s) => ({ id: s.id, name: s.name }))}
              >
                <IconPlus size={16} aria-hidden />
                Yeni paket
              </PackageFormDialog>
            </div>
          ) : null}

          {pkg.length === 0 ? (
            <Card>
              <CardContent className="text-muted-foreground py-12 text-center text-sm">
                Henüz paket yok.
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad</TableHead>
                    <TableHead>Hizmet</TableHead>
                    <TableHead className="text-right">Seans</TableHead>
                    <TableHead className="text-right">Geçerlilik</TableHead>
                    <TableHead className="text-right">Fiyat</TableHead>
                    {isOwner ? <TableHead className="w-10" /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pkg.map((p) => {
                    const serviceName = relName(p.services);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {serviceName}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.total_sessions}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-right">
                          {p.valid_days ? `${p.valid_days} gün` : "Süresiz"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(p.price)}
                        </TableCell>
                        {isOwner ? (
                          <TableCell className="text-right">
                            <PackageFormDialog
                              pkg={{
                                id: p.id,
                                name: p.name,
                                service_id: p.service_id,
                                total_sessions: p.total_sessions,
                                price: Number(p.price),
                                valid_days: p.valid_days,
                              }}
                              services={svc.map((s) => ({
                                id: s.id,
                                name: s.name,
                              }))}
                              variant="ghost"
                              size="icon"
                            >
                              <IconEdit size={16} aria-hidden />
                              <span className="sr-only">Düzenle</span>
                            </PackageFormDialog>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="islemler" className="space-y-3">
          {isOwner ? (
            <div className="flex justify-end">
              <ProcedureTypeDialog>
                <IconPlus size={16} aria-hidden />
                Yeni işlem türü
              </ProcedureTypeDialog>
            </div>
          ) : null}

          {proc.length === 0 ? (
            <Card>
              <CardContent className="text-muted-foreground py-12 text-center text-sm">
                Henüz işlem türü yok. Hazır şablonlarla hızlı başlayabilirsiniz.
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Tip</TableHead>
                    <TableHead className="text-right">Alan</TableHead>
                    {isOwner ? <TableHead className="w-10" /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proc.map((p) => {
                    const fields = (p.parameter_schema as unknown as
                      | SchemaField[]
                      | null) ?? [];
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.category ?? "—"}
                        </TableCell>
                        <TableCell>
                          {p.is_medical ? (
                            <Badge variant="secondary">Medikal</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              Kozmetik
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-right tabular-nums">
                          {fields.length}
                        </TableCell>
                        {isOwner ? (
                          <TableCell className="text-right">
                            <ProcedureTypeDialog
                              procedure={{
                                id: p.id,
                                name: p.name,
                                category: p.category,
                                is_medical: p.is_medical,
                                requires_consent: p.requires_consent,
                                parameter_schema: fields,
                                default_session_count: p.default_session_count,
                                recommended_interval_days:
                                  p.recommended_interval_days,
                              }}
                              variant="ghost"
                              size="icon"
                            >
                              <IconEdit size={16} aria-hidden />
                              <span className="sr-only">Düzenle</span>
                            </ProcedureTypeDialog>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
