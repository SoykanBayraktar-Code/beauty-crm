import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, signInAs } from "./clients";

export type Role = "owner" | "reception" | "specialist" | "accountant";

export type TestUser = {
  id: string;
  email: string;
  password: string;
  client: SupabaseClient;
  memberId: string;
  staffId: string | null;
};

const PASSWORD = "test-password-123";

// Oluşturulan kaynakların kaydı → afterAll'da temizlenir.
const createdUsers = new Set<string>();
const createdOrgs = new Set<string>();

let counter = 0;
function uniq(): string {
  counter += 1;
  return `${Date.now().toString(36)}${counter}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Doğrulanmış (email_confirm) auth kullanıcısı oluşturur. */
async function newAuthUser(label: string) {
  const admin = adminClient();
  const email = `t_${label}_${uniq()}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  createdUsers.add(data.user.id);
  return { id: data.user.id, email, password: PASSWORD };
}

/** Yeni merkez + owner (gerçek create_organization RPC akışıyla). */
export async function newOrg(name = "Test Klinik"): Promise<{
  orgId: string;
  owner: TestUser;
}> {
  const u = await newAuthUser("owner");
  const client = await signInAs(u.email, u.password);
  const { data: orgId, error } = await client.rpc("create_organization", {
    p_name: name,
    p_full_name: "Owner",
  });
  if (error || !orgId) throw new Error(`create_organization: ${error?.message}`);
  createdOrgs.add(orgId as string);

  const admin = adminClient();
  const { data: m } = await admin
    .from("org_members")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", u.id)
    .single();
  const { data: s } = await admin
    .from("staff")
    .select("id")
    .eq("org_id", orgId)
    .eq("member_id", m!.id)
    .single();

  return {
    orgId: orgId as string,
    owner: { ...u, client, memberId: m!.id, staffId: s!.id },
  };
}

/** Mevcut merkeze belirli rolde üye ekler (uzman/resepsiyon için staff kaydı da). */
export async function addMember(
  orgId: string,
  role: Role,
  label: string = role,
): Promise<TestUser> {
  const u = await newAuthUser(label);
  const admin = adminClient();
  const { data: m, error } = await admin
    .from("org_members")
    .insert({ org_id: orgId, user_id: u.id, role })
    .select("id")
    .single();
  if (error) throw new Error(`addMember(${role}): ${error.message}`);

  let staffId: string | null = null;
  if (role === "specialist" || role === "reception") {
    const { data: s } = await admin
      .from("staff")
      .insert({ org_id: orgId, member_id: m!.id, full_name: label })
      .select("id")
      .single();
    staffId = s?.id ?? null;
  }

  const client = await signInAs(u.email, u.password);
  return { ...u, client, memberId: m!.id, staffId };
}

export async function seedCustomer(orgId: string, fullName = "Test Hasta") {
  const admin = adminClient();
  const { data, error } = await admin
    .from("customers")
    .insert({ org_id: orgId, full_name: fullName })
    .select("id")
    .single();
  if (error) throw new Error(`seedCustomer: ${error.message}`);
  return data!.id as string;
}

/** Uzmana hasta için randevu açar → can_access_clinical o uzmana klinik erişim verir. */
export async function seedAppointment(
  orgId: string,
  staffId: string,
  customerId: string,
  opts: { offsetMin?: number; status?: string; customerPackageId?: string } = {},
) {
  const admin = adminClient();
  const base = Date.now() + (opts.offsetMin ?? 24 * 60) * 60000;
  const { data, error } = await admin
    .from("appointments")
    .insert({
      org_id: orgId,
      staff_id: staffId,
      customer_id: customerId,
      start_at: new Date(base).toISOString(),
      end_at: new Date(base + 30 * 60000).toISOString(),
      status: opts.status ?? "scheduled",
      customer_package_id: opts.customerPackageId ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`seedAppointment: ${error.message}`);
  return data!.id as string;
}

export async function seedProduct(
  orgId: string,
  opts: { name?: string; unit?: string; reorder?: number } = {},
) {
  const admin = adminClient();
  const { data, error } = await admin
    .from("products")
    .insert({
      org_id: orgId,
      name: opts.name ?? "Test Ürün",
      unit: opts.unit ?? "adet",
      reorder_level: opts.reorder ?? 0,
      category: "consumable",
    })
    .select("id")
    .single();
  if (error) throw new Error(`seedProduct: ${error.message}`);
  return data!.id as string;
}

export async function seedBatch(
  orgId: string,
  productId: string,
  quantity: number,
  expiry: string | null = null,
) {
  const admin = adminClient();
  const { data, error } = await admin
    .from("product_batches")
    .insert({
      org_id: orgId,
      product_id: productId,
      quantity,
      expiry_date: expiry,
      batch_no: `L${Math.floor(Math.random() * 1e5)}`,
    })
    .select("id, quantity")
    .single();
  if (error) throw new Error(`seedBatch: ${error.message}`);
  return data!.id as string;
}

export async function seedTreatment(
  orgId: string,
  customerId: string,
  staffId: string | null = null,
) {
  const admin = adminClient();
  const { data, error } = await admin
    .from("treatment_records")
    .insert({ org_id: orgId, customer_id: customerId, staff_id: staffId })
    .select("id")
    .single();
  if (error) throw new Error(`seedTreatment: ${error.message}`);
  return data!.id as string;
}

/** Bir lotun güncel miktarını döndürür (servis-rol, RLS atlanır). */
export async function batchQuantity(batchId: string): Promise<number> {
  const admin = adminClient();
  const { data } = await admin
    .from("product_batches")
    .select("quantity")
    .eq("id", batchId)
    .single();
  return Number(data!.quantity);
}

/** Tüm test kaynaklarını siler (org cascade + auth kullanıcıları). */
export async function cleanupAll() {
  const admin = adminClient();
  for (const org of createdOrgs) {
    await admin.from("organizations").delete().eq("id", org);
  }
  for (const uid of createdUsers) {
    await admin.auth.admin.deleteUser(uid).catch(() => {});
  }
  createdOrgs.clear();
  createdUsers.clear();
}
