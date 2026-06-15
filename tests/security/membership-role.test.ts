import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { newOrg, addMember, cleanupAll, type TestUser } from "../helpers/factory";

// F-1 regresyonu: getMembership() user_id ile filtrelenmezse RLS org-kapsamlı
// olduğu için BAŞKA üyenin rolünü döndürebilir. Bu testler tehlikeyi ve düzeltmeyi sabitler.
let reception: TestUser;

beforeAll(async () => {
  const a = await newOrg("Rol Klinik");
  reception = await addMember(a.orgId, "reception");
}, 60000);

afterAll(async () => {
  await cleanupAll();
});

describe("F-1: üyelik rolü bütünlüğü", () => {
  it("reception istemcisi org_members'ta TÜM üyeleri görür (RLS org-kapsamlı, kullanıcı-kapsamlı değil)", async () => {
    const { data } = await reception.client.from("org_members").select("role");
    expect((data ?? []).length).toBeGreaterThanOrEqual(2); // owner + reception
    expect((data ?? []).map((r) => r.role)).toContain("owner");
  });

  it("user_id ile filtrelenince TAM kendi rolünü ('reception') döndürür (düzeltme)", async () => {
    const { data } = await reception.client
      .from("org_members")
      .select("role")
      .eq("user_id", reception.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    expect(data?.role).toBe("reception");
  });
});
