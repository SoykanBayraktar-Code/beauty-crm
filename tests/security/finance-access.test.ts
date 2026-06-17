import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminClient } from "../helpers/clients";
import { newOrg, addMember, cleanupAll, type TestUser } from "../helpers/factory";

// Finans RLS: gider = owner/muhasebe; kasa = owner/resepsiyon yazar, +muhasebe okur.
let orgA: string;
let owner: TestUser;
let reception: TestUser;
let accountant: TestUser;
let specialist: TestUser;
let orgB: string;
let ownerB: TestUser;

beforeAll(async () => {
  const a = await newOrg("Finans RLS Klinik");
  orgA = a.orgId;
  owner = a.owner;
  reception = await addMember(orgA, "reception");
  accountant = await addMember(orgA, "accountant");
  specialist = await addMember(orgA, "specialist");

  const admin = adminClient();
  await admin.from("expenses").insert({
    org_id: orgA,
    category: "rent",
    amount: 15000,
  });
  // KAPALI kasa (okuma testleri için; açık-kasa unique index'ini tetiklemez)
  await admin.from("cash_sessions").insert({
    org_id: orgA,
    opening_float: 500,
    opened_at: new Date(Date.now() - 7200000).toISOString(),
    closed_at: new Date(Date.now() - 3600000).toISOString(),
    counted_amount: 500,
  });

  const b = await newOrg("Finans RLS Klinik B");
  orgB = b.orgId;
  ownerB = b.owner;
}, 60000);

afterAll(async () => {
  await cleanupAll();
});

describe("Gider erişimi (yalnız owner + muhasebe)", () => {
  it("owner giderleri görür", async () => {
    const { data } = await owner.client.from("expenses").select("id");
    expect((data ?? []).length).toBeGreaterThan(0);
  });
  it("muhasebe giderleri görür", async () => {
    const { data } = await accountant.client.from("expenses").select("id");
    expect((data ?? []).length).toBeGreaterThan(0);
  });
  it("resepsiyon gider GÖREMEZ", async () => {
    const { data } = await reception.client.from("expenses").select("id");
    expect(data ?? []).toHaveLength(0);
  });
  it("uzman gider GÖREMEZ", async () => {
    const { data } = await specialist.client.from("expenses").select("id");
    expect(data ?? []).toHaveLength(0);
  });
  it("muhasebe gider EKLEYEBİLİR; resepsiyon EKLEYEMEZ", async () => {
    const ok = await accountant.client
      .from("expenses")
      .insert({ org_id: orgA, category: "other", amount: 100 });
    expect(ok.error).toBeNull();
    const blocked = await reception.client
      .from("expenses")
      .insert({ org_id: orgA, category: "other", amount: 100 });
    expect(blocked.error).not.toBeNull();
  });
});

describe("Kasa erişimi (owner/resepsiyon yazar, +muhasebe okur)", () => {
  it("resepsiyon kasayı görür", async () => {
    const { data } = await reception.client.from("cash_sessions").select("id");
    expect((data ?? []).length).toBeGreaterThan(0);
  });
  it("muhasebe kasayı görür", async () => {
    const { data } = await accountant.client.from("cash_sessions").select("id");
    expect((data ?? []).length).toBeGreaterThan(0);
  });
  it("uzman kasayı GÖREMEZ", async () => {
    const { data } = await specialist.client.from("cash_sessions").select("id");
    expect(data ?? []).toHaveLength(0);
  });
  it("muhasebe kasa AÇAMAZ (RLS); resepsiyon açabilir", async () => {
    const blocked = await accountant.client
      .from("cash_sessions")
      .insert({ org_id: orgA, opening_float: 0 });
    expect(blocked.error).not.toBeNull();
    const ok = await reception.client
      .from("cash_sessions")
      .insert({ org_id: orgA, opening_float: 100 });
    expect(ok.error).toBeNull();
  });
});

describe("Çapraz-kiracı (orgB, orgA finansını göremez)", () => {
  it("orgB owner, orgA giderlerini göremez", async () => {
    const { data } = await ownerB.client.from("expenses").select("id");
    expect(data ?? []).toHaveLength(0);
  });
  it("orgB owner, orgA kasasını göremez", async () => {
    const { data } = await ownerB.client.from("cash_sessions").select("id");
    expect(data ?? []).toHaveLength(0);
  });
});
