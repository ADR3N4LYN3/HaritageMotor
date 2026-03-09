#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════
# Heritage Motor — Deploy / Redeploy
# Usage: ./deploy.sh
# ═══════════════════════════════════════════════════════════════

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$PROJECT_DIR/.env"

cd "$PROJECT_DIR"

# Verify prerequisites
if ! command -v docker &>/dev/null; then
    echo "ERROR: Docker not installed. Run ./setup.sh first."
    exit 1
fi
if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: .env not found. Run ./setup.sh first."
    exit 1
fi

# Load env vars for use in this script
set -a; source "$ENV_FILE"; set +a

echo "=== Heritage Motor — Deploy ==="

# Build images
echo "-> Building images..."
docker compose build

# Start PostgreSQL first and wait for healthy
echo "-> Starting PostgreSQL..."
docker compose up -d postgres
echo "-> Waiting for PostgreSQL..."
for i in $(seq 1 30); do
    if docker compose exec postgres pg_isready -U "$POSTGRES_USER" &>/dev/null; then
        break
    fi
    sleep 1
done

# Create/update heritage_app role with the production password.
# Password is validated hex-only to prevent SQL injection (setup.sh generates via openssl rand -hex).
if [ -n "$APP_DB_PASSWORD" ]; then
    if ! echo "$APP_DB_PASSWORD" | grep -qE '^[0-9a-fA-F]+$'; then
        echo "ERROR: APP_DB_PASSWORD contains invalid characters. Regenerate with: openssl rand -hex 32"
        exit 1
    fi
    echo "-> Configuring heritage_app role..."
    docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
        "DO \$\$ BEGIN
           IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'heritage_app') THEN
             CREATE ROLE heritage_app LOGIN PASSWORD '${APP_DB_PASSWORD}';
           ELSE
             ALTER ROLE heritage_app PASSWORD '${APP_DB_PASSWORD}';
           END IF;
         END \$\$;"
fi

# Run migrations
echo "-> Running migrations..."
docker compose run --rm api ./api migrate

# Start all services
echo "-> Starting services..."
docker compose up -d

# Cleanup
echo "-> Cleaning old images..."
docker image prune -f

echo ""
echo "=== Deploy complete ==="
echo "   Landing : https://heritagemotor.app"
echo "   API     : https://api.heritagemotor.app/health"
echo "   App     : https://app.heritagemotor.app"
echo "   Stats   : https://stats.heritagemotor.app"
echo ""
echo "   Logs    : docker compose logs -f"
echo "   Status  : docker compose ps"
