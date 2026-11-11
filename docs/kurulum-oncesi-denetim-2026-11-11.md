# Kurulum öncesi denetim (2026-11-11)

Bunu kendime talimat olarak yazdım. Yarın sistem ilk gerçek müşteri firmaya kurulacak. Ajan yok, her adımı sırayla kendim yapıyorum. Token tasarrufu için her adımda yalnızca ilgili dosyaları okuyorum.

## Kurallar

- Canlı veritabanında yalnızca okuma ve test yapılır. Yeni migration önce yerelde yazılır, sonra kullanıcıya listelenir. WhatsApp botuyla ilgili migration'lar önceden onaylı.
- GitHub'a push etmek canlıya çıkmak demek: kullanıcı onayı olmadan yapılmaz.
- Gizli anahtarlar ekrana ve dosyaya yazılmaz.
- Merihe dosyalarına dokunulmaz.
- Her düzeltme kanıtla kapanır: test, ölçüm ya da ekran görüntüsü.

## 1. Veri nerede, firmalar nasıl ayrılıyor

- Tablo listesi. Her tabloda RLS açık mı, `company_id` var mı?
- Politikalar: kullanıcı yalnızca kendi firmasını görüyor mu? Sales rolü yalnızca kendine atananları mı görüyor?
- `scripts/verify-tenant-isolation.mts` ve `npm run security:check` çalıştırılır.
- SECURITY DEFINER fonksiyonlar: `search_path` sabit mi? `anon` ve `authenticated` çalıştırabiliyor mu? `wa_*` fonksiyonları yalnızca service_role'e açık olmalı.
- Supabase güvenlik ve performans uyarıları Management API'den okunur.

## 2. Bot'tan CRM'e akış

- Akış: WhatsApp → n8n webhook → `wa_inbound` → `wa_context` → yapay zekâ → `wa_bot_reply` → `agent_upsert_lead` → `leads`, `lead_activities`.
- Uç durumlar:
  - aynı numara iki kez yazarsa ne olur;
  - aynı numara iki farklı firmaya yazarsa ne olur;
  - pasif firma ya da hat;
  - bilinmeyen `phone_number_id`;
  - yapay zekâ hata verirse ne olur.
- Webhook'un sahte istek kabul etmesi riski: Meta imza doğrulaması (`X-Hub-Signature-256`) var mı?
- n8n'de hata olunca kimsenin haberi oluyor mu (hata workflow'u)?

## 3. Hız

- Giriş, sayfa geçişi ve müşteri detayı için sunucu süreleri ölçülür (`[PERF]` günlükleri ya da yerel prod build).
- Sıralı (birbirini bekleyen) veritabanı çağrıları, gereksiz `select *`, büyük istemci paketleri, eksik index aranır.
- Önce/sonra tablosu tutulur.

## 4. Mobil ve masaüstü

- Yerel prod build'de önizleme sayfaları 375 px ve 1280 px genişlikte açılır.
- Kontrol edilenler: taşma, yatay kaydırma, dokunma hedefleri, konsol hataları.

## 5. Kod ve veritabanı hataları

- `npm run check` (typecheck, lint, audit, security), `next build`, smoke testleri.
- Sunucu eylemleri:
  - her biri yetki kontrol ediyor mu;
  - girdiler doğrulanıyor mu;
  - hata mesajları iç ayrıntı sızdırıyor mu.
- Güvenlik başlıkları, giriş hız sınırı, açık yönlendirme, `dev-onizleme` canlıda kapalı mı.

## 6. n8n botu: sert eleştiri

- Sanki başkası yazmış gibi bakılır:
  - tek nokta hataları;
  - maliyet;
  - gecikme;
  - tekrar gönderim;
  - sessiz hata;
  - talimatın uzunluğu.
- Yalnızca gerçek bir sorunu çözen ve ucuz değişiklikler yapılır.

## 7. Bitiş

- Eski/yeni karşılaştırması, kalan riskler ve yol haritası.
- Kullanıcıya sade bir dille "sistem nasıl çalışıyor" anlatımı.
- Push ve canlı migration'lar için tek bir onay sorusu.

---

# Sonuçlar (2026-11-11)

## 1. Veri ve firma ayrımı

**Tablolar ve fonksiyonlar**
- 18 tablonun hepsinde RLS açık.
- Firma verisi olan her tabloda `company_id` var.
- Bot fonksiyonlarını (`wa_*`, `agent_upsert_lead`) yalnızca sunucu anahtarı çalıştırabiliyor: anon ve oturum açmış kullanıcı çağıramıyor.

**Saldırı testi**
- `npm run security:check` artık WhatsApp tablolarını ve bot fonksiyonlarını da deniyor (9. bölüm).
- Canlıda çalıştırma komutu: `SECURITY_ENV_FILE=.env.production-backup.local`.
- Sonuç: **52 denemeden 50'si engellendi.**
- Kaçan ikisi Supabase Auth'un parola kuralı (en az 6 karakter, karakter şartı yok). Uygulama kendi kuralını (10 karakter, büyük/küçük harf, rakam) zaten zorluyor. Ama oturum açmış biri Supabase'e doğrudan bağlanıp kendi parolasını zayıflatabilir. Çözüm ücretsiz bir Auth ayarı ve onay bekliyor.

**Supabase uyarıları ve diğer kontroller**
- Supabase uyarıları: sızmış parola kontrolü (Pro gerekir) ve WhatsApp tablolarında 2 eksik index ile çift politika. Index ve politika sorunları 0040'ta düzeltildi.
- Gizli anahtar derlenmiş tarayıcı paketlerinde yok. Onu kullanan her admin işleminden önce admin kontrolü var.
- Formlar alanları beyaz listeyle kabul ediyor; kullanıcı firma ya da atama alanını değiştiremiyor.
- Gece yedeği her gün alınıyor (son yedek: 11.11 03:02).

## 2. Hız

**Ölçümler**
- Canlı veritabanında en çok zaman harcayan sorgular 1-12 ms. Veritabanı darboğaz değil.
- Canlı giriş sayfasında ilk bayt medyan 236 ms; aynı sunucudaki boş `robots.txt` 211 ms. Yani uygulamanın kendi payı ~25 ms, kalanı bağlantı ve ağ.
- Önceki çalışmalarda yapılmış olanlar: sorgular paralel, sayfalama paralel, profil önbellekte, oturum arka planda yenileniyor, prefetch bilerek kapalı.
- Kodda kayda değer bir kazanç kalmadı. Paketler küçük: en büyük JS parçası 67 KB (gzip), CSS toplam 25 KB.

**Kalan seçenekler (`docs/hiz-calismasi-2026-11-08.md`)**
- Supabase Pro.
- VPS.
- Cloudflare.

Hepsi ücretli ya da DNS değişikliği istiyor.

## 3. Mobil ve masaüstü

- 375 px ve 1280 px genişlikte giriş, Bugün, Leadler, Pano, Takipte, Takvim ve WhatsApp hatları ekranlarında yatay taşma yok.
- Konsolda uygulama hatası yok.
- `/dev-onizleme` canlıda kapalı: giriş sayfasına yönlendiriyor, derlemede 404.

## 4. Kod

- `tsc` temiz, `npm audit` 0 açık, `next build` başarılı.
- Lint: 10 uyarı. Hepsi "kaydettikten sonra formu sıfırla" kalıbı; zararsız.

## 5. n8n botu: sert eleştiri ve çözümler

| Sorun | Ne olurdu | Çözüm |
|---|---|---|
| Yapay zekâ iki denemede de hata verirse akış duruyordu | Müşteri cevapsız kalır, kimse fark etmez | "Yedek Cevap" dalı müşteriye "Mesajınızı aldım, ekibimiz en kısa sürede size dönüş yapacak." gönderir (art arda değil) ve hatayı Denetim Kaydı'na yazar. **Bozuk modelli geçici kopyayla denendi.** |
| Hatalar sessizdi | Supabase ya da WhatsApp gönderimi bozulsa haftalarca anlaşılmaz | "WhatsApp Bot - Hata Kaydı" workflow'u eklendi; her hata admin → Denetim Kaydı'nda "Bot hatası" olarak görünür. Aynı hata 10 dakikada bir kez yazılır. **Bozuk adımlı geçici kopyayla denendi.** n8n 2.x'te hata workflow'unun aktif olması gerekiyormuş. |
| Maliyet sınırı yoktu | Trol ya da sahte istekler OpenAI kredisini yakar | `wa_context`: sohbet başına en fazla 12 bot cevabı, hat başına saatte 150. Sınır aşılınca bot susar; lead yine CRM'e düşer (0041). |
| Yarıda kalan müşteri CRM'e 3 saat sonra düşüyordu | Satış ekibi geç arar | 1 saate indirildi. Müşteri 72 saat içinde dönerse sohbet kaldığı yerden devam eder. |
| Bot hiç cevap veremediyse lead notu "botun sorularına cevap vermedi" diyordu (yanlış), müşterinin yazdıkları da yoktu | Satış ekibi müşterinin ne istediğini bilemez | Not artık müşterinin son 3 mesajını içeriyor; bot hata verdiyse bunu açıkça yazıyor (0040). |
| Meta imzası (`X-Hub-Signature-256`) ve verify token kontrol edilmiyor | Webhook adresini bilen biri sahte mesaj gönderebilir | **Meta bağlantısıyla birlikte yapılacak.** App Secret kullanıcı tarafından n8n'e girilmeli. Bu arada maliyet sınırı ve bilinmeyen hat reddi zarar sınırlıyor. |

Ölçülen sağlık:
- Son 684 çalışmanın 683'ü başarılı, 1'i iptal edilmiş, hata yok.
- Cevap süresi medyan 8,7 sn; bunun 5 sn'si bilerek konan bekleme (peş peşe mesajları birleştirmek için).
- Değişikliklerden sonra 20 sohbetlik test tekrar çalıştırıldı; hepsi cevap aldı.

## 6. Yol haritası (eksikler)

1. **Gerçek WhatsApp numarasını bağlamadan önce:**
   - Meta imza doğrulaması ve verify token;
   - müşteri hattının eklenmesi;
   - `TEST_IKLIMLEN` hattının kapatılması;
   - bir gerçek uçtan uca deneme.
2. Onay bekleyen canlı adımlar:
   - GitHub push (panel kodu);
   - 0040 migration'ı;
   - Supabase parola kuralının 10 karakter ve karakter şartı olarak ayarlanması.
3. Admin hesabı için iki adımlı doğrulama (TOTP Supabase'te açık, panelde arayüzü yok).
4. Bot hatalarını e-posta ya da telefona bildirmek. Şu an yalnızca panelde görünüyor.
5. Sesli mesajı yazıya çevirme. Şu an bot müşteriden yazmasını istiyor.
6. Ödeme alan müşteriler gelince Supabase Pro: günlük yedek, PITR, daha düzenli hız.
