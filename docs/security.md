# Güvenlik Rehberi

Bu doküman: (1) neyin nasıl korunduğunu, (2) yeni özellik eklerken uyulacak kuralları,
(3) güvenliği nasıl test edeceğinizi, (4) hâlâ elle yapılması gereken adımları anlatır.

## Katmanlar (savunma derinliği)

| Katman | Ne yapar | Nerede |
|---|---|---|
| **Veritabanı (RLS)** | Firma izolasyonu + rol yetkileri. Asıl güvenlik sınırı BUDUR; uygulama kodundaki kontroller ikinci katmandır. | `supabase/migrations/0002, 0024, 0026, 0027` |
| **Pasif hesap/firma** | `profiles.is_active=false` ya da `companies.is_active=false` → RLS yardımcıları `NULL` döner → tüm erişim **anında** kesilir (açık oturum dahil). | `private.current_user_role()` / `current_user_company_id()` |
| **Ayrıcalık sütunları** | `profiles.role / company_id / is_active / email` yalnızca admin tarafından değişir. | `protect_profile_privileged_columns` tetikleyicisi |
| **Rol kaynağı** | Yeni hesabın rolü/firması **yalnızca `app_metadata`'dan** gelir (kullanıcı değiştiremez). `user_metadata` hiçbir yetki vermez. | `handle_new_user` |
| **Çapraz-firma bütünlüğü** | `activities/followups/discovery_visits/sales` → `lead_id` ile `company_id` aynı firmadan olmalı; lead'in atanan kişisi/kategorisi/personeli aynı firmadan olmalı. | `enforce_*` tetikleyicileri |
| **Yetkiler** | `anon` hiçbir tabloda/fonksiyonda yetkisiz. Tetikleyici fonksiyonlar RPC ile çağrılamaz. Yardımcılar `private` şemada (PostgREST açığa çıkarmaz). | migration 0026/0027 |
| **Denetim kaydı** | Rol/aktiflik/e-posta, firma, entegrasyon, satış değişiklikleri silinemez biçimde kaydedilir; admin panelinde **Denetim Kaydı**. | `audit_log`, `/admin/audit` |
| **Tarayıcı** | Nonce'lu CSP (XSS'e ek katman), `frame-ancestors 'none'`, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HttpOnly oturum çerezleri. | `src/proxy.ts`, `next.config.mjs`, `lib/supabase/server.ts` |
| **Giriş** | Hesap başına 10 dk'da 8 / IP başına 30 başarısız denemede kilit; pasif hesap girişi reddedilir; parola politikası (≥10, büyük+küçük+rakam). | `login/actions.ts`, `lib/security/rate-limit.ts`, `lib/auth/password.ts` |
| **Sunucu action'ları** | Next.js Origin denetimi (CSRF) + `allowedOrigins`; her action kendi rol kontrolünü yapar; hata metinleri istemciye ham gitmez. | `lib/errors.ts` |

## Yeni kod yazarken KURALLAR

1. **Yeni tablo:** `enable row level security` + `select/insert/update/delete` politikalarını AYRI yaz +
   `grant select, insert, update, delete on ... to authenticated` **elle ver** (artık varsayılan olarak
   `anon`/`authenticated`'a yetki verilmez — unutursan "permission denied" ile gürültülü hata alırsın, sessiz açık kalmaz).
   Politikalarda `(select private.current_user_role())` / `(select private.current_user_company_id())` / `(select auth.uid())`.
2. **Yeni fonksiyon:** varsayılan olarak kimse çağıramaz. RPC olacaksa `grant execute ... to authenticated` ver ve
   `security invoker` tercih et. `security definer` gerekiyorsa `set search_path = ''` (ya da `public`) yaz ve
   **yalnızca** gerçekten gerekli yetkiyi ver. Tetikleyici fonksiyona EXECUTE verme.
3. **Hesap oluşturma:** `auth.admin.createUser({ app_metadata: { role, company_id }, user_metadata: { full_name } })`.
   ASLA rol/firmayı `user_metadata`'ya koyma. Oluşturduktan sonra profilin oluştuğunu doğrula
   (bkz. `verifyProfileProvisioned` in `admin/actions.ts`).
4. **Service role (`createAdminClient`)** yalnızca admin-only server action'larda ve **önce** `requireAdmin()` sonrası.
   Asla `"use client"` dosyadan import etme. `SUPABASE_SECRET_KEY` `NEXT_PUBLIC_` ile başlamamalı.
5. **Kullanıcı girdisi:** `.or()` / `.ilike()` içine giren metni `sanitizeSearchTerm` ile temizle; serbest metni
   uzunlukla sınırla; sayısal girdiye üst sınır koy; DB hatasını istemciye `friendlyDbError()` ile ver (ham `error.message` değil).
6. **Yönlendirme:** kullanıcıdan gelen `next`/`redirect` değerini doğrulamadan kullanma (`auth/callback` → `safeNextPath`).
7. **Tarayıcıdan Supabase'e doğrudan bağlanma.** CSP `connect-src 'self'`; oturum çerezleri HttpOnly. Tüm veri sunucu tarafından geçer.
8. Yeni sayfa eklerken `connection()`/dinamik render zaten kök layout'ta — nonce'lu CSP için sayfa **statik olmamalı**.

## Test etme

```bash
npm run security:check   # canlı DB'ye karşı 41 saldırı denemesi (izole geçici firma/kullanıcı; sonunda siler)
npm run check            # tip kontrolü + lint + npm audit + güvenlik testi
npm run backup           # tüm tabloları backups/<tarih>/ altına JSON olarak yedekler (git dışı)
```

`scripts/security-audit.mjs` her migration / Auth ayarı değişikliğinden sonra çalıştırılmalı. Yeni tablo/kolon/politika
eklediğinde ilgili saldırı denemesini oraya da ekle. Test, canlı projede `__secaudit_*` adlı geçici kayıtlar açar ve siler
(her çalışmada denetim kaydına birkaç satır düşer — normaldir).

Supabase'in kendi denetimleri: `GET https://api.supabase.com/v1/projects/<ref>/advisors/security` ve `/advisors/performance`.

## Elle yapılması GEREKEN adımlar (Supabase panelinden)

Bunlar proje **Auth yapılandırması** olduğu için otomatik araçla değiştirilmedi:

1. **Authentication → Sign In / Providers → "Allow new users to sign up" KAPAT.**
   (Hesapları yalnızca ajans admini açar; herkese açık kayıt gereksiz. DB artık kayıtla gelen kullanıcıya yetki vermiyor, ama
   yine de boş hesap/spam ve e-posta kotası tüketimi olur.)
2. **Authentication → URL Configuration:** `Site URL` = `https://panel.iklimlen.com` (şu an `http://localhost:3000`),
   `Redirect URLs` = `https://panel.iklimlen.com/**` (+ geliştirme için `http://localhost:3000/**`).
3. **Authentication → Password:** minimum uzunluk 10, "büyük+küçük harf+rakam" zorunlu; **"Prevent use of leaked passwords"** aç
   (Pro plan gerektirebilir). Uygulama parola politikasını Auth ayarından bağımsız olarak da zorluyor.
4. **Yedek:** Free planda otomatik yedek/PITR yok. Pro plana geçin (günlük yedek + PITR) ve/veya `npm run backup`'ı haftalık çalıştırıp
   çıktıyı şifreli/ayrı bir yere kopyalayın.
5. **Legacy API anahtarları:** WhatsApp agent `sb_secret_...` kullanıyorsa Settings → API Keys → Legacy anahtarları devre dışı bırakın.
6. **GitHub:** sohbette/ekranda paylaşılmış tüm kişisel erişim jetonlarını (PAT) `github.com/settings/tokens` altından silin;
   **Supabase Personal Access Token'ı** (`SUPABASE_ACCESS_TOKEN`, `.env.local`) da iş bitince iptal edin.
7. (İleri seviye) Ajans admin hesabı için 2 adımlı doğrulama (TOTP) — admin hesabı tüm firmalara erişir.

## Dağıtım notları

- **Sıra:** DB migration'ları (0026/0027) canlıda ZATEN uygulandı. Yeni panel kodu (GitHub → Hostinger) yayına çıkana kadar
  eski kod çalışır. Bu aralıkta eski panelden **yeni firma/kullanıcı oluşturmayın** — eski kod rolü `user_metadata`'da gönderir,
  yeni tetikleyici buna (bilerek) güvenmez ve hesap profilsiz kalır. Olduysa: `node scripts/fix-orphan-users.mjs --apply`.
- **CSP acil anahtarı:** yayına çıkınca sayfa bozuk/boş görünürse Hostinger ortam değişkenlerine `CSP_REPORT_ONLY=1` ekleyip
  yeniden başlatın (CSP yalnızca raporlama moduna geçer, hiçbir şey engellenmez) ve durumu bildirin.
- Yayın sonrası hızlı kontrol: `/login` açılıyor mu, giriş yapılıyor mu, Dashboard/Satışlar/Ayarlar açılıyor mu, admin →
  Denetim Kaydı açılıyor mu.

## Bilinen / kabul edilen riskler

- Oturumu sunucuda iptal edilen (çıkış) bir JWT ≤1 saat geçerli kalır (`getClaims` yerel doğrulama — performans için).
  Pasif kullanıcı/firma ise DB katmanında **anında** kesilir.
- Giriş hız sınırı bellek içidir (süreç yeniden başlayınca sıfırlanır; çoklu süreçte paylaşılmaz). Asıl kalıcı korumalar:
  parola politikası, Supabase Auth limitleri, RLS.
- `authenticated` rolü tabloları PostgREST ile doğrudan sorgulayabilir; korunma RLS + tetikleyicilerle sağlanır (`security:check` bunu sınar).
