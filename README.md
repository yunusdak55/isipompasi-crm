# Isı Pompası CRM — V1 Çekirdek (Aşama 1)

Isı pompası kurulumu yapan firmalara hizmet veren ajans için **multi-tenant CRM +
AI altyapısı**. Bu doküman, spec'in "38. İLK GÖREVİN" bölümünde istenen 10
maddenin nasıl karşılandığını ve projeyi nasıl ayağa kaldıracağınızı anlatır.

---

## 1) Bu aşamada ne yapıldı (madde 1-10)

| # | Madde | Durum | Nerede |
|---|-------|-------|--------|
| 1 | Proje klasör yapısı | ✅ | `src/app`, `src/components`, `src/lib`, `supabase/migrations` |
| 2 | Next.js + TypeScript kurulumu | ✅ (dosyalar hazır, `npm install` gerekli — bkz. §3) | `package.json`, `tsconfig.json` |
| 3 | Supabase bağlantısı | ✅ | `src/lib/supabase/client.ts`, `server.ts`, `src/middleware.ts` |
| 4 | Database schema taslağı | ✅ 11 tablo | `supabase/migrations/0001_init_schema.sql` |
| 5 | Authentication yapısı | ✅ e-posta+şifre, session cookie | `src/app/login`, `src/lib/supabase/*` |
| 6 | Company / tenant / user / role yapısı | ✅ `profiles.role` + `company_id` | migration 0001 + `handle_new_user()` |
| 7 | RLS politikaları | ✅ tüm tablolarda, rol bazlı | `supabase/migrations/0002_rls_policies.sql` |
| 8 | Temel dashboard layout | ✅ Sidebar + Topbar + istatistik kartları | `src/app/(dashboard)/dashboard` |
| 9 | Lead listesi (temel ekran) | ✅ arama + durum filtresi + sayfalama | `src/app/(dashboard)/leads` |
| 10 | Lead detay sayfası (iskelet) | ✅ tüm bölümler, düzenleme **henüz yok** | `src/app/(dashboard)/leads/[id]` |

**Bilerek V1 kapsamı dışında bırakılanlar** (spec md.31'de sonraki adımlar, bu
görevde değil): Kanban pipeline (drag&drop), not/takip/kayıp-nedeni
**düzenleme** formları, Teklifler/Satışlar/Raporlar/AI Asistan sayfaları,
Ajans admin paneli (firma/kullanıcı oluşturma UI'ı). Veritabanı şeması bunların
hepsi için zaten hazır; sadece UI henüz yok.

---

## 2) Önemli mimari kararlar ve varsayımlar (spec md.39 gereği)

Spec'te belirtilmeyen noktalarda mantıklı varsayımlar yapıldı; güvenlik/tenant
izolasyonu gibi kritik konularda varsayım yapılmadı, en güvenli çözüm seçildi:

- **Veritabanı anahtarları İngilizce, arayüz Türkçe.** `status='won'` gibi
  değerler İngilizce; kullanıcıya gösterilen her metin `src/lib/constants/lead.ts`
  üzerinden Türkçe etiketlenir. Böylece Türkçe karakter (İ/i, ş, ğ) kaynaklı
  sıralama/karşılaştırma sorunları ve ileride çoklu dil ihtiyacı baştan
  engellenir.
- **RLS = tek gerçek güvenlik sınırı.** Sayfalar da kendi içinde oturum
  kontrolü yapar ama bu ikinci bir savunma katmanıdır; asıl izolasyon
  veritabanı seviyesinde RLS ile sağlanır (bkz. §5).
- **`lost_reasons` tüm firmalarda ortak liste** olarak tasarlandı (spec
  "standart kayıp nedenleri" diyor). İleride firma bazlı özelleştirme
  gerekirse tabloya `company_id` eklenip mevcut satırlar `NULL` (genel)
  kabul edilerek genişletilebilir.
- **`competitors` / `integrations` / `ai_reports` sadece owner + admin** görür,
  `sales` göremez (spec'te açıkça belirtilmemiş, stratejik veri olduğu için
  bu şekilde varsayıldı).
- **Supabase yeni API key formatı (`sb_publishable_...` / `sb_secret_...`)**
  kullanıldı — Supabase'in güncel resmi önerisi bu yönde; eski `anon` /
  `service_role` anahtarları da işlevsel olarak birebir aynı şekilde çalışır
  (bkz. §3, adım 2).
- **RİSK NOTU — `integrations.config` (jsonb):** Buraya gerçek WhatsApp/Meta/
  Telegram token'ları asla açık metin yazılmamalı. V1'de bu sadece bağlantı
  durumunu (connected/pending/vb.) tutan bir iskelet; gerçek entegrasyon
  eklenirken secret'lar için ayrı bir vault/şifreli çözüm gerekecek.
- **RİSK NOTU — e-posta onayı.** Supabase projenizde "Confirm email" açıksa,
  admin tarafından oluşturulan kullanıcılar ilk girişten önce e-posta
  onaylamak zorunda kalabilir. Test ortamında bunu Supabase Dashboard →
  Authentication → Providers'tan kapatabilir veya kullanıcıyı "Auto Confirm
  User" seçeneğiyle oluşturabilirsiniz.

---

## 3) Projeyi çalıştırma

### Adım 1 — Bağımlılıkları kurun

> Bu proje, ağ erişimi olmayan bir ortamda **elle** yazıldı; `npm install`
> hiç çalıştırılmadı. İlk çalıştırmada normalden biraz daha fazla paket
> uyumsuzluğu çıkma ihtimaline karşı `npm run typecheck` ile başlamanız
> önerilir (bkz. Adım 5).

```bash
npm install
```

### Adım 2 — Supabase projesi oluşturun

1. [supabase.com](https://supabase.com) üzerinde yeni bir proje açın.
2. **Settings → API Keys** bölümünden:
   - Proje URL'ini kopyalayın
   - Yeni format bir **Publishable key** oluşturun (yoksa "Create new API
     keys" ile) — client tarafında kullanılacak
   - Yeni format bir **Secret key** oluşturun — sadece sunucu tarafı admin
     işlemleri için (V1'de henüz kullanılmıyor, ileride admin panel için
     gerekecek)
   - Projeniz eski (legacy) anahtar sistemindeyse `anon` key'i Publishable
     key yerine, `service_role` key'i Secret key yerine kullanabilirsiniz;
     RLS açısından fark yoktur.
3. `.env.local.example` dosyasını `.env.local` olarak kopyalayıp değerleri
   doldurun.

### Adım 3 — Veritabanı şemasını uygulayın

Supabase Dashboard → **SQL Editor**'e girip sırasıyla:

1. `supabase/migrations/0001_init_schema.sql` içeriğini yapıştırıp çalıştırın.
2. `supabase/migrations/0002_rls_policies.sql` içeriğini yapıştırıp çalıştırın.

(Supabase CLI kullanıyorsanız alternatif olarak `supabase db push` ile de
uygulayabilirsiniz.)

### Adım 4 — Test için ilk kullanıcıyı ve firmayı oluşturun

Henüz admin paneli (firma/kullanıcı oluşturma ekranı) yapılmadığı için ilk
kaydı elle oluşturmanız gerekiyor:

1. **Authentication → Users → Add user** ile bir kullanıcı oluşturun
   (e-posta + şifre). "Auto Confirm User" işaretleyin.
2. **User Metadata** alanına şunu yazın (owner rolü ve firma adıyla otomatik
   eşleşmesi için önce firmayı oluşturup `company_id`'sini buraya
   yazabilir, ya da aşağıdaki 3. adımdaki gibi sonradan güncelleyebilirsiniz):
   ```json
   { "full_name": "Test Yönetici", "role": "owner" }
   ```
3. SQL Editor'de firmayı oluşturup kullanıcıyı ona bağlayın:
   ```sql
   insert into public.companies (name, city)
   values ('ABC Isı Sistemleri', 'İstanbul')
   returning id;
   -- yukarıdaki id'yi kopyalayip asagida kullanin:

   update public.profiles
   set company_id = '<yukarida-donen-id>'
   where email = 'test@ornek.com';
   ```
4. (İsteğe bağlı ama önerilir) birkaç örnek lead ekleyin:
   ```sql
   insert into public.leads (company_id, first_name, last_name, phone, city, property_type, area_m2, status, priority)
   values
     ('<company_id>', 'Ahmet', 'Yılmaz', '05551112233', 'İstanbul', 'villa', 280, 'new', 'hot'),
     ('<company_id>', 'Ayşe', 'Demir', '05559998877', 'Bursa', 'apartment', 120, 'offer', 'medium');
   ```

Ajans admin için de aynı şekilde bir kullanıcı oluşturup metadata'ya
`{"role": "admin"}` yazmanız yeterli (`company_id` gerekmez).

### Adım 5 — Tip kontrolü ve geliştirme sunucusu

```bash
npm run typecheck   # tsc --noEmit
npm run dev         # http://localhost:3000
```

`/login` sayfasından 4. adımda oluşturduğunuz e-posta/şifre ile giriş yapın.

---

## 4) Veritabanı tabloları (11 tablo)

| Tablo | Amaç |
|---|---|
| `companies` | Tenant'lar — her ısı pompası firması bir satır |
| `profiles` | `auth.users` uzantısı: `role` (admin/owner/sales) + `company_id` |
| `lost_reasons` | Standart kayıp nedenleri (ortak referans listesi) |
| `leads` | Ana varlık — spec md.8'deki tüm alanlar |
| `activities` | Lead zaman çizelgesi / not geçmişi |
| `followups` | Takip tarihi + notu geçmişi |
| `offers` | Basit teklif takibi |
| `sales` | Kapanan satışlar |
| `competitors` | Rakip firma veri modeli (UI sonraki aşama) |
| `integrations` | WhatsApp/Meta/Telegram/GA/Search Console bağlantı durumu |
| `ai_reports` | AI analiz çıktılarının geçmişi (V1'de henüz kullanılmıyor) |

Tüm tablolarda `company_id` (tenant anahtarı) ve gerekli yerlerde
`created_at/updated_at/created_by/updated_by` audit alanları var. İndexler
`company_id`, `phone`, `status`, `created_at`, `next_followup_at`,
`assigned_salesperson` üzerinde (spec md.24).

## 5) Authentication + RLS mantığı

**Authentication:** Supabase Auth (e-posta+şifre). `@supabase/ssr` paketi
oturumu HTTP-only cookie'de tutar; `src/middleware.ts` her istekte token'ı
tazeler ve girişsiz kullanıcıyı `/login`'e yönlendirir. Yeni bir
`auth.users` satırı oluştuğunda `handle_new_user()` trigger'ı otomatik
olarak `profiles` satırı açar.

**Tenant izolasyonu (RLS):** Her tabloda Row Level Security açık. İki
`SECURITY DEFINER` yardımcı fonksiyon (`current_user_role()`,
`current_user_company_id()`) oturum açan kullanıcının rolünü/firmasını
okur — `SECURITY DEFINER` kullanılmasının nedeni, `profiles` tablosuna
bakan bir RLS politikasının kendi kendine sonsuz döngüye girmesini
engellemektir (Supabase'in resmi önerdiği çözüm).

Rol bazlı kural özeti:

- **admin** → tüm firmaları görür/yönetir (`company_id` şartı yok)
- **owner** → sadece `company_id = kendi firması` olan satırları görür
- **sales** → `leads` üzerinde sadece `assigned_salesperson = kendisi` olan
  satırları görür; ilişkili `activities/followups/offers` de bu kurala göre
  süzülür

Bu sayede **Firma A hiçbir koşulda Firma B'nin verisini göremez** — kural
uygulama kodunda değil, veritabanı seviyesinde zorlanır.

## 6) Klasör yapısı

```
src/
  app/
    login/                    # giriş sayfası + server action
    auth/callback/             # e-posta onayı/magic link icin altyapi
    (dashboard)/                # oturum gerektiren tüm sayfalar
      layout.tsx                # Sidebar + Topbar kabuğu, oturum kontrolü
      dashboard/                # md.7
      leads/                     # md.9 (liste) + [id] (md.10 detay iskeleti)
  components/
    layout/                    # Sidebar, Topbar
    ui/                        # Badge, Card, Button (paylaşılan primitifler)
    dashboard/, leads/          # sayfa bazlı bileşenler
  lib/
    supabase/                  # browser + server client
    types/                      # database.types.ts (elle yazıldı, bkz. not) + domain.ts
    constants/                  # İngilizce anahtar -> Türkçe etiket eşlemesi
    data/                       # server-side veri erişim fonksiyonları
    auth/                       # oturum/profil yardımcıları + sign-out action
  middleware.ts
supabase/migrations/           # 0001 şema, 0002 RLS
```

## 7) Bilinen sınırlamalar / bir sonraki oturumda kontrol edilmesi gerekenler

- **`npm install` hiç çalıştırılmadı** (bu ortamda ağ erişimi yok). Kod,
  güncel (Ağustos 2026) Next.js 16 / React 19 / Tailwind v4 / `@supabase/ssr`
  dokümantasyonu referans alınarak elle yazıldı ve global TypeScript
  derleyicisiyle **söz dizimi** açısından kontrol edildi (gerçek paket
  kurulumu olmadığı için tam tip kontrolü yapılamadı). İlk `npm install`
  sonrası `npm run typecheck` ve `npm run build` çalıştırmanız önerilir.
- `src/lib/types/database.types.ts` elle yazıldı; Supabase projeniz
  kurulduktan sonra `npx supabase gen types typescript --project-id <id> > src/lib/types/database.types.ts`
  ile gerçek/otoritatif haliyle değiştirin.
- Lead detay sayfasında not ekleme, takip tarihi belirleme ve durum
  değiştirme **henüz bağlı değil** (sadece görüntüleme) — spec md.31'de
  ayrı maddeler (12-14) olarak bir sonraki aşamada eklenecek.

---

Bu özet, spec'in **38. bölümünde** istenen "hangi dosyaları oluşturduğunu,
database tablolarını, authentication mantığını, RLS mantığını, uygulamayı
nasıl çalıştıracağını, hangi adımda olduğumuzu" özetleme isteğini karşılar.
Bir sonraki aşamaya (spec md.31, madde 11-20: Notlar/Takip/Kayıp nedeni
düzenleme formları, Teklif, Satış, Raporlar, AI Assistant UI, güvenlik
testleri, deployment) birlikte geçebiliriz.
