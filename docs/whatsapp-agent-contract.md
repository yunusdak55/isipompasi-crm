# WhatsApp Agent — Veritabanı Kontratı

Bu doküman, WhatsApp'a bağlı AI agent'ın (n8n üzerinden, Supabase'e `service_role`
anahtarıyla doğrudan yazan bir dış sistem) bu CRM ile arasındaki **tam ve tek**
sözleşmedir. n8n tarafında agent'a prompt yazılırken buradaki alan adları,
sınırlar ve kurallar birebir kullanılmalı — kod tarafında bir şey değişirse bu
dosya da güncellenir.

## Agent'ın yetkisi: SADECE iki şey

1. `public.leads` tablosuna **yeni satır ekleme** (insert) — WhatsApp'tan gelen
   ilk mesajla bir potansiyel müşteri kaydı açmak için.
2. `public.leads.notes` alanını **güncelleme** ve/veya `public.activities`
   tablosuna **yeni satır ekleme** — kendi değerlendirmesini/görüşünü not
   olarak bırakmak için.

Agent **asla**:
- `leads.status`'u değiştirmez (pipeline durumu — Lead/Keşif-Teklif/Takip/
  Satış/Kayıp — her zaman satış personeli/firma sahibi tarafından elle
  belirlenir).
- `leads.last_contact_at`'e dokunmaz (bu alan sadece GERÇEK, insan tarafından
  yapılan bir görüşme/temas sonrasında güncellenir — bkz. aşağıdaki "Neden"
  bölümü).
- `leads.assigned_salesperson`'u değiştirmez (atama ajans/firma sahibinin işi).
- Var olan bir `leads.notes` değerini agent'ın kendi önceki notunu SİLEREK
  değil, üstüne EKLEYEREK güncellemesi beklenir (aşağıya bkz.).

## Lead oluştururken doldurulacak alanlar

| Alan | Zorunlu mu | Kural |
|---|---|---|
| `phone` | **Evet** | WhatsApp numarası, olduğu gibi. |
| `first_name` | Hayır | WhatsApp'ta görünen profil adı varsa onu yaz. **Yoksa/bulunamıyorsa alanı NULL/boş bırak — asla isim icat etme.** (Şema artık bunu destekliyor: `first_name` nullable.) |
| `last_name` | Hayır | Aynı kural — WhatsApp adı tek kelimeyse boş bırakılır. |
| `company_id` | **Evet** | Mesajın hangi WhatsApp Business numarasına geldiğine göre n8n tarafında belirlenir (hangi firmanın hattı). Bu dokümanın kapsamı dışında — n8n flow'unun kendi yönlendirme mantığı. |
| `product_category_id` | Önerilir | "Gerekli hizmeti seçsin" (spec) — o `company_id`'ye ait `product_categories` tablosundan (ör. Isı Pompası, Klima, VRF) konuşmadan çıkardığı kategoriyi seç. Emin değilse boş bırak, insan düzenler. |
| `notes` | Önerilir | Agent'ın ilk değerlendirmesi/görüşü (bkz. aşağı). |

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

## `discovery_visits`, `followups`, `sales` — agent'ın hiç dokunmadığı tablolar

Bunlar tamamen insan tarafından (satış personeli/firma sahibi) panelden
yönetilir. Agent bunlara asla yazmaz.
