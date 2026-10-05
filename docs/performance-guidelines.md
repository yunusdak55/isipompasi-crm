# Performans Kuralları (yeni panel / yeni sayfa yazarken)

Bu uygulamanın gecikmesinin neredeyse tamamı **Supabase'e giden ağ turlarından** gelir
(proje `eu-west-1`, her tur ~60-150 ms). Hız = ağ turu sayısını azaltmak ve
birbirine bağlı olmayanları **aynı turda** çalıştırmak.

## Sayfa yazarken
1. **Bağımsız sorguları `Promise.all` ile paralel çalıştır.** Art arda `await` = toplanan gecikme.
   Sadece gerçekten bir öncekinin sonucuna bağlı olan sorgu sırayla beklenir.
2. **Kimlik için `getCurrentProfile()` / `requireProfile()` kullan** (`src/lib/auth/session.ts`).
   Aynı istekte tek sefer çalışır (`cache()`), JWT'yi ağ turu olmadan yerelde doğrular
   (`getClaims()`), profil + firma adını tek sorguda getirir. **Sayfada `supabase.auth.getUser()` çağırma**;
   her çağrı Supabase Auth'a ayrı bir ağ turudur.
3. **Sayıları/toplamları JS'te değil veritabanında hesapla.** Tüm satırları çekip `filter/reduce`
   yapmak lead sayısıyla doğrusal yavaşlar. Örnek: `dashboard_stats()` ve `agency_company_stats()`
   (`SECURITY INVOKER` SQL fonksiyonu + `supabase.rpc(...)`; RLS aynen geçerli kalır).
4. **Listeleri sayfala / sınırla** (`.range()`, `.limit()`). Sınırsız `select` yazma.
   **DİKKAT:** PostgREST tek istekte en fazla **1000 satır** döndürür ve fazlasını **sessizce keser**
   (`.limit(5000)` bunu aşmaz). Tüm satırları toplaması gereken sorgular için
   `fetchAllRows` (`src/lib/data/paginate.ts`) kullan; sıralamayı benzersiz bir kolonla bitir (`.order("id")`).
   Mümkünse toplamı veritabanında hesapla (madde 3).
7. **Tarih/gün sınırı için `src/lib/time.ts` kullan** (`startOfDayTR`, `partsTR`, `monthStartTR`, `followupDateTR`).
   `setHours(0,0,0,0)`, `getDate()`, `toLocaleDateString()` **sunucu saat dilimini** (Hostinger'da büyük olasılıkla UTC)
   kullanır: "bugün" 03:00'e kayar, ay/gün kovaları 3 saat sapar. Geliştirici makinesi Türkiye saatinde olduğu için
   yerelde HİÇ görünmez. `Intl.DateTimeFormat`'a daima `timeZone: "Europe/Istanbul"` ver.
5. **Server action'larda** bağımsız yazmaları paralel yap veya tek `insert([...])` ile birleştir
   (örnek: `logMeetingOutcomeAction`).
6. **Rotalara `loading.tsx` EKLEME** (2026-10-05'te hepsi kaldırıldı). İskelet tıklamada anında geliyordu ama React, bir
   Suspense yedeği gösterildikten sonra asıl içeriği **en az 300 ms** bekletir (`FALLBACK_THROTTLE_MS`): sunucu 100 ms'de yanıt
   verse de içerik 307–311 ms'den önce görünmüyordu. Şimdi geçiş sunucu yanıtı gelir gelmez tamamlanır; 150 ms'den uzun sürerse
   `NavProgress` şeridi (`src/components/layout/nav-progress.tsx`) görünür. Bir sayfa gerçekten yavaşsa (>1 sn) çözüm iskelet
   değil, sorgu turlarını azaltmaktır.
8. **Linklerde prefetch kapalı** (`prefetch={false}`; satırlarda `IntentLink`). Rotalar dinamik ve `loading.tsx`'siz olduğu
   için önceden çekilecek bir şey yok; açık bırakmak sayfa açılışında onlarca boş istek demekti.
9. **Periyodik/otomatik veri yenilemede `router.refresh()` kullanma.** Hafif bir Route Handler + `fetch` kullan
   (örnek: `/api/dashboard-today`, `DashboardLive`).
10. **Profili beklemeden veriyi başlat.** `const [profile, data] = await Promise.all([requireProfile(), getData()])`.
    Eskiden her sayfa önce profili bekliyor, veriyi ancak ondan sonra istiyordu = tıklama başına boşuna bir tur. Veri kullanıcının
    oturumuyla (RLS) okunduğu için güvenli; yönlendirme kontrolü `Promise.all`'dan hemen sonra yapılır. Veri firma kimliğine
    bağlıysa `requireProfileWithCompanyData` (JWT ipucu) kullan. **Service-role istemcisiyle okunan veriyi asla böyle başlatma.**
11. **Server action'da ilk okumaları birlikte yap:** `requireProfile()` + mevcut kaydı okuma + yardımcı aramalar tek
    `Promise.all`. Yazmalar bunlar dönüp kontroller geçmeden başlamaz.
12. **Satır ağırlıklı tabloları istemci bileşeni yap** (`"use client"`, veri prop'u). Sunucu bileşeni olarak 20 satırlık Leadler
    tablosu RSC yanıtına 139 KB hazır eleman ağacı yazıyordu; veri olarak 30 KB. Tarih/para biçimleri `lib/utils`'te Türkiye
    saatine sabit olduğu sürece sunucu ve tarayıcı aynı metni üretir (`TZ=UTC` ile sunucuyu çalıştırıp konsolu kontrol et).
13. **Giriş animasyonları içeriği bekletmesin.** `from { opacity: 0 }` + gecikme = o süre boyunca veri GÖRÜNMEZ. Satır
    gecikmesi en çok ~70 ms, süre ~150 ms; bölüm sıralaması (`.stagger`) toplam ~250 ms'yi geçmesin.

## Veritabanı (migration) yazarken
- RLS politikalarında **her zaman** `(select auth.uid())`, `(select private.current_user_role())`,
  `(select private.current_user_company_id())` biçimini kullan (satır başına değil, sorgu başına bir kez hesaplanır).
  (Yardımcılar `private` şemadadır — bkz. docs/security.md.)
- Aynı tablo + eylem için **birden fazla permissive politika bırakma**; `FOR ALL` yerine
  `insert / update / delete` ayrı yaz.
- Sık filtrelenen/sıralanan kolonlara ve `lead_id` gibi ilişki kolonlarına indeks ekle.
- **`profiles` tablosundaki `role`, `company_id`, `is_active` kolonları yalnızca admin tarafından değişir**
  (`trg_profiles_protect_privileged` tetikleyicisi). Yeni bir "kullanıcı kendi satırını güncelleyebilir"
  politikası yazarken bu tür ayrıcalıklı kolonları mutlaka koru.
- Migration sonrası Supabase performans denetimini çalıştır:
  `GET https://api.supabase.com/v1/projects/<ref>/advisors/performance` (Personal Access Token ile).

## Görsel / istemci
- Büyük görselleri kullanılacak boyutun ~2 katına küçült (logo 297 KB → 6 KB oldu). `public/` altındaki
  görseller 1 gün önbelleklenir (`next.config.mjs` → `headers()`).
- Büyük, kaydırılan yüzeylerde `backdrop-blur` kullanma (kaydırma takılması).
