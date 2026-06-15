import { describe, it, expect, afterAll } from "vitest";
import { newOrg, cleanupAll } from "./helpers/factory";
import { anonClient } from "./helpers/clients";

afterAll(async () => {
  await cleanupAll();
});

describe("harness smoke", () => {
  it("owner yeni merkezini okuyabilir (create_organization RPC akışı)", async () => {
    const { orgId, owner } = await newOrg("Smoke Klinik");
    expect(owner.staffId).toBeTruthy();
    const { data, error } = await owner.client
      .from("organizations")
      .select("id, name")
      .eq("id", orgId)
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBe(orgId);
  });

  it("anon hiçbir organizasyon göremez (RLS)", async () => {
    const { data } = await anonClient().from("organizations").select("id");
    expect(data ?? []).toHaveLength(0);
  });
});
