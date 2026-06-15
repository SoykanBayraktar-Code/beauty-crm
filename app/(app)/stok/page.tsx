import { IconPlus } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/auth/dal";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ProductRow,
  type ProductView,
  type BatchView,
} from "@/components/inventory/product-row";
import { ProductFormDialog } from "@/components/inventory/product-form-dialog";
import {
  SupplierFormDialog,
  type SupplierInput,
} from "@/components/inventory/supplier-form-dialog";
import { SupplierRow } from "@/components/inventory/supplier-row";
import { expiryStatus } from "@/lib/inventory";

function relName(rel: unknown): string | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0]?.name ?? null;
  return (rel as { name?: string }).name ?? null;
}

export default async function StokPage() {
  await requireMembership();
  const supabase = await createClient();

  const [{ data: products }, { data: batches }, { data: suppliers }] =
    await Promise.all([
      supabase
        .from("products")
        .select(
          "id, name, sku, category, unit, supplier_id, reorder_level, sale_price, suppliers(name)",
        )
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("product_batches")
        .select("id, product_id, batch_no, expiry_date, quantity")
        .is("deleted_at", null)
        .order("expiry_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("suppliers")
        .select("id, name, phone, email, notes")
        .is("deleted_at", null)
        .order("name"),
    ]);

  const supplierOptions = (suppliers ?? []).map((s) => ({
    id: s.id,
    name: s.name,
  }));

  const batchByProduct = new Map<string, BatchView[]>();
  for (const b of batches ?? []) {
    const view: BatchView = {
      id: b.id,
      batch_no: b.batch_no,
      expiry_date: b.expiry_date,
      quantity: Number(b.quantity),
      expiry: expiryStatus(b.expiry_date),
    };
    const arr = batchByProduct.get(b.product_id) ?? [];
    arr.push(view);
    batchByProduct.set(b.product_id, arr);
  }

  const rows: ProductView[] = (products ?? []).map((p) => {
    const b = batchByProduct.get(p.id) ?? [];
    const total = b.reduce((s, x) => s + x.quantity, 0);
    const reorder = Number(p.reorder_level);
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      unit: p.unit,
      supplier_id: p.supplier_id,
      supplier_name: relName(p.suppliers),
      reorder_level: reorder,
      sale_price: p.sale_price === null ? null : Number(p.sale_price),
      total,
      isLow: reorder > 0 && total <= reorder,
      batches: b,
    };
  });

  const lowCount = rows.filter((r) => r.isLow).length;
  const expiredCount = (batches ?? []).filter(
    (b) => expiryStatus(b.expiry_date) === "expired",
  ).length;
  const soonCount = (batches ?? []).filter(
    (b) => expiryStatus(b.expiry_date) === "soon",
  ).length;
  const hasAlerts = lowCount > 0 || expiredCount > 0 || soonCount > 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Stok</h1>
        <p className="text-muted-foreground text-sm">
          Sarf/perakende ürün, lot ve son kullanma takibi.
        </p>
      </div>

      {hasAlerts ? (
        <div className="flex flex-wrap gap-2">
          {lowCount > 0 ? (
            <span className="bg-destructive/10 text-destructive rounded-md px-2.5 py-1.5 text-sm">
              ⚠ {lowCount} ürün kritik stokta
            </span>
          ) : null}
          {expiredCount > 0 ? (
            <span className="bg-destructive/10 text-destructive rounded-md px-2.5 py-1.5 text-sm">
              ⚠ {expiredCount} lot SKT geçti
            </span>
          ) : null}
          {soonCount > 0 ? (
            <span className="rounded-md bg-[var(--accent)] px-2.5 py-1.5 text-sm text-[var(--accent-foreground)]">
              ⌛ {soonCount} lot SKT yaklaşıyor
            </span>
          ) : null}
        </div>
      ) : null}

      <Tabs defaultValue="urunler">
        <TabsList>
          <TabsTrigger value="urunler">Ürünler</TabsTrigger>
          <TabsTrigger value="tedarikciler">Tedarikçiler</TabsTrigger>
        </TabsList>

        <TabsContent value="urunler">
          <Card>
            <CardContent className="space-y-3 py-5">
              <div className="flex justify-end">
                <ProductFormDialog suppliers={supplierOptions} size="sm">
                  <IconPlus size={16} aria-hidden />
                  Yeni ürün
                </ProductFormDialog>
              </div>
              {rows.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Henüz ürün yok.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {rows.map((p) => (
                    <ProductRow
                      key={p.id}
                      product={p}
                      suppliers={supplierOptions}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tedarikciler">
          <Card>
            <CardContent className="space-y-3 py-5">
              <div className="flex justify-end">
                <SupplierFormDialog size="sm">
                  <IconPlus size={16} aria-hidden />
                  Yeni tedarikçi
                </SupplierFormDialog>
              </div>
              {(suppliers ?? []).length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Henüz tedarikçi yok.
                </p>
              ) : (
                <ul className="divide-border divide-y">
                  {(suppliers ?? []).map((s) => (
                    <SupplierRow key={s.id} supplier={s as SupplierInput} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
