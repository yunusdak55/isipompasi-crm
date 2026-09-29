#!/usr/bin/env node
/**
 * KOK SEBEP MIMARI DUZELTMESI (2026-09-30, "donma" = ChunkLoadError kanitlandi,
 * bkz. lib/chunk-load-recovery.ts): Hostinger'in Node.js dagitim sistemi
 * (Phusion Passenger, sembolik link tabanli: hbuilds/current -> versions/<uuid>)
 * HER yeni deploy'da bir onceki `versions/<uuid>` klasorunu TAMAMEN SILIYOR -
 * canli dogrulandi (9+ deploy sonrasi versions/ altinda TEK klasor vardi).
 * Next.js'in icerik-hash'li JS/CSS parcalari (.next/static/chunks/*) o klasorun
 * icinde oldugu icin, ESKI bir sekmede acik kalan bir sayfa yeni bir deploy'dan
 * SONRA bir chunk istedi mi, o dosya artik sunucuda YOK - ChunkLoadError,
 * kullaniciya "donma" (webpack varsayilani: 2 dakika bekleme) olarak yansir.
 *
 * KANIT + COZUM: canli dogrulandi (Chrome ile), Apache/LiteSpeed (Passenger'in
 * onunde) bir istegi Node'a yonlendirmeden ONCE `public_html/` icinde ayni
 * yolda bir statik dosya olup olmadigina bakiyor - varsa DOGRUDAN onu
 * sunuyor, Node'a hic ugramiyor. `public_html` ise Node app'in dagitim
 * dizininin (hbuilds/) TAMAMEN DISINDA - hicbir deploy ona dokunmuyor.
 *
 * Bu betik HER `npm run build`'den SONRA (package.json: "postbuild") otomatik
 * calisir: o build'in ürettigi .next/static/* dosyalarini public_html/_next/static/
 * altina KOPYALAR (VAR OLANI ASLA SILMEZ/UZERINE YAZMAZ - dosya adlari icerik-hash'li
 * oldugu icin ayni ad = ayni icerik, cakisma yok). Sonuc: N. deploy'un
 * dosyalari (N-1). deploy'dan SONRA bile hala erisilebilir kaliyor - eski
 * sekme SESSIZCE calismaya devam ediyor, ChunkLoadError hic olusmuyor.
 *
 * Disk sismesin diye RETENTION_DAYS'ten eski dosyalar her calistiginda budanir
 * (bu kadar uzun sure acik kalmis BIR sekme icin reload-fallback zaten var,
 * bkz. lib/chunk-load-recovery.ts).
 *
 * Hostinger DISINDA (yerel gelistirme, farkli bir platform) public_html yolu
 * bulunamazsa betik SESSIZCE (build'i KIRMADAN) hicbir sey yapmadan biter.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DOMAIN = "panel.iklimlen.com";
const RETENTION_DAYS = 14;

const projectStaticDir = path.join(process.cwd(), ".next", "static");
const publicHtmlDir = path.join(os.homedir(), "domains", DOMAIN, "public_html");
const targetStaticDir = path.join(publicHtmlDir, "_next", "static");

function log(msg) {
  console.log(`[sync-static-assets] ${msg}`);
}

if (!fs.existsSync(publicHtmlDir)) {
  log(`"${publicHtmlDir}" bulunamadi - Hostinger disinda calisiliyor olmali, atlaniyor.`);
  process.exit(0);
}

if (!fs.existsSync(projectStaticDir)) {
  log(`"${projectStaticDir}" yok - once "next build" calismali, atlaniyor.`);
  process.exit(0);
}

function pruneOldFiles(dir, cutoffMs) {
  let pruned = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      pruned += pruneOldFiles(fullPath, cutoffMs);
      if (fs.readdirSync(fullPath).length === 0) fs.rmdirSync(fullPath);
    } else if (fs.statSync(fullPath).mtimeMs < cutoffMs) {
      fs.unlinkSync(fullPath);
      pruned++;
    }
  }
  return pruned;
}

function copyNewFiles(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  let copied = 0;
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copied += copyNewFiles(srcPath, destPath);
    } else if (!fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath);
      copied++;
    }
  }
  return copied;
}

if (fs.existsSync(targetStaticDir)) {
  const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const pruned = pruneOldFiles(targetStaticDir, cutoffMs);
  if (pruned > 0) log(`${pruned} adet ${RETENTION_DAYS} gunden eski dosya budandi.`);
}

const copied = copyNewFiles(projectStaticDir, targetStaticDir);
log(`${copied} yeni statik dosya "${targetStaticDir}" altina eklendi (birikimli, mevcutlar korunuyor).`);

/**
 * Apache bu klasordeki dosyalari (public_html icinde oldugu icin) Node'a hic
 * sormadan DOGRUDAN sunuyor (canli dogrulandi) - yani Next.js'in normalde
 * bu yollara koydugu `Cache-Control: public, max-age=31536000, immutable`
 * basligini ARTIK KENDIMIZ vermeliyiz, aksi halde tarayici bu icerik-hash'li
 * (dolayisiyla gercekten degismez) dosyalari gereksiz yere tekrar tekrar
 * dogrulardi. HTML/RSC yanitlari bu klasorden GECMEZ (onlar hep Node/proxy.ts
 * uzerinden dinamik render edilir) - yani bu SADECE hash'li statik varliklari
 * etkiler, sayfa icerigini asla "immutable" yapmaz.
 */
const htaccessPath = path.join(targetStaticDir, ".htaccess");
fs.writeFileSync(
  htaccessPath,
  '<IfModule mod_headers.c>\n  Header set Cache-Control "public, max-age=31536000, immutable"\n</IfModule>\n'
);
