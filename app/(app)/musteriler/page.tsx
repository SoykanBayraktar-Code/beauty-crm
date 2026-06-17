import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  CustomersToolbar,
  type SavedSegment,
} from "@/components/customers/customers-toolbar";
import {
  parseFilters,
  hasAnyFilter,
  ageToBirthRange,
} from "@/lib/customer-filters";
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

const NO_MATCH = "00000000-0000-0000-0000-000000000000";

export default async function MusterilerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const f = parseFilters(sp);
  const filtered = hasAnyFilter(f);

  const supabase = await createClient();

  // "Aktif paket" filtresi → önce ilgili müşteri id'leri
  let packageIds: string[] | null = null;
  if (f.hasPackage) {
    const { data: cps } = await supabase
      .from("customer_packages")
      .select("customer_id, sessions_total, sessions_used")
      .eq("status", "active")
      .is("deleted_at", null);
    packageIds = [
      ...new Set(
        (cps ?? [])
          .filter((c) => c.sessions_used < c.sessions_total)
          .map((c) => c.customer_id),
      ),
    ];
  }

  let query = supabase
    .from("customers")
    .select("id, full_name, phone, email, gender, tags, source, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (f.q) query = query.or(`full_name.ilike.%${f.q}%,phone.ilike.%${f.q}%`);
  if (f.gender) query = query.eq("gender", f.gender);
  if (f.source) query = query.ilike("source", `%${f.source}%`);
  if (f.tags.length) query = query.overlaps("tags", f.tags);
  const birth = ageToBirthRange(f.ageMin, f.ageMax, new Date());
  if (birth.lte) query = query.lte("birth_date", birth.lte);
  if (birth.gte) query = query.gte("birth_date", birth.gte);
  if (f.createdFrom) query = query.gte("created_at", f.createdFrom);
  if (f.createdTo) query = query.lte("created_at", `${f.createdTo}T23:59:59`);
  if (f.hasPackage === "yes")
    query = query.in("id", packageIds!.length ? packageIds! : [NO_MATCH]);
  if (f.hasPackage === "no" && packageIds!.length)
    query = query.not("id", "in", `(${packageIds!.join(",")})`);

  const { data: customers } = await query;
  const rows = customers ?? [];

  const { data: segRows } = await supabase
    .from("segments")
    .select("id, name, criteria")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  const segments = (segRows ?? []) as SavedSegment[];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Müşteriler</h1>
        <p className="text-muted-foreground mt-1">
          {rows.length} kayıt{filtered ? " (filtreli)" : ""}
        </p>
      </div>

      <CustomersToolbar segments={segments} />

      {rows.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-16 text-center text-sm">
            {filtered
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
