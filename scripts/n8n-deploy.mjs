#!/usr/bin/env node
/**
 * n8n/whatsapp-bot.json'u n8n'e yukler (ayni isimde workflow varsa gunceller,
 * yoksa olusturur). Kullanim:
 *   node scripts/n8n-deploy.mjs            # yukle
 *   node scripts/n8n-deploy.mjs --activate # yukle + aktif et
 *
 * API anahtari ~/.config/iklimlen/n8n.env dosyasindan okunur (N8N_API_KEY=...),
 * repoya ya da ekrana ASLA yazilmaz. Sunucu: N8N_URL (varsayilan asagida).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const envFile = path.join(os.homedir(), ".config/iklimlen/n8n.env");
const env = Object.fromEntries(
  fs
    .readFileSync(envFile, "utf8")
    .split("\n")
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()])
);
const KEY = env.N8N_API_KEY;
const BASE = (env.N8N_URL || "https://n8n-7jne.iklimlen.com").replace(/\/$/, "");
if (!KEY) throw new Error(`${envFile} icinde N8N_API_KEY yok`);

const file = new URL("../n8n/whatsapp-bot.json", import.meta.url);
const wf = JSON.parse(fs.readFileSync(file, "utf8"));
const body = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings };

async function api(method, p, data) {
  const res = await fetch(`${BASE}/api/v1${p}`, {
    method,
    headers: { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" },
    body: data ? JSON.stringify(data) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${p} -> ${res.status} ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

const list = await api("GET", "/workflows?limit=250");
const existing = list.data.find((w) => w.name === wf.name);

// n8n ekraninda elle secilen kimlik bilgileri (or. "WhatsApp'a Gonder" dugumundeki
// Meta token'i) dosyada yok; guncellemede silinmesinler diye mevcut workflow'dan
// ayni isimli dugumlere tasinir. (Yalnizca kimlik bilgisi ID/adi; token degil.)
if (existing) {
  const live = await api("GET", `/workflows/${existing.id}`);
  for (const node of body.nodes) {
    const liveNode = live.nodes.find((n) => n.name === node.name);
    if (liveNode?.credentials && !node.credentials) node.credentials = liveNode.credentials;
  }
}
const saved = existing ? await api("PUT", `/workflows/${existing.id}`, body) : await api("POST", "/workflows", body);
console.log(`${existing ? "guncellendi" : "olusturuldu"}: ${saved.id} (${saved.name})`);

if (process.argv.includes("--activate")) {
  await api("POST", `/workflows/${saved.id}/activate`);
  console.log("aktif");
}
console.log(`Webhook: ${BASE}/webhook/whatsapp`);
