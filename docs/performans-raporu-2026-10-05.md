# Performans ve Veri Koruması Raporu — 2026-10-05

Dal: `claude/kusursuz-panel` (main'e **birleştirilmedi**, canlıya çıkmadı).
Canlı veritabanında yalnızca okuma yapıldı; hiçbir kayıt, ayar ya da migration değiştirilmedi.

## Özet

"Donma / kasma"nın kaynağı sunucu, veritabanı ya da hosting değil; **istemci tarafındaki üç ayar/desen**:

1. Prefetch edilen iskeletler 30 sn'de bayatlıyordu → 30 sn'den uzun durulan sayfada tıklama **~0,5 sn hiçbir tepki vermiyordu**.
2. Dashboard'daki otomatik yenileme (`router.refresh()`) her seferinde 13–26 isteklik bir prefetch dalgası başlatıyordu; boşta duran sekme **117 sn'de 64 istek** attı.
3. Saatlik oturum yenilemesi, paralel istekler yüzünden **4–5 kat** çalışıyordu (bir kez de `http_400` ile başarısız oldu).

Üçü de bu dalda düzeltildi. **Düzeltme sonrası ölçüm henüz yapılamadı** (neden ve nasıl yapılacağı: "Sana kalan adımlar").

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
| Yerel yedek | Çalışıyor: launchd `com.iklimlen.dbbackup`, son 7 gün mevcut, sonuncusu 05.10 00:16 |
| Yedeğin çalıştığı yer | `/Users/yunusdak/Projects/iklimlen-crm` (bu repo değil; orada commit'lenmemiş değişiklikler var) |

Yedekler tek bir diskte duruyor; o Mac kaybolursa yedek de gider.

`supabase/proposed/0033_lead_phone_unique_and_agent_upsert.sql` iki şey önerir: (A) firma başına telefonun son 10 hanesi üzerinden UNIQUE indeks, (B) agent için yalnızca kontrattaki alanlara yazan atomik `agent_upsert_lead` RPC'si (yalnızca `service_role` çağırabilir). **Bu SQL hiçbir veritabanında çalıştırılmadı** (Docker yok); uygulamadan önce yerel Supabase'de denenmeli.

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
