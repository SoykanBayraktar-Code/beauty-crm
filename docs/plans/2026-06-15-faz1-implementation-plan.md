# Faz 1 — MVP Çekirdek · Uygulama Planı

- **Tarih:** 2026-06-15
- **Durum:** Onay bekliyor
- **Hedef:** Bir güzellik merkezinin **günlük operasyonunu** tek panelden yürütebilmesi: müşteri yönetimi + gelişmiş arama, hizmet/paket kataloğu, randevu takvimi, temel ödeme + makbuz, KVKK onamı.
- **Referans:** [tasarım belgesi](2026-06-15-beauty-crm-design.md) · [Faz 0 planı](2026-06-15-faz0-implementation-plan.md)
- **Ortam:** Local Supabase (ücretsiz); migration'lar git'te → buluta geçiş tek komut.

> **Kapsam notu:** Klinik derinlik (SOAP, öncesi/sonrası foto, lazer/enjeksiyon parametre tabloları, anamnez uyarı bayrakları) **Faz 2**'dedir. Faz 1'de müşteri profili klinik-dışı sekmelerle gelir (Genel · Randevular · Paket/Seans · Ödemeler · Notlar).

---

## Veri modeli (yeni migration'lar)

| Migration | Tablolar |
|---|---|
| `0002_catalog` | `procedure_types` (hazır şablon seed), `services`, `packages`, `package_services` |
| `0003_customers` | `customers` (tags, kaynak, notlar), `customer_notes` |
| `0004_appointments` | `appointments` (+ `EXCLUDE` çakışma kısıtı), `customer_packages`, seans düşüm trigger'ı |
| `0005_payments` | `payments` (+ makbuz no sequence) |
| `0006_consents` | `consents`, `audit_log` (+ temel log trigger'ları) |

Her tablo `org_id` + `deleted_at` + RLS (kiracı izolasyonu + rol kuralları). Migration'lar hem local'e uygulanır hem `lib/database.types.ts` yeniden üretilir.

---

## Adımlar (sıralı, her biri kendi içinde doğrulanır)

### 1.1 — Müşteriler (360° + gelişmiş arama)
- `0003_customers` migration + RLS (resepsiyon/owner tam; uzman erişimi Faz 2 klinikle netleşir; muhasebe sadece ad).
- **Liste:** tablo (ad, telefon, etiket, son ziyaret, kalan seans), sayfalama, sıralama.
- **Gelişmiş arama/filtre:** çok kriterli sorgu oluşturucu (ad/telefon, etiket, kaynak, yaş, son ziyaret, paket durumu) — kaydedilebilir segment temeli.
- **360° profil (sekmeli):** Genel · Randevular · Paket/Seans · Ödemeler · Notlar (klinik/foto sekmeleri Faz 2'de görünür ama yer tutucu).
- **Müşteri ekle/düzenle** (server action + zod), hızlı aksiyon çubuğu iskeleti.
- ⌘K araması artık gerçek müşteri sonuçları döndürür.

### 1.2 — Hizmetler & Paketler (katalog)
- `0002_catalog` migration + hazır `procedure_types` seed (lazer/enjeksiyon/peeling/kalıcı makyaj iskelet şemaları).
- Hizmet CRUD (ad, kategori, süre, fiyat), paket CRUD (seans, geçerlilik, fiyat, karma hizmet), kampanya fiyatı.
- Owner yönetir; diğer roller okur.

### 1.3 — Takvim & Randevu
- `0004_appointments` migration: `appointments` + Postgres `EXCLUDE USING gist` (aynı uzman + zaman çakışması imkânsız), `customer_packages` + seans düşüm trigger'ı.
- Personel sütunlu takvim (gün/hafta), randevu oluştur/düzenle (müşteri + hizmet + uzman + zaman), durum akışı (planlandı→…→tamamlandı).
- Paket satışında otomatik seri öneri (önerilen aralıkla seans önerisi).
- Dashboard'da "bugünün randevuları" widget'ı gerçek veriye bağlanır.

### 1.4 — Ödeme + makbuz
- `0005_payments` migration: `payments` (çoklu yöntem + bölünmüş ödeme), makbuz numarası.
- Profil/randevudan ödeme al; yazdırılabilir/paylaşılabilir makbuz.
- Dashboard "bugünkü gelir" KPI'sı gerçek veriye bağlanır.

### 1.5 — Onam + audit
- `0006_consents` migration: `consents` (versiyonlu, onaylı), `audit_log`.
- Müşteriye onam metni atama + kayıt; hassas işlemlerde audit log.
- Ayarlar'da temel onam şablonu yönetimi.

---

## Kabul kriterleri (Faz 1 "bitti")
- [ ] Müşteri eklenir, listelenir, **çok kriterli filtre** ile bulunur; 360° profil açılır.
- [ ] Hizmet + paket tanımlanır; paket müşteriye satılır, kalan seans takip edilir.
- [ ] Randevu oluşturulur; **çakışma DB düzeyinde engellenir**; durum akışı işler.
- [ ] Ödeme alınır, makbuz üretilir; dashboard gelir + günün randevuları gerçek veriyi gösterir.
- [ ] Onam alınır/saklanır; hassas işlemler audit log'a düşer.
- [ ] Tüm yeni tablolarda RLS doğrulanır (anon/yetkisiz erişim engellenir); `tsc` temiz; preview'da doğrulanır.

---

## Çalışma yöntemi
[Plan→Onay→Uygula]: bu plan onaylanınca **1.1 → 1.5 sırasıyla** uygulanır; her adım sonunda migration + UI preview'da doğrulanır, ayrı commit atılır. Şema değişiklikleri local'e uygulanır, tipler yeniden üretilir. Riskli/dışa dönük adım yok.
