import { describe, it, expect } from "vitest";
import {
  parseFilters,
  ageToBirthRange,
  hasAnyFilter,
} from "../../lib/customer-filters";

describe("parseFilters — enjeksiyon temizleme (güvenlik)", () => {
  it("PostgREST anlamlı karakterleri (, ( ) * . ) eler", () => {
    const { q } = parseFilters({ q: "a,b(c)*.d" });
    expect(q).not.toMatch(/[(),.*]/);
    // yalnız harf/rakam/boşluk kalır
    expect(q.replace(/\s/g, "")).toBe("abcd");
  });

  it("Türkçe harfleri ve rakamları korur", () => {
    expect(parseFilters({ q: "şıçöü 42" }).q).toBe("şıçöü 42");
  });

  it("ilike joker karakterini (%) ve PostgREST or-ayracını eler", () => {
    const { q } = parseFilters({ q: "%a%,b" });
    expect(q).not.toContain("%");
    expect(q).not.toContain(",");
  });

  it("hasPackage yalnız 'yes'/'no' kabul eder, gerisi boş", () => {
    expect(parseFilters({ hasPackage: "yes" }).hasPackage).toBe("yes");
    expect(parseFilters({ hasPackage: "no" }).hasPackage).toBe("no");
    expect(parseFilters({ hasPackage: "evet" }).hasPackage).toBe("");
  });

  it("tags virgülle ayrılır, boşlar atılır", () => {
    expect(parseFilters({ tags: "vip, , yeni ," }).tags).toEqual(["vip", "yeni"]);
  });
});

describe("ageToBirthRange — yaş→doğum tarihi sınırları (off-by-one)", () => {
  const now = new Date(2026, 5, 20); // 20 Haziran 2026 (yıl-ortası, gün kayması yıl atlamaz)

  it("ageMin en geç doğum yılını (now - min) verir", () => {
    const { lte } = ageToBirthRange("30", "", now);
    expect(lte?.slice(0, 4)).toBe("1996"); // 2026 - 30
  });

  it("ageMax en erken doğum yılını (now - max - 1) verir — max+1 off-by-one", () => {
    const { gte } = ageToBirthRange("", "40", now);
    expect(gte?.slice(0, 4)).toBe("1985"); // 2026 - 40 - 1
  });

  it("boş girdide ilgili sınır tanımsız", () => {
    const r = ageToBirthRange("", "", now);
    expect(r.gte).toBeUndefined();
    expect(r.lte).toBeUndefined();
  });
});

describe("hasAnyFilter", () => {
  it("hiç filtre yoksa false", () => {
    expect(hasAnyFilter(parseFilters({}))).toBe(false);
  });
  it("tek filtre varsa true", () => {
    expect(hasAnyFilter(parseFilters({ q: "ali" }))).toBe(true);
  });
});
