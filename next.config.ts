import type { NextConfig } from "next";

// Klinik/KVKK verisi taşıyan uygulama için temel güvenlik başlıkları.
// NOT: Tam CSP (Content-Security-Policy) nonce tabanlı kurulum gerektirir
// (bkz. node_modules/next/dist/docs/.../content-security-policy.md) ve ayrı
// test ister; burada clickjacking/sniffing/HSTS gibi düşük-kırılma riskli
// başlıklar eklendi. CSP nonce middleware'i sonraki adım olarak planlanmalı.
const securityHeaders = [
  // HTTPS zorla (yalnız HTTPS'te etkili; localhost http'de tarayıcı yok sayar).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    serverActions: {
      // Tedavi fotoğrafı yüklemesi 10MB'a kadar (MAX_PHOTO_BYTES); varsayılan
      // 1MB'lik Server Action gövde sınırı bu fotoları app kontrolüne ulaşmadan
      // reddediyordu. multipart payı için 12MB.
      bodySizeLimit: "12mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
