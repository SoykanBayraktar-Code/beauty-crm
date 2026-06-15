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

const GENDER_LABELS: Record<string, string> = {
  female: "Kadın",
  male: "Erkek",
  other: "Diğer",
};

const dateFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

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
            <CardContent className="text-muted-foreground py-10 text-center text-sm">
              Randevu geçmişi Faz 1.3'te bağlanacak.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="paketler">
          <Card>
            <CardContent className="text-muted-foreground py-10 text-center text-sm">
              Paket/seans takibi Faz 1.3'te bağlanacak.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="odemeler">
          <Card>
            <CardContent className="text-muted-foreground py-10 text-center text-sm">
              Ödeme geçmişi Faz 1.4'te bağlanacak.
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
