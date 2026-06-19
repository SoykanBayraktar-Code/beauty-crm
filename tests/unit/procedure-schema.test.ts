import { describe, it, expect } from "vitest";
import { slugifyKey } from "../../lib/procedure-schema";

describe("slugifyKey — Türkçe etiket → DB key", () => {
  it("boşlukları alt çizgiye çevirir", () => {
    expect(slugifyKey("Dalga boyu")).toBe("dalga_boyu");
  });

  it("Türkçe karakterleri ASCII'ye indirir", () => {
    expect(slugifyKey("Atış sayısı")).toBe("atis_sayisi");
    expect(slugifyKey("Konsantrasyon")).toBe("konsantrasyon");
    expect(slugifyKey("Çözünürlük güçü")).toBe("cozunurluk_gucu");
  });

  it("baş/son alt çizgileri kırpar", () => {
    expect(slugifyKey("  Bölge  ")).toBe("bolge");
    expect(slugifyKey("(Doz)")).toBe("doz");
  });

  it("tamamen geçersiz girdide 'alan' fallback'i", () => {
    expect(slugifyKey("!!!")).toBe("alan");
    expect(slugifyKey("   ")).toBe("alan");
    expect(slugifyKey("")).toBe("alan");
  });
});
