#!/bin/bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════
# Heritage Motor — Bootstrap Superadmin
# Usage: ./bootstrap.sh
# Idempotent — safe to re-run.
# ═══════════════════════════════════════════════════════════════

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# Load superadmin vars from .env if present
if [ -f .env ]; then
  eval "$(grep -E '^SUPERADMIN_EMAIL=|^SUPERADMIN_PASSWORD=' .env | sed 's/^/export /')"
fi

# Verify required variables
: "${SUPERADMIN_EMAIL:?SUPERADMIN_EMAIL required in .env}"
: "${SUPERADMIN_PASSWORD:?SUPERADMIN_PASSWORD required in .env}"

echo "-> Creating superadmin: $SUPERADMIN_EMAIL"

docker compose exec -T \
  -e SUPERADMIN_EMAIL="$SUPERADMIN_EMAIL" \
  -e SUPERADMIN_PASSWORD="$SUPERADMIN_PASSWORD" \
  api ./bootstrap

echo "-> Bootstrap complete."
