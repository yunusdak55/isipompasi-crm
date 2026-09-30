/**
 * KOK SEBEP DUZELTMESI, 2. ADIM (bkz. scripts/sync-static-assets.mjs'teki asil
 * gerekce). Canli dogrulama (2026-09-30): o script "postbuild" olarak `npm run
 * build` sirasinda calisiyor ve BASARILI log basiyor, AMA Hostinger'in build
 * ortami (build sandbox) ile gercekte trafik sunulan Passenger sureci FARKLI
 * dosya sistemleri kullaniyor gibi gorunuyor - build sirasinda public_html'e
 * yazilan dosyalar canli dosya sisteminde HICBIR ZAMAN gorunmedi (hPanel Dosya
 * Yoneticisi ile dogrulandi: build log'u "88 dosya eklendi" dese de, deploy
 * sonrasi public_html/_next/static klasoru YOKTU).
 *
 * `register()` ise Next.js'in GERCEK SUNUCU SURECI (Passenger'in calistirdigi,
 * `server.js` -> `next start`) ilk istegi karsilamadan ONCE, TAM O SUREC
 * icinde bir kere calisir - yani KESINLIKLE canli/kalici dosya sistemine
 * yazar (bu surecin kendisi zaten panel.iklimlen.com'a hizmet veren surec).
 * Build script'i (postbuild) zararsiz/gereksiz bir "en iyi ihtimalle" katman
 * olarak KALDI - asil garanti burada.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DOMAIN = "panel.iklimlen.com";
const RETENTION_DAYS = 14;

function log(msg: string) {
  console.log(`[instrumentation:sync-static-assets] ${msg}`);
}

function pruneOldFiles(dir: string, cutoffMs: number): number {
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

function copyNewFiles(srcDir: string, destDir: string): number {
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

function syncStaticAssets() {
  const projectStaticDir = path.join(process.cwd(), ".next", "static");
  const publicHtmlDir = path.join(os.homedir(), "domains", DOMAIN, "public_html");
  const targetStaticDir = path.join(publicHtmlDir, "_next", "static");

  if (!fs.existsSync(publicHtmlDir) || !fs.existsSync(projectStaticDir)) {
    log("Hostinger disinda calisiliyor olmali (public_html veya .next/static yok) - atlaniyor.");
    return;
  }

  if (fs.existsSync(targetStaticDir)) {
    const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const pruned = pruneOldFiles(targetStaticDir, cutoffMs);
    if (pruned > 0) log(`${pruned} adet ${RETENTION_DAYS} gunden eski dosya budandi.`);
  }

  const copied = copyNewFiles(projectStaticDir, targetStaticDir);
  log(`${copied} yeni statik dosya "${targetStaticDir}" altina eklendi (birikimli, mevcutlar korunuyor).`);

  fs.writeFileSync(
    path.join(targetStaticDir, ".htaccess"),
    '<IfModule mod_headers.c>\n  Header set Cache-Control "public, max-age=31536000, immutable"\n</IfModule>\n'
  );
}

export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    syncStaticAssets();
  } catch (e) {
    // Bu adim basarisiz olsa bile sunucu ACILMAYA DEVAM ETMELI - en kotu
    // ihtimalle eski sekmeler icin reload-fallback'e (chunk-load-recovery.ts)
    // geri duseriz, ama site ASLA ayaga kalkmamazlik etmemeli.
    console.error("[instrumentation:sync-static-assets] basarisiz, sunucu yine de baslatiliyor:", e);
  }
}
