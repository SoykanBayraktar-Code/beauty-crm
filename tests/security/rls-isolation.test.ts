import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminClient, anonClient } from "../helpers/clients";
import {
  newOrg,
  addMember,
  seedCustomer,
  seedAppointment,
  seedTreatment,
  cleanupAll,
  type TestUser,
} from "../helpers/factory";

// İki merkez + A'da tüm roller; klinik veri patientX'e bağlı.
let orgA: string;
let orgB: string;
let ownerA: TestUser;
let receptionA: TestUser;
let specialistWith: TestUser; // patientX ile randevusu olan uzman
let specialistWithout: TestUser; // randevusu olmayan uzman
let accountantA: TestUser;
let ownerB: TestUser;
let patientX: string;
let customerB: string;

beforeAll(async () => {
  const a = await newOrg("Klinik A");
  orgA = a.orgId;
  ownerA = a.owner;
  receptionA = await addMember(orgA, "reception");
  specialistWith = await addMember(orgA, "specialist", "uzman_randevulu");
  specialistWithout = await addMember(orgA, "specialist", "uzman_randevusuz");
  accountantA = await addMember(orgA, "accountant");

  patientX = await seedCustomer(orgA, "Hasta X");
  await seedAppointment(orgA, specialistWith.staffId!, patientX);

  // patientX için klinik + finans verisi (admin → RLS atlanır)
  const admin = adminClient();
  await admin.from("customer_anamnesis").insert({
    org_id: orgA,
    customer_id: patientX,
    version: 1,
    allergies: "Penisilin",
    pregnancy: false,
  });
  await seedTreatment(orgA, patientX, specialistWith.staffId);
  await admin.from("treatment_photos").insert({
    org_id: orgA,
    customer_id: patientX,
    kind: "before",
    storage_path: `${orgA}/${patientX}/test.png`,
  });
  await admin.from("payments").insert({
    org_id: orgA,
    customer_id: patientX,
    receipt_no: "MKB-TEST-0001",
    amount: 1000,
    method: "cash",
    type: "service",
  });

  const b = await newOrg("Klinik B");
  orgB = b.orgId;
  ownerB = b.owner;
  customerB = await seedCustomer(orgB, "Hasta B");
}, 60000);

afterAll(async () => {
  await cleanupAll();
});

describe("Çapraz-kiracı izolasyon (orgB orgA'yı göremez/yazamaz)", () => {
  it("ownerB, orgA müşterilerini göremez", async () => {
    const { data } = await ownerB.client
      .from("customers")
      .select("id")
      .eq("org_id", orgA);
    expect(data ?? []).toHaveLength(0);
  });

  it("ownerB, orgA ödemelerini göremez", async () => {
    const { data } = await ownerB.client.from("payments").select("id");
    expect((data ?? []).length).toBe(0);
  });

  it("ownerB, orgA klinik kayıtlarını göremez", async () => {
    const { data } = await ownerB.client
      .from("treatment_records")
      .select("id");
    expect((data ?? []).length).toBe(0);
  });

  it("ownerB, orgA'ya müşteri EKLEYEMEZ (org_id=orgA)", async () => {
    const { error } = await ownerB.client
      .from("customers")
      .insert({ org_id: orgA, full_name: "Sızma" });
    expect(error).not.toBeNull(); // RLS with_check ihlali
  });

  it("ownerB, orgA müşterisini GÜNCELLEYEMEZ (0 satır etkilenir)", async () => {
    await ownerB.client
      .from("customers")
      .update({ full_name: "Ele geçirildi" })
      .eq("id", patientX);
    // Admin ile doğrula: değişmemiş olmalı
    const admin = adminClient();
    const { data } = await admin
      .from("customers")
      .select("full_name")
      .eq("id", patientX)
      .single();
    expect(data?.full_name).toBe("Hasta X");
  });
});

describe("Anon (kimliksiz) hiçbir veriye erişemez", () => {
  for (const table of [
    "customers",
    "payments",
    "treatment_records",
    "customer_anamnesis",
    "treatment_photos",
    "products",
    "suppliers",
    "appointments",
  ]) {
    it(`anon → ${table} boş döner`, async () => {
      const { data } = await anonClient().from(table).select("id");
      expect(data ?? []).toHaveLength(0);
    });
  }
});

describe("Klinik erişim (KVKK) — rol ve randevu kuralı", () => {
  it("ownerA, patientX anamnezini görebilir", async () => {
    const { data } = await ownerA.client
      .from("customer_anamnesis")
      .select("id")
      .eq("customer_id", patientX);
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("randevulu uzman, patientX klinik kaydını görebilir", async () => {
    const { data } = await specialistWith.client
      .from("treatment_records")
      .select("id")
      .eq("customer_id", patientX);
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("RANDEVUSUZ uzman, patientX anamnezini GÖREMEZ", async () => {
    const { data } = await specialistWithout.client
      .from("customer_anamnesis")
      .select("id")
      .eq("customer_id", patientX);
    expect(data ?? []).toHaveLength(0);
  });

  it("RANDEVUSUZ uzman, patientX klinik kaydını GÖREMEZ", async () => {
    const { data } = await specialistWithout.client
      .from("treatment_records")
      .select("id")
      .eq("customer_id", patientX);
    expect(data ?? []).toHaveLength(0);
  });

  it("resepsiyon klinik veriyi GÖREMEZ (anamnez)", async () => {
    const { data } = await receptionA.client
      .from("customer_anamnesis")
      .select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("muhasebe klinik veriyi GÖREMEZ (treatment_records + foto)", async () => {
    const recs = await accountantA.client.from("treatment_records").select("id");
    const photos = await accountantA.client
      .from("treatment_photos")
      .select("id");
    expect(recs.data ?? []).toHaveLength(0);
    expect(photos.data ?? []).toHaveLength(0);
  });
});

describe("Klinik yazma yetkisi", () => {
  it("randevulu uzman, patientX'e klinik kayıt EKLEYEBİLİR", async () => {
    const { error } = await specialistWith.client
      .from("treatment_records")
      .insert({ org_id: orgA, customer_id: patientX });
    expect(error).toBeNull();
  });

  it("RANDEVUSUZ uzman, patientX'e klinik kayıt EKLEYEMEZ", async () => {
    const { error } = await specialistWithout.client
      .from("treatment_records")
      .insert({ org_id: orgA, customer_id: patientX });
    expect(error).not.toBeNull();
  });

  it("muhasebe klinik kayıt EKLEYEMEZ (rol)", async () => {
    const { error } = await accountantA.client
      .from("treatment_records")
      .insert({ org_id: orgA, customer_id: patientX });
    expect(error).not.toBeNull();
  });
});

describe("Yetki yükseltme engellenir", () => {
  it("resepsiyon, org_members'a owner üyelik EKLEYEMEZ", async () => {
    const { error } = await receptionA.client
      .from("org_members")
      .insert({ org_id: orgA, user_id: receptionA.id, role: "owner" });
    expect(error).not.toBeNull();
  });

  it("uzman, kendi rolünü 'owner'a YÜKSELTEMEZ (0 satır)", async () => {
    await specialistWithout.client
      .from("org_members")
      .update({ role: "owner" })
      .eq("id", specialistWithout.memberId);
    const admin = adminClient();
    const { data } = await admin
      .from("org_members")
      .select("role")
      .eq("id", specialistWithout.memberId)
      .single();
    expect(data?.role).toBe("specialist");
  });

  it("muhasebe, organizasyonu GÜNCELLEYEMEZ", async () => {
    await accountantA.client
      .from("organizations")
      .update({ name: "Hacklendi" })
      .eq("id", orgA);
    const admin = adminClient();
    const { data } = await admin
      .from("organizations")
      .select("name")
      .eq("id", orgA)
      .single();
    expect(data?.name).toBe("Klinik A");
  });
});

describe("Katalog/onam-şablonu yalnız owner tarafından yazılır", () => {
  it("resepsiyon hizmet EKLEYEMEZ (owner-only katalog)", async () => {
    const { error } = await receptionA.client
      .from("services")
      .insert({ org_id: orgA, name: "İzinsiz hizmet", duration_min: 30, price: 100 });
    expect(error).not.toBeNull();
  });

  it("uzman onam şablonu EKLEYEMEZ (owner-only)", async () => {
    const { error } = await specialistWith.client
      .from("consent_templates")
      .insert({ org_id: orgA, name: "İzinsiz onam", body: "x" });
    expect(error).not.toBeNull();
  });

  it("muhasebe audit log GÖREMEZ (owner-only)", async () => {
    const { data } = await accountantA.client.from("audit_log").select("id");
    expect(data ?? []).toHaveLength(0);
  });
});
