import { describe, it, expect } from "vitest";
import { sniffImage } from "../../lib/image";

describe("sniffImage — magic-byte tür tespiti (bildirilen MIME'ye güvenme)", () => {
  it("JPEG (FF D8 FF)", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe("jpg");
  });

  it("PNG (89 50 4E 47 0D 0A 1A 0A)", () => {
    expect(
      sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe("png");
  });

  it("WEBP (RIFF....WEBP)", () => {
    const b = new Uint8Array(12);
    b.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
    b.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
    expect(sniffImage(b)).toBe("webp");
  });

  it("sahte/yanlış imza → null (yükleme reddedilir)", () => {
    // .exe / rastgele içerik
    expect(sniffImage(new Uint8Array([0x4d, 0x5a, 0x90, 0x00]))).toBeNull();
    expect(sniffImage(new Uint8Array([0x00, 0x01, 0x02]))).toBeNull();
  });

  it("çok kısa girdi → null", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(sniffImage(new Uint8Array([]))).toBeNull();
  });
});
