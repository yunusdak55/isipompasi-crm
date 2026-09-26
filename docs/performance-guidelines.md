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
6. Her yeni sayfaya bir `loading.tsx` ekle; sidebar bağlantıları prefetch'lidir, iskelet anında gelir.
   İstemci önbelleği `next.config.mjs` → `staleTimes.dynamic = 0` ile kapalıdır, veri hep taze gelir.

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
