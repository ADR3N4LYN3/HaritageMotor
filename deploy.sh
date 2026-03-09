#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════
# Heritage Motor — Deploy / Redeploy
# Usage: ./deploy.sh
# ═══════════════════════════════════════════════════════════════

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$PROJECT_DIR/.env.prod"
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.prod"

cd "$PROJECT_DIR"

# Verify prerequisites
if ! command -v docker &>/dev/null; then
    echo "ERROR: Docker not installed. Run ./setup.sh first."
    exit 1
fi
if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: .env.prod not found. Run ./setup.sh first."
    exit 1
fi

# Load env vars for use in this script
set -a; source "$ENV_FILE"; set +a

echo "=== Heritage Motor — Deploy ==="

# Build images
echo "-> Building images..."
$COMPOSE build --no-cache

# Start PostgreSQL first and wait for healthy
echo "-> Starting PostgreSQL..."
$COMPOSE up -d postgres
echo "-> Waiting for PostgreSQL..."
for i in $(seq 1 30); do
    if $COMPOSE exec postgres pg_isready -U "$POSTGRES_USER" &>/dev/null; then
        break
    fi
    sleep 1
done

# Run migrations
echo "-> Running migrations..."
$COMPOSE run --rm api ./api migrate

# Start all services
echo "-> Starting services..."
$COMPOSE up -d

# Cleanup
echo "-> Cleaning old images..."
docker image prune -f

echo ""
echo "=== Deploy complete ==="
echo "   Landing : https://heritagemotor.app"
echo "   API     : https://api.heritagemotor.app/health"
echo "   App     : https://app.heritagemotor.app"
echo ""
echo "   Logs    : $COMPOSE logs -f"
echo "   Status  : $COMPOSE ps"
