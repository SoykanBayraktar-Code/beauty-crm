import { describe, it, expect } from "vitest";
import { navForRole, NAV_ITEMS } from "../../lib/nav";

const hrefs = (role: Parameters<typeof navForRole>[0]) =>
  navForRole(role).map((i) => i.href);

describe("navForRole — rol-görünürlük matrisi", () => {
  it("owner tüm menüleri görür", () => {
    expect(navForRole("owner")).toHaveLength(NAV_ITEMS.length);
  });

  it("muhasebe (accountant): finans/raporlar görür; takvim/stok/pazarlama/ayarlar GÖRMEZ", () => {
    const h = hrefs("accountant");
    expect(h).toEqual(
      expect.arrayContaining(["/dashboard", "/musteriler", "/finans", "/raporlar"]),
    );
    for (const hidden of ["/takvim", "/stok", "/pazarlama", "/ayarlar", "/hizmetler"]) {
      expect(h).not.toContain(hidden);
    }
  });

  it("uzman (specialist): takvim görür; finans/raporlar/ayarlar/stok GÖRMEZ", () => {
    const h = hrefs("specialist");
    expect(h).toEqual(
      expect.arrayContaining(["/dashboard", "/takvim", "/musteriler"]),
    );
    for (const hidden of ["/finans", "/raporlar", "/ayarlar", "/stok", "/pazarlama"]) {
      expect(h).not.toContain(hidden);
    }
  });

  it("resepsiyon (reception): takvim/finans/stok/pazarlama görür; ayarlar/raporlar/hizmetler GÖRMEZ", () => {
    const h = hrefs("reception");
    expect(h).toEqual(
      expect.arrayContaining(["/takvim", "/finans", "/stok", "/pazarlama"]),
    );
    for (const hidden of ["/ayarlar", "/raporlar", "/hizmetler"]) {
      expect(h).not.toContain(hidden);
    }
  });

  it("ayarlar yalnız owner'a görünür", () => {
    for (const role of ["reception", "specialist", "accountant"] as const) {
      expect(hrefs(role)).not.toContain("/ayarlar");
    }
    expect(hrefs("owner")).toContain("/ayarlar");
  });
});
