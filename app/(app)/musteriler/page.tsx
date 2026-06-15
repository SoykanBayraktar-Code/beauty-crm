import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CustomersToolbar } from "@/components/customers/customers-toolbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const GENDER_LABELS: Record<string, string> = {
  female: "Kadın",
  male: "Erkek",
  other: "Diğer",
};

const dateFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function MusterilerPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; gender?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").replace(/[,()]/g, "").trim();
  const gender = sp.gender ?? "";

  const supabase = await createClient();
  let query = supabase
    .from("customers")
    .select("id, full_name, phone, email, gender, tags, source, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (q) query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`);
  if (gender) query = query.eq("gender", gender);

  const { data: customers } = await query;
  const rows = customers ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Müşteriler</h1>
        <p className="text-muted-foreground mt-1">
          {rows.length} kayıt{q || gender ? " (filtreli)" : ""}
        </p>
      </div>

      <CustomersToolbar />

      {rows.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-16 text-center text-sm">
            {q || gender
              ? "Filtreye uyan müşteri yok."
              : "Henüz müşteri yok. Sağ üstten ilk müşteriyi ekleyin."}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad soyad</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Cinsiyet</TableHead>
                <TableHead>Etiketler</TableHead>
                <TableHead className="text-right">Eklenme</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/musteriler/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.full_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.phone ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.gender ? (GENDER_LABELS[c.gender] ?? "—") : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(c.tags ?? []).slice(0, 3).map((t: string) => (
                        <Badge key={t} variant="secondary">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right">
                    {dateFmt.format(new Date(c.created_at))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
