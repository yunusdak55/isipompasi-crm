# Performans ve Veri Koruması Raporu — 2026-10-05

Dal: `claude/kusursuz-panel` (main'e **birleştirilmedi**, canlıya çıkmadı).
Canlı veritabanında yalnızca okuma yapıldı; hiçbir kayıt, ayar ya da migration değiştirilmedi.

## Özet

"Donma / kasma"nın kaynağı sunucu, veritabanı ya da hosting değil; **istemci tarafındaki üç ayar/desen**:

1. Prefetch edilen iskeletler 30 sn'de bayatlıyordu → 30 sn'den uzun durulan sayfada tıklama **~0,5 sn hiçbir tepki vermiyordu**.
2. Dashboard'daki otomatik yenileme (`router.refresh()`) her seferinde 13–26 isteklik bir prefetch dalgası başlatıyordu; boşta duran sekme **117 sn'de 64 istek** attı.
3. Saatlik oturum yenilemesi, paralel istekler yüzünden **4–5 kat** çalışıyordu (bir kez de `http_400` ile başarısız oldu).

> **Not (aynı gün, ikinci tur):** aşağıdaki ilk turun iki önlemi — iskelet ömrünü uzatmak ve satır linklerinde "fare üstüne gelince prefetch" — ikinci turda yerini daha köklü bir çözüme bıraktı (iskeletler tamamen kaldırıldı). Güncel durum için "İkinci tur — genel hız taraması" bölümüne bakın.

Üçü de bu dalda düzeltildi. Düzeltme sonrası ölçüm **yerelde** (üretim derlemesi + izole test veritabanı) yapıldı: bkz. "Düzeltme sonrası ölçüm". Canlıdaki "sonra" ölçümü main'e birleştirmeden sonra yapılacak.

## Akış (anlaşıldığı haliyle)

WhatsApp mesajı → n8n "WhatsApp Lead Intake" (AI Agent; firma hizmet/soruları `product_categories`'ten okunur) → Supabase'e `service_role` ile yazar (`leads` ara/ekle/güncelle + `activities` not) → panel (Next.js 16, Hostinger) veriyi sunucu tarafında RLS'li kullanıcı oturumuyla okur. Tarayıcı Supabase'e hiç bağlanmaz.

## Ölçümler (düzeltme öncesi, canlı)

### Altyapı — sorun yok

| Ölçüm | Değer |
|---|---|
| Hostinger planı / konum | Business, **Europe (France)**, 2 çekirdek, 3072 MB |
| CPU / RAM (son 1 saat ort.) | **%1** / 160–225 MB |
| Süreç başlangıcı (son deploy'dan beri ~15 saat) | 2 kez: 04.10 22:33 (deploy), 05.10 03:10 |
| `/login` TTFB (dışarıdan, 8 örnek) | 7'si 0,31–0,41 sn, 1'i 0,85 sn (TLS ~0,14 sn dahil) |
| Supabase Performance Advisor | 0 hata, 0 uyarı, 7 bilgi |
| Supabase Security Advisor | 0 hata, 1 uyarı (içeriğine bakılamadı) |
| Veri hacmi | 311 lead, 1 firma; cache hit %99,97 |

### Sayfa geçişleri (Chrome, giriş yapılmış, sidebar tıklamaları)

| Ölçüm | Değer |
|---|---|
| Sıcak geçiş, `_rsc` TTFB (20 geçiş) | 105–541 ms |
| Sıcak geçiş, yanıt tamam | 231–667 ms |
| `/dashboard` tam sayfa yükleme TTFB | 970 ms (`/` üzerinden yönlendirmeyle 1902 ms) |
| Dashboard açılışında `_rsc` prefetch sayısı | ilk 5 sn'de 25 |
| Leadler sayfasına geçişte ek prefetch | ~1 sn içinde 13 (her satır linki için 2 istek) |

### Kök neden 1 — "ölü tıklama"

Aynı tıklama, sayfada bekleme süresine göre:

| | URL + iskelet | İçerik |
|---|---|---|
| Sayfada < 30 sn (iskelet önbellekte) | **8 ms** | 494 ms |
| Sayfada 38 sn (iskelet bayat) | **497 ms** | 1041 ms |

`next.config.mjs` içinde `staleTimes.static: 30` vardı. Bu değer sayfa verisinin değil, prefetch edilen `loading.tsx` iskeletlerinin ömrü (Next.js dokümanı: "Loading boundaries are considered reusable for the `static` period"). Önceki bir turda "istemci önbelleğini etkisiz kıl" niyetiyle en düşük değere çekilmiş.

Not: ölçüm sentetik tıklamayla yapıldı. Gerçek farede Next.js, link üzerine gelince bayat iskeleti yeniden ister; bu gecikmeyi kısaltır ama kaldırmaz.

### Kök neden 2 — yenileme fırtınası

Dashboard'da hiçbir şeye dokunmadan 117 sn: **64 istek**. Her `router.refresh()` sonrası 13–26 prefetch yeniden atıldı. Yenilemelerden biri **4124 ms** sürdü (aynı andaki 5 isteğin hepsinde TTFB ~2,3 sn); diğerleri 647 ms ve 1040 ms. Sekmeye geri dönüp hemen menüye tıklayan kullanıcı tam bu dalganın içine düşüyor.

### Kök neden 3 — paralel oturum yenilemesi (Hostinger `[PERF]` logları)

| Zaman | Eşzamanlı `auth_token_refresh` | Her biri | Ara katman toplamı |
|---|---|---|---|
| 12:49:40 | 4 | 487–660 ms | 645–807 ms |
| 14:00:16 | 5 | 440–481 ms | 496–562 ms |
| 12:08:51 | 1 | 669 ms, **`http_400`** | — |

Erişim jetonu dolmak üzereyken tarayıcının paralel istekleri (sayfa + prefetch'ler) aynı eski çerezle gelir ve her biri kendi yenilemesini başlatır. 14:00:16'daki olay, yukarıdaki 4,1 sn'lik yenilemeyle aynı an. `http_400`, yarışan yenilemenin oturumu düşürebildiğini gösteriyor.

## Hipotezlerin durumu

| | Hipotez | Sonuç |
|---|---|---|
| H1 | LiveStamp `router.refresh()` fırtınası | **Doğrulandı** (kök neden 2) |
| H2 | Sidebar prefetch'leri sunucu CPU'sunda kuyruk yapıyor | Kısmen: istek sayısı yüksek (25/sayfa) ama CPU %1; kuyruk kanıtı yok. Asıl zararı kök neden 3 üzerinden |
| H3 | Hostinger boşta kapatıyor (cold start) | **Çürütüldü**: 15 saatte 2 başlangıç. Keep-warm kurulmadı |
| H4 | hcdn, nonce'lu CSP'yi eziyor | **Doğrulandı**: canlı başlık yalnızca `upgrade-insecure-requests`. Dokunulmadı (aşağıda) |
| H5 | Hostinger–Supabase mesafesi | **Çürütüldü**: Fransa ↔ İrlanda. Tek tek sorgular ara sıra 312–588 ms (yalnızca ≥300 ms loglanıyor; dağılım bilinmiyor) |
| H6 | OpenAI fetch'inde zaman aşımı yok | Doğru; 30 sn eklendi |

## Yapılanlar (bu dalda)

| Dosya | Değişiklik |
|---|---|
| `next.config.mjs` | `staleTimes.static` 30 → 300 (Next.js varsayılanı). `dynamic: 0` aynı; veri yine her tıklamada taze |
| `src/components/layout/sidebar.tsx` | `useLinkStatus` ile tıklanan menüde anında beliren nokta (iskelet önbellekte değilse bile tepki var) |
| `src/components/ui/intent-link.tsx` (yeni) + 13 liste/tablo dosyası | Satır linkleri görünür olunca değil, fare/odak/dokunma ile prefetch eder |
| `src/components/dashboard/dashboard-live.tsx` (yeni), `live-stamp.tsx`, `today-hero.tsx`, `dashboard/page.tsx` | Otomatik yenileme `router.refresh()` yerine tek istek |
| `src/app/api/dashboard-today/route.ts` (yeni) | O tek isteğin ucu: oturum + aktif profil şart, admin reddedilir, RLS'li istemci, `no-store` |
| `src/lib/supabase/session-single-flight.ts` (yeni), `src/proxy.ts` | Aynı oturum çereziyle gelen eşzamanlı istekler tek doğrulamayı/yenilemeyi paylaşır; yenilenen çerezler 20 sn gecikmeli isteklere de verilir |
| `src/app/(dashboard)/agent/actions.ts` | OpenAI çağrısına 30 sn zaman aşımı |
| `supabase/proposed/0033_…sql` (yeni) | Veri bütünlüğü önerisi — **uygulanmadı** |

Doğrulama: `npm run typecheck` temiz, `npm run lint` 0 hata (10 uyarı; öncesi 11), `npm run build` başarılı. Tek-uçuş mantığı ayrı bir simülasyonda sınandı: aynı çerezle 5 eşzamanlı istek → 1 yenileme; farklı kullanıcı ayrı; hata ve yenilemesiz sonuç saklanmıyor.

**Doğrulanmayanlar:** tarayıcıda giriş yapılmış halde hiçbir değişiklik çalıştırılmadı (yerelde `.env.local` yok, parola giremem). Dashboard'un istemci bileşenine taşınması ve proxy değişikliği en çok dikkat isteyen iki yer.

## Düzeltme sonrası ölçüm (yerel, 2026-10-05 14:48–14:58)

Ortam: `npm run build && npm run start` (localhost:3000), izole test projesi (PerfTest Firma, 5.000 lead), giriş yapılmış Chrome, sekme görünür. "Önce" sütunu canlıdan (Hostinger, 311 lead). **Ortamlar farklı olduğu için milisaniyeler birebir kıyaslanamaz; kıyaslanabilir olan davranıştır** (kaç istek gidiyor, iskelet sunucu beklenmeden geliyor mu).

| Ölçüm | Önce (canlı) | Sonra (yerel) |
|---|---|---|
| Dashboard boşta, giden istek | 117 sn'de **64** | 134 sn'de **2** (yalnızca `/api/dashboard-today`, 61. ve 121. sn; 563 ve 346 ms). Damga 14:48 → 14:50 |
| Uzun bekleyip menüye tıklama: URL + iskelet | 38 sn sonra **497 ms** | 179 sn sonra **12,7 ms** (içerik 545 ms) |
| 5 dk'dan uzun bekleyip tıklama (324. sn) | — | menüdeki nokta 1,3 ms, iskelet 25,6 ms, içerik 902 ms; ardından menü iskeletleri yeniden prefetch edildi |
| Dashboard açılışında `_rsc` prefetch (ilk 5 sn) | 25 | 19 (yalnızca 10 menü linki; satır linki 0) |
| Leadler sayfasında boşta prefetch | ~1 sn'de 13 | 5 sn'de **0** (ekranda 40 satır linki varken) |
| Satırın üzerine gelince / tıklayınca | — | yalnızca o satır için 2 istek; tıklamada iskelet 8,9 ms, içerik 448 ms |
| Damgaya tıklayıp elle yenileme | `router.refresh()` + 13–26 prefetch | 1 istek, 359 ms; düğme o sırada devre dışı |
| Sekmeden 22 sn ayrılıp geri dönme | prefetch dalgası; bir yenileme 4124 ms | gizliyken 0 istek, dönüşte 1 istek (253 ms) |
| 20 eşzamanlı oturumlu istek | — | 20/20 `200`, yönlendirme yok, oturum düşmedi |
| Konsol hatası | — | yok |

5 dakikayı aşan beklemede iskelet artık önbellekte değildir; yerelde 25,6 ms'de gelmesi sunucunun ilk baytının 17 ms olmasındandır. Canlıda bu süre sunucunun ilk baytı kadar olur (düzeltme öncesi `_rsc` TTFB 105–541 ms ölçülmüştü); o arada tıklanan menüdeki nokta anında belirir. Gerekirse sekme görünürken menü iskeletleri ~4 dakikada bir yenilenerek bu da kapatılabilir; önce canlıda ölçülmeli.

**Hâlâ doğrulanmayanlar:** gerçek bir saatlik jeton yenilemesi sırasında tek-uçuş (yalnızca simülasyon + yukarıdaki 20 eşzamanlı istek; yenileme anı zorlanamadı), boyama kaynaklı takılma, canlıdaki TTFB dağılımı, admin kullanıcı formundaki uyarının görünümü.

### Bilerek yapılmayanlar

- **CSP / `connection()`**: canlıda etkisiz olduğu doğru, ama kaldırmak bir güvenlik katmanını (CDN kapatılırsa yeniden işleyecek) ölçülmüş bir kazanç olmadan silmek olurdu.
- **Keep-warm cron**: cold start kanıtı yok.
- **`PERF_LOG_ALL=1`**: canlı ortam değişkeni + yeniden başlatma gerektirir; kök nedenler onsuz bulundu.

## Veri koruması

| Konu | Durum |
|---|---|
| Çift lead | Şu an **yok** (ham ve normalize sayım: 0) |
| Telefon biçimi | 310 kayıt `05XXXXXXXXX`, 1 kayıt `+90XXXXXXXXXX` → düz metin eşleşmesi aynı kişiyi kaçırabilir |
| `(company_id, phone)` tekilliği | Yok; yalnızca `idx_leads_phone` |
| Supabase planı | **Free** → otomatik yedek ve PITR yok |
| Yerel yedek | **Düzeltildi (05.10 14:28).** launchd `com.iklimlen.dbbackup` çalışıyordu ama 02–05 Ekim arasında canlıyı değil **test projesini** yedekliyordu (aşağıya bkz.) |
| Yedeğin çalıştığı yer | `/Users/yunusdak/Projects/iklimlen-crm` |

Yedekler tek bir diskte duruyor; o Mac kaybolursa yedek de gider.

**Düzeltme (aynı gün, sonraki oturum):** bu raporun ilk hali "yerel yedek çalışıyor, sonuncusu 05.10 00:16" diyordu; klasörlerin içeriğine bakılınca yanlış çıktı. `scripts/backup-db.mjs` `.env.local`'i okuyordu ve o dosya 01.10 akşamı izole test projesine çevrilmişti: 02, 03 ve 05 Ekim klasörlerinde canlı veri değil "PerfTest Firma" (5.000 sahte lead) var, 02 Ekim yarım, 04 Ekim boş (ağ hatası). Son gerçek canlı yedek 01.10 03:12'ydi. Yapılanlar: betik artık canlı ayar dosyasını (`.env.production-backup.local`) okur, hedef canlı proje değilse **durur**, ağ hatasını tekrar dener, yarım klasör bırakmaz, `manifest.json` yazar; gece görevi başarısız olursa ekranda bildirim çıkar. 05.10 14:28'de taze canlı yedek alındı (311 lead, 807 satır). Yanıltıcı klasörler silinmedi, adlarına `-TEST` / `-BOS` eklendi.

**İkinci kopya (05.10 14:41):** her yedek artık tek dosya olarak canlı projedeki özel `db-backups` Storage kovasına da yükleniyor. Doğrulandı: kova `public: false`, anahtarsız indirme/listeleme reddediliyor, herkese açık adres kapalı, indirilen arşiv yerel klasörle birebir aynı. Sınırı: kopya veritabanıyla aynı Supabase hesabında ve gece görevi bu Mac'te çalışıyor; Mac kapalıysa yeni yedek alınmaz.

`supabase/proposed/0033_lead_phone_unique_and_agent_upsert.sql` iki şey önerir: (A) firma başına telefonun son 10 hanesi üzerinden UNIQUE indeks, (B) agent için yalnızca kontrattaki alanlara yazan atomik `agent_upsert_lead` RPC'si (yalnızca `service_role` çağırabilir). İlk turda hiçbir veritabanında çalıştırılmamıştı. **Sonraki oturumda izole test projesine uygulandı ve sınandı** (`npx tsx scripts/verify-lead-phone-unique.mts`, 23/23): aynı firmada aynı numara `05…` / `+90…` / boşluklu / parantezli yazılsa da ikinci kez eklenemiyor, başka firmada serbest, 10 eşzamanlı ekleme tek lead üretiyor; RPC ismi ezmiyor, notları alta ekliyor, insan alanlarına dokunmuyor ve yalnızca `service_role` çağırabiliyor. Panelde bu durumda artık "Bu telefon numarası bu firmada zaten kayıtlı…" mesajı çıkıyor (`leads/actions.ts`); yerelde ekranda denendi (var olan `5300004782` numarası `+90 530 000 47 82` olarak girildi → reddedildi, lead sayısı 5.000'de kaldı). **Canlıya henüz uygulanmadı:** canlıda çift numara olmadığı yeniden doğrulandı (311 lead, 0 çift, hepsi ≥10 hane) ve taze yedek alındı, ancak uygulama komutu izin katmanında reddedildi; SQL'i Supabase SQL Editor'de kullanıcının çalıştırması gerekiyor. Uygulandıktan sonra dosya `supabase/migrations/` altına taşınmalı ve n8n akışı tek `agent_upsert_lead` çağrısına indirilmeli (bkz. `docs/whatsapp-agent-contract.md`).

## İkinci tur — genel hız taraması (2026-10-05 öğleden sonra)

Amaç: tıklama gecikmesi dışında kalan bütün beklemeleri bulmak. Yöntem: (1) her rotayı yerel üretim derlemesinde 5'er kez ölçmek, (2) sunucunun her Supabase çağrısını `PERF_LOG_ALL=1` ile kaydedip sayfa başına sıralı tur sayısını çıkarmak, (3) canlı veritabanında `pg_stat_statements` ile yavaş sorgu aramak (salt okunur), (4) canlı sitenin şu anki sürelerini tarayıcıdan ölçmek (salt okunur), (5) gerçek tıklamalarda "içerik ne zaman görünüyor"u ölçmek.

### Bulunan kök nedenler

| # | Kök neden | Kanıt |
|---|---|---|
| 1 | **Her sayfa önce profili bekliyor, veriyi sonra istiyordu** (tıklama başına boşuna bir Supabase turu); bazı sayfa ve kaydetme işlemlerinde 3–7 sıralı tur | Sunucu kaydı: `/dashboard` = `profiles` 94 ms → `dashboard_today` 97 ms (art arda). Lead düzenle: profil → lead → kategoriler |
| 2 | **`loading.tsx` iskeleti içeriği en az 300 ms bekletiyordu.** React, bir Suspense yedeği gösterildikten sonra asıl içeriği 300 ms'den önce göstermez (`FALLBACK_THROTTLE_MS = 300`, react-dom 19.2.8) | Sunucu 90–140 ms'de yanıt verirken içerik hep 307 / 308 / 311 ms'de göründü (üç farklı sayfa, aynı taban) |
| 3 | **Giriş animasyonları içeriği gizliyordu:** `.stagger` 420 ms + 340 ms'ye varan gecikme; satırlar 25 ms × 12 + 220 ms; grafikler 760–900 ms | CSS'ten: son bölüm içerik geldikten 760 ms, son satır 520 ms sonra tam görünür |
| 4 | **Satır tabloları RSC yanıtını şişiriyordu:** Leadler 20 satır için 139 KB (sınıf adları tek başına 63 KB; her satır mobil + masaüstü iki kez) | Canlıda Leadler ve Satışlar, benzer sorgu sayılı sayfalardan ~120–190 ms geç bitiyor |
| 5 | Alan adı kökü (`/`) açılışında sayfa render edilip profil sorgusu bekleniyor, sonra yönlendiriliyordu | Canlı: `/` üzerinden 1005–1902 ms, doğrudan `/dashboard` 970 ms |

Sorun olmadığı görülenler: canlı veritabanında uygulama sorguları hızlı (`dashboard_stats` ort. 5,3 ms, `dashboard_today` 9,8 ms; en çok zaman alanlar Supabase panelinin kendi sorguları). Yani gecikme sorgu süresi değil, **tur sayısı**.

### Yapılanlar

| Alan | Değişiklik |
|---|---|
| Tüm sayfalar (25 rota) | Profil ile veri aynı `Promise.all`'da. Firma kimliğine bağlı veride JWT ipucu (`getClaimsCompanyHint`, `requireProfileWithCompanyData`); lead detayda atama listeleri + satış kaydı da ilk tura alındı |
| Kaydetme işlemleri (`leads/actions.ts`) | Görüşme sonucu, ertele, takibi kaldır, görüşen kişi, satış, ajan notu: ilk okumalar tek turda. Görüşme sonucu (takip) 5 → 3, satış 7 → 4, görüşen kişi 5 → 3 sıralı tur |
| `/api/dashboard-today` | Profil ile veri aynı turda |
| `src/proxy.ts` | Girişli kullanıcı `/` adresinden rolüne göre doğrudan yönlendirilir (JWT rol ipucu). Yönlendirme yanıtları artık tazelenen oturum çerezlerini de taşır |
| Rotalar | 24 `loading.tsx` kaldırıldı; yerine `NavProgress` (yalnızca geçiş 150 ms'yi aşarsa görünen şerit). Linklerde prefetch kapalı (boş istekler bitti) |
| `lead-table`, `sales-table` | İstemci bileşeni: yanıtta eleman ağacı yerine veri (Leadler 139 → 30 KB) |
| `globals.css` + 23 bileşen | `.stagger` 420 → 180 ms, gecikme en çok 80 ms; satır gecikmesi 25 → 6 ms/satır; `slide-up` 220 → 150 ms; grafik çizimleri 760–900 → 320–400 ms |
| `lib/data/paginate.ts` | 1000 satırı aşan tablolarda ikinci paralel grup 2 → 5 sayfa (5.000 satır: 3 → 2 tur) |

### Önce / sonra — sunucu yanıtı (yerel, test veritabanı 5.000 lead, 5 ölçüm medyanı, tam RSC yanıtı)

| Sayfa | Önce | Sonra | |
|---|---|---|---|
| Dashboard | 227 ms | 142 ms | −37% |
| Leadler | 216 ms · 139 KB | 141 ms · 30 KB | −35% |
| Leadler (filtreli) | 203 ms | 131 ms | −35% |
| Lead detay | 209 ms | 119 ms | −43% |
| Lead düzenle | 284 ms | 105 ms | −63% |
| Yeni lead | 181 ms | 97 ms | −46% |
| Keşifler | 176 ms | 96 ms | −45% |
| Gecikenler | 274 ms | 171 ms | −38% |
| Takvim | 324 ms | 250 ms | −23% |
| Kanban | 308 ms | 227 ms | −26% |
| Takipte | 464 ms | 404 ms | −13% |
| Satışlar | 548 ms | 358 ms | −35% |
| Raporlar | 822 ms | 562 ms | −32% |
| Dijital Ajan | 671 ms | 513 ms | −24% |
| Firma Ayarları | 197 ms | 101 ms | −49% |

Takipte / Takvim / Kanban / Raporlar / Ajan'ın kalan süresi 5.000 lead'lik veri hacminden (0,4–0,6 MB yanıt, sayfalı okuma); canlıdaki 311 lead'de bu sayfalar tek turdur.

### Önce / sonra — tıklamadan içeriğin görünmesine (yerel, gerçek tıklama, Chrome, sekme görünür)

| | Önce | Sonra |
|---|---|---|
| Dashboard | 307 ms | 143–155 ms |
| Leadler | 311 ms | 127–163 ms |
| Firma Ayarları | 308 ms | 112–141 ms |
| Lead satırı → detay | 448 ms (ilk açılış) | 168 ms |
| Satır ve metinlerin tamamen görünmesi (içerik geldikten sonra) | +520 ms (satırlar), +760 ms (bölümler) | +150–220 ms |
| Yavaş sayfa (Raporlar ~630 ms) | iskelet | şerit 220. ms'de görünüyor, içerik gelince kayboluyor |
| Sayfa açılışında boş prefetch isteği | 19 | 0 |

Kaydetme işlemleri (yalnızca "sonra" ölçüldü; "önce" koddan sayılan tur sayısıdır): ertele 545 ms (5 → 3 tur), yalnızca not 487 ms (4 → 3), not + takip 700 ms (5 → 3). Üçü de ekranda doğrulandı (zaman çizelgesi ve takip tarihi doğru).

### Canlı sitenin bugünkü hali (eski kod, 311 lead; "önce" — tarayıcıdan, İstanbul)

| Sayfa | Yanıt tamam | Boyut |
|---|---|---|
| Dashboard | 363 ms | 75 KB |
| Leadler | 483 ms | 143 KB |
| Kanban | 359 ms | 142 KB |
| Takipte | 358 ms | 63 KB |
| Lead detay | 332 ms | 32 KB |
| Yeni lead | 267 ms | 19 KB |
| Satışlar | 528 ms | 172 KB |
| Raporlar | 347 ms | 64 KB |
| Dijital Ajan | 330 ms | 15 KB |
| Firma Ayarları | 322 ms | 30 KB |
| `/` ile açılış (belge TTFB) | 1005 ms | — |


### Canlıda "sonra" (yeni kod d7665a6, 16:07:42'de yayına girdi; aynı tarayıcı, aynı hesap)

Sunucu tarafı (CDN'in bildirdiği `x-hcdn-upstream-rt`): sayfalarda ilk bayt **30–47 ms**, `/api/dashboard-today` (tek veritabanı turu, tam yanıt) **109 ms**, veritabanına gitmeyen istek 23 ms. Gerçek tıklamalarda 202 isteğin TTFB'si: ortanca **104 ms**, p90 169 ms.

| Tıklamadan içeriğe (gerçek tıklama, 3'er ölçüm) | Önce (eski kod) | Sonra |
|---|---|---|
| Dashboard | 494 ms (iskelet taze) – 1041 ms (iskelet bayat) | 201 / 224 / 225 ms |
| Takvim | — | 163 / 179 / 180 ms |
| Leadler | — | 268 / 360 / 396 ms |
| Firma Ayarları | — | 256 / 308 / 315 ms |
| Raporlar | — | 317 / 322 / 426 ms |
| Gecikenler | — | 201 / 363 / **1503** ms |
| Takipte | — | 393 / 427 / **1508** ms |
| Satışlar | — | 394 / 564 / **1610** ms |
| Sayfa açılışında prefetch isteği | 25 | 0 |

Tam RSC yanıtı (layout dahil, medyan): Leadler 483 → 270 ms (143 → 29 KB), Satışlar 528 → 340 ms (172 → 57 KB), Takipte 358 → 287 ms, Gecikenler 322 → 245 ms, Lead düzenle 320 → 257 ms. Dashboard, Takvim, Kanban ve Raporlar'da fark ölçüm gürültüsünün içinde kaldı (ikinci ölçümde aynı sayfalar ±100 ms oynadı; nedeni aşağıda).

### Kalan takılma: Türkiye → Avrupa ağ yolu (uygulama / sunucu / veritabanı değil)

Canlıda isteklerin ~%1'inde **1,1–1,5 sn**'lik duraklama var (yukarıdaki kalın değerler). Kaynağı ayrıştırıldı:

| Hedef (aynı bilgisayardan, HTTP/2, ardışık istekler) | İstek | 600 ms üstü duraklama |
|---|---|---|
| Cloudflare İstanbul ucu | 1500 | 1 (%0,07) |
| AWS Frankfurt | 300 | 1 (%0,33) |
| AWS Paris | 300 | 2 (%0,67) |
| AWS İrlanda | 300 | 2 (%0,67) |
| Hostinger CDN (panelin sabit CSS dosyası) | 1500 | 12 (%0,8) |

- Duraklama, sunucuya hiç uğramayan sabit dosyada da aynı oranda çıkıyor (tarayıcıda: sabit dosya 1/70, `robots.txt` 1/70, veritabanlı API 1/70).
- Avrupa'daki **her** hedefte var, İstanbul'daki uçta yok denecek kadar az. `ping`: modem %0 kayıp, 1.1.1.1 %0, Hostinger ucu %0,7–3,3 kayıp ve 1,1 sn'ye varan gecikme.
- Yani kaynak, bu bağlantının (Türk Telekom) yurt dışı yolundaki paket kaybı/gecikmesi. Sunucuyu Avrupa içinde başka bir şehre (Milano dahil) taşımak bunu değiştirmez.
- Bu turun dolaylı kazancı: eskiden her sayfa görüntüleme aynı bağlantıdan ~25 istek atıyordu; her biri bu duraklamaya yakalanabiliyor ve yakalanınca aynı bağlantıdaki diğer istekleri de bekletiyordu. Şimdi tıklama başına tek istek var.
- Kalıcı çare adayı: kullanıcı bağlantısını Türkiye içinde karşılayan bir uç (ör. İstanbul'da ucu olan bir CDN) kullanmak. Alan adının DNS'ini değiştirmeyi gerektirir; etkisi denenmeden bilinemez.

Veritabanı konumu için yeni veri: tek veritabanı turu sunucu tarafında ~85 ms (109 − 23). Paris ↔ İrlanda ağ gidiş-dönüşü bunun tahminen 15–20 ms'si; gerisi Supabase API katmanı. Veritabanını Paris'e taşımanın getirisi tur başına bu kadar.

### Doğrulama

`npm run typecheck` temiz · `npm run lint` 0 hata (10 eski uyarı) · `npm run build` başarılı · `scripts/smoke-routes.mts` (firma sahibi, satış personeli, ajans admin, boş firma, bozuk girdiler) **tüm sayfalar sağlam** · sunucu `TZ=UTC` ile (Hostinger gibi) çalıştırılıp 10 sayfa tam yüklendi: konsolda hata / hydration uyarısı yok · sunucu kaydında başarısız çağrı yok.

### Bu turda bulunup düzeltilen diğer hatalar

- **Tanımsız renk tonları:** `accent-400` 49 yerde, `ink-500` 14 yerde (ve 11 ton daha) kullanılıyor ama temada tanımlı değildi; Tailwind sınıf üretmediği için bu vurgular (aktif menü ikonu, bekleme noktası, hata sayfası metni) renksiz kalıyordu. Ara tonlar eklendi.
- **Yönlendirmede kaybolan oturum çerezi:** proxy yönlendirme yanıtı, aynı istekte tazelenen çerezleri taşımıyordu.
- Gece yedeğinin 4 gece test veritabanını yedeklemesi ve lead formundaki "çift telefon" mesajı (yukarıda "Veri koruması").

### Sunucu konumu (İstanbul'dan ölçüm, Türk Telekom, TCP bağlantı süresi, 12 ölçüm medyanı)

| Bölge | Gecikme |
|---|---|
| Milano | 42 ms |
| Frankfurt | 52 ms |
| Paris | 57 ms |
| Zürih | 64 ms |
| Londra | 69 ms |
| İrlanda (veritabanının şu anki yeri) | 83 ms |

Hostinger'ın Türkiye'de veri merkezi yok; Avrupa'da Fransa, Almanya, Litvanya, Hollanda, Birleşik Krallık var ve konum hPanel'den ücretsiz taşınabiliyor. Supabase'te bölge sonradan değiştirilemiyor (yeni proje + veri taşıma gerekir); Frankfurt (`eu-central-1`) mevcut. Tarayıcı açısından Fransa ile Almanya arasındaki fark ~5 ms; asıl kazanç **sunucu ile veritabanını aynı şehre koymak** (şu an Fransa ↔ İrlanda, her sorgu turunda tahmini 15–20 ms): Hostinger Almanya + Supabase Frankfurt. Beklenen kazanç etkileşim başına ~20–80 ms; karşılığı bir veritabanı taşıması (yeni anahtarlar, kullanıcı hesapları, n8n bağlantısı). Öneri: önce bu turdaki kod değişikliklerini canlıda ölçmek; taşıma ancak ondan sonra da gerek görülürse.

## Sana kalan adımlar

1. **Yerelde dene** (canlı veritabanına bağlı olacağı için yalnızca gezin, kayıt oluşturma/düzenleme yapma):
   `cp /Users/yunusdak/Projects/iklimlen-crm/.env.local .env.local && npm run build && npm run start`, sonra `localhost:3000`'de giriş yap. Bakılacaklar: Dashboard açılıyor ve damga dakikada bir güncelleniyor mu; DevTools → Network'te `_rsc` filtresiyle boşta dururken istek akıyor mu (beklenen: yalnızca dakikada bir `/api/dashboard-today`); bir sayfada 1 dk durup menüye tıklayınca iskelet anında geliyor mu.
2. **main'e birleştirme onayı.** Onaydan sonra canlıda aynı ölçümleri tekrarlayıp bu rapora "sonra" sütununu eklerim.
3. **Karar:** aynı firmada aynı telefonla ikinci lead açılabilsin mi? Hayırsa 0033'ü önce yerelde deneyip, `npm run backup` sonrası uygularız; ardından n8n akışındaki "ara / ekle / güncelle / aktivite" adımları tek `agent_upsert_lead` çağrısına iner.
4. **Supabase Auth ayarları** (ben okuyamadım): "Allow new users to sign up" kapalı mı, Site URL `https://panel.iklimlen.com` mi, legacy API anahtarları devre dışı mı (`docs/security.md` madde 1, 2, 5). Security Advisor'daki 1 uyarıya da bak.
5. **Yedek:** Pro plana geç (günlük yedek + PITR) ya da en azından `backups/` klasörünü ikinci bir yere (şifreli bulut/disk) kopyalat.
6. Supabase SQL Editor'de "Untitled query" adlı özel bir sorgu kaldı (salt-okunur sayım sorgusu); silebilirsin.

## Hâlâ bilinmeyenler

- **Boyama (paint) kaynaklı takılma** ölçülemedi: test sekmesi çoğu zaman `hidden` durumdaydı. JS tarafında uzun görev kaydedilmedi, ama bu görsel takılma olmadığını kanıtlamaz.
- Tam sayfa yüklemede 970 ms TTFB'nin katman dağılımı (proxy / layout sorguları / render) ayrıştırılmadı.
- 4,1 sn'lik yenilemenin sunucu logunda görünen kısmı ~1 sn; kalan ~1,3 sn'nin nerede geçtiği (LiteSpeed/Passenger kuyruğu?) bilinmiyor.
