import { describe, it, expect } from "vitest";
import { expiryStatus } from "../../lib/inventory";

// expiryStatus içeride new Date() (bugün) kullanır → tarihleri bugüne göreli ve
// YEREL bileşenlerden üretelim (fonksiyonun parse mantığıyla aynı, TZ-flaky değil).
function localDateStr(offsetDays: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

describe("expiryStatus — SKT durumu", () => {
  it("tarihsizde null", () => {
    expect(expiryStatus(null)).toBeNull();
  });

  it("geçmiş tarih → expired", () => {
    expect(expiryStatus(localDateStr(-5))).toBe("expired");
    expect(expiryStatus(localDateStr(-1))).toBe("expired");
  });

  it("30 gün içinde → soon (sınır dahil)", () => {
    expect(expiryStatus(localDateStr(0))).toBe("soon"); // bugün
    expect(expiryStatus(localDateStr(15))).toBe("soon");
    expect(expiryStatus(localDateStr(30))).toBe("soon"); // 30. gün hâlâ soon
  });

  it("30 günden uzak → ok", () => {
    expect(expiryStatus(localDateStr(31))).toBe("ok");
    expect(expiryStatus(localDateStr(120))).toBe("ok");
  });
});
