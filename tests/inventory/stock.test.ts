import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminClient } from "../helpers/clients";
import {
  newOrg,
  seedCustomer,
  seedProduct,
  seedBatch,
  seedTreatment,
  batchQuantity,
  cleanupAll,
} from "../helpers/factory";

let orgA: string;
let custX: string;
let recordId: string;

beforeAll(async () => {
  const a = await newOrg("Stok Klinik");
  orgA = a.orgId;
  custX = await seedCustomer(orgA);
  recordId = await seedTreatment(orgA, custX);
}, 60000);

afterAll(async () => {
  await cleanupAll();
});

describe("Stok düşüm trigger'ı (işleme bağlı lot izlenebilirliği)", () => {
  it("kullanım eklenince ilgili lottan düşer", async () => {
    const admin = adminClient();
    const pid = await seedProduct(orgA, { name: "Botoks", unit: "ünite" });
    const bid = await seedBatch(orgA, pid, 10);
    const { error } = await admin.from("treatment_product_usage").insert({
      org_id: orgA,
      treatment_record_id: recordId,
      product_id: pid,
      batch_id: bid,
      quantity: 4,
    });
    expect(error).toBeNull();
    expect(await batchQuantity(bid)).toBe(6);
  });

  it("yetersiz stok → exception fırlatır ve lot DEĞİŞMEZ", async () => {
    const admin = adminClient();
    const pid = await seedProduct(orgA, { name: "Dolgu", unit: "ml" });
    const bid = await seedBatch(orgA, pid, 5);
    const { error } = await admin.from("treatment_product_usage").insert({
      org_id: orgA,
      treatment_record_id: recordId,
      product_id: pid,
      batch_id: bid,
      quantity: 100,
    });
    expect(error).not.toBeNull();
    expect(String(error?.message)).toMatch(/yeterli stok yok/i);
    expect(await batchQuantity(bid)).toBe(5);
  });

  it("kullanım silinince stok iade edilir (revert trigger)", async () => {
    const admin = adminClient();
    const pid = await seedProduct(orgA, { name: "Serum", unit: "ml" });
    const bid = await seedBatch(orgA, pid, 20);
    const { data: u } = await admin
      .from("treatment_product_usage")
      .insert({
        org_id: orgA,
        treatment_record_id: recordId,
        product_id: pid,
        batch_id: bid,
        quantity: 8,
      })
      .select("id")
      .single();
    expect(await batchQuantity(bid)).toBe(12);

    await admin.from("treatment_product_usage").delete().eq("id", u!.id);
    expect(await batchQuantity(bid)).toBe(20);
  });

  it("negatif stok DB-düzeyinde imkansız (quantity >= 0 check)", async () => {
    const admin = adminClient();
    const pid = await seedProduct(orgA, { name: "Test", unit: "adet" });
    const { error } = await admin.from("product_batches").insert({
      org_id: orgA,
      product_id: pid,
      quantity: -5,
    });
    expect(error).not.toBeNull();
  });

  it("0 veya negatif kullanım miktarı reddedilir (quantity > 0 check)", async () => {
    const admin = adminClient();
    const pid = await seedProduct(orgA);
    const bid = await seedBatch(orgA, pid, 10);
    const { error } = await admin.from("treatment_product_usage").insert({
      org_id: orgA,
      treatment_record_id: recordId,
      product_id: pid,
      batch_id: bid,
      quantity: 0,
    });
    expect(error).not.toBeNull();
  });
});
