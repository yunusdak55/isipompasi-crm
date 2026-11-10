# WhatsApp ön görüşme botu: kurulum

Bot, müşteri firmanın Meta reklamından WhatsApp'a yazan kişiye o firmanın temel sorularını sorar.
Kişiyi panelde lead olarak açar (numara, WhatsApp adı, il/ilçe, m², hizmet, reklam başlığı).
Sohbet bitince zaman çizelgesine tek bir **"Ön görüşme"** notu yazar. Satış personeli arayıp kendi notunu ve takip gününü panelden girer.

## Parçalar

| Parça | Nerede | Not |
|---|---|---|
| Workflow "WhatsApp Bot - Çoklu Firma" | n8n (`n8n-7jne.iklimlen.com`), kaynak `n8n/whatsapp-bot.json` | Bütün firmalar için TEK workflow |
| Yükleme | `node scripts/n8n-deploy.mjs [--activate]` | API anahtarı `~/.config/iklimlen/n8n.env` |
| Veritabanı | migration `0035_whatsapp_bot.sql` (canlıda, 2026-11-10) | `whatsapp_lines`, `whatsapp_conversations`, `whatsapp_messages`, `wa_inbound`, `wa_bot_reply`, `wa_close_stale` |
| Hangi hat hangi firma | Panel → Entegrasyonlar → **WhatsApp Bot Hatları** | Yeni müşteri buradan eklenir |
| Sorular | Panel → Firma Ayarları → kategoriler (`agent_code` + `agent_questions`) | Firmaya göre |
| Webhook | `https://n8n-7jne.iklimlen.com/webhook/whatsapp` (GET doğrulama + POST mesaj) | |

## Botun kuralları

- **Reklam şartı:** Yeni sohbet yalnızca reklamdan gelen metin mesajıyla başlar (Meta `referral` bilgisi). Firma sahibinin eşiyle dostuyla yazışmasına karışmaz. Hat ayarında kapatılabilir.
- **Sesli mesaj, resim, belge:** Bot cevap vermez. Geçmişe "[audio gönderildi]" diye işaret düşer.
- **Tekrar gelen mesaj:** Meta aynı mesajı iki kez gönderirse ikincisi işlenmez.
- **Sohbet bitince:** Bot kapanış cümlesinden sonra susar; müşteriyi satış temsilcisi devralır.
- **Yarım kalan sohbet:** 3 saat sessiz kalırsa o ana kadar öğrenilenler "Ön görüşme (müşteri yanıtı yarıda kaldı)" notu olarak yazılır. Bu kontrol 30 dakikada bir çalışır.
- **Panele dokunmadığı alanlar:** Bot durum, takip tarihi, görüşen kişi ve son temas alanlarını değiştirmez (bkz. `docs/whatsapp-agent-contract.md`).
- **Test modu:** Hat test modundaysa cevap kaydedilir ama WhatsApp'a gönderilmez.

## Bir kez yapılacaklar (İklimlen)

1. **Meta uygulaması:** developers.facebook.com'da İklimlen'in Business portföyüne bağlı bir uygulama açılır ve WhatsApp ürünü eklenir.
2. **Webhook:**
   - WhatsApp → Configuration → Callback URL: `https://n8n-7jne.iklimlen.com/webhook/whatsapp`
   - Verify token: herhangi bir kelime (bot kontrol etmiyor).
   - Abone olunacak alan: `messages`.
3. **Kalıcı token:** Business ayarları → Sistem kullanıcıları → yönetici sistem kullanıcısı oluşturulur, uygulama ve WhatsApp hesapları atanır. Token şu izinlerle ve süresiz üretilir: `whatsapp_business_messaging`, `whatsapp_business_management`.
4. **n8n kimlik bilgisi:**
   - n8n → Credentials → New → **Header Auth**
   - Name: `Authorization`, Value: `Bearer <token>`
   - Kimlik bilgisinin adı: **WhatsApp (Meta)**
   - Workflow'da **WhatsApp'a Gönder** düğümünde bu kimlik bilgisi seçilir. `n8n-deploy.mjs` sonraki yüklemelerde bu seçimi korur.
5. **İlk hat:** Uygulama canlı moda alınır. İşletme doğrulaması gerekiyorsa tamamlanır.

Token yalnızca n8n'de durur; panelde, veritabanında ve bu repoda yoktur.

## Her yeni müşteri (5-10 dakika)

1. **Numarayı bağla:** Müşterinin WhatsApp numarası Cloud API'ye bağlanır.
   - Müşterinin kendi Meta Business hesabında kalır; İklimlen'e iş ortağı olarak paylaşılır ve sistem kullanıcısına atanır.
   - Numara WhatsApp Business uygulamasında da kullanılmaya devam edecekse "coexistence" ile bağlanır.
2. **Uygulamaya abone et:** Müşterinin WhatsApp hesabı uygulamaya abone edilir (`POST /{waba_id}/subscribed_apps`). Abone olmayan hesabın mesajları bota hiç gelmez.
3. **Panele ekle:** Panel → Entegrasyonlar → WhatsApp Bot Hatları
   - Firmayı seç.
   - **Phone Number ID**'yi yaz (Meta → WhatsApp → API Setup ekranındaki numara kimliği; telefon numarasının kendisi değil).
   - Önce **Test modu**nu açık bırakıp kendi telefonundan reklam bağlantısıyla yaz. Cevaplar panele düşüyorsa test modunu kapat.
4. **Soruları gir:** Firma Ayarları'nda her hizmetin `agent_code`'u ve soruları girilir. Sorusu olmayan hizmette bot genel il/ilçe + m² sorularını sorar.
5. **Reklamı bağla:** Reklam "WhatsApp'a mesaj gönder" hedefiyle bu numaraya bağlanır.

n8n'e dokunulmaz.

## Sınama

`TEST_IKLIMLEN` adlı bir test hattı İklimlen firmasında test modunda durur; Meta bu numarayı hiç göndermez.

Meta biçiminde sahte bir mesaj göndermek için:

```bash
curl -X POST https://n8n-7jne.iklimlen.com/webhook/whatsapp -H 'Content-Type: application/json' -d '{"entry":[{"changes":[{"value":{"metadata":{"phone_number_id":"TEST_IKLIMLEN"},"contacts":[{"profile":{"name":"Test"},"wa_id":"905550000101"}],"messages":[{"from":"905550000101","id":"wamid.deneme1","type":"text","text":{"body":"Isı pompası hakkında bilgi alabilir miyim?"},"referral":{"source_id":"1","headline":"Deneme"}}]}}]}]}'
```

**2026-11-10 testinde doğrulananlar:**
- Reklamsız numaraya bot sessiz kaldı.
- Reklamdan gelene 3 soru sırayla soruldu, ardından kapanış cümlesi geldi.
- Lead `05…` biçiminde açıldı; ad, il/ilçe, m², hizmet ve reklam başlığı doğru doldu.
- Zaman çizelgesine tek not düştü.
- Tekrar gönderilen mesaj işlenmedi.
- Sadece "Merhaba" yazana "Merhaba, nasıl yardımcı olabiliriz?" dendi.
- Sesli mesaja cevap verilmedi.
- Yarım kalan sohbet not olarak kapandı.

Test kayıtları silindi.
