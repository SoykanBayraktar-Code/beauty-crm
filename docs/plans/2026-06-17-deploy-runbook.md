# Deploy Runbook — Cloud Supabase + Vercel

- **Tarih:** 2026-06-17
- **Durum:** Hazır — uygulama kullanıcının Supabase/Vercel hesapları + billing/domain kararıyla **birlikte** yapılır.
- **Hedef:** Lokal çalışan CRM'i bulut Supabase (Frankfurt/EU) + Vercel'e canlı almak.

> Bu **dışa açık bir yayındır**. Adımlar kullanıcının hesaplarına erişim ister; her adımda dur-onayla.

---

## 0. Ön koşullar
- [ ] Supabase hesabı (org Pro — ücretli proje/billing onayı). Bölge: **Frankfurt (eu-central-1)** (KVKK).
- [ ] Vercel hesabı + projeyi GitHub'a push (`SoykanBayraktar-Code/beauty-crm` private önerilir).
- [ ] (Opsiyonel) Özel domain.
- [ ] SMTP sağlayıcı (auth e-postaları için): **Resend** veya Postmark (Supabase varsayılan SMTP'si rate-limitli, prod için yetersiz).

---

## 1. Supabase cloud projesi
1. Dashboard → **New project** → bölge **Frankfurt** → güçlü DB şifresi. `project-ref`'i not al.
2. Yerelden bağla ve migration'ları gönder:
   ```bash
   cd beauty-crm
   supabase link --project-ref <PROJECT_REF>
   supabase db push          # 0001 … 0016 tümünü uygular
   ```
   - `0010_photos` migration'ı **'treatment-photos' bucket'ını** ve storage RLS'ini otomatik kurar (insert into storage.buckets). Ayrıca el ile bucket açmaya gerek yok.
   - Doğrula: Dashboard → Database → migration listesi + Storage → bucket görünür.
3. **API anahtarları** (Dashboard → Project Settings → API):
   - `Publishable key` (sb_publishable_…) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `Secret key` (sb_secret_…) → `SUPABASE_SERVICE_ROLE_KEY` (yalnız sunucu!)
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`

## 2. Auth ayarları (Dashboard → Authentication)
- [ ] **Site URL** = prod domain (örn. `https://app.lumea.com`).
- [ ] **Redirect URLs** = prod domain + Vercel preview pattern.
- [ ] **Email → Confirm email = AÇIK** (lokalde kapalıydı; prod'da açık olmalı).
- [ ] **SMTP**: Resend/Postmark SMTP bilgilerini gir (gönderen adresi doğrulanmış domain). Bu olmadan kayıt/şifre-sıfırlama e-postaları gitmez.
- [ ] Şifre sıfırlama akışı: Supabase'in `resetPasswordForEmail` + bir `/reset` sayfası (NOT: bu sayfa henüz YOK — Adım 4 sonrası küçük ek; lokalde test edilemiyordu).

## 3. Vercel deploy
1. Vercel → **Add New Project** → GitHub repo'yu seç (framework otomatik: Next.js).
2. **Environment Variables** (Production + Preview):
   | Key | Değer |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | cloud project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sb_publishable_… |
   | `SUPABASE_SERVICE_ROLE_KEY` | sb_secret_… (yalnız server; `NEXT_PUBLIC` DEĞİL) |
3. **Deploy**. Build = `next build` (Next 16 + Turbopack). `proxy.ts` nodejs runtime'da çalışır — Vercel destekler.
4. (Opsiyonel) **Domain** ekle + DNS doğrula.

## 4. Yayın sonrası
- [ ] Prod URL → `/setup` → ilk merkezi + owner hesabını oluştur (gerçek e-posta; confirm e-postası gelir).
- [ ] Smoke test: giriş · müşteri ekle · randevu · ödeme+makbuz · klinik kayıt · stok · personel ekle.
- [ ] **RLS doğrula (prod):** anon key ile `curl .../rest/v1/customers` → `[]` dönmeli.
- [ ] **Yedekleme:** Supabase Pro → PITR/günlük yedek AÇIK; geri yükleme testi.
- [ ] (Önerilen) **Sentry** hata izleme ekle.
- [ ] Test verisi (Lumea/Ayşe/resepsiyon@…) prod'a GİTMEZ — temiz başlar (lokal DB ayrı).

## 5. Prod'a özgü dikkat
- Lokal demo anahtarları (`tests/helpers/clients.ts` inline) prod'u ETKİLEMEZ — testler yalnız lokale bağlanır; CI'da env override edilir.
- `SUPABASE_SERVICE_ROLE_KEY` sızıntısı = tam DB erişimi → yalnız Vercel server env'de, repo'da değil (`.env.local` git-ignored ✓).
- Çok-merkez (multi-org) HENÜZ AÇIK DEĞİL — F-2 tek-org unique index aktif. SaaS'a geçişte JWT-claim + index düşürme gerekir (ayrı faz).

---

## Açık küçük işler (deploy öncesi/sonrası, kod)
- [ ] Şifre sıfırlama sayfası (`/reset` + `forgotPassword` action) — SMTP'siz lokalde test edilemediği için ertelendi.
- [ ] E-posta onayı akış sayfası (confirm sonrası yönlendirme).
> Bunlar Adım 4b deploy sırasında SMTP kurulunca eklenir.
