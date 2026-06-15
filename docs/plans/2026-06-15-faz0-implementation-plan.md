# Faz 0 — Temel & İskelet · Uygulama Planı

- **Tarih:** 2026-06-15
- **Durum:** Onay bekliyor
- **Hedef:** Çalışan iskelet — lux-minimal tema (açık/koyu), Supabase auth + multi-tenant temel (org/üye/personel + RLS), korumalı app shell (sidebar + topbar + ⌘K iskeleti), role göre menü.
- **Referans:** [tasarım belgesi](2026-06-15-beauty-crm-design.md)

---

## Teknoloji seçimleri (öneri)

| Konu | Seçim | Gerekçe |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript (strict) | Tasarım kararı |
| Stil | Tailwind v4 + shadcn/ui (Radix) | Token'lar CSS değişkeni, erişilebilir |
| İkon | `@tabler/icons-react` | Önizlemeyle tutarlı |
| Tema | `next-themes` | Koyu/açık toggle |
| Form/validasyon | `react-hook-form` + `zod` | Client+server tek kaynak |
| Sunucu verisi | `@supabase/ssr` + Server Components | Server-first, güvenli |
| Paket yöneticisi | `pnpm` (yoksa `npm`) | Hızlı |
| DB (dev) | Supabase CLI **local-first** (`supabase start`) | Maliyetsiz geliştirme; cloud'a sonra `link` |

> Açık kararlar (onayında varsayılan alınır): paket yöneticisi `pnpm`; DB geliştirme **local-first** (cloud Supabase projesi Faz 1 sonu / deploy öncesi açılır).

---

## Adımlar

### 0.1 — Proje iskeleti
- `create-next-app` ile kurulum (TS, App Router, Tailwind, ESLint, `app/` kök dizin).
  - Repo'da `docs/` + `.git` mevcut olduğu için: `docs/` geçici taşınır → scaffold → geri alınır.
- `tsconfig` strict; path alias `@/*`.
- Klasör iskeleti (tasarım belgesindeki yapı): `app/(auth)`, `app/(app)`, `components/ui`, `lib`, `supabase/migrations`.

### 0.2 — Bağımlılıklar
```
pnpm add @supabase/supabase-js @supabase/ssr zod react-hook-form @hookform/resolvers \
         next-themes @tabler/icons-react date-fns clsx tailwind-merge
pnpm dlx shadcn@latest init     # token'lar lux-minimal'e göre
pnpm dlx shadcn@latest add button card input label badge dropdown-menu avatar \
         dialog command sonner separator skeleton
```

### 0.3 — Tasarım sistemi (lux-minimal)
- `app/globals.css`: CSS değişkenleri — açık + koyu tema token'ları (zemin `#F6F2E9`/`#1A1916`, vurgu altın `#C7A35A`, metin, kenarlık, anlamsal renkler) → Tailwind v4 `@theme` ile bağla.
- `next/font` ile **Inter**; 400/500 ağırlık.
- `ThemeProvider` (next-themes) + `ThemeToggle` bileşeni (güneş/ay).
- shadcn token'ları (`--primary` = altın vb.) lux paletine eşlenir; köşe yarıçapı 12/9px.
- Çıktı: `/` veya `/style` demo sayfasında tüm temel bileşenler iki temada doğru görünür.

### 0.4 — Supabase & şema (migration `0001_init`)
- `supabase init` + `supabase start` (local stack).
- `lib/supabase/{server,client,middleware}.ts` — `@supabase/ssr` istemcileri.
- **Migration 0001_init.sql:**
  - `role` enum (`owner`,`reception`,`specialist`,`accountant`).
  - Tablolar: `organizations`, `org_members`, `staff` (hepsi `org_id` + `deleted_at`).
  - Yardımcı fonksiyonlar: `current_org_id()`, `current_role()` (JWT/`org_members`'tan).
  - **RLS enable + politikalar:** her tabloda kiracı izolasyonu (`org_id = current_org_id()`) + ayarlar yazımı yalnız `owner`.
- `pnpm dlx supabase gen types typescript` → `lib/database.types.ts`.

### 0.5 — Auth + App Shell
- **Middleware:** oturum yenileme + `(app)/*` rotalarını koru (girişsiz → `/login`).
- **`/login`:** e-posta + şifre (react-hook-form + zod).
- **`/setup`:** ilk kullanıcı için merkez (org) + owner üyelik + staff kaydı oluşturma akışı.
- **`(app)/layout.tsx`:** Sidebar (9 modül, role göre filtreli) + Topbar (⌘K arama iskeleti `cmdk`, ThemeToggle, kullanıcı menüsü) + içerik alanı.
- **RBAC yardımcıları:** `getCurrentMember()`, `requireRole()` (server guard) + UI'da menü görünürlüğü.
- **`(app)/dashboard/page.tsx`:** role-uyarlı placeholder (gerçek widget'lar Faz 1).

---

## Kabul kriterleri (Faz 0 "bitti" tanımı)
- [ ] `pnpm dev` çalışır; lux-minimal tema **açık + koyu** doğru render olur.
- [ ] Kullanıcı kayıt/giriş yapar; `/setup` ile ilk org + owner + staff oluşur.
- [ ] Korumalı panel açılır; sidebar + topbar + tema toggle + ⌘K iskeleti çalışır.
- [ ] Menü **role göre** filtrelenir (örn. muhasebe → finans odaklı).
- [ ] `0001_init` migration uygulanır; **RLS** ile başka org'un verisi görünmez (temel doğrulama).
- [ ] `lib/database.types.ts` üretilir; tip güvenliği uçtan uca.
- [ ] (Hedef) Vercel preview deploy alınır.

---

## Çalışma yöntemi
[Plan→Onay→Uygula] tercihine uygun: bu plan onaylanınca adımlar **0.1 → 0.5 sırasıyla** uygulanır; her adım sonunda kısa özet + doğrulama. Üretim/şema değişiklikleri öncesi dry-run/yedek mantığı korunur. Riskli/dışa dönük adım yok (local-first geliştirme).
