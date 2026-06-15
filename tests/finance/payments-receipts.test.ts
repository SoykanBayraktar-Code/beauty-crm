import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminClient } from "../helpers/clients";
import {
  newOrg,
  seedCustomer,
  seedAppointment,
  cleanupAll,
  type TestUser,
} from "../helpers/factory";

let orgA: string;
let ownerA: TestUser;
let custX: string;

beforeAll(async () => {
  const a = await newOrg("Finans Klinik");
  orgA = a.orgId;
  ownerA = a.owner;
  custX = await seedCustomer(orgA, "Finans Hasta");
}, 60000);

afterAll(async () => {
  await cleanupAll();
});

describe("Makbuz numarası — atomik, sıralı, çakışmasız", () => {
  it("aynı org+gün ardışık sıralı numara üretir", async () => {
    const r1 = await ownerA.client.rpc("next_receipt_no");
    const r2 = await ownerA.client.rpc("next_receipt_no");
    expect(r1.error).toBeNull();
    expect(String(r1.data)).toMatch(/^MKB-\d{8}-\d{4}$/);
    const n1 = Number(String(r1.data).slice(-4));
    const n2 = Number(String(r2.data).slice(-4));
    expect(n2).toBe(n1 + 1);
  });

  it("eşzamanlı 12 çağrı → 12 BENZERSİZ numara (yarış-güvenli)", async () => {
    const calls = await Promise.all(
      Array.from({ length: 12 }, () => ownerA.client.rpc("next_receipt_no")),
    );
    const nums = calls.map((c) => c.data as string);
    expect(nums.every((n) => /^MKB-\d{8}-\d{4}$/.test(n))).toBe(true);
    expect(new Set(nums).size).toBe(12);
  });

  it("farklı org → bağımsız sayaç (0001'den başlar)", async () => {
    const b = await newOrg("Finans Klinik B");
    const r = await b.owner.client.rpc("next_receipt_no");
    expect(String(r.data)).toMatch(/-0001$/);
  });
});

describe("Bölünmüş ödeme tek makbuzda paylaşılır", () => {
  it("aynı receipt_no ile 2 satır → ikisi de saklanır ve toplanır", async () => {
    const admin = adminClient();
    const receipt = "MKB-SPLIT-TEST-1";
    await admin.from("payments").insert([
      { org_id: orgA, customer_id: custX, receipt_no: receipt, amount: 1000, method: "cash", type: "service" },
      { org_id: orgA, customer_id: custX, receipt_no: receipt, amount: 500, method: "card", type: "service" },
    ]);
    const { data } = await admin
      .from("payments")
      .select("amount")
      .eq("receipt_no", receipt);
    expect((data ?? []).length).toBe(2);
    const total = (data ?? []).reduce((s, r) => s + Number(r.amount), 0);
    expect(total).toBe(1500);
  });

  it("negatif/sıfır tutar DB check ile reddedilir", async () => {
    const admin = adminClient();
    const { error } = await admin.from("payments").insert({
      org_id: orgA, customer_id: custX, receipt_no: "MKB-NEG", amount: -50, method: "cash", type: "service",
    });
    expect(error).not.toBeNull();
  });
});

describe("Seans düşümü trigger'ı (paket)", () => {
  it("randevu 'completed' → 1 seans düşer; geri alınınca iade edilir", async () => {
    const admin = adminClient();
    const { data: pkg } = await admin
      .from("customer_packages")
      .insert({
        org_id: orgA,
        customer_id: custX,
        name: "8 Seans Paket",
        sessions_total: 8,
        sessions_used: 0,
      })
      .select("id")
      .single();

    const apptId = await seedAppointment(orgA, ownerA.staffId!, custX, {
      customerPackageId: pkg!.id,
    });

    await admin.from("appointments").update({ status: "completed" }).eq("id", apptId);
    let res = await admin
      .from("customer_packages")
      .select("sessions_used")
      .eq("id", pkg!.id)
      .single();
    expect(Number(res.data!.sessions_used)).toBe(1);

    await admin.from("appointments").update({ status: "scheduled" }).eq("id", apptId);
    res = await admin
      .from("customer_packages")
      .select("sessions_used")
      .eq("id", pkg!.id)
      .single();
    expect(Number(res.data!.sessions_used)).toBe(0);
  });
});
