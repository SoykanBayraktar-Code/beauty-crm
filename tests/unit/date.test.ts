import { describe, it, expect } from "vitest";
import { istanbulMonthStart } from "../../lib/date";

describe("istanbulMonthStart — ay sınırı Istanbul saatine göre (M4)", () => {
  it("ay ortasında doğru ay başı verir", () => {
    const r = istanbulMonthStart(new Date("2026-06-20T10:00:00Z"));
    expect(r.date).toBe("2026-06-01");
    expect(r.iso).toBe("2026-05-31T21:00:00.000Z"); // Istanbul 1 Haz 00:00 = UTC 31 May 21:00
  });

  it("UTC'de hâlâ önceki ayken Istanbul yeni aya geçmişse yeni ayı seçer", () => {
    // 31 May 22:00 UTC = 1 Haz 01:00 Istanbul → Haziran olmalı
    const r = istanbulMonthStart(new Date("2026-05-31T22:00:00Z"));
    expect(r.date).toBe("2026-06-01");
    expect(r.iso).toBe("2026-05-31T21:00:00.000Z");
  });

  it("yıl başında bir önceki yıla taşar (UTC instant)", () => {
    const r = istanbulMonthStart(new Date("2026-01-10T00:00:00Z"));
    expect(r.date).toBe("2026-01-01");
    expect(r.iso).toBe("2025-12-31T21:00:00.000Z");
  });
});
