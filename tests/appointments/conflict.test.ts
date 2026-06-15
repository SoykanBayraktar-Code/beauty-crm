import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminClient } from "../helpers/clients";
import {
  newOrg,
  seedCustomer,
  cleanupAll,
  type TestUser,
} from "../helpers/factory";

let orgA: string;
let owner: TestUser;
let cust1: string;
let cust2: string;

beforeAll(async () => {
  const a = await newOrg("Randevu Klinik");
  orgA = a.orgId;
  owner = a.owner;
  cust1 = await seedCustomer(orgA, "H1");
  cust2 = await seedCustomer(orgA, "H2");
}, 60000);

afterAll(async () => {
  await cleanupAll();
});

function appt(
  customerId: string,
  startMs: number,
  mins = 30,
  status = "scheduled",
) {
  return {
    org_id: orgA,
    staff_id: owner.staffId,
    customer_id: customerId,
    start_at: new Date(startMs).toISOString(),
    end_at: new Date(startMs + mins * 60000).toISOString(),
    status,
  };
}

const BASE = Date.now() + 30 * 86400000; // bolca ileride, mevcut veriyle çakışmaz

describe("Randevu çakışma engeli (EXCLUDE gist)", () => {
  it("aynı uzman + çakışan zaman → ikinci randevu EKLENEMEZ", async () => {
    const admin = adminClient();
    const a1 = await admin
      .from("appointments")
      .insert(appt(cust1, BASE))
      .select("id")
      .single();
    expect(a1.error).toBeNull();

    const a2 = await admin
      .from("appointments")
      .insert(appt(cust2, BASE + 10 * 60000)) // 10dk sonra → çakışır
      .select("id")
      .single();
    expect(a2.error).not.toBeNull();
  });

  it("aynı uzman + çakışmayan zaman → EKLENEBİLİR", async () => {
    const admin = adminClient();
    const r = await admin
      .from("appointments")
      .insert(appt(cust1, BASE + 5 * 86400000))
      .select("id")
      .single();
    expect(r.error).toBeNull();
  });

  it("iptal edilen randevu çakışma yaratmaz", async () => {
    const admin = adminClient();
    const t = BASE + 10 * 86400000;
    await admin.from("appointments").insert(appt(cust1, t, 30, "cancelled"));
    const r = await admin
      .from("appointments")
      .insert(appt(cust2, t)) // aynı saat ama diğeri iptal
      .select("id")
      .single();
    expect(r.error).toBeNull();
  });

  it("end_at <= start_at → reddedilir (check kısıtı)", async () => {
    const admin = adminClient();
    const s = new Date(BASE + 15 * 86400000).toISOString();
    const { error } = await admin.from("appointments").insert({
      org_id: orgA,
      staff_id: owner.staffId,
      customer_id: cust1,
      start_at: s,
      end_at: s,
      status: "scheduled",
    });
    expect(error).not.toBeNull();
  });
});
