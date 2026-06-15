# Güzellik Merkezi CRM — Tasarım Belgesi

- **Tarih:** 2026-06-15
- **Durum:** Onaylandı (brainstorming tamamlandı) → Faz 0 uygulamaya hazır
- **Sahip:** Soykan Bayraktar (WOOWCODE)
- **Marka adı:** _TBD_ (önizlemede placeholder: "Lumea")

---

## 1. Genel Bakış & Hedefler

Güzellik/medikal estetik merkezleri için **hasta-müşteri takibi, randevu yönetimi ve klinik kayıt** sunan; görsel olarak etkileyici, fonksiyonel ve ölçeklenebilir bir CRM web uygulaması.

**Stratejik kararlar:**
- **Kullanım modeli:** Önce tek merkez için canlıya al; veri modelini baştan **multi-tenant** (SaaS'a hazır) tasarla.
- **Stack:** Next.js (App Router) + Supabase (Postgres / Auth / Storage / RLS) + Vercel.
- **Çekirdek modüller:** Randevu · Müşteri 360° · Finans/Paket · Pazarlama (fazlı teslim).
- **Tasarım dili:** Modern & temiz SaaS, **lux minimal** (antrasit + krem + şampanya altını), koyu/açık tema.
- **Randevu:** Sadece içeriden (personel paneli). Online müşteri portalı SaaS fazına bırakıldı.
- **İletişim:** WhatsApp (hatırlatma + kampanya), SMS/e-posta modüler yedek.

**Başarı kriterleri:** Resepsiyon günlük tüm operasyonu tek panelden yürütebilmeli; klinik kayıt mevzuata uygun ve eksiksiz olmalı; KVKK uyumu veritabanı düzeyinde garanti edilmeli; sistem tek merkezden çok merkeze tek satır kod değişmeden ölçeklenebilmeli.

---

## 2. Mimari

Tek Next.js projesi, server-first.

```
beauty-crm/
├─ app/
│  ├─ (auth)/login, /setup            → giriş, ilk kurulum
│  ├─ (app)/                          → korumalı panel (layout: sidebar + topbar + ⌘K)
│  │   ├─ dashboard/                  → role-uyarlanan özet
│  │   ├─ takvim/                     → personel sütunlu randevu takvimi
│  │   ├─ musteriler/[id]/            → müşteri 360° profili
│  │   ├─ hizmetler/  paketler/       → katalog + işlem türü/şema
│  │   ├─ finans/                     → ödemeler, kasa, raporlar
│  │   ├─ pazarlama/                  → kampanya, otomasyon
│  │   ├─ stok/                       → sarf malzeme, lot/SKT
│  │   ├─ raporlar/                   → iş zekâsı
│  │   └─ ayarlar/                    → merkez, personel, roller, KVKK
│  └─ api/  (route handlers, webhooks: WhatsApp)
├─ components/ui/   (tasarım sistemi — shadcn/ui temelli)
├─ lib/  (supabase client, auth, RBAC, zod validation)
└─ supabase/ migrations/  (SQL şema + RLS politikaları + pg_cron)
```

**Katmanlar:**
- **Veri:** Supabase Postgres. Her tablo `org_id` taşır; **Row Level Security** ile merkez izolasyonu DB düzeyinde garanti.
- **Kimlik:** Supabase Auth (e-posta+şifre → magic link). Kullanıcı↔rol eşlemesi `org_members`.
- **Sunum:** Server Components ile veri çekme; Client Components yalnızca etkileşimli alanlarda (takvim, formlar, arama).
- **Doğrulama:** Zod şemaları client+server tek kaynak.
- **Deploy:** Vercel (preview + production), Supabase managed (Frankfurt/EU bölgesi).

**Güvenlik ilkesi:** RLS son söz; uygulama hatası bile veri sızdıramaz.

---

## 3. Veri Modeli

> Tüm tablolar `org_id` (multi-tenant) ve `deleted_at` (soft-delete) taşır.

### 3.1 Kiracılık & Kimlik
- `organizations` — merkez bilgisi, ayarlar (çalışma saatleri, para birimi, logo, randevu slot süresi).
- `org_members` — `auth.users` ↔ org + **rol** (owner / reception / specialist / accountant).
- `staff` — uzman detayı: uzmanlık alanları, çalışma saatleri, takvim rengi. (Komisyon oranı SaaS fazında.)

### 3.2 Müşteri (360°)
- `customers` — ad, telefon, e-posta, doğum tarihi, cinsiyet, **kaynak**, etiketler, notlar.
- `customer_anamnesis` — _hassas, versiyonlu:_ ilaçlar, alerji, kronik durum, gebelik/emzirme, kontrendikasyon, Fitzpatrick tipi. Her güncelleme yeni sürüm (denetim izi).
- `customer_photos` — öncesi/sonrası foto (Supabase Storage, imzalı URL), işleme + onama bağlı.

### 3.3 Katalog
- `procedure_types` — **katalog-güdümlü dinamik şema:** ad, kategori, `is_medical`, `parameter_schema` (JSON Schema → dinamik form + validasyon), `requires_consent`, `consent_template_id`, varsayılan seans sayısı, önerilen aralık (gün).
- `services` — hizmet adı, kategori, **süre (dk)**, fiyat, `procedure_type_id`.
- `packages` + `package_services` — esnek paket: toplam seans, fiyat, geçerlilik süresi, karma hizmet, kampanya fiyatı, hediye/devir; abonelik desteği.

### 3.4 Randevu & Seans
- `appointments` — müşteri, uzman, hizmet, **başlangıç/bitiş**, durum (planlandı → onaylandı → geldi → işlemde → tamamlandı → ödendi; iptal / gelmedi), `customer_package_id`, `created_by`.
  - **Çakışma önleme:** aynı uzman+zaman aralığı için Postgres `EXCLUDE` constraint (`btree_gist`) → çift rezervasyon DB düzeyinde imkânsız.
- `customer_packages` — satılan paket: `sessions_total`, `sessions_used` (randevu *tamamlandı* olunca trigger ile artar), alış tarihi, bitiş, durum.
  - **Otomatik seri öneri:** paket satılınca önerilen aralıkla tüm seanslar takvime önerilir; resepsiyon onaylar/düzenler.

### 3.5 Klinik Kayıt
- `treatment_records` — her işlemin ana kaydı: randevu, müşteri, uygulayan, `procedure_type_id`, bölge, tarih, **SOAP notu**, uygulayan+müşteri **e-imza**, `parameters` (şemaya karşı doğrulanmış JSONB).
- `treatment_laser_sessions` & `treatment_injections` — yüksek hacimli/sorgulanan iki kritik tür için **tipli alt tablo** ("yıllık toplam ünite", "lot geri çağırma", "fluence ilerlemesi" sorguları için).
  - Lazer alanları: cihaz, dalga boyu (nm), fluence (J/cm²), spot (mm), pulse (ms), soğutma, atış sayısı, bölge, Fitzpatrick, tüy rengi/kalınlığı.
  - Enjeksiyon alanları: ürün/marka, lot no + SKT, sulandırma, bölge başına ünite/mL, enjeksiyon haritası, toplam doz, teknik.
- `adverse_events` — yan etki/komplikasyon kaydı (_Faz 2_).

### 3.6 Finans
- `payments` — tutar, **yöntem** (nakit/kart/havale/online), **bölünmüş ödeme** desteği, tür (hizmet/paket/ürün), tarih, alan personel, makbuz referansı.
- `cash_sessions` — günlük kasa aç/kapa + gün sonu mutabakatı.
- `expenses` — gider (kira, malzeme, maaş) → net kâr raporu.

### 3.7 Stok & Sarf Malzeme
- `products` — sarf malzeme + perakende ürün; birim, kritik stok eşiği.
- `product_batches` — lot no + SKT.
- `treatment_product_usage` — hangi lot, hangi işlemde, ne kadar → **işleme bağlı otomatik düşüm** + yasal izlenebilirlik.
- `suppliers` + `purchase_orders` — tedarikçi, sipariş/giriş, alış maliyeti.

### 3.8 Pazarlama & İletişim
- `message_templates` — WhatsApp şablonları (onaylı), makbuz, işlem sonrası bakım metinleri.
- `scheduled_messages` — kuyruk: kime, ne zaman, hangi şablon, durum (kuyrukta/iletildi/okundu/hata), maliyet.
- `messages` — gönderim/yanıt logu (gelen "Onayla/İptal" yanıtları dahil).
- `campaigns` — segment kriteri (gelişmiş filtre çıktısı) + şablon + zamanlama + durum.
- `segments` — kaydedilmiş filtre tanımları (Müşteriler arama motoruyla ortak).

### 3.9 KVKK & Denetim
- `consents` — versiyonlu, e-imzalı açık rıza: sürüm, tarih, IP; işleme/fotoğrafa bağlı.
- `clinical_access_grants` — bir uzmana başka uzmanın hastası için **açık, gerekçeli, süreli** klinik erişim (yönetici açar).
- `audit_log` — kim, ne zaman, neye erişti/değiştirdi (her hassas okuma/yazma).

---

## 4. Roller & Yetkilendirme (RBAC + RLS)

İki katman: **DB/RLS** (bypass edilemez) + **uygulama** (UX). Hassas tablolar ayrı, rol bazlı erişim.

| Modül / Eylem | Yönetici | Resepsiyon | Uzman | Muhasebe |
|---|:---:|:---:|:---:|:---:|
| Randevu görüntüle/oluştur | ✅ tümü | ✅ tümü | 🔸 kendi takvimi | ❌ |
| Müşteri iletişim/profil | ✅ | ✅ | ✅ | 🔸 sadece ad |
| Klinik kayıt + SOAP | ✅ | ❌ | 🔸 kendi müşterisi | ❌ |
| Anamnez / sağlık verisi | ✅ | ❌ | 🔸 kendi müşterisi | ❌ |
| Öncesi/sonrası foto | ✅ | 🔸 yükleme | 🔸 kendi müşterisi | ❌ |
| Ödeme alma | ✅ | ✅ | ❌ | ✅ |
| Finans raporu / gelir | ✅ | ❌ | ❌ | ✅ |
| Hizmet/paket/fiyat | ✅ | ❌ | ❌ | ❌ |
| Pazarlama / kampanya | ✅ | 🔸 gönderim | ❌ | ❌ |
| Personel & roller & ayarlar | ✅ | ❌ | ❌ | ❌ |

**Kilit kurallar:**
- Uzman **yalnızca kendi uyguladığı** müşterinin klinik kaydını/anamnezini/fotoğrafını görür (KVKK "bilmesi gereken kadar").
- Yönetici, `clinical_access_grants` ile bir uzmana başka uzmanın hastası için **süreli/gerekçeli** erişim açabilir.
- Muhasebe sağlık verisi görmez; resepsiyon klinik veri görmez; uzman finansı görmez.

**RLS yardımcıları:**
```sql
current_org_id()  -- JWT claim'inden aktif merkez (kiracı izolasyonu)
current_role()    -- org_members'tan kullanıcının rolü
```
Her tabloda iki kademe: (1) kiracı izolasyonu `org_id = current_org_id()`; (2) hassas tablolarda rol/sahiplik kontrolü + `clinical_access_grants` istisnası.

**Savunma derinliği:** RLS → Next.js middleware/server guard (403) → UI (yetkisiz menü render edilmez). Her erişim `audit_log`'a.

---

## 5. Modüller & Ekranlar

| # | Modül | Karar |
|---|---|---|
| 1 | **Dashboard** | Role göre uyarlanır; widget'lar: bugünün takvimi, gelir/finans KPI, müşteri/doluluk, aksiyon listesi. |
| 2 | **Takvim & Randevu** | Personel sütunlu (kaynak görünümü) gün/hafta/ay; tam yaşam döngüsü; paketlerde otomatik seri öneri + kalan seans otomatik düşümü. |
| 3 | **Müşteriler 360°** | Sekmeli düzen (Genel · Randevular · İşlem/Klinik · Foto · Paket/Seans · Ödemeler · Notlar · Onam); öncesi/sonrası karşılaştırma, işlem zaman tüneli, anamnez uyarı bayrakları, hızlı aksiyon çubuğu. |
| 4 | **Hizmetler & Paketler** | Esnek paket (karma + kampanya + hediye/devir + abonelik); hazır klinik şablonlar + görsel form düzenleyici (`parameter_schema`). |
| 5 | **Finans** | Çoklu yöntem + bölünmüş ödeme; makbuz (yazdır/WhatsApp); kasa aç-kapa + gider → net kâr. (Prim/komisyon SaaS fazı.) |
| 6 | **Pazarlama & İletişim** | 4 otomasyon (hatırlatma+onay, kayıp müşteri dönüş, paket bitiyor, doğum günü+bakım); segment + zamanlamalı kampanya + iletildi/okundu takibi. |
| 7 | **Stok & Sarf Malzeme** | Sarf+lot/SKT, perakende satış, kritik stok uyarısı, tedarikçi/sipariş; işleme bağlı otomatik düşüm. |
| 8 | **Raporlar & Analitik** | Gelir/finans, müşteri elde tutma & kaynağı, hizmet/işlem analizi; ekranda görüntüleme (dışa aktarım sonra). |
| 9 | **Ayarlar** | Tema (koyu/açık), merkez & çalışma saatleri, personel & roller, onam/mesaj şablonları, entegrasyonlar; **tam KVKK seti**. |
| ➕ | **Global arama & filtre** | ⌘K hızlı arama + çok kriterli filtre/sorgu oluşturucu; aynı motor Pazarlama'da **segment oluşturucu** olarak kullanılır. |

---

## 6. Tasarım Sistemi

**Renk token'ları (açık tema):**
- Zemin `#F6F2E9` (sıcak fildişi) · Yüzey `#FFFFFF` · Kenarlık `#ECE5D6`
- Metin `#211E1A` (ana) / `#8C8578` (ikincil)
- **Vurgu — şampanya altını** `#C7A35A` (hover `#9C7A3C`), yumuşak altın `#F3EAD6`
- Anlamsal: başarı `#5E8A63`, uyarı `#B5772E`

**Koyu tema:** zemin `#1A1916`, yüzey `#221F1B`, metin `#F3EEE2`; altın korunur.

**Tipografi:** Inter (geometrik), 2 ağırlık (400/500), başlıklarda sıkı tracking, finansal alanlarda tabular-nums.

**Form dili:** köşe yarıçapı 12px (kart) / 9px (buton-input), 0–1px ince kenarlık, düz yüzeyler (gradyan/gölge yok), 4px temelli boşluk, 150–200ms geçişler.

**Bileşen temeli:** shadcn/ui + Tailwind v4 (token'lar CSS değişkeni), Tabler ikonlar, Radix erişilebilirlik.

---

## 7. Entegrasyonlar & Bildirimler

**Bildirim mimarisi:**
- `scheduled_messages` tablosu → **Supabase `pg_cron`** her dakika vakti gelenleri tarar → **Edge Function** worker WhatsApp'a yollar → durum güncellenir.
- Webhook ile gelen yanıtlar işlenir: müşteri "Onayla/İptal" → randevu durumu otomatik güncellenir.

**WhatsApp Business API:**
- Sağlayıcı: **Meta Cloud API** (doğrudan) veya BSP (360dialog/Twilio). Onaylı şablon zorunlu.
- Şablon değişkenleri dinamik; gönderim logu + konuşma başına maliyet takibi.

**Diğer (modüler):** SMS yedeği (NetGSM/İleti Merkezi), e-posta (Resend), ödeme (iyzico/Stripe — SaaS), online portal (SaaS).

---

## 8. KVKK & Uyum

- **Veri ikameti:** Supabase Frankfurt (EU); yurt dışı aktarım için açık rıza metni.
- Fotoğraf/sağlık verisi: imzalı (süreli) URL; rıza yoksa erişim engeli (RLS + uygulama).
- Şifreleme (at-rest + in-transit), tam audit log.
- Veri öznesi araçları: dışa aktarma (erişim talebi), silme/anonimleştirme (unutulma hakkı), onam geçmişi.
- Otomatik yedekleme + geri yükleme testi.
- Mevzuat ayrımı: `is_medical` işlemlerde hekim onayı + tam klinik kayıt + onam zorunlu (Güzellik ve Estetik Amaçlı Sağlık Kuruluşları Yönetmeliği).

---

## 9. Yol Haritası (Fazlar)

| Faz | Kapsam | Çıktı |
|---|---|---|
| **0 · Temel** | Kurulum, tasarım sistemi (token+shadcn+tema), Auth+org+RLS iskeleti, app shell, ⌘K iskeleti | Çalışan iskelet + tema |
| **1 · MVP Çekirdek** | Müşteriler 360° + gelişmiş arama, Takvim/Randevu, Hizmet/Paket, temel ödeme+makbuz, onam+audit | Günlük operasyon çalışır |
| **2 · Klinik Derinlik** | İşlem şeması + form editör, klinik kayıt+SOAP+anamnez+uyarı bayrakları, öncesi/sonrası foto, stok+lot | Tam klinik dosya |
| **3 · Finans & Analitik** | Kasa+gider+net kâr, bölünmüş ödeme, raporlar, tam KVKK seti | İş zekâsı + uyum |
| **4 · Otomasyon** | WhatsApp + şablon, 4 otomasyon, segment/zamanlı kampanya, bildirim motoru (pg_cron+Edge Fn) | Pazarlama otomasyonu |
| **5 · SaaS (sonra)** | Online randevu portalı, çoklu merkez onboarding, abonelik/faturalama, prim/komisyon | Satılabilir ürün |

---

## 10. Açık Sorular / Sonra Karar

- **Marka adı** (placeholder: "Lumea").
- WhatsApp sağlayıcı kesinleşmesi (Meta Cloud API vs BSP) — Faz 4 başında.
- Prim/komisyon detayı ve perakende ürün vergilendirmesi — ilgili fazda.
- e-Arşiv/e-Fatura entegrasyonu gerekli mi? (mevzuat/muhasebe ihtiyacına göre).
