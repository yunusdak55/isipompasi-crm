"""n8n/hata-kaydi.json ureteci: WhatsApp botunda bir adim hata verince (Supabase'e ulasilamadi,
WhatsApp'a gonderilemedi...) n8n bu workflow'u calistirir; hata admin panelinde Denetim Kaydi'na
"Bot hatası" olarak yazilir (public.wa_log_error, migration 0041). n8n 2.x'te hata workflow'u
AKTIF (yayinda) olmali, yoksa hic calismaz (2026-11-11 denendi) - bu yuzden --activate.

Kullanim: python3 n8n/build-hata-kaydi.py n8n/hata-kaydi.json && node scripts/n8n-deploy.mjs n8n/hata-kaydi.json --activate
"""
import json, sys, uuid

OUT = sys.argv[1]
SUPABASE_URL = "https://dhnwcvirgnkpnlrurdap.supabase.co"
SUPA_CRED = {"supabaseApi": {"id": "jHSd1FJtTriSFKqE", "name": "Supabase account"}}


def node(name, type_, ver, pos, params, **extra):
    n = {"id": str(uuid.uuid5(uuid.NAMESPACE_URL, "iklimlen-wa-hata/" + name)), "name": name, "type": type_,
         "typeVersion": ver, "position": pos, "parameters": params}
    n.update(extra)
    return n


BODY = ("={{ JSON.stringify({ p_workflow: $json.workflow && $json.workflow.name, "
        "p_node: $json.execution && $json.execution.lastNodeExecuted, "
        "p_message: (function(e){ e = e || {}; return [e.message, e.description].filter(Boolean).join(': ') || 'bilinmeyen hata'; })($json.execution && $json.execution.error), "
        "p_execution: String(($json.execution && $json.execution.id) || '') }) }}")

nodes = [
    node("Botta Hata Oldu", "n8n-nodes-base.errorTrigger", 1, [0, 0], {}),
    node("Denetim Kaydına Yaz (wa_log_error)", "n8n-nodes-base.httpRequest", 4.2, [240, 0], {
        "method": "POST", "url": SUPABASE_URL + "/rest/v1/rpc/wa_log_error",
        "authentication": "predefinedCredentialType", "nodeCredentialType": "supabaseApi",
        "sendBody": True, "specifyBody": "json", "jsonBody": BODY,
        "options": {"timeout": 15000}}, credentials=SUPA_CRED, retryOnFail=True, maxTries=3, waitBetweenTries=2000),
]
connections = {"Botta Hata Oldu": {"main": [[{"node": "Denetim Kaydına Yaz (wa_log_error)", "type": "main", "index": 0}]]}}
wf = {"name": "WhatsApp Bot - Hata Kaydı", "nodes": nodes, "connections": connections,
      "settings": {"executionOrder": "v1", "timezone": "Europe/Istanbul"}}
json.dump(wf, open(OUT, "w"), ensure_ascii=False, indent=2)
print("ok", len(nodes), "node")
