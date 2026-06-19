// Görüntü doğrulama yardımcıları (saf, test edilebilir). Storage/Server Action
// kodundan ayrıştırıldı (M11) — MIME sniff güvenlik-kritik olduğu için birim testli.

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export type ImageExt = "jpg" | "png" | "webp";

/** Client'ın bildirdiği (sahteci olabilen) MIME → uzantı. */
export const PHOTO_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Sniff sonucu uzantı → güvenilir MIME (upload contentType için). */
export const SNIFF_MIME: Record<ImageExt, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Client'ın bildirdiği MIME sahteci olabilir → gerçek baytlardan (magic bytes) tür çıkar. */
export function sniffImage(b: Uint8Array): ImageExt | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return "jpg";
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  )
    return "png";
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // WEBP
  )
    return "webp";
  return null;
}
