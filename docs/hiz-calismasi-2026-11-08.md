# Hız çalışması: CRM ve iklimlen.com (2026-11-08)

Hedef: panel.iklimlen.com ve iklimlen.com'u Türkiye'den her tıklamada hızlı açılır hale getirmek.

## 1. Bir tıklamada zaman nereye gidiyor

Ölçümler Türkiye'den (bu Mac) ve Hostinger çalışma zamanı günlüklerinden alındı.

| Katman | Normal | Ara ara | Kaynak |
|---|---|---|---|
| Türkiye → Hostinger CDN ucu (bağlantı) | ~60 ms | yeni bağlantıların ~%10-15'inde +1 sn | curl, 25'er örnek |
| Hostinger sunucusu (Fransa), sayfa hazırlama | 30-45 ms | isteklerin ~%15'inde 0,5-2,2 sn | `x-hcdn-upstream-rt`, 20'şer örnek |
| Sunucu → Supabase (İrlanda), bir veritabanı turu | ~85 ms | 300-1040 ms | `[PERF]` günlükleri, Ekim raporu |
| Oturum yenileme (saatte bir) | — | ~1 sn | `auth_token_refresh duration=1042ms` |

Notlar:
- Hostinger'daki ara sıra beklemeler veritabanına hiç gitmeyen `robots.txt`'te de görüldü. İki ayrı Node uygulamasında (CRM ve iklimlen.com) aynı oranda var. Yani koddan değil, paylaşımlı sunucudan geliyor.
- Uygulama uyuyup yeniden başlamıyor: 11 dakika boşta kaldıktan sonra bile 44 ms'de cevap verdi.
- Yeni bağlantılardaki 1 saniyelik kayıp Cloudflare'e bağlanırken de görüldü (1/25). Bir kısmı yerel internet hattından geliyor.
- İrlanda'nın kendi payı her veritabanı turunda 15-20 ms. Supabase'in İstanbul ya da Türkiye bölgesi yok (en yakını Frankfurt ve Zürih). Hostinger'ın da Türkiye'de veri merkezi yok.
- Merihe paneli hızlı, çünkü veritabanı sunucunun içinde bir dosya; arada ağ yok.

## 2. Kodda yapılanlar (ücretsiz)

| Değişiklik | Kazanç | Dosya |
|---|---|---|
| Girişte 750 ms animasyon bitmeden panel istenmiyordu; artık hemen isteniyor | girişte −750 ms | `src/app/login/page.tsx` |
| Pervane ve ızgara görselleri 900 → 640 px | giriş ekranı −80 KB | `public/img/unite-*.webp` |
| Profil 60 sn sunucu belleğinde tutuluyor; profil veya firma değiştiren işlemler önbelleği hemen siliyor | Her kaydetmede bir sıralı veritabanı turu daha az (85-1000 ms). Sayfalarda Supabase'e giden yük azalıyor | `src/lib/auth/session.ts`, admin ve ayarlar işlemleri |
| Supabase bağlantıları 4 sn yerine 60 sn açık tutuluyor | Her turda bağlantı kurma süresi gidiyor. Buradaki ölçüm: 162 → 67 ms | `src/lib/supabase/fetch-with-timeout.ts` |
| Oturum, süresi dolmadan arka planda yenileniyor; sekmeye dönülünce de hemen yenileniyor | Saatte bir tıklamaya binen ~1 sn bekleme ortadan kalkıyor (sekme açıkken) | `src/components/layout/session-keeper.tsx`, `src/app/api/session-ping` |
| iklimlen.com ana sayfası her ziyarette baştan üretiliyordu; artık 5 dk'lık hazır kopyadan geliyor (alt sayfalar gibi) | Sunucu süresi ~73 → ~17 ms, paylaşımlı sunucuda daha az yük | `iklimlen-site/src/app/page.tsx` |

Güvenlik: profil önbelleği yetki kararı vermiyor. Pasif kullanıcı ve firma veritabanında RLS ile anında kesiliyor (migration 0026). Önbellekteki kopya yalnızca ekranda gösterilen profil.

## 3. Kodla çözülemeyenler: seçenekler

Kalan en büyük iki kaynak altyapıda: Hostinger'daki ara sıra 0,5-2 sn beklemeler ve Supabase Nano'nun yavaş cevapları.

| Seçenek | Ne çözer | Maliyet | Not |
|---|---|---|---|
| A. Supabase Pro (Micro makine) | Veritabanı ve oturum yenileme cevapları daha düzenli; proje uyumaz | aylık ~25 $ | Ücretli. Taşıma gerektirmez |
| B. Uygulamaları paylaşımlı hostingden VPS'e almak (ör. Hostinger KVM) | Sunucudaki %15'lik 0,5-2 sn beklemeler (başka sitelerle paylaşılan kaynak) | aylık birkaç $ | Ücretli. Kurulum ve yayın düzeni değişir |
| C. Sunucu ile veritabanını aynı şehre koymak (ör. VPS Frankfurt + Supabase Frankfurt) | Her turda 15-20 ms | Supabase'te yeni proje ve veri taşıma | B ile birlikte anlamlı. Supabase bölgesi sonradan değiştirilemiyor |
| D. Önüne Cloudflare (ücretsiz plan) | Türkiye'de (İstanbul) bağlantı kurulumu ve statik dosyalar | ücretsiz | DNS değişikliği gerekir; Hostinger CDN'i ile çakışmaması ayarlanmalı |
| E. Supabase'te oturum süresini uzatmak (1 sa → birkaç saat) | Uzun aradan sonra ilk açılışta oturum yenilemesi daha seyrek | ücretsiz | Güvenlik ödünü: iptal edilen oturum daha uzun geçerli kalır |

Önerilen sıra: kod değişikliklerini yayına al ve canlıda ölç → beklemeler sürerse A, sonra B. C ve D, B'den sonra.
