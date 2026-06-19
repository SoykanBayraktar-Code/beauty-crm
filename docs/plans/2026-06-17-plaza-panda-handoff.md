# PLAZA PANDA Teslim Paketi — Yönetici Girişi Entegrasyonu

- **Tarih:** 2026-06-17
- **Taraflar:** WOOWCODE (CRM) ↔ PLAZA PANDA (biguzelliklara.com sitesi) ↔ Bi Güzellik Lara (sahip)
- **Kapsam:** Siteye "Yönetici Girişi" butonu + panel alt alanı (`panel.biguzelliklara.com`).
- **İlke:** PLAZA PANDA yalnız aşağıdaki **2 şeyi** uygular; CRM kodu/DB/anahtarları **görmez**.

> **Önemli:** Bu paketteki hiçbir şey gizli değildir (sadece bir DNS kaydı + bir bağlantı). CRM iç yapısı WOOWCODE'da kapalı kalır.

---

## PLAZA PANDA'ya gönderilecek metin (kopyala-gönder)

> Merhaba PLAZA PANDA ekibi,
> biguzelliklara.com'a güzellik merkezinin yönetim paneline (CRM) giriş için küçük bir entegrasyon yapacağız. Sizden **2 küçük şey** rica ediyoruz; gerisi bizde. Hiçbir kod/sır paylaşımı yok.

### 1) DNS kaydı (alan adı yöneticisi)
`biguzelliklara.com` DNS yönetiminde tek bir kayıt:

| Tür | Ad / Host | Değer / Hedef | TTL |
|---|---|---|---|
| `CNAME` | `panel` | `cname.vercel-dns.com` | Auto/3600 |

*(Bu, `panel.biguzelliklara.com`'u bizim güvenli sunucumuza yönlendirir. SSL'i biz hallederiz.)*

### 2) "Yönetici Girişi" butonu (footer'a)
Sitenin **footer**'ına aşağıdaki bağlantıyı ekleyin (diskret, küçük bir link yeterli):

**Sade sürüm:**
```html
<a href="https://panel.biguzelliklara.com/login" target="_blank" rel="noopener noreferrer">
  Yönetici Girişi
</a>
```

**Tailwind'li öneri (sitenizin stiline uyarlayın):**
```html
<a href="https://panel.biguzelliklara.com/login"
   target="_blank" rel="noopener noreferrer"
   class="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors">
  <!-- opsiyonel kilit ikonu -->
  Yönetici Girişi
</a>
```

- Yeni sekmede açılmalı (`target="_blank"`), `rel="noopener noreferrer"` kalmalı.
- Konum: footer (üst menüye koymanıza gerek yok; bu personele yönelik bir giriştir).

> Hepsi bu kadar. URL'e tıklayan personel kendi e-posta + şifresiyle panele girer. Teşekkürler!

---

## PLAZA PANDA'nın YAPMAYACAĞI / GÖRMEYECEĞİ
- ❌ CRM kaynak kodu · ❌ veritabanı · ❌ API/Supabase anahtarı · ❌ personel hesapları
- ❌ Sunucu/Vercel erişimi · ❌ herhangi bir gizli yapılandırma
- ✅ Yalnız: 1 DNS CNAME + 1 footer linki.

## WOOWCODE tarafı (bizde kalan işler)
1. CRM'i Vercel'e deploy et → `panel.biguzelliklara.com` domainini Vercel projesine ekle (SSL otomatik).
2. PLAZA PANDA CNAME'i ekleyince Vercel doğrulamayı tamamlar.
3. `panel` alt alanına **`noindex`** (arama motorunda çıkmasın).
4. İlk yönetici hesabını `/setup` ile oluştur; personeli Ayarlar → Personel'den ekle.
5. Uçtan uca test: site footer butonu → panel login → giriş.

## Doğrulama
- `panel.biguzelliklara.com/login` açılıyor + SSL yeşil.
- Footer butonu yeni sekmede login'i açıyor.
- Personel e-posta+şifre ile giriş yapıp panele ulaşıyor.
