import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "../helpers/clients";
import {
  newOrg,
  addMember,
  seedCustomer,
  cleanupAll,
  type TestUser,
} from "../helpers/factory";

// F-3: yetkili (owner) bir uzmana randevu dışı klinik erişim açabilmeli; iptal/süre çalışmalı.
let orgA: string;
let owner: TestUser;
let specialist: TestUser; // randevusuz uzman
let patientX: string;

async function canSeeAnamnesis(client: SupabaseClient): Promise<boolean> {
  const { data } = await client
    .from("customer_anamnesis")
    .select("id")
    .eq("customer_id", patientX);
  return (data ?? []).length > 0;
}

beforeAll(async () => {
  const a = await newOrg("Grant Klinik");
  orgA = a.orgId;
  owner = a.owner;
  specialist = await addMember(orgA, "specialist");
  patientX = await seedCustomer(orgA, "Hasta X");
  const admin = adminClient();
  await admin.from("customer_anamnesis").insert({
    org_id: orgA,
    customer_id: patientX,
    version: 1,
    allergies: "Lateks",
  });
}, 60000);

afterAll(async () => {
  await cleanupAll();
});

describe("F-3: klinik erişim yetkilendirme (grant / revoke)", () => {
  it("randevusuz uzman başlangıçta klinik kaydı GÖREMEZ", async () => {
    expect(await canSeeAnamnesis(specialist.client)).toBe(false);
  });

  it("non-owner grant AÇAMAZ (RLS owner-only)", async () => {
    const { error } = await specialist.client
      .from("clinical_access_grants")
      .insert({
        org_id: orgA,
        customer_id: patientX,
        grantee_id: specialist.memberId,
      });
    expect(error).not.toBeNull();
  });

  it("owner grant açınca uzman GÖREBİLİR", async () => {
    const { error } = await owner.client
      .from("clinical_access_grants")
      .insert({
        org_id: orgA,
        customer_id: patientX,
        grantee_id: specialist.memberId,
      });
    expect(error).toBeNull();
    expect(await canSeeAnamnesis(specialist.client)).toBe(true);
  });

  it("grant iptal edilince uzman TEKRAR göremez", async () => {
    const admin = adminClient();
    await admin
      .from("clinical_access_grants")
      .update({ revoked_at: new Date().toISOString() })
      .eq("customer_id", patientX);
    expect(await canSeeAnamnesis(specialist.client)).toBe(false);
  });

  it("süresi geçmiş grant erişim VERMEZ", async () => {
    const admin = adminClient();
    await admin.from("clinical_access_grants").insert({
      org_id: orgA,
      customer_id: patientX,
      grantee_id: specialist.memberId,
      expires_at: new Date(Date.now() - 86400000).toISOString(),
    });
    expect(await canSeeAnamnesis(specialist.client)).toBe(false);
  });
});
