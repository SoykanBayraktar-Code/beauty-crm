# Faz 2 — Klinik Derinlik · Uygulama Planı

- **Tarih:** 2026-06-16
- **Durum:** Onay bekliyor
- **Hedef:** CRM'i medikal estetik seviyesine taşımak — anamnez & uyarı bayrakları, katalog-güdümlü dinamik klinik kayıt (SOAP + işleme özel parametreler), öncesi/sonrası fotoğraf (onam korumalı), stok & lot izlenebilirliği.
- **Referans:** [tasarım belgesi](2026-06-15-beauty-crm-design.md) · [Faz 1 planı](2026-06-15-faz1-implementation-plan.md)
- **Ortam:** Local Supabase (Storage container dahil); migration'lar git'te.

> **Kapsam notu:** Lazer/enjeksiyonun ayrı "tipli alt tabloları" (yıllık ünite toplamı, lot geri-çağırma gibi ağır sorgular için) Faz 3 optimizasyonuna bırakıldı. Faz 2'de işleme özel veriler `treatment_records.parameters` (şemaya karşı doğrulanmış JSONB) içinde tutulur — dinamik form + kayıt için yeterli.

---

## Veri modeli (yeni migration'lar)

| Migration | Tablolar |
|---|---|
| `0007_anamnesis` | `customer_anamnesis` (versiyonlu hassas sağlık) |
| `0008_procedures` | `procedure_types` (parametre şeması), `services.procedure_type_id` |
| `0009_treatments` | `treatment_records` (SOAP + JSONB parametreler), `treatment_photos` |
| `0010_inventory` | `products`, `product_batches` (lot/SKT), `treatment_product_usage`, `suppliers` |

Hepsi `org_id` + RLS. Klinik tablolar **rol bazlı kısıtlı** (uzman kendi müşterisi; `clinical_access_grants` ileride). Storage için **özel bucket** + imzalı URL.

---

## Adımlar (sıralı, her biri preview'da doğrulanır)

### 2.1 — Anamnez & uyarı bayrakları
- `0007_anamnesis`: alerji, kronik durum, ilaçlar, gebelik/emzirme, Fitzpatrick, kontrendikasyon; **versiyonlu** (her güncelleme yeni sürüm, denetim izi).
- Profil **Anamnez** sekmesi: form (güncelle → yeni sürüm) + geçmiş.
- Profil üstünde **uyarı bayrakları** (alerji/gebelik/kontrendikasyon kırmızı rozet) — işlem öncesi görünür.
- RLS: owner + ilgili uzman okur; muhasebe/resepsiyon göremez.

### 2.2 — İşlem türü & parametre şeması
- `0008_procedures`: `procedure_types` (ad, kategori, `is_medical`, `parameter_schema` JSONB = alan tanımları [{key,label,type,unit,options}], `requires_consent`, varsayılan seans/aralık).
- Hizmetler'e "İşlem türleri" sekmesi: **görsel alan editörü** (alan ekle/çıkar) + **hazır şablonlar** (lazer/enjeksiyon/peeling/kalıcı makyaj — tek tıkla yükle).
- `services.procedure_type_id` bağı.

### 2.3 — Klinik kayıt + SOAP
- `0009_treatments` (treatment_records kısmı): randevu/müşteri/uygulayan, `procedure_type_id`, bölge, tarih, **SOAP** (Subjektif/Objektif/Değerlendirme/Plan), `parameters` (şemaya göre **dinamik form**, JSONB).
- Randevu bloğundan / profilden "Klinik kayıt ekle" → işlem türü seçince parametre formu otomatik oluşur.
- Profil **İşlem/Klinik** sekmesi: kronolojik kayıt zaman tüneli (parametreler + SOAP).
- RLS: owner + uygulayan uzman.

### 2.4 — Öncesi/sonrası fotoğraf
- `treatment_photos` (storage path, tür: before/after, işleme/müşteriye bağlı, çekim tarihi).
- Supabase **Storage özel bucket** + RLS; yükleme imzalı URL ile; **onam yoksa yükleme engeli** (Faz 1.5 consents kontrolü).
- Profilde öncesi/sonrası **kayan karşılaştırma** + klinik kayda foto ekleme.

### 2.5 — Stok & sarf malzeme + lot
- `0010_inventory`: `products` (sarf/perakende, kritik eşik), `product_batches` (lot no + SKT), `treatment_product_usage` (hangi lot, hangi kayıtta, miktar), `suppliers`.
- Stok modülü (placeholder → gerçek): ürün/lot listesi, **kritik stok & SKT uyarısı**.
- Klinik kayıtta kullanılan ürün+lot → **işleme bağlı otomatik stok düşümü** (trigger) + lot izlenebilirliği.

---

## Kabul kriterleri (Faz 2 "bitti")
- [ ] Anamnez güncellenir (versiyonlanır); profilde alerji/gebelik **uyarı bayrağı** görünür.
- [ ] İşlem türü tanımlanır (hazır şablon + özel alan); şema dinamik formu üretir.
- [ ] Klinik kayıt eklenir: SOAP + işleme özel parametreler (örn. lazer fluence/atış) saklanır; profil zaman tünelinde görünür.
- [ ] Onam varsa öncesi/sonrası foto yüklenir + karşılaştırılır; onam yoksa engellenir.
- [ ] Ürün+lot tanımlanır; klinik kayıtta kullanım → stok düşer + lot izlenir; kritik stok/SKT uyarısı çıkar.
- [ ] Tüm yeni tablolarda RLS doğrulanır (özellikle klinik veri rol kısıtı); `tsc` temiz; preview'da doğrulanır.

---

## Çalışma yöntemi
[Plan→Onay→Uygula]: onaylanınca **2.1 → 2.5 sırasıyla** uygulanır; her adımda migration + UI preview'da doğrulanır, ayrı commit. Klinik veri RLS'i her adımda test edilir (KVKK).
