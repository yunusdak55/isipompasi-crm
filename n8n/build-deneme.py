"""n8n/bot-deneme.json ureteci: n8n ekranindaki sohbet penceresinden botu musteri gibi denemek icin.

Kullanim: python3 n8n/build-deneme.py n8n/bot-deneme.json && node scripts/n8n-deploy.mjs n8n/bot-deneme.json

Akis: Sohbet penceresine yazilan mesaj, Meta'nin gonderdigi bicimde gercek bot webhook'una
TEST_IKLIMLEN hattindan (test modu: WhatsApp'a hicbir sey gitmez) gonderilir. 15 sn sonra botun
cevabi veritabanindan okunup sohbet penceresine yazilir. Her sohbet oturumu ayri bir test
musterisidir (0555 009 xx xx); lead panelde Iklimlen altinda gorunur.
"""
import json, sys, uuid

OUT = sys.argv[1]
SUPABASE_URL = "https://dhnwcvirgnkpnlrurdap.supabase.co"
SUPA_CRED = {"supabaseApi": {"id": "jHSd1FJtTriSFKqE", "name": "Supabase account"}}

PREP_JS = r"""
// Sohbet oturumu -> sabit bir test numarasi (her yeni oturum yeni musteri).
const sid = String($json.sessionId || 'deneme');
let h = 7;
for (const ch of sid) h = (h * 31 + ch.charCodeAt(0)) % 10000;
const phone = '90555009' + String(h).padStart(4, '0');
const text = String($json.chatInput || '').trim();
const now = Date.now();
const m = { from: phone, id: 'deneme.' + now + '.' + Math.random().toString(36).slice(2, 8), timestamp: String(Math.floor(now / 1000)) };
const cmd = text.toLowerCase();
if (cmd === '/ses') { m.type = 'audio'; m.audio = { id: 'deneme', mime_type: 'audio/ogg', voice: true }; }
else if (cmd === '/foto') { m.type = 'image'; m.image = { id: 'deneme', mime_type: 'image/jpeg' }; }
else if (cmd === '/konum') { m.type = 'location'; m.location = { latitude: 41.5636, longitude: 35.9071 }; }
else { m.type = 'text'; m.text = { body: text }; }
// Her mesaj reklamdan gelmis gibi isaretlenir (reklam: isi pompasi).
m.referral = { source_type: 'ad', source_id: 'deneme', headline: 'Isı pompasıyla faturanızı düşürün',
               body: 'Kışın doğalgaz faturasına son.' };
const payload = { object: 'whatsapp_business_account', entry: [{ id: '0', changes: [{ field: 'messages', value: {
  messaging_product: 'whatsapp', metadata: { phone_number_id: 'TEST_IKLIMLEN' },
  contacts: [{ profile: { name: 'Deneme Müşteri' }, wa_id: phone }], messages: [m] } }] }] };
return [{ json: { phone, panelPhone: '0' + phone.slice(2), sentAt: new Date(now - 1000).toISOString(), payload } }];
"""

ANSWER_JS = r"""
// Bu mesajdan sonra botun yazdigi cevap(lar).
const prep = $('Mesajı Hazırla').first().json;
const since = new Date(prep.sentAt).getTime();
const msgs = [];
for (const it of $input.all()) {
  for (const m of (it.json.whatsapp_messages || [])) {
    if (m.role === 'bot' && new Date(m.created_at).getTime() > since) msgs.push(m);
  }
}
msgs.sort((a, b) => a.id - b.id);
let out = msgs.map(m => m.body).join('\n\n');
if (!out) {
  out = '(Bot cevap vermedi. "tamam", "👍" gibi cevap gerektirmeyen bir mesajsa ya da sohbet bittikten sonraki kısa cevap hakkı dolduysa bu normaldir.)';
}
if (/bilgilerinizi aldım/i.test(out)) {
  out += '\n\n— Ön görüşme bitti. Panelde bu müşteri: ' + prep.panelPhone + ' (İklimlen). Yeni müşteri gibi denemek için sohbeti sıfırla.';
}
return [{ json: { output: out } }];
"""


def node(name, type_, ver, pos, params, **extra):
    n = {"id": str(uuid.uuid5(uuid.NAMESPACE_URL, "iklimlen-wa-deneme/" + name)), "name": name, "type": type_,
         "typeVersion": ver, "position": pos, "parameters": params}
    n.update(extra)
    return n


nodes = [
    node("Sohbet (müşteri gibi yaz)", "@n8n/n8n-nodes-langchain.chatTrigger", 1.1, [0, 0], {"options": {}},
         webhookId=str(uuid.uuid5(uuid.NAMESPACE_URL, "iklimlen-wa-deneme/chat"))),
    node("Mesajı Hazırla", "n8n-nodes-base.code", 2, [220, 0], {"jsCode": PREP_JS.strip()}),
    node("Bota Gönder", "n8n-nodes-base.httpRequest", 4.2, [440, 0], {
        "method": "POST", "url": "https://n8n-7jne.iklimlen.com/webhook/whatsapp",
        "sendBody": True, "specifyBody": "json", "jsonBody": "={{ JSON.stringify($json.payload) }}",
        "options": {"timeout": 15000}}),
    node("Botun Cevabını Bekle (15 sn)", "n8n-nodes-base.wait", 1.1, [660, 0], {
        "resume": "timeInterval", "amount": 15, "unit": "seconds"},
        webhookId=str(uuid.uuid5(uuid.NAMESPACE_URL, "iklimlen-wa-deneme/wait"))),
    node("Cevabı Oku", "n8n-nodes-base.httpRequest", 4.2, [880, 0], {
        "method": "GET",
        "url": "={{ '" + SUPABASE_URL + "/rest/v1/whatsapp_conversations?select=whatsapp_messages(id,role,body,created_at)"
               "&order=started_at.desc&limit=1&wa_phone=eq.' + $('Mesajı Hazırla').first().json.phone }}",
        "authentication": "predefinedCredentialType", "nodeCredentialType": "supabaseApi",
        "options": {"timeout": 15000}}, credentials=SUPA_CRED, alwaysOutputData=True),
    node("Cevabı Göster", "n8n-nodes-base.code", 2, [1100, 0], {"jsCode": ANSWER_JS.strip()}),
]
conn = lambda t: {"main": [[{"node": t, "type": "main", "index": 0}]]}
connections = {
    "Sohbet (müşteri gibi yaz)": conn("Mesajı Hazırla"),
    "Mesajı Hazırla": conn("Bota Gönder"),
    "Bota Gönder": conn("Botun Cevabını Bekle (15 sn)"),
    "Botun Cevabını Bekle (15 sn)": conn("Cevabı Oku"),
    "Cevabı Oku": conn("Cevabı Göster"),
}
wf = {"name": "Bot Deneme Sohbeti", "nodes": nodes, "connections": connections,
      "settings": {"executionOrder": "v1", "timezone": "Europe/Istanbul"}}
json.dump(wf, open(OUT, "w"), ensure_ascii=False, indent=2)
print("ok", len(nodes), "node")
