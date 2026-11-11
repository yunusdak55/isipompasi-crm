"""n8n/whatsapp-bot.json ureteci. Botun talimati: n8n/bot-istemi.txt.
Kullanim: python3 n8n/build-workflow.py n8n n8n/whatsapp-bot.json && node scripts/n8n-deploy.mjs"""
import json, os, re, sys, uuid

D = sys.argv[1]
OUT = sys.argv[2]
SUPABASE_URL = "https://dhnwcvirgnkpnlrurdap.supabase.co"
SUPA_CRED = {"supabaseApi": {"id": "jHSd1FJtTriSFKqE", "name": "Supabase account"}}
# "WhatsApp Bot - Hata Kaydı" workflow'unun n8n kimligi (n8n/build-hata-kaydi.py ile kurulur).
# Botta yakalanmayan her hata (Supabase, WhatsApp gonderimi...) Denetim Kaydi'na yazilir.
ERROR_WF_ID = "iC9iKT6rfIBMJJUa"
OPENAI_CRED = {"openAiApi": {"id": "Mcu5ZOGxNWJMI0yP", "name": "OpenAI account"}}

sp = open(f"{D}/bot-istemi.txt").read().strip()
for ph in ("{FIRMA_ADI}", "{FİRMA_HİZMETLERİ_BURAYA}", "{FIRMA_BILGILERI}"):
    assert ph in sp, ph
SCHEMA = {
    "type": "object",
    "properties": {
        "reply_to_customer": {"type": "string", "description": "Musteriye gonderilecek kisa WhatsApp mesaji; yalnizca kapanistan sonra cevap gerekmiyorsa bos string"},
        "area_m2": {"type": ["number", "null"], "description": "Metrekare, ogrenilmediyse null"},
        "product_interest": {"type": ["string", "null"], "enum": ["heat_pump", "air_conditioner", "vrf", "solar_panel", "solar_water_heater", "other", None],
                              "description": "Ilgilendigi hizmet kodu (hizmet listesindeki parantez ici kod)"},
        "city": {"type": ["string", "null"], "description": "Musterinin ili, ogrenilmediyse null"},
        "district": {"type": ["string", "null"], "description": "Musterinin ilcesi, ogrenilmediyse null"},
        "customer_name": {"type": ["string", "null"], "description": "Musteri adini sohbette soyledi ise adi, yoksa null"},
        "summary_note": {"type": ["string", "null"], "description": "Bu turda ogrenilen yeni bilginin tek satirlik Turkce ozeti (sorularin cevaplari yaninda baska telefon numarasi, arama saati, randevu istegi, teknik soru, itiraz gibi ek bilgiler de); yeni bilgi yoksa null"},
        "conversation_complete": {"type": "boolean", "description": "Kapanis cumlesi bu turda gonderildiyse true"},
        "final_summary": {"type": ["string", "null"], "description": "Yalnizca kapanis turunda: ogrenilen her seyin 1-3 cumlelik notu, musteri baska dilde yazsa bile MUTLAKA TURKCE; diger turlarda null"},
    },
    "required": ["reply_to_customer", "conversation_complete"],
}

PARSE_JS = r"""
// Meta'nin gonderdigi govdeyi tek tek mesajlara ayirir. "iletildi/okundu"
// bildirimleri (statuses) burada elenir: mesaj yoksa akis durur.
const out = [];
for (const item of $input.all()) {
  const body = item.json.body || item.json;
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const v = change.value || {};
      const lineId = v.metadata && v.metadata.phone_number_id;
      for (const m of v.messages || []) {
        const contact = (v.contacts || []).find(c => c.wa_id === m.from) || (v.contacts || [])[0] || {};
        let type = m.type;
        let text = null;
        // Tepki (mesaja emoji birakma) konusma degil: hic kaydedilmez.
        if (m.type === 'reaction') continue;
        const OK = ['text', 'button', 'interactive', 'audio', 'voice', 'image', 'video', 'document', 'sticker', 'location', 'contacts'];
        if (!OK.includes(m.type)) continue;  // system, unsupported, order vb.
        if (m.type === 'text') text = m.text && m.text.body;
        else if (m.type === 'location') {
          // Konum cevap gerektirmez ama satis temsilcisi icin harita linki saklanir.
          const l = m.location || {};
          if (l.latitude != null && l.longitude != null) {
            text = 'https://maps.google.com/?q=' + l.latitude + ',' + l.longitude
              + (l.name || l.address ? ' (' + [l.name, l.address].filter(Boolean).join(', ') + ')' : '');
          }
        }
        else if (m.type === 'button') { type = 'text'; text = m.button && m.button.text; }
        else if (m.type === 'contacts') {
          // Paylasilan kisi karti (ör. "eşimin numarası"): ad + numara metne cevrilir.
          type = 'text';
          text = '[kişi kartı] ' + (m.contacts || []).map(c =>
            ((c.name && (c.name.formatted_name || c.name.first_name)) || 'İsimsiz') + ': ' +
            (c.phones || []).map(ph => ph.phone || ph.wa_id).filter(Boolean).join(', ')).join(' | ');
        }
        else if (m.type === 'interactive') {
          const r = m.interactive || {};
          type = 'text';
          text = (r.button_reply && r.button_reply.title) || (r.list_reply && r.list_reply.title) || null;
        }
        out.push({ json: {
          p_phone_number_id: lineId,
          p_wamid: m.id,
          p_from: m.from,
          p_profile_name: (contact.profile && contact.profile.name) || null,
          p_type: type,
          p_text: text,
          p_referral: m.referral || null,
        }});
      }
    }
  }
}
return out;
"""

PROMPT_JS = r"""
const TEMPLATE = __TEMPLATE__;
const GENERIC = ["Hangi il ve ilçede bu hizmeti istiyorsunuz?", "Kaç m²'lik bir alan için düşünüyorsunuz?"];
const ctx = $input.item.json;
const cats = Array.isArray(ctx.categories) ? ctx.categories : [];
const qs = q => {
  let list = q;
  if (typeof list === 'string') { try { list = JSON.parse(list); } catch (e) { list = null; } }
  if (!Array.isArray(list) || list.length === 0) list = GENERIC;
  return list.map((s, i) => (i + 1) + '. ' + s).join('\n');
};
const blocks = cats.map(c => '**' + c.label + ' (' + c.agent_code + '):**\nAşağıdaki soruları SIRAYLA, TEK TEK sor:\n' + qs(c.agent_questions));
blocks.push('**Diğer (other):**\nMüşteri yukarıdaki hizmetlerin hiçbirine net şekilde uymayan bir talep gelirse, aşağıdaki genel soruları sor:\n' + qs(null));
const info = (ctx.bot_info || '').trim();
const system = TEMPLATE
  .split('{FIRMA_ADI}').join(ctx.company_name || 'firmamız')
  .replace('{FIRMA_BILGILERI}', info || 'Bu firma için ek bilgi girilmemiş. Firma hakkındaki bütün sorulara: "Bu konuda ekibimiz sizi arayınca bilgi verecek."')
  .replace('{FİRMA_HİZMETLERİ_BURAYA}', '\n\n' + blocks.join('\n\n') + '\n\n');
const lines = (ctx.history || []).map(h => (h.role === 'bot' ? 'Sen' : 'Müşteri') + ': ' + h.body);
const profileName = $('Mesajları Ayır').item.json.p_profile_name;
const ad = ctx.ad || {};
const adText = (ad.headline || ad.body)
  ? 'Müşterinin tıkladığı reklam: ' + [ad.headline, ad.body].filter(Boolean).join(' / ') + '\n\n' : '';
const durum = ctx.phase === 'aftercare' ? 'DURUM: ön görüşme tamamlandı (kapanış mesajı gönderildi). KAPANIŞTAN SONRA kurallarına uy.\n\n' : '';
const prompt = durum + adText + (profileName ? 'Müşterinin WhatsApp profil adı: ' + profileName + '\n\n' : '')
  + 'SOHBET GEÇMİŞİ (en eskiden en yeniye):\n' + lines.join('\n')
  + '\n\nMüşterinin son mesajına kurallara uygun cevabını üret.';
return { json: { ...ctx, system, prompt } };
""".replace("__TEMPLATE__", json.dumps(sp, ensure_ascii=False))


def node(name, type_, ver, pos, params, **extra):
    n = {"id": str(uuid.uuid5(uuid.NAMESPACE_URL, "iklimlen-wa/" + name)), "name": name, "type": type_,
         "typeVersion": ver, "position": pos, "parameters": params}
    n.update(extra)
    return n


def rpc(name, fn, pos, body_expr):
    return node(name, "n8n-nodes-base.httpRequest", 4.2, pos, {
        "method": "POST",
        "url": f"{SUPABASE_URL}/rest/v1/rpc/{fn}",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "supabaseApi",
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": body_expr,
        "options": {"timeout": 15000},
    }, credentials=SUPA_CRED, retryOnFail=True, maxTries=2, waitBetweenTries=1000)


FIX_JS = r"""
// Yapay zeka cevabina son kontrol (istemin unutabilecegi kurallari garantiler):
// ilk mesaj her zaman selamla baslar; bosluklar toparlanir.
const ctx = $('İstemi Hazırla').item.json;
const out = { ...($json.output || {}) };
let r = String(out.reply_to_customer || '').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
const firstTurn = ctx.phase !== 'aftercare' && !(ctx.history || []).some(h => h.role === 'bot');
// Kapanis mesaji her zaman birebir gider (yapay zeka kisaltip bozabiliyor).
const KAPANIS = 'Teşekkür ederim, bilgilerinizi aldım. Ekibimiz ilk müsaitlikte sizi arayıp bilgilendirme sağlayacak.';
if (out.conversation_complete === true && /bilgilerinizi aldım/i.test(r)) {
  const named = r.match(/^(?:Merhaba, )?(Teşekkür ederim [^,.]{2,40} (?:Bey|Hanım)), bilgilerinizi aldım/i);
  r = named ? named[1] + ', bilgilerinizi aldım. Ekibimiz ilk müsaitlikte sizi arayıp bilgilendirme sağlayacak.' : KAPANIS;
}
// "…anlıyorum; Hangi il…" gibi noktalı virgülden sonra büyük harf: cümleyi ayır.
r = r.replace(/; (?=[A-ZÇĞİÖŞÜ])/g, '. ');
const turkce = /[çğıöşüİ]/i.test(r);
if (firstTurn && r && turkce && !/^merhaba/i.test(r)) {
  // Cevap zaten tesekkurle basliyorsa (ör. ilk mesajda kapanis) cift tesekkur olmasin.
  r = /^teşekkür/i.test(r) ? 'Merhaba, t' + r.slice(1) : 'Merhaba, ilginiz için teşekkürler. ' + r;
}
out.reply_to_customer = r;
return { json: { ...$json, output: out } };
"""

FALLBACK_JS = r"""
// Yapay zeka iki denemede de cevap veremezse (OpenAI kesintisi, bozuk cikti)
// musteri sessiz kalmasin: kisa, dogru bir yedek cevap gider. Ayni yedek cevap
// art arda gonderilmez. Hata ayrica Denetim Kaydi'na yazilir (wa_log_error).
const ctx = $('İstemi Hazırla').item.json;
const YEDEK = 'Mesajınızı aldım, ekibimiz en kısa sürede size dönüş yapacak.';
const lastBot = [...(ctx.history || [])].reverse().find(h => h.role === 'bot');
const already = lastBot && String(lastBot.body).includes(YEDEK);
const err = $json.error && ($json.error.message || $json.error.description || String($json.error));
return { json: {
  output: { reply_to_customer: (already || ctx.phase === 'aftercare') ? '' : YEDEK, conversation_complete: false, summary_note: null },
  log: { p_workflow: 'WhatsApp Bot - Çoklu Firma', p_node: 'Bot Cevabı (AI)', p_message: 'Yedek cevap gönderildi: ' + String(err || 'yapay zekâ cevap vermedi').slice(0, 400), p_execution: String($execution.id) },
} };
"""

nodes = [
    node("Meta Doğrulama (GET)", "n8n-nodes-base.webhook", 2, [0, -300], {
        "path": "whatsapp", "httpMethod": "GET", "responseMode": "responseNode", "options": {}},
        webhookId=str(uuid.uuid5(uuid.NAMESPACE_URL, "iklimlen-wa/get"))),
    node("Doğrulama Cevabı", "n8n-nodes-base.respondToWebhook", 1.1, [240, -300], {
        "respondWith": "text", "responseBody": "={{ $json.query['hub.challenge'] || '' }}", "options": {}}),
    node("WhatsApp Mesajı (POST)", "n8n-nodes-base.webhook", 2, [0, 0], {
        "path": "whatsapp", "httpMethod": "POST", "responseMode": "onReceived", "options": {}},
        webhookId=str(uuid.uuid5(uuid.NAMESPACE_URL, "iklimlen-wa/post"))),
    node("Mesajları Ayır", "n8n-nodes-base.code", 2, [240, 0], {"jsCode": PARSE_JS.strip()}),
    rpc("Gelen Mesajı Kaydet (wa_inbound)", "wa_inbound", [480, 0], "={{ JSON.stringify($json) }}"),
    node("Cevap Verilecek mi?", "n8n-nodes-base.if", 2.2, [720, 0], {
        "conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
                       "conditions": [{"id": "c1", "leftValue": "={{ $json.action }}", "rightValue": "reply",
                                       "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"},
        "options": {}}),
    node("Peş Peşe Mesajları Bekle (5 sn)", "n8n-nodes-base.wait", 1.1, [880, -20], {
        "resume": "timeInterval", "amount": 5, "unit": "seconds"}, webhookId=str(uuid.uuid5(uuid.NAMESPACE_URL, "iklimlen-wa/wait"))),
    rpc("Hâlâ Son Mesaj mı? (wa_context)", "wa_context", [1060, -20],
        "={{ JSON.stringify({ p_conversation_id: $json.conversation_id, p_message_id: $json.message_id }) }}"),
    node("Cevaplanacak mı?", "n8n-nodes-base.if", 2.2, [1240, -20], {
        "conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
                       "conditions": [{"id": "c3", "leftValue": "={{ $json.action }}", "rightValue": "reply",
                                       "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"},
        "options": {}}),
    node("İstemi Hazırla", "n8n-nodes-base.code", 2, [1420, -20], {"mode": "runOnceForEachItem", "jsCode": PROMPT_JS.strip()}),
    node("Bot Cevabı (AI)", "@n8n/n8n-nodes-langchain.agent", 3.1, [1660, -20], {
        "promptType": "define", "text": "={{ $json.prompt }}", "hasOutputParser": True,
        "options": {"systemMessage": "={{ $json.system }}"}}, retryOnFail=True, maxTries=2,
        onError="continueErrorOutput"),
    node("Yedek Cevap (AI hata verirse)", "n8n-nodes-base.code", 2, [1860, 160], {"mode": "runOnceForEachItem", "jsCode": FALLBACK_JS.strip()}),
    rpc("Hatayı Kaydet (wa_log_error)", "wa_log_error", [2080, 300], "={{ JSON.stringify($json.log) }}"),
    node("OpenAI Model", "@n8n/n8n-nodes-langchain.lmChatOpenAi", 1.3, [1600, 200], {
        "model": {"__rl": True, "value": "gpt-5.6-luna", "mode": "list", "cachedResultName": "gpt-5.6-luna"},
        "builtInTools": {}, "options": {"timeout": 30000, "maxRetries": 1}}, credentials=OPENAI_CRED),
    node("Çıktı Biçimi", "@n8n/n8n-nodes-langchain.outputParserStructured", 1.3, [1760, 200], {
        "schemaType": "manual", "inputSchema": json.dumps(SCHEMA, ensure_ascii=False, indent=2)}),
    node("Cevabı Düzenle", "n8n-nodes-base.code", 2, [1860, -160], {"mode": "runOnceForEachItem", "jsCode": FIX_JS.strip()}),
    rpc("Cevabı ve Bilgileri Kaydet (wa_bot_reply)", "wa_bot_reply", [1960, -20],
        "={{ JSON.stringify({ p_conversation_id: $('İstemi Hazırla').item.json.conversation_id, "
        "p_reply: $json.output.reply_to_customer, p_fields: $json.output, "
        "p_message_id: $('İstemi Hazırla').item.json.message_id }) }}"),
    node("Gönderilsin mi?", "n8n-nodes-base.if", 2.2, [2200, -20], {
        "conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
                       "conditions": [{"id": "c2", "leftValue": "={{ $json.ok === true && $('İstemi Hazırla').item.json.test_mode === false && !!($('Cevabı Düzenle').item.json.output.reply_to_customer || '').trim() }}",
                                       "rightValue": "", "operator": {"type": "boolean", "operation": "true", "singleValue": True}}],
                       "combinator": "and"}, "options": {}}),
    node("WhatsApp'a Gönder", "n8n-nodes-base.httpRequest", 4.2, [2440, -40], {
        "method": "POST",
        "url": "={{ 'https://graph.facebook.com/v23.0/' + $('İstemi Hazırla').item.json.phone_number_id + '/messages' }}",
        "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
        "sendBody": True, "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ messaging_product: 'whatsapp', to: $('İstemi Hazırla').item.json.to, type: 'text', "
                    "text: { body: $('Cevabı Düzenle').item.json.output.reply_to_customer } }) }}",
        "options": {"timeout": 15000}}, retryOnFail=True, maxTries=3, waitBetweenTries=2000),
    node("Her 30 dakikada", "n8n-nodes-base.scheduleTrigger", 1.2, [0, 360], {
        "rule": {"interval": [{"field": "minutes", "minutesInterval": 30}]}}),
    # 1 saat cevapsiz kalan sohbet kapanir ve lead CRM'e yazilir (musteri 72 saat icinde donerse sohbet devam eder).
    rpc("Yarım Kalanları Kapat (wa_close_stale)", "wa_close_stale", [240, 360], "={{ JSON.stringify({ p_idle: '1 hour' }) }}"),
]

conn = lambda *targets: {"main": [[{"node": t, "type": "main", "index": 0} for t in targets]]}
connections = {
    "Meta Doğrulama (GET)": conn("Doğrulama Cevabı"),
    "WhatsApp Mesajı (POST)": conn("Mesajları Ayır"),
    "Mesajları Ayır": conn("Gelen Mesajı Kaydet (wa_inbound)"),
    "Gelen Mesajı Kaydet (wa_inbound)": conn("Cevap Verilecek mi?"),
    "Cevap Verilecek mi?": {"main": [[{"node": "Peş Peşe Mesajları Bekle (5 sn)", "type": "main", "index": 0}], []]},
    "Peş Peşe Mesajları Bekle (5 sn)": conn("Hâlâ Son Mesaj mı? (wa_context)"),
    "Hâlâ Son Mesaj mı? (wa_context)": conn("Cevaplanacak mı?"),
    "Cevaplanacak mı?": {"main": [[{"node": "İstemi Hazırla", "type": "main", "index": 0}], []]},
    "İstemi Hazırla": conn("Bot Cevabı (AI)"),
    "OpenAI Model": {"ai_languageModel": [[{"node": "Bot Cevabı (AI)", "type": "ai_languageModel", "index": 0}]]},
    "Çıktı Biçimi": {"ai_outputParser": [[{"node": "Bot Cevabı (AI)", "type": "ai_outputParser", "index": 0}]]},
    "Bot Cevabı (AI)": {"main": [[{"node": "Cevabı Düzenle", "type": "main", "index": 0}],
                                 [{"node": "Yedek Cevap (AI hata verirse)", "type": "main", "index": 0}]]},
    "Yedek Cevap (AI hata verirse)": conn("Cevabı Düzenle", "Hatayı Kaydet (wa_log_error)"),
    "Cevabı Düzenle": conn("Cevabı ve Bilgileri Kaydet (wa_bot_reply)"),
    "Cevabı ve Bilgileri Kaydet (wa_bot_reply)": conn("Gönderilsin mi?"),
    "Gönderilsin mi?": {"main": [[{"node": "WhatsApp'a Gönder", "type": "main", "index": 0}], []]},
    "Her 30 dakikada": conn("Yarım Kalanları Kapat (wa_close_stale)"),
}

wf = {"name": "WhatsApp Bot - Çoklu Firma", "nodes": nodes, "connections": connections,
      "settings": {"executionOrder": "v1", "timezone": "Europe/Istanbul",
                   **({"errorWorkflow": ERROR_WF_ID} if ERROR_WF_ID else {})}}
json.dump(wf, open(OUT, "w"), ensure_ascii=False, indent=2)
print("ok", len(nodes), "node,", len(sp), "karakter istem")
