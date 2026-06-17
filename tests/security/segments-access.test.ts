import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminClient } from "../helpers/clients";
import { newOrg, addMember, cleanupAll, type TestUser } from "../helpers/factory";

// Segment RLS: üyeler okur; owner/resepsiyon yazar.
let orgA: string;
let owner: TestUser;
let reception: TestUser;
let specialist: TestUser;
let accountant: TestUser;
let ownerB: TestUser;

beforeAll(async () => {
  const a = await newOrg("Segment Klinik");
  orgA = a.orgId;
  owner = a.owner;
  reception = await addMember(orgA, "reception");
  specialist = await addMember(orgA, "specialist");
  accountant = await addMember(orgA, "accountant");
  await adminClient()
    .from("segments")
    .insert({ org_id: orgA, name: "VIP", criteria: { tags: "vip" } });

  const b = await newOrg("Segment Klinik B");
  ownerB = b.owner;
}, 60000);

afterAll(async () => {
  await cleanupAll();
});

describe("Segment erişimi", () => {
  it("tüm roller segmentleri okuyabilir", async () => {
    for (const u of [owner, reception, specialist, accountant]) {
      const { data } = await u.client.from("segments").select("id");
      expect((data ?? []).length).toBeGreaterThan(0);
    }
  });

  it("resepsiyon segment EKLEYEBİLİR", async () => {
    const { error } = await reception.client
      .from("segments")
      .insert({ org_id: orgA, name: "Yeni", criteria: {} });
    expect(error).toBeNull();
  });

  it("uzman ve muhasebe segment EKLEYEMEZ", async () => {
    const s = await specialist.client
      .from("segments")
      .insert({ org_id: orgA, name: "X", criteria: {} });
    const a = await accountant.client
      .from("segments")
      .insert({ org_id: orgA, name: "Y", criteria: {} });
    expect(s.error).not.toBeNull();
    expect(a.error).not.toBeNull();
  });

  it("orgB, orgA segmentlerini göremez (çapraz-kiracı)", async () => {
    const { data } = await ownerB.client.from("segments").select("id");
    expect(data ?? []).toHaveLength(0);
  });
});
