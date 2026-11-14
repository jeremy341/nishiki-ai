#!/usr/bin/env bash
# Consistent SQLite backup (safe while the app runs) + keeps the last 14 copies.
# Also copy .env somewhere safe, separately: it holds the keys and ENCRYPTION_KEY.
set -euo pipefail
APP_DIR=${APP_DIR:-/opt/friend-ai}
OUT_DIR=${OUT_DIR:-/var/backups/friend-ai}
mkdir -p "$OUT_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
node -e "
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync('$APP_DIR/data/app.db');
  db.exec(\"VACUUM INTO '$OUT_DIR/app-$STAMP.db'\");
  db.close();
"
ls -1t "$OUT_DIR"/app-*.db 2>/dev/null | tail -n +15 | xargs -r rm --
echo "backup written: $OUT_DIR/app-$STAMP.db"
