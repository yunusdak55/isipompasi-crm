#!/bin/bash
# GUNLUK OTOMATIK YEDEK - launchd tarafindan cagrilir (bkz. ~/Library/LaunchAgents/com.iklimlen.dbbackup.plist).
# launchd, kabuk PATH'ini/nvm'i devralmadigi icin node'un TAM yolu sabit kodlanir.
# Betik CANLI projeyi yedekler (.env.production-backup.local); hedef canli degilse durur
# (bkz. scripts/backup-db.mjs). Basarisiz olursa ekranda bildirim cikar - sessizce
# gecistirilmesin (02-05 Ekim 2026: 4 gece fark edilmeden canli yedek alinmadi).
set -uo pipefail
cd "/Users/yunusdak/Projects/iklimlen-crm"
echo "--- $(date '+%Y-%m-%d %H:%M:%S') gecelik yedek ---"
if ! /Users/yunusdak/.nvm/versions/node/v24.21.0/bin/node scripts/backup-db.mjs; then
  /usr/bin/osascript -e 'display notification "Gece yedeğinde sorun var. Ayrıntı: ~/Library/Logs/iklimlen-backup.log" with title "İklimlen CRM yedeği" sound name "Basso"' || true
  exit 1
fi
