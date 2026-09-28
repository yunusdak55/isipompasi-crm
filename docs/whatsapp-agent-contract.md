# WhatsApp Agent — Veritabanı Kontratı

Bu doküman, WhatsApp'a bağlı AI agent'ın (n8n üzerinden, Supabase'e `service_role`
anahtarıyla doğrudan yazan bir dış sistem) bu CRM ile arasındaki **tam ve tek**
sözleşmedir. n8n tarafında agent'a prompt yazılırken buradaki alan adları,
sınırlar ve kurallar birebir kullanılmalı — kod tarafında bir şey değişirse bu
dosya da güncellenir.

## Agent'ın amacı ve konuşma davranışı (kullanıcı spec, 2026-09-27)

Agent'ın amacı **satış yapmak değil** — sana mesaj atan potansiyel müşteriyi,
firmanın gerçek satış temsilcisi arayıp dönüş sağlayana kadar **sıcak tutmak**.
Fiyat/teklif verme, randevu belirleme gibi işler tamamen insan satış
temsilcisinin işidir.

- Müşterinin ilk mesajı bir hizmet belirtiyorsa (reklamdan geldiği için genelde
  öyledir, ör. "Isı pompasıyla ilgili bilgi alabilir miyim?") agent hangi
  hizmetten bahsedildiğini mesajdan çıkarır, **asla** "hangi hizmetle
  ilgileniyorsunuz" diye sormaz veya hizmetleri sayıp seçtirmez.
- Müşterinin ilk mesajı düz bir selamlamaysa (hizmet belirtmiyorsa, ör.
  "Merhaba"), agent SADECE `"Merhaba, nasıl yardımcı olabiliriz?"` yanıtını
  verir — hizmetleri saymaz, soru sormaz, bir sonraki mesajı bekler.
- İhtiyaç analizi soruları artık **firmaya göre dinamik** (bkz. aşağıdaki
  "Dinamik hizmet/soru sistemi" bölümü) — sabit "2 soru" kuralı yok, her
  hizmetin kendi soru listesi var; hiçbir kategoriye uymayan/agent_code'u
  olmayan durumlarda genel il/ilçe + m² sorularına düşer.
- Tüm sorular o hizmetin listesindeki sırayla, tek tek (aynı mesajda değil)
  sorulur; liste bitince sabit bir kapanış cümlesiyle sohbet bitirilir (bkz.
  n8n'deki AI Agent node'unun System Message'ı — buradaki tam cümle orada
  tanımlı, bu doküman sadece DB kontratını kapsar).

## Dinamik hizmet/soru sistemi (2026-09-27, "kalıcı/otomatik sistem")

Agent'ın hangi hizmetleri tanıdığı ve her hizmet için hangi soruları soracağı
**n8n workflow'una gömülü DEĞİL** — her firmanın kendi `product_categories`
satırlarından çalışma zamanında okunuyor. Kullanıcı kararı (2026-09-27):
*"BU HİZMETLER FİRMAYA GÖRE DEĞİŞECEK, BEN DE ONU FİRMAYA GÖRE
GÜNCELLEYECEM"* — yani yeni bir müşteri firma eklendiğinde veya bir firmanın
hizmetleri değiştiğinde **n8n workflow'una hiç dokunmaya gerek yok**, sadece
o firmanın `product_categories` satırları CRM panelinden (Firma Ayarları)
veya doğrudan Supabase'den güncellenir.

- `product_categories.agent_code` (migration `0029_agent_category_questions.sql`):
  bu kategorinin `leads.product_interest` kodu (`heat_pump` / `air_conditioner`
  / `vrf` / `solar_panel` / `solar_water_heater` / `other`). **Null ise agent bu
  kategoriyi hiç tanımaz** — ihtiyaç analizi sorularına dahil etmez (örn. firma
  içi sadece raporlama amaçlı tutulan bir kategori olabilir).
- `product_categories.agent_questions` (aynı migration): bu hizmet için agent'ın
  sırayla soracağı sorular, bir JSON metin dizisi (`["Soru 1?", "Soru 2?", ...]`).
  Boş/null ise agent genel soru setini kullanır: "Hangi il ve ilçede bu hizmeti
  istiyorsunuz?" + "Kaç m²'lik bir alan için düşünüyorsunuz?".
- n8n tarafında akış **tek bir sıralı zincir** (paralel dal YOK — daha önce
  paralel denendi, `AI Agent`'ın "Connected Chat Trigger Node" prompt
  kaynağı kendi girdisinde `chatInput` alanı arıyor ve `Test Config`
  atlanınca bu alan kayboluyordu, o yüzden zincire çevrildi):
  `Test Config` → `Get Product Categories` (Supabase "Get many rows",
  `product_categories` tablosu, `company_id` filtresi) → `Build Services
  Prompt` (Code node — her kategoriyi formatlar, `agent_code` olmayanları
  eler, sona her zaman sabit bir "Diğer" fallback bloğu ekler, `Test
  Config`'ten `$('Test Config').first().json` ile `chatInput`/`sessionId`/
  `company_id`/`customer_phone`'u da kendi çıktısına taşır — Code node'un
  `return [{ json: {...} }]`'ı item'ı komple değiştirdiği için bu alanlar
  taşınmazsa AI Agent'ın prompt kaynağı "No prompt specified" hatası verir)
  → `AI Agent` (main input olarak SADECE `Build Services Prompt`'a bağlı).
  AI Agent'ın System Message'ı Expression modunda: `Test Config`'teki sabit
  `static_prompt` metnindeki `{FİRMA_HİZMETLERİ_BURAYA}` yer tutucusunu
  `Build Services Prompt`'un ürettiği metinle `.replace()` ile değiştirir.
  `Test Config` yine de `AI Agent`'tan sonraki adımların (`Get many rows`,
  `Create a row`, `Log Activity` vb.) `$('Test Config').item.json...`
  referanslarında kullanılabilir, çünkü zincirin bir parçası olduğu için
  n8n'in `$('NodeName')` çözümlemesi hâlâ ona erişebiliyor.
  **Bilinen kozmetik sorun (henüz düzeltilmedi):** `Build Services Prompt` →
  `AI Agent` arasında n8n canvas'ında YANLIŞLIKLA iki özdeş (duplicate) bağlantı
  oluştu (bağlantıyı sürükleyerek eklerken); işlevi etkilemiyor (uçtan uca
  test başarılı) ama temizlenmesi gerekiyor.
- Bugün (2026-09-27) İklimlen'in (`c8ac30bc-9ba4-4fe9-8462-619e3fa496ae`)
  mevcut 4 kategorisinden 3'ü dolduruldu: Isı Pompası→`heat_pump`, Klima→
  `air_conditioner`, VRF/VRV Sistemi→`vrf` (Klima/VRF soru seti kullanıcı
  tarafından henüz teyit edilmedi, tahmini varsayılan). "Diğer" kategorisi
  `agent_code = null` bırakıldı (agent'ın zaten kendi sabit "Diğer" fallback
  bloğu var, ayrıca ihtiyaç yok).
- Uçtan uca doğrulandı: gerçek n8n Chat Trigger testi ile "Isı pompasıyla
  alakalı bilgi alabilir miyim?" → doğru sırayla 3 dinamik soru (il/ilçe, m²,
  ısınma yöntemi) → doğru kapanış cümlesi → `leads`/`activities`'e doğru
  yazıldı (city/district/area_m2/product_interest doğru, notlar doğru),
  test verisi temizlendi.

**Bilinen sınır (henüz çözülmedi):** Sesli mesaj/medya desteği yok. Test ortamında
(n8n Chat Trigger) zaten sadece metin var. Gerçek WhatsApp Business API'ye
bağlandığında: gelen mesajın tipi (metin/ses/resim/video/belge) kontrol edilmeli,
**ses veya diğer medya mesajlarında AI Agent hiç çalıştırılmamalı ve HİÇBİR cevap
gönderilmemeli** (tahminle yanlış cevap vermektense sessiz kalıp insan satış
temsilcisinin dinlemesini beklemek — kullanıcı kararı, 2026-09-27). Bu, workflow'a
"mesaj tipi metin mi?" kontrolü olarak eklenmesi gereken bir yönlendirme adımı,
henüz uygulanmadı.

**Bilinen sınır (henüz çözülmedi):** Kullanıcı, agent'ın SADECE reklamdan gelen
mesajlara devreye girmesini, firma sahibinin aynı hat üzerinden eş/dost ile
yaptığı normal WhatsApp sohbetlerine karışmamasını istiyor. Bu, düz metinden
AI'ın anlayabileceği bir şey değil ("Merhaba" yazan bir arkadaş ile "Merhaba"
yazan bir müşteri metinde ayırt edilemez) — gerçek çözüm, WhatsApp Business
Cloud API'nin "Click-to-WhatsApp Ads" mesajlarında gönderdiği `referral`
alanını (reklamdan geldiğini kanıtlayan meta veri) n8n workflow'unda AI Agent
çalışmadan ÖNCE kontrol edip, bu alan yoksa workflow'u sessizce durdurmaktır.
Bu, gerçek WhatsApp Business API bağlantısı kurulduğunda (şu an test Chat
Trigger kullanılıyor) eklenmesi gereken bir yönlendirme adımıdır — henüz
uygulanmadı.

## Agent'ın yetkisi: leads üzerinde upsert + notes/activities

n8n workflow'u ("WhatsApp Lead Intake") her gelen mesajda önce `phone` +
`company_id` ile `leads` tablosunda mevcut kayıt arar (`Get many rows`):

1. **Kayıt yoksa** → `public.leads` tablosuna **yeni satır ekler** (insert),
   WhatsApp'tan gelen ilk mesajla anında panelde görünmesi için.
2. **Kayıt zaten varsa** → aynı satırı **günceller** (update), sadece aşağıda
   izin verilen kolonlarla.
3. Her iki durumda da `public.activities` tablosuna **yeni satır ekler**
   (`type: 'note'`) ve `leads.notes` alanına zaman damgalı ekleme yapar.

Bu sayede konuşma birkaç mesaja yayılsa bile (konut tipi bir mesajda,
metrekare bir sonrakinde gelebilir), agent her turda öğrendiği yeni bilgiyi
**aynı lead satırına** işler — DB şeması zaten `property_type`, `area_m2`,
`product_interest` kolonlarını içerdiği için buna ek migration gerekmedi.

Agent **asla**:
- `leads.status`'u değiştirmez (pipeline durumu — Lead/Keşif-Teklif/Takip/
  Satış/Kayıp — her zaman satış personeli/firma sahibi tarafından elle
  belirlenir).
- `leads.last_contact_at`'e dokunmaz (bu alan sadece GERÇEK, insan tarafından
  yapılan bir görüşme/temas sonrasında güncellenir — WhatsApp'taki otomatik
  agent yazışması bir "temas" sayılmaz; bununla karıştırılmaması gereken,
  agent'ın da güncellediği ayrı bir alan olan `last_activity_at` için aşağıdaki
  "Neden önemli" bölümüne bkz.).
- `leads.assigned_salesperson`'u, `leads.next_followup_at/note`'unu,
  `leads.priority`, `leads.offered_amount`, `leads.contacted_by`'ı değiştirmez
  (bunların hepsi insan/satış tarafının işi).
- Var olan bir `leads.notes` değerini agent'ın kendi önceki notunu SİLEREK
  değil, üstüne EKLEYEREK güncellemesi beklenir (aşağıya bkz.).
- Update sırasında bir alanı (ör. `property_type`) yeni bilgi gelmediyse
  `null` ile EZMEZ — önceki DB değerini korur (`yeni_deger || eski_deger`
  mantığıyla).

## Lead oluştururken/güncellerken doldurulacak alanlar

| Alan | Zorunlu mu | Kural |
|---|---|---|
| `phone` | **Evet** (sadece insert) | WhatsApp numarası, olduğu gibi. Update'te bu alan zaten mevcut satırı eşleştirmek için kullanılır, değiştirilmez. |
| `first_name` | Hayır | WhatsApp'ta görünen profil adı/konuşmadan çıkan isim varsa yaz. **Yoksa/bulunamıyorsa alanı NULL/boş bırak — asla isim icat etme.** |
| `last_name` | Hayır | Aynı kural. |
| `company_id` | **Evet** (sadece insert) | Mesajın hangi WhatsApp Business numarasına geldiğine göre n8n tarafında belirlenir (hangi firmanın hattı) — bugünkü test workflow'unda `Test Config` node'undan sabit geliyor, gerçek WhatsApp entegrasyonunda phone_number_id→company_id eşleme tablosundan gelecek. |
| `area_m2` | Önerilir | Sayı, metrekare — hizmetin uygulanacağı alan. Öğrenilmediyse dokunma/null. |
| `city` | Önerilir | Serbest metin, il. Öğrenilmediyse dokunma/null. |
| `district` | Önerilir | Serbest metin, ilçe. Öğrenilmediyse dokunma/null. |
| `product_interest` | Önerilir | **Serbest metin DEĞİL** — veritabanı check constraint'i var (`leads_product_interest_check`, migration 0009 + 0028, **0028 canlı veritabanına uygulandı ve doğrulandı — `solar_panel`/`solar_water_heater` artık kabul ediliyor**), sadece şu İngilizce kodlar kabul edilir: `heat_pump` (Isı Pompası), `air_conditioner` (Klima), `vrf` (VRF/VRV Sistemi), `solar_panel` (Güneş Paneli), `solar_water_heater` (Güneş Enerjili Su Isıtma Sistemi), `other` (Diğer). Müşteriyle Türkçe konuşulur, ama bu alana yazılırken mutlaka bu kodlardan biri kullanılmalı. |
| `product_category_id` | Opsiyonel | O `company_id`'ye ait `product_categories` tablosundan (firma bazlı, Türkçe `label` alanı) eşleşen kategori seçilebilir — `product_interest`'ten ayrı, ek/gelecek bir alan, bugünkü workflow bunu doldurmuyor. |
| `notes` | Önerilir | Agent'ın o turdaki özeti, zaman damgalı eklenir (bkz. aşağı). |

**Not:** `property_type` (konut tipi) artık agent tarafından SORULMUYOR/yazılmıyor (kullanıcı kararı, 2026-09-27). Bu alan CRM panelinde hâlâ mevcut ve manuel form üzerinden doldurulabilir, agent sadece dokunmuyor. Sorulan sorular artık sabit "sadece area_m2 + city/district" değil — yukarıdaki "Dinamik hizmet/soru sistemi" bölümüne bkz.: her hizmetin kendi soru listesi var (`product_categories.agent_questions`), sadece hiçbir kategoriye uymayan/agent_code'u olmayan durumlarda genel il/ilçe + m² sorularına düşülüyor. Bu ekstra soruların (ör. ısınma yöntemi, çatı/arazi, kişi sayısı) DB'de ayrı bir kolonu yok — hepsi `notes` alanına serbest metin olarak ekleniyor.

`status` alanı hiç gönderilmemeli — veritabanı varsayılanı (`new` = "Lead")
otomatik uygulanır, bu doğru davranıştır.

## `notes` alanını doldurma/güncelleme kuralı

`leads.notes` **tek bir metin alanı** — üzerine yazıldığında öncekini kaybeder.
Agent bu alanı ilk oluşturmada doldurur; sonraki her güncellemede **önceki
içeriği koruyup altına ekleyerek** yazmalı (örnek biçim):

```
[22 Eyl 09:14] Villa, yerden ısıtma yok, bütçe belirtmedi. Isı pompası ile ilgileniyor.
[22 Eyl 14:30] Kombiyi tamamen değiştirmek istiyor, keşif için uygun.
```

Bu, "yaptığı bilgilendirme doğrultusunda kendi görüşünü not kısmına yazsın"
isteğinin karşılığıdır — satış personeli lead detayına girdiğinde "Ajan
Görüşü" panelinde bu birikmiş özeti görür.

## Her etkileşimde `activities` tablosuna da bir satır eklenmeli (önerilir)

`notes` alanını güncellemenin yanında, aynı anda `public.activities` tablosuna
`type: 'note'` ile bir satır eklemek **şiddetle önerilir**:

```sql
insert into public.activities (lead_id, company_id, type, description)
values ('<lead_id>', '<company_id>', 'note', 'WhatsApp: müşteri keşif tarihi sordu.');
```

**Neden önemli:** Bu tabloya her insert, bir veritabanı trigger'ı üzerinden
`leads.last_activity_at`'i otomatik günceller. "Gecikenler" sayfası, bir takip
tarihi geldiğinde **herhangi bir not bile** güncelleme sayıldığı için bu alanı
kullanır (bkz. `src/lib/utils.ts` → `isLeadOverdue`). Agent bu satırı hiç
eklemezse, WhatsApp'ta gerçek bir yazışma olsa bile CRM bunu "hiç güncelleme
yok" sayabilir.

**Bilinen risk / gelecekte gözden geçirilecek nokta:** `last_activity_at`
şu an agent'ın kendi otomatik mesajlarını da "güncelleme" olarak sayıyor. Yani
bir takip günü geldiğinde satış personeli hiç aramasa bile, agent'ın o gün
müşteriyle bir WhatsApp yazışması olduysa "Gecikenler" listesine düşmeyebilir.
Bunun istenip istenmediği (agent'ın kendi mesajlarının insan takibinin yerini
tutup tutamayacağı) ayrıca netleştirilmeli — gerekirse trigger, `created_by IS
NOT NULL` (yani sadece giriş yapmış bir insan tarafından eklenen satırlar)
koşuluyla sınırlandırılabilir.

## Agent asla giremeyeceği alanlar/tablo hakları

Agent'ın kullandığı `service_role` anahtarı RLS'yi (Row Level Security) atlar
— yani teknik olarak her şeye yazabilir. Bu nedenle bu dokümandaki sınırlar
**veritabanı tarafından zorlanmıyor, n8n prompt/flow tasarımıyla** korunuyor.
n8n flow'una sadece "insert to leads", "update leads.notes", "insert to
activities" adımları eklenmeli; `status`/`last_contact_at`/`assigned_salesperson`
güncelleyen hiçbir adım olmamalı.

**Anahtar güvenliği (bkz. docs/security.md):**
- Agent için YALNIZCA yeni format `sb_secret_...` anahtarı kullanılmalı ve sadece
  n8n'in şifreli credential deposunda tutulmalı (workflow JSON'una, loglara, sohbete,
  repoya ASLA yazılmamalı). Sızdığından şüphelenilirse Supabase → Settings → API Keys
  üzerinden hemen yenilenmeli.
- Projede hâlâ **eski (legacy) `service_role` JWT anahtarı** etkin. Agent artık
  `sb_secret_...` kullanıyorsa, Settings → API Keys → "Legacy API keys" altından
  eski anahtarlar devre dışı bırakılmalı (ikinci bir tam-yetkili anahtar gereksiz risk).
- Veritabanı artık lead'e bağlı kayıtlarda (`activities` vb.) `lead_id` ile `company_id`
  uyuşmazlığını reddeder (migration 0026) — agent yanlış firmanın `company_id`'siyle
  yazmaya çalışırsa `23514` hatası alır.

## `discovery_visits`, `followups`, `sales` — agent'ın hiç dokunmadığı tablolar

Bunlar tamamen insan tarafından (satış personeli/firma sahibi) panelden
yönetilir. Agent bunlara asla yazmaz.
