#!/bin/bash
# GUNLUK OTOMATIK YEDEK - launchd tarafindan cagrilir (bkz. ~/Library/LaunchAgents/com.iklimlen.dbbackup.plist).
# launchd, kabuk PATH'ini/nvm'i devralmadigi icin node'un TAM yolu sabit kodlanir.
set -euo pipefail
cd "/Users/yunusdak/Projects/iklimlen-crm"
/Users/yunusdak/.nvm/versions/node/v24.21.0/bin/node scripts/backup-db.mjs
